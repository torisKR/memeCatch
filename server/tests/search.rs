//! `POST /api/memes/semantic-search` over HTTP.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::http::StatusCode;
use common::{config, database_url, send, spawn_app};

const SITE_URL: &str = "https://memes.example";
const PATH: &str = "/api/memes/semantic-search";

async fn app(database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let env = [&[("NEXT_PUBLIC_SITE_URL", SITE_URL)][..], extra].concat();
    spawn_app(config(database_url, &env)).await
}

async fn ask(app: SocketAddr, body: &str) -> common::Reply {
    let headers = [("origin", SITE_URL), ("content-type", "application/json")];
    send(app, "POST", PATH, &headers, body.to_owned()).await
}

#[tokio::test]
async fn the_reason_follows_the_setting_db() {
    let db = database_url();
    let on = [("MEME_SEMANTIC_SEARCH_ENABLED", "true")];
    let enabled = app(&db, &on).await;
    let disabled = app(&db, &[]).await;
    let query = r#"{"query":"없는 검색어 zzqx"}"#;

    let model_unavailable = ask(enabled, query).await;
    let disabled = ask(disabled, query).await;

    assert_eq!(model_unavailable.status, StatusCode::OK);
    assert_eq!(model_unavailable.header("cache-control"), Some("no-store"));
    assert_eq!(
        model_unavailable.body,
        r#"{"mode":"keyword","reason":"model_unavailable","items":[]}"#
    );
    assert_eq!(
        disabled.body,
        r#"{"mode":"keyword","reason":"disabled","items":[]}"#
    );
}

#[tokio::test]
async fn origin_and_body_are_checked() {
    let app = app(common::UNUSED_DATABASE_URL, &[]).await;

    let no_origin = send(app, "POST", PATH, &[], r#"{"query":"댄스"}"#).await;
    let short = ask(app, r#"{"query":" 밈 "}"#).await;

    assert_eq!(no_origin.status, StatusCode::FORBIDDEN);
    assert_eq!(no_origin.body, r#"{"error":"invalid_origin"}"#);
    assert_eq!(short.status, StatusCode::BAD_REQUEST);
    assert_eq!(short.body, r#"{"error":"invalid_query"}"#);
}
