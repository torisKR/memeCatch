//! `POST /api/upload` and `POST /api/mpe/uploads` over HTTP, against the
//! S3 gateway (`common::s3`) and the test database, with real session rows.
//! `parity/uploads.mjs` compares the same cases with Next.
//!
//! Tests named `..._db_...` need the test database
//! (`export DATABASE_URL="$(scripts/test-db.sh up)"`) and Docker.

mod common;

use std::net::SocketAddr;

use axum::body::{Body, Bytes};
use axum::http::StatusCode;
use common::s3::S3Server;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{Reply, UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app};
use futures_util::stream;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const SITE_URL: &str = "https://memes.example";
const BOUNDARY: &str = "----axumuploadtest";
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
/// What `readBoundedFormData` may read in both routes: 20 MiB + 128 KiB.
const BODY_LIMIT: usize = 20 * 1024 * 1024 + 128 * 1024;
const APP_ENV: [(&str, &str); 3] = [
    ("NEXT_PUBLIC_SITE_URL", SITE_URL),
    ("RELEASE_SHA", "abc123"),
    ("NODE_ENV", "development"),
];
const FORM_TYPE: (&str, &str) = (
    "content-type",
    "multipart/form-data; boundary=----axumuploadtest",
);

type Part<'a> = (&'a str, Option<(&'a str, &'a str)>, &'a [u8]);

/// A multipart body: `(name, Some((filename, type)) or None, content)`.
fn multipart(parts: &[Part<'_>]) -> Vec<u8> {
    let mut body = Vec::new();
    for (name, file, content) in parts {
        body.extend_from_slice(format!("--{BOUNDARY}\r\n").as_bytes());
        let disposition = match file {
            Some((filename, kind)) => format!(
                "Content-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\nContent-Type: {kind}\r\n"
            ),
            None => format!("Content-Disposition: form-data; name=\"{name}\"\r\n"),
        };
        body.extend_from_slice(disposition.as_bytes());
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(content);
        body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{BOUNDARY}--\r\n").as_bytes());
    body
}

fn error(code: &str) -> String {
    format!(r#"{{"ok":false,"error":"{code}"}}"#)
}

struct Fixture {
    gateway: S3Server,
    app: SocketAddr,
    db: Db,
}

/// The app with objects in the gateway and the test database, in front of
/// an upstream that answers 418.
async fn fixture(extra: &[(&str, &str)]) -> Fixture {
    let gateway = S3Server::start().await;
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("create the better-auth tables");
    let upstream = marker_upstream().await;
    let env = [&APP_ENV[..], extra].concat();
    let config = gateway.app_config(upstream, &database_url(), &gateway.secret_key, &env);
    let mut state = AppState::new(config).expect("app state");
    state.storage = gateway.storage();
    let app = common::spawn_router(build_app(state)).await;
    Fixture { gateway, app, db }
}

/// A user with a session: the id and the cookie header value.
async fn signed_in(db: &Db) -> (String, String) {
    let user = create_user(db.pool()).await;
    let token = create_session(db.pool(), &user, 3_600.0).await;
    (user.id, signed_cookie(PLAIN, &token, SECRET))
}

/// One number from one statement about `user`, as `service_role`.
async fn service_number(db: &Db, sql: &'static str, user: &str) -> i64 {
    let user = user.to_owned();
    let result: Result<i64, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_scalar(sql).bind(user).fetch_one(tx).await }),
        )
        .await;
    result.expect("read test rows")
}

/// The `reserve_api_request` calls `user` made for `upload`, and for
/// `mpe_upload_storage`.
async fn api_requests(db: &Db, user: &str) -> (i64, i64) {
    let count = |action| {
        format!(
            "select coalesce(sum(request_count), 0)::int8 from public.api_rate_limits where user_id = $1::uuid and action = '{action}'"
        )
    };
    let upload: &'static str = count("upload").leak();
    let mpe: &'static str = count("mpe_upload_storage").leak();
    (
        service_number(db, upload, user).await,
        service_number(db, mpe, user).await,
    )
}

async fn post(app: SocketAddr, path: &str, cookie: &str, body: impl Into<Body>) -> Reply {
    let headers = [("origin", SITE_URL), ("cookie", cookie), FORM_TYPE];
    send(app, "POST", path, &headers, body).await
}

#[tokio::test]
async fn an_image_is_put_in_r2_under_the_users_folder_and_metered_db() {
    let fixture = fixture(&[]).await;
    let (user, cookie) = signed_in(&fixture.db).await;
    let body = multipart(&[("file", Some(("a.png", "image/png")), PNG)]);

    let reply = post(fixture.app, "/api/upload", &cookie, body).await;

    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert_eq!(reply.header("content-type"), Some("application/json"));
    let body: serde_json::Value = serde_json::from_str(&reply.body).unwrap();
    let path = body["path"].as_str().unwrap();
    let file = path
        .strip_prefix(&format!("meme-uploads/{user}/"))
        .expect(path);
    // `<randomUUID()>.png`: 36 characters, version 4.
    assert!(
        file.len() == 40 && file.ends_with(".png") && &file[14..15] == "4",
        "{file}"
    );
    let stored = fixture
        .gateway
        .storage()
        .get("meme-uploads", &path["meme-uploads/".len()..])
        .await
        .unwrap()
        .expect("the object is in R2");
    assert_eq!(stored.bytes, Bytes::from_static(PNG));
    assert_eq!(stored.content_type, "image/png");
    assert_eq!(api_requests(&fixture.db, &user).await, (1, 0));
    let quota = "select reserved_bytes from public.community_upload_storage_quota where scope = 'user:' || $1";
    assert_eq!(
        service_number(&fixture.db, quota, &user).await,
        PNG.len() as i64
    );
}

#[tokio::test]
async fn the_checks_answer_as_the_route_does_db() {
    let fixture = fixture(&[]).await;
    let (_, cookie) = signed_in(&fixture.db).await;
    let gif: &[u8] = b"GIF89a....";
    let big_png = [PNG, &vec![0; 5 * 1024 * 1024]].concat();
    let cases: [(&str, Vec<u8>, StatusCode, &str); 6] = [
        (
            "no file",
            multipart(&[("x", None, b"1")]),
            StatusCode::BAD_REQUEST,
            "no_file",
        ),
        (
            "a text field named file",
            multipart(&[("file", None, PNG)]),
            StatusCode::BAD_REQUEST,
            "no_file",
        ),
        (
            "a type not listed",
            multipart(&[("file", Some(("a.bmp", "image/bmp")), PNG)]),
            StatusCode::BAD_REQUEST,
            "invalid_type",
        ),
        (
            "bytes that are not the type",
            multipart(&[("file", Some(("a.gif", "image/png")), gif)]),
            StatusCode::BAD_REQUEST,
            "invalid_type",
        ),
        (
            "an image over 5 MiB",
            multipart(&[("file", Some(("a.png", "image/png")), &big_png)]),
            StatusCode::BAD_REQUEST,
            "too_large",
        ),
        (
            "not a form",
            b"{}".to_vec(),
            StatusCode::BAD_REQUEST,
            "no_file",
        ),
    ];
    for (name, body, status, code) in cases {
        let reply = post(fixture.app, "/api/upload", &cookie, body).await;
        assert_eq!(reply.status, status, "{name}: {}", reply.body);
        assert_eq!(reply.body, error(code), "{name}");
    }
}

#[tokio::test]
async fn a_body_one_byte_over_the_limit_is_refused_before_it_is_stored_db() {
    let fixture = fixture(&[]).await;
    let (user, cookie) = signed_in(&fixture.db).await;
    let headers = [("origin", SITE_URL), ("cookie", cookie.as_str()), FORM_TYPE];
    let chunk = 65_536;

    // Declared: refused on the header, before a byte is read.
    let over = vec![b'a'; BODY_LIMIT + 1];
    let declared = send(fixture.app, "POST", "/api/upload", &headers, over).await;
    // Not declared (chunked): refused once byte 20 MiB + 128 KiB + 1 arrives.
    let chunks = (0..=BODY_LIMIT / chunk).map(move |index| {
        let size = if index == BODY_LIMIT / chunk {
            BODY_LIMIT % chunk + 1
        } else {
            chunk
        };
        Ok::<_, std::io::Error>(Bytes::from(vec![b'a'; size]))
    });
    let streamed = Body::from_stream(stream::iter(chunks));
    let streamed = send(fixture.app, "POST", "/api/mpe/uploads", &headers, streamed).await;
    // Exactly the limit is read, and is no form.
    let at_limit = vec![b'a'; BODY_LIMIT];
    let at_limit = send(fixture.app, "POST", "/api/upload", &headers, at_limit).await;

    assert_eq!(declared.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(declared.body, error("too_large"));
    assert_eq!(streamed.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(streamed.body, error("file_too_large"));
    assert_eq!(at_limit.status, StatusCode::BAD_REQUEST);
    assert_eq!(at_limit.body, error("no_file"));
    // Each was metered first, as in the TypeScript; nothing was stored.
    assert_eq!(api_requests(&fixture.db, &user).await, (2, 1));
    let storage = fixture.gateway.storage();
    let listed = storage.list("meme-uploads", &user).await.unwrap();
    assert!(listed.is_empty(), "{listed:?}");
}

/// Sends `head` and `body` on one connection and reads until it closes.
async fn raw(app: SocketAddr, head: &str, body: &[u8]) -> String {
    let mut socket = TcpStream::connect(app).await.expect("connect");
    socket.write_all(head.as_bytes()).await.expect("write head");
    socket.write_all(body).await.expect("write body");
    let mut answer = Vec::new();
    socket.read_to_end(&mut answer).await.expect("read");
    String::from_utf8_lossy(&answer).into_owned()
}

#[tokio::test]
async fn a_client_that_sends_more_than_it_declares_gets_only_what_it_declared_read_db() {
    let fixture = fixture(&[]).await;
    let (user, cookie) = signed_in(&fixture.db).await;
    // A whole valid form follows, but only its first 64 bytes are declared.
    let body = multipart(&[("file", Some(("a.png", "image/png")), PNG)]);
    let head = format!(
        "POST /api/upload HTTP/1.1\r\nHost: x\r\nOrigin: {SITE_URL}\r\nCookie: {cookie}\r\nContent-Type: multipart/form-data; boundary={BOUNDARY}\r\nContent-Length: 64\r\nConnection: close\r\n\r\n"
    );

    let answer = raw(fixture.app, &head, &body).await;

    assert!(
        answer.starts_with("HTTP/1.1 400 Bad Request\r\n"),
        "{answer}"
    );
    assert!(answer.contains(&error("no_file")), "{answer}");
    let storage = fixture.gateway.storage();
    let listed = storage.list("meme-uploads", &user).await.unwrap();
    assert!(listed.is_empty(), "{listed:?}");
}

#[tokio::test]
async fn an_mpe_upload_is_stored_then_removed_when_the_ingestion_fails_db() {
    let fixture = fixture(&[]).await;
    let (user, cookie) = signed_in(&fixture.db).await;
    let rights: &[u8] = br#"{"accepted":true}"#;
    let mp4: &[u8] = b"\0\0\0\x18ftypisom\0\0\x02\0isomiso2";
    let body = multipart(&[
        ("rightsDeclaration", None, rights),
        ("file", Some(("a.mp4", "video/mp4")), mp4),
    ]);

    let reply = post(fixture.app, "/api/mpe/uploads", &cookie, body).await;

    // create_media_ingestion requires a storage.objects row that nothing
    // writes, so the TypeScript fails here too and removes what it stored.
    assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(reply.body, error("ingestion_failed"));
    let storage = fixture.gateway.storage();
    let listed = storage.list("mpe-temporary", &user).await.unwrap();
    assert!(listed.is_empty(), "{listed:?}");
    assert_eq!(api_requests(&fixture.db, &user).await, (0, 1));
}

#[tokio::test]
async fn the_mpe_checks_answer_as_the_route_does_db() {
    let fixture = fixture(&[]).await;

    let rights: Part = ("rightsDeclaration", None, br#"{"accepted":true}"#);
    let refused: Part = ("rightsDeclaration", None, br#"{"accepted":"yes"}"#);
    let png: Part = ("file", Some(("a.png", "image/png")), PNG);
    let as_gif: Part = ("file", Some(("a.png", "image/gif")), PNG);
    let empty: Part = ("file", Some(("a.png", "image/png")), b"");
    let cases: [(&str, Vec<Part>, StatusCode, &str); 6] = [
        (
            "no file",
            vec![rights],
            StatusCode::BAD_REQUEST,
            "file_required",
        ),
        (
            "no rights",
            vec![png],
            StatusCode::BAD_REQUEST,
            "rights_required",
        ),
        (
            "rights not accepted",
            vec![png, refused],
            StatusCode::BAD_REQUEST,
            "rights_required",
        ),
        (
            "a source",
            vec![png, rights, ("sourceId", None, b"")],
            StatusCode::BAD_REQUEST,
            "source_not_allowed",
        ),
        (
            "a declared type that is not the bytes",
            vec![as_gif, rights],
            StatusCode::BAD_REQUEST,
            "mime_mismatch",
        ),
        (
            "an empty file",
            vec![empty, rights],
            StatusCode::BAD_REQUEST,
            "empty_file",
        ),
    ];
    // Five a minute per user: each case has its own.
    for (name, parts, status, code) in cases {
        let (_, cookie) = signed_in(&fixture.db).await;
        let reply = post(fixture.app, "/api/mpe/uploads", &cookie, multipart(&parts)).await;
        assert_eq!(reply.status, status, "{name}: {}", reply.body);
        assert_eq!(reply.body, error(code), "{name}");
    }
}

#[tokio::test]
async fn the_limit_in_memory_answers_429_with_retry_after_db() {
    let fixture = fixture(&[]).await;
    let (_, cookie) = signed_in(&fixture.db).await;
    // Five MPE uploads a minute; a request without a file counts.
    for _ in 0..5 {
        let reply = post(fixture.app, "/api/mpe/uploads", &cookie, "").await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);
    }

    let reply = post(fixture.app, "/api/mpe/uploads", &cookie, "").await;

    assert_eq!(reply.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(reply.body, error("rate_limited"));
    let retry_after: i32 = reply.header("retry-after").unwrap().parse().unwrap();
    assert!((1..=60).contains(&retry_after), "{retry_after}");
}

#[tokio::test]
async fn origin_and_session_are_checked_first_and_other_origins_go_to_next_db() {
    let fixture = fixture(&[]).await;
    for (path, signed_out) in [
        ("/api/upload", "login_required"),
        ("/api/mpe/uploads", "signed_out"),
    ] {
        let no_origin = send(fixture.app, "POST", path, &[FORM_TYPE], "").await;
        let same_origin = [("sec-fetch-site", "same-origin")];
        let same_origin = send(fixture.app, "POST", path, &same_origin, "").await;
        let site = send(fixture.app, "POST", path, &[("origin", SITE_URL)], "").await;
        let other = [("origin", "http://localhost:3000")];
        let other = send(fixture.app, "POST", path, &other, "").await;
        let get = send(fixture.app, "GET", path, &[], "").await;

        assert_eq!(no_origin.status, StatusCode::FORBIDDEN);
        assert_eq!(no_origin.body, error("invalid_origin"));
        assert_eq!(same_origin.status, StatusCode::UNAUTHORIZED);
        assert_eq!(same_origin.body, error(signed_out));
        assert_eq!(site.status, StatusCode::UNAUTHORIZED);
        assert_eq!(site.body, error(signed_out));
        assert_eq!(other.body, format!("upstream saw POST {path}"));
        assert_eq!(get.body, format!("upstream saw GET {path}"));
    }
}

#[tokio::test]
async fn on_the_local_backend_or_when_disabled_the_uploads_stay_with_next_db() {
    let upstream = marker_upstream().await;
    let local = spawn_app(config(upstream, UNUSED_DATABASE_URL, &APP_ENV)).await;
    let disabled = fixture(&[("AXUM_DISABLED_ROUTES", "upload,mpe-uploads")]).await;

    for app in [local, disabled.app] {
        for path in ["/api/upload", "/api/mpe/uploads"] {
            let reply = send(app, "POST", path, &[("origin", SITE_URL)], "").await;
            assert_eq!(reply.body, format!("upstream saw POST {path}"));
        }
    }
}

/// C3-4: without an upstream the local directory is the only one, so both
/// routes are this server's there, as Next's are on its local backend
/// (`uploadLocal` of lib/object-storage.ts), and a signed URL to an object
/// that is not there is the 404 `missing`, not Next's to look for.
#[tokio::test]
async fn without_an_upstream_db_the_uploads_use_the_local_directory() {
    let root = tempfile::tempdir().expect("temp dir");
    let dir = root.path().to_str().unwrap();
    let env = [&APP_ENV[..], &[("LOCAL_OBJECT_STORAGE_DIR", dir)]].concat();
    let config = common::config_alone(&database_url(), &env);
    let storage = memecatch_server::storage::Storage::new(&config).expect("storage");
    let app = spawn_app(config).await;
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("create the better-auth tables");
    let (user, cookie) = signed_in(&db).await;

    let image = multipart(&[("file", Some(("a.png", "image/png")), PNG)]);
    let uploaded = post(app, "/api/upload", &cookie, image).await;
    let rights: &[u8] = br#"{"accepted":true}"#;
    let mp4: &[u8] = b"\0\0\0\x18ftypisom\0\0\x02\0isomiso2";
    let video = multipart(&[
        ("rightsDeclaration", None, rights),
        ("file", Some(("a.mp4", "video/mp4")), mp4),
    ]);
    let mpe = post(app, "/api/mpe/uploads", &cookie, video).await;
    let missing_url = storage
        .signed_object_url("meme-uploads", &format!("{user}/none.png"), 60)
        .unwrap();
    let missing_path = &missing_url[missing_url.find("/api/").unwrap()..];
    let missing = send(app, "GET", missing_path, &[], Body::empty()).await;

    assert_eq!(uploaded.status, StatusCode::OK, "{}", uploaded.body);
    let body: serde_json::Value = serde_json::from_str(&uploaded.body).unwrap();
    let path = body["path"].as_str().unwrap();
    assert!(path.starts_with(&format!("meme-uploads/{user}/")), "{path}");
    assert_eq!(std::fs::read(root.path().join(path)).unwrap(), PNG);
    // As with R2: stored, then removed when the ingestion fails.
    assert_eq!(
        mpe.status,
        StatusCode::INTERNAL_SERVER_ERROR,
        "{}",
        mpe.body
    );
    assert_eq!(mpe.body, error("ingestion_failed"));
    assert!(
        !root
            .path()
            .join("mpe-temporary")
            .join(&user)
            .read_dir()
            .is_ok_and(|mut d| d.next().is_some())
    );
    assert_eq!(api_requests(&db, &user).await, (1, 1));
    assert_eq!(missing.status, StatusCode::NOT_FOUND);
    assert_eq!(missing.body, r#"{"message":"missing"}"#);
}

/// For `parity/uploads.mjs`, which starts it: the app on `PARITY_PORT`, in
/// front of the script's Next (`UPSTREAM_URL`), with objects in the S3
/// gateway the script started, reached at `PARITY_R2_ENDPOINT` through the
/// script's recording proxy. The rest of the configuration is the
/// environment's. Serves until the script kills it.
#[tokio::test]
#[ignore = "started by parity/uploads.mjs"]
async fn serve_for_parity() {
    let variable = |name: &str| std::env::var(name).unwrap_or_else(|_| panic!("{name} is not set"));
    let config = memecatch_server::config::Config::from_lookup(|name| std::env::var(name).ok())
        .expect("configuration");
    let endpoint = variable("PARITY_R2_ENDPOINT");
    assert!(
        endpoint.starts_with("http://127.0.0.1:"),
        "the parity gateway must be local"
    );
    let mut state = AppState::new(config.clone()).expect("app state");
    state.storage =
        memecatch_server::storage::Storage::with_r2_endpoint(&config, &endpoint).expect("storage");
    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", variable("PARITY_PORT")))
        .await
        .expect("bind the parity port");
    eprintln!("serving for parity on {}", listener.local_addr().unwrap());
    axum::serve(listener, build_app(state))
        .await
        .expect("serve");
}
