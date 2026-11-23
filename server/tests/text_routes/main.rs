//! The text routes of `routes/public.rs` over HTTP: `/llms.txt`,
//! `/llms-full.txt`, `/feed.xml`, `/feed/updated.xml` and the localized
//! `/{locale}/llms.txt` and `/{locale}/llms-full.txt`.
//!
//! The expected bodies under `tests/fixtures/r1/` are what the real Next
//! server answered for the rows of `tests/fixtures/r1_seed.sql`
//! (`parity/README.md` has the steps), so these tests hold the Rust to Next's
//! bytes without a Next server.
//!
//! They need the test database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.
//! The seed replaces every meme, so they refuse a database that holds
//! profiles (other than test users) or more than a few memes of its own.

#[path = "../common/mod.rs"]
mod common;
mod corpus;
mod korean;
mod localized;
mod routing;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{
    Reply, UNUSED_DATABASE_URL, config, database_url, get, marker_upstream, send, spawn_app,
};
use corpus::{empty_corpus, seeded_corpus};

/// The `NEXT_PUBLIC_SITE_URL` of the Next build the fixtures came from.
const SITE_URL: &str = "http://127.0.0.1:3411";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
const UNAVAILABLE: &str = "Publication export temporarily unavailable.\n";

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
    ];
    // `extra` first: the first value found for a name wins.
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

async fn app_with_db(upstream: SocketAddr) -> SocketAddr {
    app(upstream, &database_url(), &[]).await
}

/// The app with a database that refuses connections.
async fn app_without_db(upstream: SocketAddr, extra: &[(&str, &str)]) -> SocketAddr {
    app(upstream, UNUSED_DATABASE_URL, extra).await
}

/// What every answer of these routes carries besides its body: the headers
/// the handler sets and the ones Next adds to every route.
fn assert_text_headers(reply: &Reply, content_type: &str, language: Option<&str>, path: &str) {
    assert_eq!(reply.status, StatusCode::OK, "{path}");
    assert_eq!(reply.header("content-type"), Some(content_type), "{path}");
    assert_eq!(reply.header("content-language"), language, "{path}");
    assert_eq!(
        reply.header("cache-control"),
        Some("public, max-age=3600"),
        "{path}"
    );
    assert_eq!(reply.header("vary"), Some(NEXT_VARY), "{path}");
    assert_eq!(
        reply.header("x-memecatch-release-sha"),
        Some("abc123"),
        "{path}"
    );
    // Next sends a route handler's body chunked.
    assert_eq!(reply.header("content-length"), None, "{path}");
}
