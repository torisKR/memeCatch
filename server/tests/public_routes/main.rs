//! The five public routes of `routes/public.rs` over HTTP: `/robots.txt`,
//! `/api/random-meme`, `/memes/random`, `/api/csp-report`, `/api/daily-quiz`.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They replace the approved
//! rows of `memes`, so they refuse a database that holds profiles (other than
//! the users `tests/auth.rs` creates) or more than a few memes of its own.
//!
//! One file per route; `main.rs` holds what they share.

#[path = "../common/mod.rs"]
mod common;
mod csp_report;
mod daily_quiz_route;
mod memes_table;
mod random;
mod robots;
mod routing;

use std::collections::BTreeSet;
use std::net::SocketAddr;
use std::time::SystemTime;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use common::{
    UNUSED_DATABASE_URL, client, closed_addr, config, database_url, spawn_app, spawn_router,
};
use http_body_util::BodyExt;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::routes::public::daily_quiz;
use memecatch_server::routes::public::quiz::{self, PoolMeme};
use memecatch_server::{AppState, build_app};
use memes_table::{SeedMeme, replace_approved_memes, seed_db};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, MutexGuard};

const SITE_URL: &str = "https://memes.example";
const SHORT_ID_ALPHABET: &str = "abcdefghjkmnpqrstuvwxyz23456789";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
/// Every row these tests insert has a slug with this prefix.
const SLUG_PREFIX: &str = "axum-t4-";
const UNAVAILABLE: &str =
    r#"{"error":"오늘의 퀴즈를 불러오지 못했어요.","code":"DAILY_QUIZ_UNAVAILABLE"}"#;

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

async fn get(app: SocketAddr, path: &str) -> Reply {
    send(app, "GET", path, &[], Body::empty()).await
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

/// The app with no database behind it, for routes and cases that query nothing.
async fn app_without_db(upstream: SocketAddr, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
    ];
    // `extra` first: the first value found for a name wins.
    spawn_app(config(
        upstream,
        UNUSED_DATABASE_URL,
        &[extra, &base[..]].concat(),
    ))
    .await
}

async fn app_with_db(upstream: SocketAddr) -> SocketAddr {
    spawn_app(config(
        upstream,
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", SITE_URL),
            ("RELEASE_SHA", "abc123"),
        ],
    ))
    .await
}
