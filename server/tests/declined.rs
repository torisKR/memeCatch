//! Requests a route declines get that route's own answer, never a 501
//! (PLAN.md L2-2). No database: every case here is decided before a read,
//! or is the answer to a read that fails.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, config, parse_head, raw_request, send, spawn_app};

const SECRET: (&str, &str) = ("MEMECATCH_SIGNING_SECRET", "test-only-signing-secret");
const FOREIGN: [(&str, &str); 2] = [
    ("origin", "https://evil.example"),
    ("content-type", "application/json"),
];

async fn app(extra: &[(&str, &str)]) -> SocketAddr {
    spawn_app(config(UNUSED_DATABASE_URL, extra)).await
}

#[tokio::test]
async fn a_target_outside_ascii_is_400_before_any_route() {
    let app = app(&[SECRET]).await;
    for target in [
        "/about?q=한",
        "/api/db/query?x=é",
        "/api/meme-cards?ä",
        "/없는",
    ] {
        let raw = raw_request(
            app,
            &format!("GET {target} HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"),
        )
        .await;
        let (first, _) = parse_head(&raw);
        assert_eq!(first, "HTTP/1.1 400 Bad Request", "{target}");
    }
}

#[tokio::test]
async fn a_foreign_origin_gets_each_routes_403() {
    let app = app(&[SECRET]).await;
    for (path, body) in [
        (
            "/api/db/query",
            r#"{"data":null,"error":{"message":"untrusted origin","status":403},"count":null}"#,
        ),
        (
            "/api/analytics/events",
            r#"{"ok":false,"error":"origin_not_allowed"}"#,
        ),
        (
            "/api/memes/view",
            r#"{"ok":false,"error":"origin_not_allowed"}"#,
        ),
        ("/api/meme-cards/claim", r#"{"error":"invalid_origin"}"#),
    ] {
        let reply = send(app, "POST", path, &FOREIGN, "{}").await;
        assert_eq!(
            reply.status,
            StatusCode::FORBIDDEN,
            "{path}: {}",
            reply.body
        );
        assert_eq!(reply.body, body, "{path}");
    }
}

#[tokio::test]
async fn the_tracking_routes_without_their_secret_answer_503() {
    let app = app(&[]).await;
    let same = [("sec-fetch-site", "same-origin")];
    for (path, error) in [
        ("/api/memes/view", "view_unavailable"),
        ("/api/analytics/events", "analytics_unavailable"),
    ] {
        let reply = send(app, "POST", path, &same, "{}").await;
        assert_eq!(reply.status, StatusCode::SERVICE_UNAVAILABLE, "{path}");
        assert_eq!(
            reply.body,
            format!(r#"{{"ok":false,"error":"{error}"}}"#),
            "{path}"
        );
    }
}

#[tokio::test]
async fn auth_endpoints_answer_as_better_call_does() {
    let app = app(&[]).await;
    let none: [(&str, &str); 0] = [];
    for path in ["/api/auth/get-session", "/api/auth/verify-email?token=x"] {
        let head = send(app, "HEAD", path, &none, Body::empty()).await;
        assert_eq!(head.status, StatusCode::NOT_FOUND, "HEAD {path}");
    }
    let no_token = send(app, "GET", "/api/auth/verify-email", &none, Body::empty()).await;
    assert_eq!(no_token.status, StatusCode::BAD_REQUEST);
    assert!(
        no_token.body.contains(r#""code":"VALIDATION_ERROR""#),
        "{}",
        no_token.body
    );
    let form = [("content-type", "application/x-www-form-urlencoded")];
    let sign_in = send(app, "POST", "/api/auth/sign-in/email", &form, "a=b").await;
    assert_eq!(sign_in.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    let json = [("content-type", "application/json")];
    let odd = send(app, "POST", "/api/auth/sign-in/email", &json, "[]").await;
    assert_eq!(odd.status, StatusCode::BAD_REQUEST);
    assert!(
        odd.body.contains(r#""code":"VALIDATION_ERROR""#),
        "{}",
        odd.body
    );
}

#[tokio::test]
async fn pages_that_find_nothing_are_the_not_found_document() {
    let app = app(&[]).await;
    for path in [
        "/memes?page=abc",
        "/memes?page=2&page=3",
        "/guides/no-such-guide",
        "/originals/edition/no-such-edition",
        "/collections/no-such-collection",
        "/quiz/r/%ff",
    ] {
        let reply = send(app, "GET", path, &[], Body::empty()).await;
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{path}");
        assert!(reply.body.contains("<html"), "{path}");
        assert!(reply.header("x-axum-not-ported").is_none(), "{path}");
    }
    let first_page = send(app, "GET", "/memes?page=1", &[], Body::empty()).await;
    assert_eq!(first_page.status, StatusCode::PERMANENT_REDIRECT);
    assert_eq!(first_page.header("location"), Some("/memes"));
    let asset = send(app, "GET", "/_axum/site.0000000000.css", &[], Body::empty()).await;
    assert_eq!(asset.status, StatusCode::NOT_FOUND);
}

/// The database is unreachable here: a page whose read fails is the error
/// document.
#[tokio::test]
async fn a_page_whose_read_fails_is_the_error_document() {
    let app = app(&[]).await;
    for path in ["/memes", "/search?q=x", "/memes/abc-x"] {
        let reply = send(app, "GET", path, &[], Body::empty()).await;
        assert_eq!(reply.status, StatusCode::INTERNAL_SERVER_ERROR, "{path}");
        assert!(reply.body.contains("밈을 잡다가 놓쳤어요"), "{path}");
        assert_eq!(
            reply.header("cache-control"),
            Some("private, no-cache, no-store, max-age=0, must-revalidate"),
            "{path}"
        );
    }
}

#[tokio::test]
async fn images_and_ids_that_do_not_decode_are_not_found() {
    let app = app(&[]).await;
    let card = send(app, "GET", "/og/xx", &[], Body::empty()).await;
    assert_eq!(card.status, StatusCode::NOT_FOUND);
    let quiz = send(app, "GET", "/og/quiz/%ff", &[], Body::empty()).await;
    assert_eq!(quiz.status, StatusCode::NOT_FOUND);
    let meme_card = send(app, "GET", "/api/meme-cards/%ff", &[], Body::empty()).await;
    assert_eq!(meme_card.status, StatusCode::BAD_REQUEST);
    assert_eq!(meme_card.body, r#"{"error":"invalid_input"}"#);
    let job = send(app, "GET", "/api/mpe/jobs/%ff", &[], Body::empty()).await;
    assert_eq!(job.status, StatusCode::UNAUTHORIZED);
}
