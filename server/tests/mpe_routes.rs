//! `GET /api/mpe/jobs/{id}` and `POST /api/mpe/renders` over HTTP, with real
//! session rows. `parity/mpe.mjs` compares the same cases with Next.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{Reply, UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::PgPool;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const SITE_URL: &str = "https://memes.example";
const ORIGIN: (&str, &str) = ("origin", SITE_URL);
const SIGNED_OUT: &str = r#"{"ok":false,"error":"signed_out"}"#;

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
        // Read the cookie a browser holds over plain HTTP.
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

/// A user with a session: the id and the cookie header value.
async fn signed_in(pool: &PgPool) -> (String, String) {
    let user = create_user(pool).await;
    let token = create_session(pool, &user, 3_600.0).await;
    (user.id, signed_cookie(PLAIN, &token, SECRET))
}

/// The database with the better-auth tables in place.
async fn database() -> Db {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("the better-auth tables (db/migrations)");
    db
}

/// One value from one statement, as `service_role`.
async fn service_scalar(db: &Db, sql: &'static str, args: Vec<String>) -> String {
    let result: Result<String, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let mut query = sqlx::query_scalar(sql);
                    for arg in args {
                        query = query.bind(arg);
                    }
                    query.fetch_one(tx).await
                })
            },
        )
        .await;
    result.expect("write test rows")
}

/// An ingestion of `user` that expires in `expires_in`, and its id.
async fn ingestion(db: &Db, user: &str, expires_in: &str) -> String {
    service_scalar(
        db,
        "insert into public.media_ingestions
           (user_id, ingest_mode, mime_type, media_kind, byte_size, sha256,
            temporary_storage_key, expires_at, rights_attested_at)
         values ($1::uuid, 'USER_UPLOADED', 'video/mp4', 'video', 1000, repeat('a', 64),
                 $1 || '/' || gen_random_uuid(), now() + $2::interval, now() - interval '2 days')
         returning id::text",
        vec![user.to_owned(), expires_in.to_owned()],
    )
    .await
}

/// A job of `ingestion` and its id.
async fn job(db: &Db, ingestion: &str, job_type: &str, status: &str, output: &str) -> String {
    service_scalar(
        db,
        "insert into public.processing_jobs
           (ingestion_id, job_type, status, processor_name, processor_version, input_hash,
            output_json, started_at, completed_at, created_at)
         values ($1::uuid, $2, $3, 'p', '1', md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text), $4::jsonb,
                 case when $3 = 'completed' then timestamptz '2026-11-01T00:00:01+00' end,
                 case when $3 = 'completed' then timestamptz '2026-11-01T00:00:02.5+00' end,
                 '2026-11-01T00:00:00.123456+00')
         returning id::text",
        vec![
            ingestion.to_owned(),
            job_type.to_owned(),
            status.to_owned(),
            output.to_owned(),
        ],
    )
    .await
}

async fn get_job(app: SocketAddr, id: &str, cookie: Option<&str>) -> Reply {
    let headers: Vec<(&str, &str)> = cookie
        .map(|cookie| ("cookie", cookie))
        .into_iter()
        .collect();
    send(
        app,
        "GET",
        &format!("/api/mpe/jobs/{id}"),
        &headers,
        Body::empty(),
    )
    .await
}

#[tokio::test]
async fn a_job_db_is_shown_to_its_owner_only_with_the_body_next_sends() {
    let db = database().await;
    let (owner, owner_cookie) = signed_in(db.pool()).await;
    let (_, other_cookie) = signed_in(db.pool()).await;
    let ingestion = ingestion(&db, &owner, "1 day").await;
    let queued = job(
        &db,
        &ingestion,
        "inspect",
        "queued",
        r#"{"b": 1.0, "10": "x", "artifactKey": "k"}"#,
    )
    .await;
    let app = app(marker_upstream().await, &database_url(), &[]).await;

    let signed_out = get_job(app, &queued, None).await;
    let owned = get_job(app, &queued, Some(&owner_cookie)).await;
    let foreign = get_job(app, &queued, Some(&other_cookie)).await;
    let not_a_uuid = get_job(app, "not-a-uuid", Some(&owner_cookie)).await;

    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(signed_out.body, SIGNED_OUT);
    assert_eq!(owned.status, StatusCode::OK);
    assert_eq!(owned.header("cache-control"), Some("no-store"));
    assert_eq!(owned.header("content-type"), Some("application/json"));
    // Keys in the TypeScript's order; the output as JSON.stringify writes it,
    // without its storage key.
    assert_eq!(
        owned.body,
        format!(
            r#"{{"ok":true,"data":{{"id":"{queued}","ingestionId":"{ingestion}","jobType":"inspect","status":"queued","attempts":0,"output":{{"10":"x","b":1}},"downloadUrl":null,"downloadExpiresIn":null,"errorCode":null,"startedAt":null,"completedAt":null,"createdAt":"2026-11-01T00:00:00.123456+00:00"}}}}"#
        )
    );
    for reply in [foreign, not_a_uuid] {
        assert_eq!(reply.status, StatusCode::NOT_FOUND);
        assert_eq!(reply.body, r#"{"ok":false,"error":"job_not_found"}"#);
    }
}

#[tokio::test]
async fn a_finished_render_db_gets_a_signed_url_unless_it_expired_or_names_no_artifact() {
    let db = database().await;
    let (owner, cookie) = signed_in(db.pool()).await;
    let live = ingestion(&db, &owner, "1 day").await;
    let expired = ingestion(&db, &owner, "-1 minute").await;
    let key = format!("{owner}/{live}/renders/{}.mp4", "e".repeat(64));
    let output = format!(r#"{{"artifactKey": "{key}", "width": 1080}}"#);
    let ready = job(&db, &live, "render", "completed", &output).await;
    let gone = job(&db, &expired, "render", "completed", &output).await;
    let keyless = job(
        &db,
        &live,
        "render",
        "completed",
        r#"{"artifactKey": "not/a/key.mp4"}"#,
    )
    .await;
    let app = app(marker_upstream().await, &database_url(), &[]).await;

    let ready = get_job(app, &ready, Some(&cookie)).await;
    let gone = get_job(app, &gone, Some(&cookie)).await;
    let keyless = get_job(app, &keyless, Some(&cookie)).await;

    assert_eq!(ready.status, StatusCode::OK);
    let url = format!(
        "{SITE_URL}/api/media/signed?key=mpe-temporary%2F{}",
        key.replace('/', "%2F")
    );
    assert!(
        ready.body.contains(&format!(
            r#""output":{{"width":1080}},"downloadUrl":"{url}&exp="#
        )),
        "{}",
        ready.body
    );
    assert!(
        ready
            .body
            .contains(r#","downloadExpiresIn":60,"errorCode":null,"#)
    );
    assert_eq!(gone.status, StatusCode::GONE);
    assert_eq!(gone.body, r#"{"ok":false,"error":"artifact_expired"}"#);
    assert_eq!(keyless.status, StatusCode::BAD_GATEWAY);
    assert_eq!(keyless.body, r#"{"ok":false,"error":"artifact_not_ready"}"#);
}

fn render_body(ingestion: &str) -> String {
    format!(
        r#"{{"ingestionId":"{ingestion}","preset":"vertical","attribution":"출처","segments":[{{"startMs":0,"endMs":1000,"text":"자막"}}]}}"#
    )
}

async fn post_render(app: SocketAddr, headers: &[(&str, &str)], body: String) -> Reply {
    send(app, "POST", "/api/mpe/renders", headers, body).await
}

#[tokio::test]
async fn a_render_request_db_is_checked_in_the_order_next_checks_it() {
    let db = database().await;
    let (owner, cookie) = signed_in(db.pool()).await;
    let ingestion = ingestion(&db, &owner, "1 day").await;
    let app = app(marker_upstream().await, &database_url(), &[]).await;
    let user = [ORIGIN, ("cookie", cookie.as_str())];

    let no_origin = post_render(app, &[("cookie", cookie.as_str())], render_body(&ingestion)).await;
    let signed_out = post_render(app, &[ORIGIN], render_body(&ingestion)).await;
    let invalid = post_render(app, &user, r#"{"ingestionId":"x"}"#.to_owned()).await;
    let valid = post_render(app, &user, render_body(&ingestion)).await;
    let jobs = service_scalar(
        &db,
        "select count(*)::text from public.processing_jobs where ingestion_id = $1::uuid",
        vec![ingestion.clone()],
    )
    .await;

    assert_eq!(no_origin.status, StatusCode::FORBIDDEN);
    assert_eq!(no_origin.body, r#"{"ok":false,"error":"invalid_origin"}"#);
    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(signed_out.body, SIGNED_OUT);
    assert_eq!(invalid.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid.body,
        r#"{"ok":false,"error":"invalid_render_request"}"#
    );
    // The TypeScript's call fails before it reaches the function (see
    // routes/mpe/renders.rs), so a valid request queues nothing.
    assert_eq!(valid.status, StatusCode::BAD_REQUEST);
    assert_eq!(valid.body, r#"{"ok":false,"error":"render_not_available"}"#);
    assert_eq!(jobs, "0");
}

#[tokio::test]
async fn the_sixth_render_request_db_of_a_user_in_a_minute_is_refused() {
    let db = database().await;
    let (_, cookie) = signed_in(db.pool()).await;
    let app = app(marker_upstream().await, &database_url(), &[]).await;
    let user = [ORIGIN, ("cookie", cookie.as_str())];

    for _ in 0..5 {
        let reply = post_render(app, &user, "{}".to_owned()).await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST);
    }
    let refused = post_render(app, &user, "{}".to_owned()).await;

    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.body, r#"{"ok":false,"error":"rate_limited"}"#);
    let wait: u32 = refused
        .header("retry-after")
        .expect("retry-after")
        .parse()
        .unwrap();
    assert!((1..=60).contains(&wait));
}

#[tokio::test]
async fn a_dead_database_is_a_signed_out_caller_as_in_next() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    let cookie = signed_cookie(PLAIN, "sometoken", SECRET);

    let user = [ORIGIN, ("cookie", cookie.as_str())];
    let (job, render) = tokio::join!(
        get_job(app, "d1000000-0000-4000-8000-000000000001", Some(&cookie)),
        post_render(app, &user, "{}".to_owned()),
    );

    for reply in [job, render] {
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
        assert_eq!(reply.body, SIGNED_OUT);
    }
}

/// A candidate of `ingestion` with two matches (rank 2 first in the table),
/// and its id.
async fn candidate_with_matches(db: &Db, ingestion: &str) -> String {
    let candidate = service_scalar(
        db,
        "insert into public.meme_candidates (ingestion_id, title, meme_type, model_version, prompt_version)
         values ($1::uuid, 'axum test', 'PHRASE', 'v', 'v') returning id::text",
        vec![ingestion.to_owned()],
    )
    .await;
    service_scalar(
        db,
        "with memes as (
           insert into public.memes (title, slug)
           select 'axum test ' || n, 'axum-test-' || gen_random_uuid() from generate_series(1, 2) n
           returning id)
         , numbered as (select id, row_number() over () as n from memes)
         insert into public.candidate_matches
           (candidate_id, meme_id, rank, overall_score, text_score, classification, evidence_json, created_at)
         select $1::uuid, id, 3 - n::int, case when n = 1 then 0.5000 else 0.9876 end, null, 'RELATED',
                case when n = 1 then '{\"10\": 1.0, \"b\": [1e2]}' else '{}' end::jsonb,
                '2026-11-01T00:00:00.123456+00'
           from numbered
         returning candidate_id::text",
        vec![candidate.clone()],
    )
    .await;
    candidate
}

#[tokio::test]
async fn candidate_matches_db_are_listed_to_an_operator_in_rank_order() {
    let db = database().await;
    let (owner, _) = signed_in(db.pool()).await;
    let (_, user_cookie) = signed_in(db.pool()).await;
    let (operator, operator_cookie) = signed_in(db.pool()).await;
    service_scalar(
        &db,
        "update public.profiles set role = 'operator' where id = $1::uuid returning id::text",
        vec![operator],
    )
    .await;
    let ingestion = ingestion(&db, &owner, "1 day").await;
    let candidate = candidate_with_matches(&db, &ingestion).await;
    let app = app(marker_upstream().await, &database_url(), &[]).await;
    let list = async |query: String, cookie: Option<&str>| {
        let headers: Vec<(&str, &str)> = cookie
            .map(|cookie| ("cookie", cookie))
            .into_iter()
            .collect();
        send(
            app,
            "GET",
            &format!("/api/admin/mpe-candidates{query}"),
            &headers,
            Body::empty(),
        )
        .await
    };

    let signed_out = list(format!("?candidateId={candidate}"), None).await;
    let not_operator = list(format!("?candidateId={candidate}"), Some(&user_cookie)).await;
    let no_id = list(String::new(), Some(&operator_cookie)).await;
    let listed = list(
        format!("?candidateId={}", candidate.to_uppercase()),
        Some(&operator_cookie),
    )
    .await;

    assert_eq!(
        (signed_out.status, signed_out.body.as_str()),
        (StatusCode::UNAUTHORIZED, SIGNED_OUT)
    );
    assert_eq!(not_operator.status, StatusCode::FORBIDDEN);
    assert_eq!(
        not_operator.body,
        r#"{"ok":false,"error":"operator_required"}"#
    );
    assert_eq!(no_id.status, StatusCode::BAD_REQUEST);
    assert_eq!(no_id.body, r#"{"ok":false,"error":"invalid_input"}"#);
    assert_eq!(listed.status, StatusCode::OK);
    assert_eq!(listed.header("cache-control"), Some("no-store"));
    let rows: serde_json::Value = serde_json::from_str(&listed.body).unwrap();
    let ranks: Vec<_> = rows["data"]
        .as_array()
        .unwrap()
        .iter()
        .map(|row| row["rank"].clone())
        .collect();
    assert_eq!(ranks, [1, 2]);
    // Columns in table order; numbers and the jsonb as JSON.stringify writes them.
    assert!(listed.body.contains(r#""rank":1,"overall_score":0.9876,"text_score":null,"visual_score":null,"audio_score":null,"classification":"RELATED","evidence_json":{},"created_at":"2026-11-01T00:00:00.123456+00:00"}"#), "{}", listed.body);
    assert!(
        listed.body.contains(r#""overall_score":0.5,"#),
        "{}",
        listed.body
    );
    assert!(
        listed
            .body
            .contains(r#""evidence_json":{"10":1,"b":[100]}"#),
        "{}",
        listed.body
    );
}
