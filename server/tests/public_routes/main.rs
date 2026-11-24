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

use std::collections::BTreeSet;
use std::net::SocketAddr;
use std::time::SystemTime;

use axum::body::Body;
use axum::http::StatusCode;
use common::{Reply, UNUSED_DATABASE_URL, closed_addr, config, database_url, get, send, spawn_app};
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
