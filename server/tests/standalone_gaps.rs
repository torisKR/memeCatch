//! The last requests an Axum without upstream (`AXUM_NO_UPSTREAM`) left to
//! Next (`PLAN.md` C3): each is answered here as Next answers it.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, config_alone, send, spawn_app};

async fn alone(extra: &[(&str, &str)]) -> SocketAddr {
    spawn_app(config_alone(UNUSED_DATABASE_URL, extra)).await
}

/// C3-3: `/api/auth/*` paths no native endpoint takes get better-auth's own
/// answers (better-call's router), as C1-11 lists them.
#[tokio::test]
async fn unported_auth_paths_get_better_auths_router_answers() {
    let app = alone(&[]).await;
    let none: [(&str, &str); 0] = [];
    let head = send(app, "HEAD", "/api/auth/get-session", &none, Body::empty()).await;
    let post = send(app, "POST", "/api/auth/get-session", &none, Body::empty()).await;
    let text = [("content-type", "Text/Plain; charset=utf-8")];
    let post_text = send(app, "POST", "/api/auth/get-session", &text, "x").await;
    let unknown_get = send(app, "GET", "/api/auth/nope", &none, Body::empty()).await;
    let unknown_post = send(app, "POST", "/api/auth/nope/deeper", &none, "{}").await;
    let wrong_method = send(app, "GET", "/api/auth/sign-out", &none, Body::empty()).await;
    let put = send(app, "PUT", "/api/auth/nope", &none, Body::empty()).await;
    let unported = send(app, "GET", "/api/auth/list-sessions", &none, Body::empty()).await;

    for (reply, what) in [
        (&head, "HEAD get-session"),
        (&unknown_get, "GET unknown"),
        (&unknown_post, "POST unknown"),
        (&wrong_method, "GET of a POST endpoint"),
    ] {
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{what}");
        assert_eq!(reply.body, "", "{what}");
        assert!(reply.header("x-axum-not-ported").is_none(), "{what}");
    }
    assert_eq!(post.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(post.header("content-type"), Some("application/json"));
    assert_eq!(
        post.body,
        r#"{"message":"Content-Type is required. Allowed types: application/json","code":"UNSUPPORTED_MEDIA_TYPE"}"#
    );
    assert_eq!(post_text.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
    assert_eq!(
        post_text.body,
        r#"{"message":"Content-Type \"Text/Plain; charset=utf-8\" is not allowed. Allowed types: application/json","code":"UNSUPPORTED_MEDIA_TYPE"}"#
    );
    // Next's own answer for a method route.ts does not export.
    assert_eq!(put.status, StatusCode::METHOD_NOT_ALLOWED);
    // An endpoint that would run, which the app never calls: still Next's.
    assert_eq!(unported.status, StatusCode::NOT_IMPLEMENTED);
    assert_eq!(
        unported.header("x-axum-not-ported"),
        Some("/api/auth/[...all]")
    );
}

/// In production better-auth's limiter runs before its router, for any path:
/// `/change-email` is 3 per 10 s, so the fourth is a 429 before the 415.
#[tokio::test]
async fn the_auth_limiter_counts_unported_paths_too() {
    let app = alone(&[("NODE_ENV", "production")]).await;
    let from = [("x-forwarded-for", "203.0.113.7")];
    let mut statuses = Vec::new();
    for _ in 0..4 {
        let reply = send(app, "POST", "/api/auth/change-email", &from, Body::empty()).await;
        statuses.push(reply.status);
    }
    assert_eq!(
        statuses,
        [
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            StatusCode::TOO_MANY_REQUESTS,
        ]
    );
}
