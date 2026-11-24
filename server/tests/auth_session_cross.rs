//! `GET /api/auth/get-session` and `POST /api/auth/sign-out` in Rust against
//! the app's own better-auth on one test database, both ways, under each
//! `NODE_ENV`:
//!
//! - a session better-auth created is read, extended, expired and signed out
//!   by Rust, and better-auth's `getSession` then agrees with what Rust left;
//! - better-auth reads, extends, expires and signs out, and Rust agrees.
//!
//! The refresh boundary (`expiresAt - 7 d + 1 d <= now`) and the expiry
//! boundary (`expiresAt < now`) are each approached from a second on either
//! side.
//!
//! Needs the test database, Node and the repository's `node_modules`:
//!
//! ```sh
//! export DATABASE_URL="$(scripts/test-db.sh up)"
//! cargo test --test auth_session_cross -- --ignored --nocapture
//! ```

mod common;

use std::net::SocketAddr;
use std::path::Path;
use std::process::Command;

use axum::http::StatusCode;
use common::{Reply, config, database_url, marker_upstream, send, spawn_app};
use serde_json::Value;
use sqlx::PgPool;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
/// Always a trusted origin (`trustedOrigins` in lib/auth/server.ts).
const ORIGIN: &str = "http://localhost:3000";
const SECOND: i64 = 1_000;
const DAY: i64 = 86_400 * SECOND;
const WEEK: i64 = 7 * DAY;
const MODES: [&str; 2] = ["development", "production"];

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Minted {
    cookie: String,
    cookie_name: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct BetterAuthAnswer {
    body: Value,
    set_cookie: Vec<String>,
}

/// `expiresAt` and `updatedAt` of a session row, in milliseconds.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
struct Row {
    expires_at: i64,
    updated_at: i64,
}

/// One Node process at a time: each runs `ensureAuthSchema`, whose grants
/// fail when two run at once ("tuple concurrently updated").
static NODE: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn node(script: &str, args: &[&str], env: &[(&str, String)]) -> Vec<u8> {
    let _one_at_a_time = NODE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root");
    let output = Command::new("node")
        .args(["--import", "./scripts/register-ts-paths.mjs", script])
        .args(args)
        .current_dir(repository)
        .env("DATABASE_URL", database_url())
        .env("BETTER_AUTH_SECRET", SECRET)
        .envs(env.iter().map(|(name, value)| (*name, value.as_str())))
        .output()
        .expect("run node");
    assert!(
        output.status.success(),
        "{script} failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}

/// A user signed up and in by better-auth, with a fresh session.
fn mint(mode: &str) -> Minted {
    let out = node(
        "server/tests/better_auth_cookie.mjs",
        &[],
        &[("NODE_ENV", mode.into())],
    );
    serde_json::from_slice(&out).expect("one JSON line from better_auth_cookie.mjs")
}

/// better-auth's own `getSession` (`get`) or `signOut` (`sign-out`), with
/// `expiresAt` set to its `Date.now() + expires_in` first when given.
fn better_auth(
    mode: &str,
    action: &str,
    cookie: &str,
    expires_in: Option<i64>,
) -> BetterAuthAnswer {
    let expires_in = expires_in.map(|ms| ms.to_string());
    let mut args = vec![action, cookie];
    args.extend(expires_in.as_deref());
    let env = [("NODE_ENV", mode.to_owned())];
    let out = node("server/tests/better_auth_session.mjs", &args, &env);
    serde_json::from_slice(&out).expect("one JSON line from better_auth_session.mjs")
}

fn now_ms() -> i64 {
    let since = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("after 1970");
    i64::try_from(since.as_millis()).expect("milliseconds fit")
}

/// The token of `name=<token>.<signature>`: better-auth's tokens are
/// alphanumeric, so it ends at the first dot.
fn token_of(cookie: &str) -> String {
    let value = &cookie[cookie.find('=').expect("name=value") + 1..];
    value.split('.').next().expect("token").to_owned()
}

async fn row(pool: &PgPool, token: &str) -> Option<Row> {
    let found: Option<(i64, i64)> = sqlx::query_as(
        r#"select floor(extract(epoch from "expiresAt") * 1000)::bigint,
                  floor(extract(epoch from "updatedAt") * 1000)::bigint
           from "session" where token = $1"#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await
    .expect("read the session row");
    found.map(|(expires_at, updated_at)| Row {
        expires_at,
        updated_at,
    })
}

async fn set_expiry(pool: &PgPool, token: &str, at_ms: i64) {
    sqlx::query(
        r#"update "session" set "expiresAt" = timestamptz 'epoch' + $1 * interval '1 millisecond'
           where token = $2"#,
    )
    .bind(at_ms)
    .bind(token)
    .execute(pool)
    .await
    .expect("set expiresAt");
}

struct Side {
    mode: &'static str,
    app: SocketAddr,
    pool: PgPool,
}

impl Side {
    async fn new(mode: &'static str) -> Self {
        let upstream = marker_upstream().await;
        let app = spawn_app(config(upstream, &database_url(), &[("NODE_ENV", mode)])).await;
        let pool = PgPool::connect(&database_url()).await.expect("connect");
        Self { mode, app, pool }
    }

    fn prefix(&self) -> &'static str {
        if self.mode == "production" {
            "__Secure-"
        } else {
            ""
        }
    }

    fn attributes(&self, max_age: i64) -> String {
        let secure = if self.mode == "production" {
            "Secure; "
        } else {
            ""
        };
        format!("Max-Age={max_age}; Path=/; HttpOnly; {secure}SameSite=Lax")
    }

    /// The cookie better-auth sets on a refresh: the same signed value for 7 days.
    fn refreshed(&self, cookie: &str) -> String {
        format!("{cookie}; {}", self.attributes(WEEK / SECOND))
    }

    /// `deleteSessionCookie` with no data chunks: token, data, dont_remember.
    fn cleared(&self) -> Vec<String> {
        ["session_token", "session_data", "dont_remember"]
            .map(|name| {
                format!(
                    "{}better-auth.{name}=; {}",
                    self.prefix(),
                    self.attributes(0)
                )
            })
            .to_vec()
    }

    async fn get(&self, cookie: &str) -> Reply {
        let reply = send(
            self.app,
            "GET",
            "/api/auth/get-session",
            &[("cookie", cookie)],
            "",
        )
        .await;
        assert_eq!(
            reply.status,
            StatusCode::OK,
            "{}: {}",
            self.mode,
            reply.body
        );
        reply
    }

    async fn sign_out(&self, cookie: &str) -> Reply {
        let headers = [
            ("cookie", cookie),
            ("origin", ORIGIN),
            ("content-type", "application/json"),
        ];
        send(self.app, "POST", "/api/auth/sign-out", &headers, "{}").await
    }
}

fn set_cookies(reply: &Reply) -> Vec<String> {
    reply
        .headers
        .get_all("set-cookie")
        .iter()
        .map(|value| value.to_str().expect("ascii").to_owned())
        .collect()
}

fn json(reply: &Reply) -> Value {
    serde_json::from_str(&reply.body).expect("a JSON body")
}

/// Rust reads a fresh better-auth session as better-auth does, and leaves a
/// session one second short of the refresh boundary as it is.
async fn rust_reads(side: &Side, minted: &Minted, token: &str) {
    let fresh = side.get(&minted.cookie).await;
    assert!(set_cookies(&fresh).is_empty(), "{}", side.mode);
    assert_eq!(json(&fresh)["session"]["token"], token);
    let theirs = better_auth(side.mode, "get", &minted.cookie, None);
    assert_eq!(json(&fresh), theirs.body, "{}: the same session", side.mode);

    set_expiry(&side.pool, token, now_ms() + WEEK - DAY + SECOND).await;
    let before = row(&side.pool, token).await;
    let short = side.get(&minted.cookie).await;
    assert!(set_cookies(&short).is_empty(), "{}: not due yet", side.mode);
    assert_eq!(row(&side.pool, token).await, before, "{}", side.mode);
}

/// One second past the refresh boundary Rust extends the row as better-auth
/// would (`expiresAt = now + 7 d`, `updatedAt = now`, one `now`), and
/// better-auth then reads the extended session without extending it again.
async fn rust_extends(side: &Side, minted: &Minted, token: &str) {
    set_expiry(&side.pool, token, now_ms() + WEEK - DAY - SECOND).await;
    let start = now_ms();
    let extended = side.get(&minted.cookie).await;
    let end = now_ms();
    let after = row(&side.pool, token)
        .await
        .expect("the row is still there");
    assert!(
        (start + WEEK..=end + WEEK).contains(&after.expires_at),
        "{after:?}"
    );
    assert_eq!(after.updated_at, after.expires_at - WEEK, "{}", side.mode);
    assert_eq!(set_cookies(&extended), [side.refreshed(&minted.cookie)]);

    let theirs = better_auth(side.mode, "get", &minted.cookie, None);
    assert!(
        theirs.set_cookie.is_empty(),
        "{}: no second refresh",
        side.mode
    );
    assert_eq!(theirs.body, json(&extended), "{}", side.mode);
    assert_eq!(row(&side.pool, token).await, Some(after), "{}", side.mode);
}

/// A second before `expiresAt` the session is read; a second after, Rust
/// deletes the row and clears the cookies, and better-auth finds nothing.
async fn rust_expires(side: &Side, minted: &Minted, token: &str) {
    set_expiry(&side.pool, token, now_ms() + SECOND).await;
    let live = side.get(&minted.cookie).await;
    assert_eq!(json(&live)["session"]["token"], token, "{}", side.mode);

    set_expiry(&side.pool, token, now_ms() - SECOND).await;
    let expired = side.get(&minted.cookie).await;
    assert_eq!(expired.body, "null", "{}", side.mode);
    assert_eq!(set_cookies(&expired), side.cleared(), "{}", side.mode);
    assert_eq!(row(&side.pool, token).await, None, "{}", side.mode);

    let theirs = better_auth(side.mode, "get", &minted.cookie, None);
    assert_eq!(theirs.body, Value::Null, "{}", side.mode);
    assert_eq!(
        theirs.set_cookie,
        side.cleared(),
        "{}: the same cookies",
        side.mode
    );
}

/// Rust signs a better-auth session out; better-auth then finds nothing.
async fn rust_signs_out(side: &Side) {
    let minted = mint(side.mode);
    let token = token_of(&minted.cookie);
    let reply = side.sign_out(&minted.cookie).await;
    assert_eq!(
        reply.status,
        StatusCode::OK,
        "{}: {}",
        side.mode,
        reply.body
    );
    assert_eq!(reply.body, r#"{"success":true}"#);
    assert_eq!(set_cookies(&reply), side.cleared(), "{}", side.mode);
    assert_eq!(row(&side.pool, &token).await, None, "{}", side.mode);

    let theirs = better_auth(side.mode, "get", &minted.cookie, None);
    assert_eq!(theirs.body, Value::Null, "{}", side.mode);
}

#[tokio::test]
#[ignore = "needs Node and node_modules: cargo test --test auth_session_cross -- --ignored --nocapture"]
async fn rust_reads_extends_expires_and_signs_out_better_auth_sessions() {
    for mode in MODES {
        let minted = mint(mode);
        let side = Side::new(mode).await;
        let token = token_of(&minted.cookie);
        assert!(minted.cookie_name.starts_with(side.prefix()), "{mode}");

        rust_reads(&side, &minted, &token).await;
        rust_extends(&side, &minted, &token).await;
        rust_expires(&side, &minted, &token).await;
        rust_signs_out(&side).await;
        println!("NODE_ENV={mode}: better-auth agrees with every state Rust left");
    }
}

/// better-auth leaves a session a second short of the refresh boundary as it
/// is, extends one a second past it, and Rust reads both as better-auth
/// answered, extending neither again.
async fn better_auth_extends(side: &Side, minted: &Minted, token: &str) {
    let before = row(&side.pool, token).await.expect("a row");
    let short = better_auth(side.mode, "get", &minted.cookie, Some(WEEK - DAY + SECOND));
    assert!(short.set_cookie.is_empty(), "{}: not due yet", side.mode);
    let kept = row(&side.pool, token).await.expect("a row");
    assert_eq!(kept.updated_at, before.updated_at, "{}", side.mode);
    let ours = side.get(&minted.cookie).await;
    assert!(set_cookies(&ours).is_empty(), "{}", side.mode);
    assert_eq!(json(&ours), short.body, "{}", side.mode);

    let due = better_auth(side.mode, "get", &minted.cookie, Some(WEEK - DAY - SECOND));
    assert_eq!(
        due.set_cookie,
        [side.refreshed(&minted.cookie)],
        "{}",
        side.mode
    );
    let after = row(&side.pool, token).await.expect("a row");
    assert_eq!(after.updated_at, after.expires_at - WEEK, "{}", side.mode);
    let ours = side.get(&minted.cookie).await;
    assert!(
        set_cookies(&ours).is_empty(),
        "{}: no second refresh",
        side.mode
    );
    assert_eq!(json(&ours), due.body, "{}", side.mode);
    assert_eq!(row(&side.pool, token).await, Some(after), "{}", side.mode);
}

/// better-auth reads a session a second before `expiresAt` and deletes it a
/// second after; Rust then finds nothing and clears the same cookies.
async fn better_auth_expires(side: &Side, minted: &Minted, token: &str) {
    let live = better_auth(side.mode, "get", &minted.cookie, Some(SECOND));
    assert_eq!(live.body["session"]["token"], token, "{}", side.mode);

    let expired = better_auth(side.mode, "get", &minted.cookie, Some(-SECOND));
    assert_eq!(expired.body, Value::Null, "{}", side.mode);
    assert_eq!(expired.set_cookie, side.cleared(), "{}", side.mode);
    assert_eq!(row(&side.pool, token).await, None, "{}", side.mode);

    let ours = side.get(&minted.cookie).await;
    assert_eq!(ours.body, "null", "{}", side.mode);
    assert_eq!(set_cookies(&ours), expired.set_cookie, "{}", side.mode);
}

/// better-auth signs a session out; Rust then finds nothing.
async fn better_auth_signs_out(side: &Side) {
    let minted = mint(side.mode);
    let token = token_of(&minted.cookie);
    let theirs = better_auth(side.mode, "sign-out", &minted.cookie, None);
    assert_eq!(theirs.body, serde_json::json!({ "success": true }));
    assert_eq!(theirs.set_cookie, side.cleared(), "{}", side.mode);
    assert_eq!(row(&side.pool, &token).await, None, "{}", side.mode);

    let ours = side.get(&minted.cookie).await;
    assert_eq!(ours.body, "null", "{}", side.mode);
    assert_eq!(set_cookies(&ours), side.cleared(), "{}", side.mode);
}

#[tokio::test]
#[ignore = "needs Node and node_modules: cargo test --test auth_session_cross -- --ignored --nocapture"]
async fn better_auth_reads_extends_expires_and_signs_out_and_rust_agrees() {
    for mode in MODES {
        let minted = mint(mode);
        let side = Side::new(mode).await;
        let token = token_of(&minted.cookie);

        better_auth_extends(&side, &minted, &token).await;
        better_auth_expires(&side, &minted, &token).await;
        better_auth_signs_out(&side).await;
        println!("NODE_ENV={mode}: Rust agrees with every state better-auth left");
    }
}
