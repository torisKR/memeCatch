//! `GET /api/auth/get-session` and `POST /api/auth/sign-out` at their limits:
//! an oversized `Cookie` header, and a database that refuses connections or
//! has no free connection. Only the exhausted pool needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{
    UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app, spawn_router,
};
use memecatch_server::{AppState, build_app};

/// Node's `--max-http-header-size` default (16 KiB): a request whose headers
/// are longer gets 431 before Next runs.
const NODE_HEADER_LIMIT: usize = 16 * 1024;
const ORIGIN: &str = "http://localhost:3000";

fn cookie_of(len: usize) -> String {
    format!("a={}", "x".repeat(len - 2))
}

#[tokio::test]
async fn a_cookie_header_over_16_kib_gets_node_s_431() {
    let upstream = marker_upstream().await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;
    let json = ("content-type", "application/json");
    for (len, expected) in [
        (NODE_HEADER_LIMIT, StatusCode::OK),
        (
            NODE_HEADER_LIMIT + 1,
            StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE,
        ),
        (400_000, StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE),
    ] {
        let cookie = cookie_of(len);
        let get = send(
            app,
            "GET",
            "/api/auth/get-session",
            &[("cookie", &cookie)],
            Body::empty(),
        )
        .await;
        let sign_out = send(
            app,
            "POST",
            "/api/auth/sign-out",
            &[("cookie", &cookie), ("origin", ORIGIN), json],
            Body::from("{}"),
        )
        .await;
        for (route, reply) in [("get-session", get), ("sign-out", sign_out)] {
            assert_eq!(reply.status, expected, "{route} with a {len}-byte cookie");
            if expected == StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE {
                assert_eq!(reply.body, "", "{route}");
                assert_eq!(reply.header("connection"), Some("close"), "{route}");
                assert_eq!(reply.header("set-cookie"), None, "{route}");
            }
        }
    }
    // Two Cookie headers count together, as Node counts every header byte.
    let half = cookie_of(NODE_HEADER_LIMIT / 2 + 1);
    let reply = send(
        app,
        "GET",
        "/api/auth/get-session",
        &[("cookie", &half), ("cookie", &half)],
        Body::empty(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE);
}

/// better-auth's limiter: 100 requests a 10 s window per address and path.
async fn the_101st_get_session(node_env: Option<&str>) -> StatusCode {
    let upstream = marker_upstream().await;
    let vars: Vec<(&str, &str)> = node_env
        .map(|mode| ("NODE_ENV", mode))
        .into_iter()
        .collect();
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &vars)).await;
    let address = [("x-forwarded-for", "198.18.0.7")];
    for _ in 0..100 {
        let reply = send(app, "GET", "/api/auth/get-session", &address, Body::empty()).await;
        assert_eq!(reply.status, StatusCode::OK, "{node_env:?}");
    }
    send(app, "GET", "/api/auth/get-session", &address, Body::empty())
        .await
        .status
}

#[tokio::test]
async fn the_limiter_is_on_exactly_when_the_cookies_are_secure() {
    // `NODE_ENV` unset reads as production for the cookie names (config.rs),
    // so it must for the limiter too.
    assert_eq!(
        the_101st_get_session(None).await,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        the_101st_get_session(Some("production")).await,
        StatusCode::TOO_MANY_REQUESTS
    );
    assert_eq!(
        the_101st_get_session(Some("development")).await,
        StatusCode::OK
    );
}

const SECRET: &str = "test-only-auth-secret";
/// The main pool's acquire timeout (`db.rs`).
const ACQUIRE_TIMEOUT: Duration = Duration::from_secs(5);

async fn session_rows(pool: &sqlx::PgPool, token: &str) -> i64 {
    sqlx::query_scalar("select count(*) from public.session where token = $1")
        .bind(token)
        .fetch_one(pool)
        .await
        .expect("count sessions")
}

// node-pg waits for a free connection; this pool gives up after 5 s. A
// sign-out that waited that long tries once more, so a pool busy for a
// little over 5 s still ends the session, as Next would.
#[tokio::test]
async fn sign_out_waits_out_one_acquire_timeout_and_deletes_the_session() {
    let vars = [("NODE_ENV", "development"), ("AXUM_DB_POOL_MAX", "1")];
    let state =
        AppState::new(config(marker_upstream().await, &database_url(), &vars)).expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let user = create_user(&pool).await;
    let token = create_session(&pool, &user, 3_600.0).await;
    let app = spawn_router(build_app(state)).await;

    // The pool's only connection is busy for a second past the timeout.
    let busy = pool.acquire().await.expect("the only connection");
    let held_for = ACQUIRE_TIMEOUT + Duration::from_secs(1);
    tokio::spawn(async move {
        tokio::time::sleep(held_for).await;
        drop(busy);
    });
    let started = Instant::now();
    let reply = send(
        app,
        "POST",
        "/api/auth/sign-out",
        &[
            ("cookie", &signed_cookie(PLAIN, &token, SECRET)),
            ("origin", ORIGIN),
            ("content-type", "application/json"),
        ],
        Body::from("{}"),
    )
    .await;
    let took = started.elapsed();

    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert_eq!(reply.body, r#"{"success":true}"#);
    assert!(took >= held_for, "{took:?}");
    assert!(
        took < 2 * ACQUIRE_TIMEOUT + Duration::from_secs(1),
        "{took:?}"
    );
    assert_eq!(session_rows(&pool, &token).await, 0, "the session survived");
}

/// A sign-out with a validly signed session cookie, from a trusted origin.
async fn sign_out_with_a_session(app: std::net::SocketAddr) -> (common::Reply, Duration) {
    let started = Instant::now();
    let reply = send(
        app,
        "POST",
        "/api/auth/sign-out",
        &[
            (
                "cookie",
                &signed_cookie(PLAIN, "a1fixtoken0000000000000000000001", SECRET),
            ),
            ("origin", ORIGIN),
            ("content-type", "application/json"),
        ],
        Body::from("{}"),
    )
    .await;
    (reply, started.elapsed())
}

/// The answer when the session could not be deleted: not a success, and the
/// cookies of this device expired all the same.
fn assert_failed_to_sign_out(reply: &common::Reply) {
    assert_eq!(
        reply.status,
        StatusCode::INTERNAL_SERVER_ERROR,
        "{}",
        reply.body
    );
    assert_eq!(
        reply.body,
        r#"{"message":"Failed to sign out","code":"FAILED_TO_SIGN_OUT"}"#
    );
    let expired: Vec<&str> = reply
        .headers
        .get_all("set-cookie")
        .iter()
        .map(|line| line.to_str().unwrap())
        .collect();
    assert_eq!(
        expired,
        [
            "better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
            "better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
            "better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
        ]
    );
}

// better-auth answers 200 `{"success":true}` here and leaves the row (A1-4
// in PLAN.md): a user told "signed out" must be signed out.
#[tokio::test]
async fn sign_out_says_it_failed_when_postgres_refuses_connections() {
    let dead_database = format!(
        "postgresql://memecatch:unused@{}/memecatch",
        common::closed_addr().await
    );
    let vars = [("NODE_ENV", "development")];
    let app = spawn_app(config(marker_upstream().await, &dead_database, &vars)).await;
    let (reply, took) = sign_out_with_a_session(app).await;
    assert_failed_to_sign_out(&reply);
    // Two acquire timeouts: the first try and the one retry.
    assert!(took >= 2 * ACQUIRE_TIMEOUT, "{took:?}");
}

#[tokio::test]
async fn sign_out_says_it_failed_when_the_pool_stays_busy_past_the_retry() {
    let vars = [("NODE_ENV", "development"), ("AXUM_DB_POOL_MAX", "1")];
    let state =
        AppState::new(config(marker_upstream().await, &database_url(), &vars)).expect("app state");
    let pool = state.db.pool().clone();
    let app = spawn_router(build_app(state)).await;
    let busy = pool.acquire().await.expect("the only connection");
    let (reply, took) = sign_out_with_a_session(app).await;
    drop(busy);
    assert_failed_to_sign_out(&reply);
    assert!(took >= 2 * ACQUIRE_TIMEOUT, "{took:?}");
}
