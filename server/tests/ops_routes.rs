//! The R4 routes over HTTP (`src/routes/ops.rs`): the retired product APIs,
//! `/api/cron/growth-baseline`, `POST /api/cron/source-refresh`, the Instagram
//! video cache route and `/api/cron/saved-state-emails`.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They write rows whose
//! dedupe keys start with `axum-r4-` and better-auth users, and remove the
//! outbox rows they wrote.

#[path = "common/mod.rs"]
mod common;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{
    Reply, UNUSED_DATABASE_URL, closed_addr, config, database_url, marker_upstream, send,
    spawn_app, spawn_router,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::AssertSqlSafe;

const CRON_SECRET: &str = "test-only-cron-secret";
const BEARER: &str = "Bearer test-only-cron-secret";
const SITE_URL: &str = "https://memes.example";
const APP_ENV: [(&str, &str); 4] = [
    ("NEXT_PUBLIC_SITE_URL", SITE_URL),
    ("RELEASE_SHA", "abc123"),
    ("CRON_SECRET", CRON_SECRET),
    ("NODE_ENV", "development"),
];
const REVALIDATE: &str = "/api/admin/instagram-video-verification/revalidate";

fn upstream_saw(method: &str, target: &str) -> String {
    format!("upstream saw {method} {target}")
}

/// An upstream standing in for Next's internal cache route: it records
/// `METHOD target authorization` and answers `status`.
async fn cache_upstream(status: StatusCode) -> (SocketAddr, Arc<Mutex<Vec<String>>>) {
    let seen = Arc::new(Mutex::new(Vec::new()));
    let record = seen.clone();
    let addr = spawn_router(Router::new().fallback(move |request: Request| {
        let record = record.clone();
        async move {
            let authorization = request
                .headers()
                .get("authorization")
                .map(|value| value.to_str().expect("ascii").to_owned())
                .unwrap_or_default();
            record.lock().expect("lock").push(format!(
                "{} {} {authorization}",
                request.method(),
                request.uri()
            ));
            (status, "{}")
        }
    }))
    .await;
    (addr, seen)
}

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    spawn_app(config(
        upstream,
        database_url,
        &[extra, &APP_ENV[..]].concat(),
    ))
    .await
}

async fn request(app: SocketAddr, method: &str, path: &str, headers: &[(&str, &str)]) -> Reply {
    send(app, method, path, headers, Body::empty()).await
}

async fn cron(app: SocketAddr, method: &str, path: &str) -> Reply {
    request(app, method, path, &[("authorization", BEARER)]).await
}

#[tokio::test]
async fn retired_product_apis_are_gone_for_every_method_they_export() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    let every = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    let cases = [
        ("/api/cron/adpick-hotdeals", &every[..2]),
        ("/api/creator-products", &every[..]),
        ("/api/creator-products/a/b?x=1", &every[..]),
    ];
    for (path, methods) in cases {
        for method in methods {
            let reply = request(app, method, path, &[]).await;
            assert_eq!(reply.status, StatusCode::GONE, "{method} {path}");
            assert_eq!(reply.body, r#"{"error":"gone"}"#);
            assert_eq!(reply.header("x-robots-tag"), Some("noindex"));
            assert_eq!(reply.header("content-type"), Some("application/json"));
        }
    }
    // The methods the route files do not export stay with Next.
    let reply = request(app, "PUT", "/api/cron/adpick-hotdeals", &[]).await;
    assert_eq!(reply.body, upstream_saw("PUT", "/api/cron/adpick-hotdeals"));
    let reply = request(app, "OPTIONS", "/api/creator-products/x", &[]).await;
    assert_eq!(
        reply.body,
        upstream_saw("OPTIONS", "/api/creator-products/x")
    );
    // A trailing slash is Next's redirect.
    let reply = request(app, "GET", "/api/creator-products/", &[]).await;
    assert_eq!(reply.status, StatusCode::IM_A_TEAPOT);
}

#[tokio::test]
async fn cron_routes_refuse_a_wrong_bearer_with_their_own_bodies() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    let cases = [
        (
            "GET",
            "/api/cron/growth-baseline",
            r#"{"ok":false,"error":"unauthorized"}"#,
        ),
        (
            "POST",
            "/api/cron/source-refresh",
            r#"{"ok":false,"error":"UNAUTHORIZED"}"#,
        ),
        (
            "GET",
            "/api/cron/saved-state-emails",
            r#"{"ok":false,"error":"UNAUTHORIZED"}"#,
        ),
    ];
    let wrong = [
        None,
        Some("Bearer wrong"),
        Some("bearer test-only-cron-secret"),
    ];
    for (method, path, body) in cases {
        for header in wrong {
            let headers: Vec<(&str, &str)> = header
                .map(|value| ("authorization", value))
                .into_iter()
                .collect();
            let reply = request(app, method, path, &headers).await;
            assert_eq!(
                reply.status,
                StatusCode::UNAUTHORIZED,
                "{method} {path} {header:?}"
            );
            assert_eq!(reply.body, body, "{method} {path}");
        }
    }
    // Without CRON_SECRET nothing is authorized.
    let unset = app_without_cron_secret().await;
    let reply = request(
        unset,
        "GET",
        "/api/cron/growth-baseline",
        &[("authorization", "Bearer ")],
    )
    .await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
}

async fn app_without_cron_secret() -> SocketAddr {
    let env = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(marker_upstream().await, UNUSED_DATABASE_URL, &env)).await
}

async fn unreachable_database() -> String {
    format!("postgresql://memecatch:x@{}/memecatch", closed_addr().await)
}

#[tokio::test]
async fn growth_baseline_answers_a_bare_500_when_the_database_fails() {
    let app = app(marker_upstream().await, &unreachable_database().await, &[]).await;
    let reply = cron(app, "GET", "/api/cron/growth-baseline").await;
    assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR);
    assert_eq!(reply.body, "");
    // POST is Next's.
    let reply = cron(app, "POST", "/api/cron/growth-baseline").await;
    assert_eq!(reply.status, StatusCode::IM_A_TEAPOT);
}

#[tokio::test]
async fn growth_baseline_db_records_the_period() {
    let app = app(marker_upstream().await, &database_url(), &[]).await;
    let reply = cron(app, "GET", "/api/cron/growth-baseline").await;
    assert_eq!(
        (reply.status, reply.body.as_str()),
        (StatusCode::OK, r#"{"ok":true}"#)
    );
    let found: Vec<(bool,)> = rows(
        &test_db(),
        "select true from public.growth_funnel_baselines where period_end = date_trunc('day', now())",
    )
    .await;
    assert_eq!(found.len(), 1);
}

#[tokio::test]
async fn source_refresh_post_asks_next_to_expire_the_catalog() {
    let (upstream, seen) = cache_upstream(StatusCode::OK).await;
    let app = app(upstream, UNUSED_DATABASE_URL, &[]).await;
    let reply = cron(app, "POST", "/api/cron/source-refresh").await;
    assert_eq!(
        (reply.status, reply.body.as_str()),
        (StatusCode::OK, r#"{"ok":true}"#)
    );
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!(
            "POST /api/internal/cache?scope=public-catalog {BEARER}"
        )]
    );
    // GET, the refresh run, stays with Next: the upstream sees it as sent.
    cron(app, "GET", "/api/cron/source-refresh").await;
    assert_eq!(
        seen.lock().expect("lock")[1],
        format!("GET /api/cron/source-refresh {BEARER}")
    );
}

#[tokio::test]
async fn source_refresh_post_reports_a_failed_expiry() {
    for status in [StatusCode::INTERNAL_SERVER_ERROR, StatusCode::UNAUTHORIZED] {
        let (upstream, _) = cache_upstream(status).await;
        let app = app(upstream, UNUSED_DATABASE_URL, &[]).await;
        let reply = cron(app, "POST", "/api/cron/source-refresh").await;
        assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(reply.body, r#"{"ok":false,"error":"REVALIDATION_FAILED"}"#);
    }
    let app = app(closed_addr().await, UNUSED_DATABASE_URL, &[]).await;
    let reply = cron(app, "POST", "/api/cron/source-refresh").await;
    assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn video_cache_route_checks_the_origin_before_anything_else() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    for headers in [&[][..], &[("sec-fetch-site", "cross-site")]] {
        let reply = request(app, "POST", REVALIDATE, headers).await;
        assert_eq!(
            (reply.status, reply.body.as_str()),
            (StatusCode::FORBIDDEN, r#"{"ok":false}"#)
        );
    }
    // Another origin may be Next's own, which only Next knows.
    let reply = request(
        app,
        "POST",
        REVALIDATE,
        &[("origin", "https://other.example")],
    )
    .await;
    assert_eq!(reply.body, upstream_saw("POST", REVALIDATE));
    let reply = request(app, "GET", REVALIDATE, &[]).await;
    assert_eq!(reply.body, upstream_saw("GET", REVALIDATE));
    // Without CRON_SECRET this server cannot reach Next's cache: Next answers.
    let unset = app_without_cron_secret().await;
    let reply = request(unset, "POST", REVALIDATE, &[("origin", SITE_URL)]).await;
    assert_eq!(reply.body, upstream_saw("POST", REVALIDATE));
}

#[tokio::test]
async fn video_cache_route_db_admits_only_operators() {
    let db = test_db();
    let (upstream, seen) = cache_upstream(StatusCode::OK).await;
    let server = app(upstream, &database_url(), &[]).await;
    let operator = sign_in(&db, true).await;
    let user = sign_in(&db, false).await;
    let forged = "better-auth.session_token=forged.token";
    let cases = [
        (None, StatusCode::UNAUTHORIZED, r#"{"ok":false}"#),
        (Some(forged), StatusCode::UNAUTHORIZED, r#"{"ok":false}"#),
        (
            Some(user.cookie.as_str()),
            StatusCode::FORBIDDEN,
            r#"{"ok":false}"#,
        ),
        (
            Some(operator.cookie.as_str()),
            StatusCode::OK,
            r#"{"ok":true}"#,
        ),
    ];
    for (index, (cookie, status, body)) in cases.into_iter().enumerate() {
        let forwarded = format!("198.51.100.{index}");
        let mut headers = vec![
            ("origin", SITE_URL),
            ("x-forwarded-for", forwarded.as_str()),
        ];
        headers.extend(cookie.map(|cookie| ("cookie", cookie)));
        let reply = request(server, "POST", REVALIDATE, &headers).await;
        assert_eq!(
            (reply.status, reply.body.as_str()),
            (status, body),
            "{cookie:?}"
        );
    }
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!(
            "POST /api/internal/cache?scope=instagram-video-verification {BEARER}"
        )]
    );

    // A failed expiry: 503, retry in a second.
    let (failing, _) = cache_upstream(StatusCode::INTERNAL_SERVER_ERROR).await;
    let failing_app = app(failing, &database_url(), &[]).await;
    let headers = [("origin", SITE_URL), ("cookie", operator.cookie.as_str())];
    let reply = request(failing_app, "POST", REVALIDATE, &headers).await;
    assert_eq!(
        (reply.status, reply.body.as_str()),
        (StatusCode::SERVICE_UNAVAILABLE, r#"{"ok":false}"#)
    );
    assert_eq!(reply.header("retry-after"), Some("1"));
}

#[tokio::test]
async fn video_cache_route_allows_30_requests_a_minute_per_client() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    let headers = [("origin", SITE_URL), ("x-forwarded-for", "203.0.113.9")];
    for _ in 0..30 {
        // Without a database the session lookup fails, which counts as
        // signed out, as in Next.
        let reply = request(app, "POST", REVALIDATE, &headers).await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
    }
    let reply = request(app, "POST", REVALIDATE, &headers).await;
    assert_eq!(
        (reply.status, reply.body.as_str()),
        (StatusCode::TOO_MANY_REQUESTS, r#"{"ok":false}"#)
    );
    assert_eq!(reply.header("retry-after"), Some("60"));
    let other = [("origin", SITE_URL), ("x-forwarded-for", "203.0.113.10")];
    let reply = request(app, "POST", REVALIDATE, &other).await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn saved_state_emails_need_an_https_delivery_url_and_a_sender() {
    let from = ("PLUS_DIGEST_FROM_EMAIL", "from@memes.example");
    let url = |value| ("PLUS_DIGEST_DELIVERY_URL", value);
    let cases = [
        vec![],
        vec![url("https://mail.example/send")],
        vec![from],
        vec![url("http://mail.example/send"), from],
        vec![url("https://u:p@mail.example/send"), from],
        vec![url("not a url"), from],
    ];
    for extra in cases {
        let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &extra).await;
        let reply = cron(app, "GET", "/api/cron/saved-state-emails").await;
        assert_eq!(reply.status, StatusCode::OK, "{extra:?}");
        assert_eq!(
            reply.body,
            r#"{"ok":true,"status":"not_configured","delivered":0,"failed":0}"#
        );
        assert_eq!(reply.header("cache-control"), Some("no-store"));
    }
}

const DELIVERY_FROM: (&str, &str) = ("PLUS_DIGEST_FROM_EMAIL", "from@memes.example");

#[tokio::test]
async fn saved_state_emails_report_a_failed_claim() {
    let delivery = [
        ("PLUS_DIGEST_DELIVERY_URL", "https://127.0.0.1:1/send"),
        DELIVERY_FROM,
    ];
    let app = app(
        marker_upstream().await,
        &unreachable_database().await,
        &delivery,
    )
    .await;
    let reply = cron(app, "GET", "/api/cron/saved-state-emails").await;
    assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
    assert_eq!(
        reply.body,
        r#"{"ok":false,"status":"failed","delivered":0,"failed":0}"#
    );
}

/// The provider at a closed port: every send fails as `fetch` does, and each
/// row records why. Deliveries that succeed are compared with Next's in
/// `parity/ops.mjs`, against an HTTPS stub.
#[tokio::test]
async fn saved_state_emails_db_record_why_each_row_failed() {
    let db = test_db();
    let url = format!("https://127.0.0.1:{}/send", closed_addr().await.port());
    let delivery = [("PLUS_DIGEST_DELIVERY_URL", url.as_str()), DELIVERY_FROM];
    let recipient = sign_in(&db, false).await;
    let payload = |short_id: &str, old_state: &str| {
        format!(
            r#"{{"title":"t","short_id":"{short_id}","old_state":"{old_state}","new_state":"y","locale":"en"}}"#
        )
    };
    let user = Some(recipient.id.as_str());
    let rows_in = [
        (user, payload("a", "x"), "fetch failed"),
        (None, payload("a", "x"), "recipient_missing"),
        (user, payload("a_b", "x"), "invalid_payload"),
        (
            user,
            payload("a", "toString"),
            "a.replaceAll is not a function",
        ),
    ];
    let _lock = OUTBOX.lock().await;
    let mut statements =
        String::from("delete from public.notification_outbox where dedupe_key like 'axum-r4-%';");
    for (index, (user, payload, _)) in rows_in.iter().enumerate() {
        let user = user.map_or_else(|| "null".to_owned(), |id| format!("'{id}'::uuid"));
        statements.push_str(&format!(
            "insert into public.notification_outbox (topic, channel, user_id, dedupe_key, payload, available_at)
             values ('meme.state.changed', 'email', {user}, 'axum-r4-{index}', '{payload}'::jsonb,
                     now() - interval '1 day' + {index} * interval '1 second');"
        ));
    }
    execute(&db, statements).await;
    let app = app(marker_upstream().await, &database_url(), &delivery).await;
    let reply = cron(app, "GET", "/api/cron/saved-state-emails").await;
    let recorded: Vec<(String, String)> = rows(
        &db,
        "select status, last_error from public.notification_outbox \
         where dedupe_key like 'axum-r4-%' order by dedupe_key",
    )
    .await;
    execute(
        &db,
        "delete from public.notification_outbox where dedupe_key like 'axum-r4-%'".to_owned(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_GATEWAY, "{}", reply.body);
    assert_eq!(
        reply.body,
        r#"{"ok":false,"status":"failed","delivered":0,"failed":4}"#
    );
    let expected: Vec<(String, String)> = rows_in
        .iter()
        .map(|(_, _, error)| ("failed".to_owned(), (*error).to_owned()))
        .collect();
    assert_eq!(recorded, expected);
}

#[tokio::test]
async fn saved_state_emails_db_with_nothing_queued_are_ok() {
    let db = test_db();
    let delivery = [
        ("PLUS_DIGEST_DELIVERY_URL", "https://127.0.0.1:1/send"),
        DELIVERY_FROM,
    ];
    let _lock = OUTBOX.lock().await;
    execute(
        &db,
        "delete from public.notification_outbox \
         where topic = 'meme.state.changed' and channel = 'email'"
            .to_owned(),
    )
    .await;
    let app = app(marker_upstream().await, &database_url(), &delivery).await;
    let reply = cron(app, "GET", "/api/cron/saved-state-emails").await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        r#"{"ok":true,"status":"ok","delivered":0,"failed":0}"#
    );
}

#[tokio::test]
async fn each_disabled_route_falls_through_to_next() {
    let cases = [
        ("growth-baseline", "GET", "/api/cron/growth-baseline"),
        ("saved-state-emails", "GET", "/api/cron/saved-state-emails"),
        ("source-refresh", "POST", "/api/cron/source-refresh"),
        ("instagram-video-cache", "POST", REVALIDATE),
        ("adpick-hotdeals", "GET", "/api/cron/adpick-hotdeals"),
        ("creator-products", "DELETE", "/api/creator-products"),
        ("creator-products", "GET", "/api/creator-products/a"),
    ];
    for (id, method, path) in cases {
        let disabled = [("AXUM_DISABLED_ROUTES", id)];
        let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &disabled).await;
        let headers = [("authorization", BEARER), ("origin", SITE_URL)];
        let reply = request(app, method, path, &headers).await;
        assert_eq!(reply.body, upstream_saw(method, path), "{id}");
    }
}

// Shared by the `_db_` tests that read or replace the outbox.
static OUTBOX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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

async fn rows<T>(db: &Db, query: &'static str) -> Vec<T>
where
    T: for<'r> sqlx::FromRow<'r, sqlx::postgres::PgRow> + Send + Unpin + 'static,
{
    let found: Result<Vec<T>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_as(query).fetch_all(tx).await }),
        )
        .await;
    found.expect("test query")
}

/// The tables better-auth creates (`ensureAuthSchema`), as in `tests/auth.rs`.
const AUTH_TABLES: &str = r#"
select pg_advisory_xact_lock(72031120);
create table if not exists public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);
create table if not exists public.session (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references public."user" (id) on delete cascade
);
create index if not exists "session_userId_idx" on public.session ("userId");
grant select on public."user", public.session to service_role;
"#;

struct TestUser {
    id: String,
    cookie: String,
}

/// A better-auth user with a profile (made by the `auth.users` trigger) and a
/// session. The nickname is `ax` and 12 hex digits, the form the other test
/// binaries recognise as a test user (`tests/public_routes/memes_table.rs`).
async fn sign_in(db: &Db, operator: bool) -> TestUser {
    let pool = db.pool();
    sqlx::raw_sql(AUTH_TABLES)
        .execute(pool)
        .await
        .expect("auth tables");
    let (id, email): (String, String) = sqlx::query_as(
        r#"insert into public."user" (name, email, "emailVerified")
           values ('axum r4 test', 'axum-r4-' || gen_random_uuid() || '@example.com', true)
           returning id::text, email"#,
    )
    .fetch_one(pool)
    .await
    .expect("insert user");
    sqlx::query(
        "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1::uuid, $2, now(),
                 jsonb_build_object('nickname', 'ax' || substr(replace($1, '-', ''), 1, 12)))",
    )
    .bind(&id)
    .bind(&email)
    .execute(pool)
    .await
    .expect("insert auth.users");
    if operator {
        let promote =
            format!("update public.profiles set role = 'operator' where id = '{id}'::uuid");
        execute(db, promote).await;
    }
    let token: String = sqlx::query_scalar(
        r#"insert into public.session (token, "expiresAt", "updatedAt", "userId")
           values (replace(gen_random_uuid()::text, '-', ''), now() + interval '1 hour', now(), $1::uuid)
           returning token"#,
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .expect("insert session");
    TestUser {
        cookie: session_cookie(&token),
        id,
    }
}

/// `<token>.<base64 HMAC-SHA256>`, percent-encoded, as better-auth sets it
/// (`BETTER_AUTH_SECRET` of `common::config`).
fn session_cookie(token: &str) -> String {
    use base64::Engine;
    use hmac::{Hmac, KeyInit, Mac};
    let mut mac = Hmac::<sha2::Sha256>::new_from_slice(b"test-only-auth-secret").expect("key");
    mac.update(token.as_bytes());
    let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    let value = format!("{token}.{signature}")
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
    format!("better-auth.session_token={value}")
}
