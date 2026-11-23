//! The meme card routes, `/api/quiz`, `/api/memes/view` and
//! `/api/analytics/events` over HTTP.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They insert memes whose
//! slug starts with `axum-r2-`, replace the collectible cards and their
//! owners, and remove what they wrote. The quiz tests also replace the
//! approved rows of `memes`, as `tests/public_routes` does.
//!
//! One file per group of routes; `main.rs` holds what they share.

mod cards;
#[path = "../common/mod.rs"]
mod common;
mod quiz_route;
mod routing;
mod tracking;

use std::net::SocketAddr;
use std::time::SystemTime;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use common::{
    UNUSED_DATABASE_URL, client, closed_addr, config, database_url, spawn_app, spawn_router,
};
use hmac::{Hmac, KeyInit, Mac};
use http_body_util::BodyExt;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sha2::Sha256;
use sqlx::AssertSqlSafe;
use sqlx::postgres::PgRow;
use tokio::sync::{Mutex, MutexGuard};

const SITE_URL: &str = "https://memes.example";
/// `BETTER_AUTH_SECRET` in `common::config`.
const AUTH_SECRET: &str = "test-only-auth-secret";
const SIGNING_SECRET: &str = "test-only-signing-secret";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
/// The app settings of every test: the session cookie has its plain name
/// (`NODE_ENV=development`), and the signing secret is set.
const APP_ENV: [(&str, &str); 4] = [
    ("NEXT_PUBLIC_SITE_URL", SITE_URL),
    ("RELEASE_SHA", "abc123"),
    ("MEMECATCH_SIGNING_SECRET", SIGNING_SECRET),
    ("NODE_ENV", "development"),
];

/// Tests that depend on what `memes` and the card tables hold take this
/// lock: cargo runs the tests of one binary in parallel.
static TABLES: Mutex<()> = Mutex::const_new(());

async fn lock_tables() -> MutexGuard<'static, ()> {
    TABLES.lock().await
}

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

impl Reply {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .get(name)
            .map(|value| value.to_str().expect("ascii header"))
    }

    fn json(&self) -> serde_json::Value {
        serde_json::from_str(&self.body).unwrap_or_else(|_| panic!("JSON body, got {}", self.body))
    }
}

async fn send(
    app: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: impl Into<Body>,
) -> Reply {
    let mut request = Request::builder()
        .method(method)
        .uri(format!("http://{app}{path}"));
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let response = client()
        .request(request.body(body.into()).unwrap())
        .await
        .expect("response");
    let (parts, body) = response.into_parts();
    let body = body.collect().await.expect("body").to_bytes();
    Reply {
        status: parts.status,
        headers: parts.headers,
        body: String::from_utf8(body.to_vec()).expect("utf-8 body"),
    }
}

async fn get(app: SocketAddr, path: &str, headers: &[(&str, &str)]) -> Reply {
    send(app, "GET", path, headers, Body::empty()).await
}

async fn post(app: SocketAddr, path: &str, headers: &[(&str, &str)], body: &str) -> Reply {
    send(app, "POST", path, headers, body.to_owned()).await
}

/// An upstream that answers every request with 418 and names what it saw.
async fn marker_upstream() -> SocketAddr {
    spawn_router(Router::new().fallback(|request: Request| async move {
        (
            StatusCode::IM_A_TEAPOT,
            format!("upstream saw {} {}", request.method(), request.uri()),
        )
    }))
    .await
}

fn upstream_saw(method: &str, target: &str) -> String {
    format!("upstream saw {method} {target}")
}

/// The app with no database behind it. `extra` wins over `APP_ENV`.
async fn app_without_db(upstream: SocketAddr, extra: &[(&str, &str)]) -> SocketAddr {
    spawn_app(config(
        upstream,
        UNUSED_DATABASE_URL,
        &[extra, &APP_ENV[..]].concat(),
    ))
    .await
}

/// The app on the test database. Its upstream is the marker: an answer that
/// is not 418 came from this server.
async fn app_with_db() -> SocketAddr {
    spawn_app(config(marker_upstream().await, &database_url(), &APP_ENV)).await
}

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

/// Runs statements as `service_role`, which may write every table the routes
/// touch. The text is assembled by the tests from their own constants and
/// generated ids, never from a response, hence `AssertSqlSafe`.
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

/// Reads rows as `service_role`.
async fn rows<T>(db: &Db, query: String) -> Vec<T>
where
    T: for<'r> sqlx::FromRow<'r, PgRow> + Send + Unpin + 'static,
{
    let found: Result<Vec<T>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_as(AssertSqlSafe(query)).fetch_all(tx).await }),
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

/// A signed-in user: the id and the `Cookie` header value of a session.
struct TestUser {
    id: String,
    cookie: String,
}

/// A better-auth user the way the app leaves one (the `"user"` row and the
/// `auth.users` row `syncAuthUser` adds, whose trigger creates the profile),
/// with a session and its signed cookie.
async fn sign_in(db: &Db) -> TestUser {
    sign_in_as(db, true).await
}

/// A session whose user has no `auth.users` row: `syncAuthUser` failed, or
/// the row was removed since.
async fn sign_in_without_auth_user(db: &Db) -> TestUser {
    sign_in_as(db, false).await
}

async fn sign_in_as(db: &Db, with_auth_user: bool) -> TestUser {
    let pool = db.pool();
    sqlx::raw_sql(AUTH_TABLES)
        .execute(pool)
        .await
        .expect("create the better-auth tables");
    let (id, email): (String, String) = sqlx::query_as(
        r#"insert into public."user" (name, email, "emailVerified")
           values ('axum r2 test', 'axum-auth-' || gen_random_uuid() || '@example.com', true)
           returning id::text, email"#,
    )
    .fetch_one(pool)
    .await
    .expect("insert user");
    if with_auth_user {
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
        id,
        cookie: session_cookie(&token),
    }
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac key");
    mac.update(message);
    mac.finalize().into_bytes().to_vec()
}

/// The cookie better-auth sets: `<token>.<base64 HMAC>`, percent-encoded.
/// Written independently of `src/auth.rs`.
fn session_cookie(token: &str) -> String {
    let signature = STANDARD.encode(hmac_sha256(AUTH_SECRET.as_bytes(), token.as_bytes()));
    let value = format!("{token}.{signature}")
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
    format!("better-auth.session_token={value}")
}

/// The `mc_growth_session` cookie of lib/growth/events.server.ts for a
/// session id, written independently of `src/routes/tracking/growth.rs`.
fn growth_cookie(session_id: &str) -> String {
    let key = hmac_sha256(
        SIGNING_SECRET.as_bytes(),
        b"memecatch:growth-session-signing:v1",
    );
    let mac = hmac_sha256(&key, format!("v1:{session_id}").as_bytes());
    format!(
        "mc_growth_session={session_id}.{}",
        URL_SAFE_NO_PAD.encode(mac)
    )
}

/// A random UUID (version 4), from the database.
async fn new_uuid(db: &Db) -> String {
    let id: Vec<(String,)> = rows(db, "select gen_random_uuid()::text".to_owned()).await;
    id[0].0.clone()
}

/// A client address no other test of this run uses.
fn unique_ip() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.subsec_nanos());
    format!("203.{}.{}.{}", seed % 250, (seed / 250) % 250, n % 250)
}
