//! `/robots.txt`, and `HEAD` on the routes that answer it.

use super::*;

// The body for NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001.
const ROBOTS_FROM_NEXT: &str = include_str!("../fixtures/robots.txt");

#[tokio::test]
async fn robots_txt_is_the_rendered_text_with_its_headers() {
    let app = app_without_db(&[]).await;

    let reply = get(app, "/robots.txt?anything=1").await;

    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        ROBOTS_FROM_NEXT.replace("http://127.0.0.1:3001", SITE_URL)
    );
    assert_eq!(
        reply.header("content-type"),
        Some("text/plain; charset=utf-8")
    );
    assert_eq!(reply.header("cache-control"), Some("s-maxage=31536000"));
    assert_eq!(reply.header("x-nextjs-cache"), Some("HIT"));
    assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    assert_eq!(reply.header("x-memecatch-release-sha"), Some("abc123"));
    // Chunked, with no length.
    assert_eq!(reply.header("content-length"), None);
}

#[tokio::test]
async fn head_answers_carry_the_get_headers_and_no_length_or_body() {
    let app = app_without_db(&[]).await;

    let get_reply = get(app, "/robots.txt").await;
    let head = send(app, "HEAD", "/robots.txt", &[], Body::empty()).await;

    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.body, "");
    assert_eq!(head.header("content-length"), None);
    for name in ["content-type", "cache-control", "x-nextjs-cache", "vary"] {
        assert_eq!(head.header(name), get_reply.header(name), "{name}");
    }
}
