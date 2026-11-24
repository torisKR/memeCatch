//! Answers that once came from the old app's router (`PLAN.md` C3, L2-1).

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, config_alone, send, spawn_app};

async fn alone(extra: &[(&str, &str)]) -> SocketAddr {
    spawn_app(config_alone(UNUSED_DATABASE_URL, extra)).await
}

/// `/api/auth/*` paths no endpoint here takes get better-auth's own router
/// answers; an endpoint the site never calls is a 404 too, and a known path
/// with another method a 405.
#[tokio::test]
async fn unported_auth_paths_get_better_auths_router_answers() {
    let app = alone(&[]).await;
    let none: [(&str, &str); 0] = [];
    let head = send(app, "HEAD", "/api/auth/get-session", &none, Body::empty()).await;
    let post = send(app, "POST", "/api/auth/change-email", &none, Body::empty()).await;
    let post_session = send(app, "POST", "/api/auth/get-session", &none, Body::empty()).await;
    let text = [("content-type", "Text/Plain; charset=utf-8")];
    let post_text = send(app, "POST", "/api/auth/change-email", &text, "x").await;
    let unknown_get = send(app, "GET", "/api/auth/nope", &none, Body::empty()).await;
    let unknown_post = send(app, "POST", "/api/auth/nope/deeper", &none, "{}").await;
    let wrong_method = send(app, "GET", "/api/auth/sign-out", &none, Body::empty()).await;
    let put = send(app, "PUT", "/api/auth/nope", &none, Body::empty()).await;
    let unported = send(app, "GET", "/api/auth/list-sessions", &none, Body::empty()).await;

    for (reply, what) in [
        (&head, "HEAD get-session"),
        (&unknown_get, "GET unknown"),
        (&unknown_post, "POST unknown"),
        (&unported, "an endpoint the site never calls"),
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
    assert_eq!(put.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(put.header("allow"), Some("GET,HEAD,POST"));
    assert_eq!(wrong_method.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(wrong_method.header("allow"), Some("POST"));
    assert_eq!(post_session.status, StatusCode::METHOD_NOT_ALLOWED);
    assert_eq!(post_session.header("allow"), Some("GET,HEAD"));
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

/// C3-5: Next serves the rewrite's target too: `/locale-rankings/en` is the
/// board `/en/rankings` shows, and a path there that is no locale is
/// `notFound()` in that root layout, `app/global-not-found.tsx`.
#[tokio::test]
async fn the_locale_rankings_path_is_the_localized_board_or_the_global_404() {
    let app = alone(&[]).await;
    let none: [(&str, &str); 0] = [];
    let rewritten = send(app, "GET", "/en/rankings", &none, Body::empty()).await;
    let direct = send(app, "GET", "/locale-rankings/en", &none, Body::empty()).await;
    for path in [
        "/locale-rankings/ko",
        "/locale-rankings/xx",
        "/locale-rankings/EN",
    ] {
        let reply = send(app, "GET", path, &none, Body::empty()).await;
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{path}");
        assert!(reply.header("x-axum-not-ported").is_none(), "{path}");
        assert!(reply.body.contains("페이지를 찾을 수 없어요"), "{path}");
    }

    assert_eq!(rewritten.status, StatusCode::OK);
    assert_eq!(direct.status, StatusCode::OK);
    let title = |body: &str| {
        let start = body.find("<title>").expect("a title");
        body[start..body[start..].find("</title>").unwrap() + start].to_owned()
    };
    assert_eq!(title(&direct.body), title(&rewritten.body));
    assert!(
        direct.body.contains(r#"<html lang="en""#),
        "{}",
        &direct.body[..200]
    );
}

/// C3-6: a quiz result token that does not decode is `notFound()` after its
/// metadata; Next streams that as a 200, this is the same document as a 404
/// (`PLAN.md` B6-22).
#[tokio::test]
async fn an_undecodable_quiz_token_is_the_not_found_document() {
    let app = alone(&[]).await;
    let none: [(&str, &str); 0] = [];
    for path in ["/quiz/r/x", "/quiz/r/%78"] {
        let reply = send(app, "GET", path, &none, Body::empty()).await;
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{path}");
        assert!(reply.header("x-axum-not-ported").is_none(), "{path}");
        assert!(
            reply
                .body
                .contains("<title>결과를 찾을 수 없어요 | 밈캐치</title>"),
            "{path}"
        );
        assert!(
            reply
                .body
                .contains(r#"<meta name="robots" content="noindex">"#),
            "{path}"
        );
    }
}
