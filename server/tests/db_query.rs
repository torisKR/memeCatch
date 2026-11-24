//! `POST /api/db/query` over HTTP (`src/routes/db_query`). The parity with
//! the real Next is `parity/db-query.mjs`; these tests keep the port's own
//! behaviour in place.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They add better-auth
//! users and memes whose slugs start with `axum-r9-`, and remove the memes.

#[path = "common/mod.rs"]
mod common;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{
    Reply, UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, session, spawn_app,
    spawn_router,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};
use sqlx::AssertSqlSafe;

const SITE_URL: &str = "https://memes.example";
const PATH: &str = "/api/db/query";
const APP_ENV: [(&str, &str); 4] = [
    ("NEXT_PUBLIC_SITE_URL", SITE_URL),
    ("RELEASE_SHA", "abc123"),
    ("CRON_SECRET", "test-only-cron-secret"),
    ("NODE_ENV", "development"),
];

async fn app(upstream: SocketAddr, database_url: &str) -> SocketAddr {
    spawn_app(config(upstream, database_url, &APP_ENV)).await
}

/// A same-site request from its own address, with `cookie` when given.
async fn post(
    app: SocketAddr,
    body: impl Into<Body>,
    address: &str,
    cookie: Option<&str>,
) -> Reply {
    let mut headers = vec![
        ("origin", SITE_URL),
        ("content-type", "application/json"),
        ("x-forwarded-for", address),
    ];
    headers.extend(cookie.map(|cookie| ("cookie", cookie)));
    send(app, "POST", PATH, &headers, body).await
}

/// `{ plan }` with the defaults the builder sends.
fn plan(fields: &str) -> String {
    format!(
        r#"{{"plan":{{"fields":[{{"kind":"star"}}],"filters":[],"orGroups":[],"orders":[],"limit":null,"offset":null,"single":false,"maybeSingle":false,"count":null,"head":false,"onConflict":null,"ignoreDuplicates":false,"returning":true,{fields}}}}}"#
    )
}

fn refused(message: &str, status: u16) -> String {
    format!(r#"{{"data":null,"error":{{"message":"{message}","status":{status}}},"count":null}}"#)
}

fn failed(message: &str, code: &str, status: u16) -> String {
    format!(
        r#"{{"data":null,"error":{{"message":"{message}","code":"{code}","status":{status}}},"count":null}}"#
    )
}

#[tokio::test]
async fn requests_are_refused_before_any_query_as_next_refuses_them() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL).await;
    let no_origin = send(app, "POST", PATH, &[], Body::empty()).await;
    assert_eq!(
        (no_origin.status, no_origin.body.clone()),
        (StatusCode::FORBIDDEN, refused("untrusted origin", 403))
    );
    assert_eq!(no_origin.header("content-type"), Some("application/json"));
    let cross = send(
        app,
        "POST",
        PATH,
        &[("sec-fetch-site", "cross-site")],
        Body::empty(),
    )
    .await;
    assert_eq!(cross.status, StatusCode::FORBIDDEN);
    // Another origin may be Next's own, and other methods are Next's.
    let other = send(
        app,
        "POST",
        PATH,
        &[("origin", "http://localhost:3000")],
        Body::empty(),
    )
    .await;
    assert_eq!(other.body, format!("upstream saw POST {PATH}"));
    let get = send(app, "GET", PATH, &[], Body::empty()).await;
    assert_eq!(get.status, StatusCode::IM_A_TEAPOT);

    let invalid = refused("invalid plan", 400);
    let cases: [(&str, String, &str); 6] = [
        ("not json", "{".into(), &invalid),
        ("no plan", "{}".into(), &invalid),
        ("plan array", r#"{"plan":[]}"#.into(), &invalid),
        (
            "unknown op",
            plan(r#""op":"drop","table":"memes""#),
            &invalid,
        ),
        (
            "fields not an array",
            plan(r#""op":"select","table":"memes","fields":{}"#),
            &invalid,
        ),
        (
            "limit past 1000",
            plan(r#""op":"select","table":"memes","limit":1001"#),
            &invalid,
        ),
    ];
    for (index, (name, body, expected)) in cases.into_iter().enumerate() {
        let reply = post(app, body, &format!("198.51.100.{index}"), None).await;
        assert_eq!(reply.body, expected, "{name}");
    }
    let same_origin = [
        ("sec-fetch-site", "same-origin"),
        ("x-forwarded-for", "198.51.100.20"),
    ];
    let fetch = send(app, "POST", PATH, &same_origin, "{").await;
    assert_eq!(fetch.body, invalid);
    let declared = [("origin", SITE_URL), ("content-length", "2000000")];
    // Refused on the declared length, before the body is read; a body that
    // runs past 1 MiB is compared with Next in parity/db-query.mjs (limits).
    let declared = send(app, "POST", PATH, &declared, Body::empty()).await;
    assert_eq!(
        (declared.status, declared.body),
        (
            StatusCode::PAYLOAD_TOO_LARGE,
            refused("request too large", 413)
        )
    );
}

#[tokio::test]
async fn an_address_may_ask_180_times_a_minute() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL).await;
    for _ in 0..180 {
        let reply = post(app, "{", "203.0.113.7", None).await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST);
    }
    let limited = post(app, "{", "203.0.113.7", None).await;
    assert_eq!(
        (limited.status, limited.body.clone()),
        (StatusCode::TOO_MANY_REQUESTS, refused("rate_limited", 429))
    );
    let retry: i64 = limited
        .header("retry-after")
        .expect("retry-after")
        .parse()
        .expect("seconds");
    assert!((1..=60).contains(&retry), "{retry}");
    // The limit counts each address on its own.
    let other = post(app, "{", "203.0.113.8", None).await;
    assert_eq!(other.status, StatusCode::BAD_REQUEST);
}

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

/// Runs statements as `service_role`. The text comes from this file's own
/// constants and generated ids, hence `AssertSqlSafe`.
async fn execute(db: &Db, statements: String) {
    let done: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(AssertSqlSafe(statements))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    done.expect("test statements");
}

async fn count(db: &Db, query: String) -> i64 {
    let found: Result<i64, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(
                    async move { sqlx::query_scalar(AssertSqlSafe(query)).fetch_one(tx).await },
                )
            },
        )
        .await;
    found.expect("test count")
}

struct TestUser {
    id: String,
    cookie: String,
}

async fn sign_in(db: &Db, operator: bool) -> TestUser {
    let pool = db.pool();
    sqlx::raw_sql(session::AUTH_TABLES)
        .execute(pool)
        .await
        .expect("auth tables");
    let user = session::create_user(pool).await;
    if operator {
        let promote = format!(
            "update public.profiles set role = 'operator' where id = '{}'::uuid",
            user.id
        );
        execute(db, promote).await;
    }
    let token = session::create_session(pool, &user, 3600.0).await;
    TestUser {
        cookie: session::signed_cookie(session::PLAIN, &token, "test-only-auth-secret"),
        id: user.id,
    }
}

/// Two memes, one public and one pending, with ids made for this test.
async fn memes(db: &Db, tag: &str) -> (String, String) {
    let public = format!("{tag}-0000-4000-8000-000000000001");
    let pending = format!("{tag}-0000-4000-8000-000000000002");
    // A failed run leaves its memes behind.
    remove_memes(db, tag).await;
    execute(
        db,
        format!(
            "insert into public.memes (id, title, slug, moderation_status, trend_score) values
               ('{public}', 'axum r9 public', 'axum-r9-{tag}-a', 'approved', 1),
               ('{pending}', 'axum r9 pending', 'axum-r9-{tag}-b', 'pending', 2)"
        ),
    )
    .await;
    (public, pending)
}

async fn remove_memes(db: &Db, tag: &str) {
    execute(
        db,
        format!("delete from public.memes where slug like 'axum-r9-{tag}-%'"),
    )
    .await;
}

#[tokio::test]
async fn plans_db_run_as_the_caller_under_row_level_security() {
    let db = test_db();
    let server = app(marker_upstream().await, &database_url()).await;
    let user = sign_in(&db, false).await;
    let (public, pending) = memes(&db, "a9000001").await;
    let ids = format!(
        r#""op":"select","table":"memes","fields":[{{"kind":"column","name":"id"}}],"filters":[{{"column":"id","op":"in","value":["{public}","{pending}"]}}]"#
    );

    // Only the public meme is anyone's to read.
    let anon = post(server, plan(&ids), "192.0.2.1", None).await;
    let only_public = format!(
        r#"{{"data":[{{"id":"{public}"}}],"error":null,"count":null,"status":200,"statusText":"OK"}}"#
    );
    assert_eq!((anon.status, anon.body), (StatusCode::OK, only_public));
    let head = plan(&format!(r#"{ids},"count":"exact","head":true"#));
    let counted = post(server, head, "192.0.2.1", None).await;
    assert_eq!(counted.body, r#"{"data":null,"error":null,"count":1}"#);

    // anon may not call the function at all; the user's own save is theirs.
    let save = plan(&format!(
        r#""op":"rpc","fn":"toggle_save","args":{{"p_meme_id":"{public}"}}"#
    ));
    let anon_save = post(server, save.clone(), "192.0.2.1", None).await;
    assert_eq!(anon_save.body, failed("query failed", "42501", 400));
    let saved = post(server, save, "192.0.2.2", Some(&user.cookie)).await;
    let saved_true = r#"{"data":true,"error":null,"count":null,"status":200,"statusText":"OK"}"#;
    assert_eq!(saved.body, saved_true);
    let rows = format!(
        "select count(*) from public.saved_memes where user_id = '{}' and meme_id = '{public}'",
        user.id
    );
    assert_eq!(count(&db, rows).await, 1);

    // What the compiler refuses, what Postgres refuses, and what the
    // caller may not do.
    let no_code = r#"{"data":null,"error":{"message":"query failed","status":400},"count":null}"#;
    let cases = [
        (r#""op":"select","table":"pg_class""#.to_owned(), failed("query failed", "42602", 400)),
        (r#""op":"select","table":"memes","fields":[{"kind":"column","name":"id;"}]"#.to_owned(), failed("query failed", "42602", 400)),
        (format!(r#"{ids},"single":true,"limit":0"#), failed("query failed", "PGRST116", 406)),
        (r#""op":"rpc","fn":"no_such_function","args":{}"#.to_owned(), failed("query failed", "42883", 404)),
        (r#""op":"select","table":"memes","filters":[{"column":"id","op":"eq","value":"not-a-uuid"}]"#.to_owned(), failed("query failed", "22P02", 400)),
        (r#""op":"select","table":"memes","filters":[{"column":"published_at","op":"gte","value":"2024-13-01"}]"#.to_owned(), failed("query failed", "22008", 400)),
        (r#""op":"select","table":"memes","filters":[{"column":"title","op":"zz","value":1}]"#.to_owned(), no_code.to_owned()),
        (r#""op":"update","table":"profiles","values":{"role":"operator"}"#.to_owned(), failed("query failed", "42501", 400)),
    ];
    for (index, (fields, expected)) in cases.into_iter().enumerate() {
        let address = format!("192.0.2.{}", 10 + index);
        let reply = post(server, plan(&fields), &address, Some(&user.cookie)).await;
        assert_eq!(reply.body, expected, "{fields}");
    }
    remove_memes(&db, "a9000001").await;
}

#[tokio::test]
async fn six_running_queries_db_turn_the_seventh_away() {
    let db = test_db();
    let server = app(marker_upstream().await, &database_url()).await;
    let user = sign_in(&db, false).await;
    let (public, _) = memes(&db, "a9000002").await;
    // `toggle_save` locks the caller's profile row first: while another
    // transaction holds it, six saves wait inside the route.
    let mut holder = db.pool().begin().await.expect("begin");
    sqlx::query("set local role service_role")
        .execute(&mut *holder)
        .await
        .expect("service role");
    sqlx::query("select 1 from public.profiles where id = $1::uuid for update")
        .bind(&user.id)
        .execute(&mut *holder)
        .await
        .expect("lock the profile");
    let save = plan(&format!(
        r#""op":"rpc","fn":"toggle_save","args":{{"p_meme_id":"{public}"}}"#
    ));
    let waiting: Vec<_> = (0..6)
        .map(|index| {
            let (body, cookie) = (save.clone(), user.cookie.clone());
            let address = format!("192.0.2.{}", 40 + index);
            tokio::spawn(async move { post(server, body, &address, Some(&cookie)).await })
        })
        .collect();
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
    let seventh = post(server, save.clone(), "192.0.2.50", Some(&user.cookie)).await;
    let busy = refused("database busy", 503);
    assert_eq!(
        (
            seventh.status,
            seventh.body.as_str(),
            seventh.header("retry-after")
        ),
        (StatusCode::SERVICE_UNAVAILABLE, busy.as_str(), Some("1"))
    );
    holder.rollback().await.expect("release");
    for task in waiting {
        assert_eq!(task.await.expect("task").status, StatusCode::OK);
    }
    // The slots are back.
    let after = post(server, save, "192.0.2.51", Some(&user.cookie)).await;
    assert_eq!(after.status, StatusCode::OK);
    remove_memes(&db, "a9000002").await;
}

/// An upstream standing in for Next's internal cache route.
async fn cache_upstream(status: StatusCode) -> (SocketAddr, Arc<Mutex<Vec<String>>>) {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let record = seen.clone();
    let addr = spawn_router(Router::new().fallback(move |request: Request| {
        let record = record.clone();
        async move {
            let line = format!("{} {}", request.method(), request.uri());
            record.lock().expect("lock").push(line);
            (status, "{}")
        }
    }))
    .await;
    (addr, seen)
}

#[tokio::test]
async fn a_video_verification_db_expires_nexts_cache_or_says_it_is_pending() {
    let db = test_db();
    let operator = sign_in(&db, true).await;
    let (public, _) = memes(&db, "a9000003").await;
    let content = "a9000003-0000-4000-8000-0000000000c1";
    // Receipts outlive their content: every run needs operations of its own.
    let run = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("clock")
        .as_micros()
        % (1 << 40);
    let operation_id = |n: u128| format!("a9000003-0000-4000-8000-{:012x}", run * 16 + n);
    execute(
        &db,
        format!(
            "insert into public.meme_contents (id, meme_id, type, platform, content_id, url)
             values ('{content}', '{public}', 'video', 'instagram', 'AxumR9', 'https://www.instagram.com/p/AxumR9/')"
        ),
    )
    .await;
    let verify = |operation: &str| {
        plan(&format!(
            r#""op":"rpc","fn":"record_instagram_post_video_verification","args":{{"p_operation_id":"{operation}","p_content_id":"{content}","p_decision":"verify","p_evidence_note":"axum r9 test evidence"}}"#
        ))
    };

    let (upstream, seen) = cache_upstream(StatusCode::OK).await;
    let server = app(upstream, &database_url()).await;
    let first_operation = verify(&operation_id(1));
    let first = post(
        server,
        first_operation,
        "192.0.2.60",
        Some(&operator.cookie),
    )
    .await;
    assert_eq!(first.status, StatusCode::OK, "{}", first.body);
    let recorded = first.body.contains(r#""decision":"verify""#)
        && first.body.contains(r#""idempotent":false"#);
    assert!(recorded, "{}", first.body);
    assert_eq!(
        *seen.lock().expect("lock"),
        ["POST /api/internal/cache?scope=instagram-video-verification"]
    );

    // Committed, but Next did not confirm the expiry: 202 and the retry path.
    let (failing, _) = cache_upstream(StatusCode::INTERNAL_SERVER_ERROR).await;
    let failing_app = app(failing, &database_url()).await;
    let second = verify(&operation_id(2));
    let pending = post(failing_app, second, "192.0.2.61", Some(&operator.cookie)).await;
    assert_eq!(pending.status, StatusCode::ACCEPTED);
    let tail = r#","count":null,"error":null,"cacheInvalidationPending":true,"cacheRetryPath":"/api/admin/instagram-video-verification/revalidate"}"#;
    assert!(pending.body.ends_with(tail), "{}", pending.body);

    // Another transaction holds the operation: three attempts, then 503.
    let operation = operation_id(3);
    let mut holder = db.pool().begin().await.expect("begin");
    sqlx::query("select pg_advisory_xact_lock(hashtextextended($1, 1))")
        .bind(&operation)
        .execute(&mut *holder)
        .await
        .expect("hold the operation");
    let conflict = post(
        server,
        verify(&operation),
        "192.0.2.62",
        Some(&operator.cookie),
    )
    .await;
    holder.rollback().await.expect("release");
    let retry = refused("verification_conflict_retry", 503);
    assert_eq!(
        (
            conflict.status,
            conflict.body.as_str(),
            conflict.header("retry-after")
        ),
        (StatusCode::SERVICE_UNAVAILABLE, retry.as_str(), Some("1"))
    );
    remove_memes(&db, "a9000003").await;
}

/// The named statements on every connection the server holds.
async fn prepared_statements(db: &Db) -> i64 {
    let mut total = 0;
    for pool in db.pools() {
        let mut held = Vec::new();
        for _ in 0..pool.size() {
            held.push(pool.acquire().await.expect("a connection"));
        }
        for connection in &mut held {
            let named: i64 = sqlx::query_scalar("select count(*) from pg_prepared_statements")
                .persistent(false)
                .fetch_one(&mut **connection)
                .await
                .expect("prepared statements");
            total += named;
        }
    }
    total
}

/// R9 review H1: each distinct plan stayed on its connection as a named
/// statement, about 20 MB of backend memory for a large one, 100 per
/// connection. node-pg sends plans unnamed, and so must this route.
#[tokio::test]
async fn distinct_plans_db_leave_no_prepared_statement_behind() {
    let env = [APP_ENV.as_slice(), &[("AXUM_DB_POOL_MAX", "1")]].concat();
    let state =
        AppState::new(config(marker_upstream().await, &database_url(), &env)).expect("state");
    let server = spawn_router(build_app(state.clone())).await;
    // A different statement text for each count of filters.
    let select = |filters: usize| {
        let filter = r#"{"column":"id","op":"eq","value":"00000000-0000-4000-8000-000000000000"}"#;
        let filters = vec![filter; filters].join(",");
        plan(&format!(
            r#""op":"select","table":"memes","filters":[{filters}]"#
        ))
    };
    let ok = r#"{"data":[],"error":null,"count":null,"status":200,"statusText":"OK"}"#;
    for filters in 1..=3 {
        let reply = post(server, select(filters), "192.0.2.60", None).await;
        assert_eq!(reply.body, ok);
    }
    let before = prepared_statements(&state.db).await;
    for filters in 4..=23 {
        let reply = post(server, select(filters), "192.0.2.60", None).await;
        assert_eq!(reply.body, ok);
    }
    assert_eq!(prepared_statements(&state.db).await, before);
}
