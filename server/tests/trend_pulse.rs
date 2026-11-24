//! `GET /api/cron/trend-pulse` over HTTP (`src/routes/ops/trend_pulse.rs`),
//! with the radar providers and Next's internal cache route as local stubs.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They share
//! `connector_health`, so they hold `DB` while they run.

#[path = "common/mod.rs"]
mod common;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{
    Reply, UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app,
    spawn_router,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::AssertSqlSafe;

const PATH: &str = "/api/cron/trend-pulse";
const BEARER: &str = "Bearer test-only-cron-secret";
const X_SEARCH: &str = "/api.x.com/2/tweets/search/recent";
const CACHE: &str = "/api/internal/cache";

static DB: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

type Seen = Arc<Mutex<Vec<String>>>;

/// A stub that records `METHOD target authorization` and answers each path
/// with its scripted status and body, 404 otherwise.
async fn stub(script: &[(&str, u16, &str)]) -> (SocketAddr, Seen) {
    let answers: HashMap<String, (u16, String)> = script
        .iter()
        .map(|(path, status, body)| ((*path).to_owned(), (*status, (*body).to_owned())))
        .collect();
    let answers = Arc::new(answers);
    let seen: Seen = Arc::new(Mutex::new(Vec::new()));
    let record = seen.clone();
    let addr = spawn_router(Router::new().fallback(move |request: Request| {
        let (record, answers) = (record.clone(), answers.clone());
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
            let (status, body) = answers
                .get(request.uri().path())
                .cloned()
                .unwrap_or((404, String::new()));
            (StatusCode::from_u16(status).expect("a status"), body)
        }
    }))
    .await;
    (addr, seen)
}

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
        ("CRON_SECRET", "test-only-cron-secret"),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

/// The app with the X connector sending to `provider`.
async fn app_with_x(next: SocketAddr, provider: SocketAddr) -> SocketAddr {
    let origin = format!("http://{provider}");
    let env = [
        ("RADAR_X_TERMS", "밈, #짤"),
        ("X_API_BEARER_TOKEN", " x-token "),
        ("AXUM_TEST_RADAR_ORIGIN", origin.as_str()),
    ];
    app(next, &database_url(), &env).await
}

async fn pulse(app: SocketAddr) -> Reply {
    send(
        app,
        "GET",
        PATH,
        &[("authorization", BEARER)],
        Body::empty(),
    )
    .await
}

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

async fn execute(statements: &'static str) {
    let done: Result<(), sqlx::Error> = test_db()
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

async fn clear_health() {
    execute("delete from public.connector_health").await;
}

type HealthRow = (String, String, i32, Option<String>, Option<String>);

async fn health() -> Vec<HealthRow> {
    let found: Result<Vec<HealthRow>, sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(
                        "select connector_key, status, consecutive_failures, last_error, \
                     cursor_state->>'cursor' from public.connector_health order by connector_key",
                    )
                    .fetch_all(tx)
                    .await
                })
            },
        )
        .await;
    found.expect("health rows")
}

#[tokio::test]
async fn trend_pulse_refuses_a_wrong_bearer() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    for header in [
        None,
        Some("Bearer wrong"),
        Some("bearer test-only-cron-secret"),
    ] {
        let headers: Vec<(&str, &str)> = header.map(|v| ("authorization", v)).into_iter().collect();
        let reply = send(app, "GET", PATH, &headers, Body::empty()).await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED, "{header:?}");
        assert_eq!(reply.body, r#"{"ok":false,"error":"UNAUTHORIZED"}"#);
    }
    // POST is not the route's: Next answers it.
    let reply = send(
        app,
        "POST",
        PATH,
        &[("authorization", BEARER)],
        Body::empty(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::IM_A_TEAPOT);
}

#[tokio::test]
async fn trend_pulse_falls_through_to_next_when_disabled() {
    let disabled = [("AXUM_DISABLED_ROUTES", "trend-pulse")];
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &disabled).await;
    let reply = pulse(app).await;
    assert_eq!(reply.body, format!("upstream saw GET {PATH}"));
}

#[tokio::test]
async fn trend_pulse_db_runs_and_then_expires_the_catalog() {
    let _db = DB.lock().await;
    let (next, seen) = stub(&[(CACHE, 200, "{}")]).await;
    let reply = pulse(app(next, &database_url(), &[]).await).await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert_eq!(
        reply.body,
        r#"{"ok":true,"status":"ok","alerts":0,"savedContextAlerts":0}"#
    );
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!("POST {CACHE}?scope=public-catalog {BEARER}")]
    );
    // A failed expiry is Next's background work: the answer stays.
    let (failing, _) = stub(&[(CACHE, 500, "{}")]).await;
    let reply = pulse(app(failing, &database_url(), &[]).await).await;
    assert_eq!(reply.status, StatusCode::OK);
}

#[tokio::test]
async fn trend_pulse_reports_a_failed_compute_and_expires_nothing() {
    let (next, seen) = stub(&[(CACHE, 200, "{}")]).await;
    let database = format!(
        "postgresql://memecatch:x@{}/memecatch",
        common::closed_addr().await
    );
    let reply = pulse(app(next, &database, &[]).await).await;
    assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
    let prefix =
        r#"{"ok":false,"status":"failed","alerts":0,"savedContextAlerts":0,"error":"compute:"#;
    assert!(reply.body.starts_with(prefix), "{}", reply.body);
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    // The scores were not computed: nothing to expire.
    assert!(seen.lock().expect("lock").is_empty());
}

#[tokio::test]
async fn trend_pulse_db_sends_the_x_search_and_cannot_record_its_health() {
    let _db = DB.lock().await;
    clear_health().await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let (provider, seen) = stub(&[(X_SEARCH, 200, r#"{"meta":{"newest_id":"42"}}"#)]).await;
    let reply = pulse(app_with_x(next, provider).await).await;
    // `connector_health.connector_key` needs two characters; X's is "x".
    // " #짤" keeps its `#`: `/^#+/` does not skip the space.
    let radar = r#""radar":{"status":"failed","persistedSignals":0,"automaticMatches":0,"pendingMatches":0,"observations":0,"safetyReviews":0,"error":"RADAR_CONNECTOR_HEALTH_WRITE_FAILED"}"#;
    assert_eq!(
        reply.body,
        format!(r#"{{"ok":true,"status":"partial","alerts":0,"savedContextAlerts":0,{radar}}}"#)
    );
    let query = "query=%28%22%EB%B0%88%22+OR+%22%23%EC%A7%A4%22%29+lang%3Ako+-is%3Aretweet+-has%3Amedia\
                 &tweet.fields=created_at%2Clang&max_results=25";
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!("GET {X_SEARCH}?{query} Bearer x-token")]
    );
    assert!(health().await.is_empty());
}

#[tokio::test]
async fn trend_pulse_db_records_threads_health_and_counts_failures() {
    let _db = DB.lock().await;
    clear_health().await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let search = "/graph.threads.com/v1.0/keyword_search";
    let threads = |provider: SocketAddr| async move {
        let origin = format!("http://{provider}");
        let env = [
            ("RADAR_THREADS_TERMS", "a,b"),
            ("THREADS_ACCESS_TOKEN", "t-token"),
            ("AXUM_TEST_RADAR_ORIGIN", origin.as_str()),
        ];
        pulse(app(next, &database_url(), &env).await).await
    };
    let answer = r#"{"data":[{"id":"1","media_type":"IMAGE"}]}"#;
    let (provider, seen) = stub(&[(search, 200, answer)]).await;
    let reply = threads(provider).await;
    assert!(reply.body.contains(r#""status":"ok""#), "{}", reply.body);
    assert_eq!(seen.lock().expect("lock").len(), 2, "one search per term");
    let healthy = ("threads".into(), "healthy".into(), 0, None, None);
    assert_eq!(health().await, [healthy]);
    let (provider, _) = stub(&[(search, 503, "")]).await;
    let reply = threads(provider).await;
    assert!(
        reply.body.contains(r#""radar":{"status":"failed""#),
        "{}",
        reply.body
    );
    let down = (
        "threads".into(),
        "down".into(),
        1,
        Some("HTTP 503".into()),
        None,
    );
    assert_eq!(health().await, [down]);
    clear_health().await;
}

#[tokio::test]
async fn trend_pulse_db_fails_the_radar_on_any_collected_signal() {
    let _db = DB.lock().await;
    clear_health().await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let posts = r#"{"data":[{"id":"1","text":"밈 #짤","created_at":"2026-11-24T05:00:00.000Z"}]}"#;
    let (provider, _) = stub(&[(X_SEARCH, 200, posts)]).await;
    let reply = pulse(app_with_x(next, provider).await).await;
    assert_eq!(reply.status, StatusCode::OK);
    assert!(
        reply
            .body
            .contains(r#""error":"RADAR_SIGNAL_WRITE_FAILED""#),
        "{}",
        reply.body
    );
    // The insert fails before the health is written.
    assert!(health().await.is_empty());
}

/// Why the radar stops at the signal insert: the TypeScript names
/// `raw_expires_at` with no value, and the column refuses `NULL`. A
/// migration that changes this needs the rest of the radar ported.
#[tokio::test]
async fn trend_pulse_db_relies_on_raw_expires_at_refusing_null() {
    let found: Result<String, sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(
                        "select is_nullable::text from information_schema.columns \
                     where table_schema = 'public' and table_name = 'external_signals' \
                     and column_name = 'raw_expires_at'",
                    )
                    .fetch_one(tx)
                    .await
                })
            },
        )
        .await;
    assert_eq!(found.expect("the column"), "NO");
}
