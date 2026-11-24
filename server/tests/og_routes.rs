//! `/og/{locale}`, `/opengraph-image` and `/og/quiz/{token}` (routes/og.rs):
//! status, headers and what stays with Next. The pixels are
//! tests/og_cards.rs's; parity/og.mjs compares both with the real Next.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::{UNUSED_DATABASE_URL, client, config, marker_upstream, spawn_app};
use http_body_util::BodyExt;
use memecatch_server::og::default_card::AR_PNG;

const QUIZ: &str = "/og/quiz/a005aaaaaaa1aaaaaaa2aaaaaaa3";

struct Answer {
    status: StatusCode,
    headers: axum::http::HeaderMap,
    body: Vec<u8>,
}

impl Answer {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name).map(|v| v.to_str().unwrap())
    }
}

async fn request(app: SocketAddr, method: &str, path: &str, host: Option<&str>) -> Answer {
    let mut builder = Request::builder()
        .method(method)
        .uri(format!("http://{app}{path}"));
    if let Some(host) = host {
        builder = builder.header("host", host);
    }
    let response = client()
        .request(builder.body(Body::empty()).unwrap())
        .await
        .unwrap();
    let (parts, body) = response.into_parts();
    Answer {
        status: parts.status,
        headers: parts.headers,
        body: body.collect().await.unwrap().to_bytes().to_vec(),
    }
}

async fn app(extra: &[(&str, &str)]) -> SocketAddr {
    let upstream = marker_upstream().await;
    spawn_app(config(upstream, UNUSED_DATABASE_URL, extra)).await
}

#[tokio::test]
async fn the_default_cards_are_answered_as_next_serves_its_prerendered_ones() {
    let app = app(&[]).await;
    for locale in ["ko", "en", "ja", "zh", "zh-tw", "ar"] {
        let answer = request(app, "GET", &format!("/og/{locale}"), None).await;
        assert_eq!(answer.status, StatusCode::OK, "{locale}");
        assert_eq!(answer.header("content-type"), Some("image/png"));
        assert_eq!(
            answer.header("cache-control"),
            Some("public, max-age=86400")
        );
        assert_eq!(answer.header("x-nextjs-cache"), Some("HIT"));
        assert_eq!(answer.header("content-language"), Some("ko"));
        assert_eq!(&answer.body[..8], b"\x89PNG\r\n\x1a\n", "{locale}");
    }
    let ar = request(app, "GET", "/og/ar?v=2", None).await;
    assert_eq!(ar.body, AR_PNG);

    let ko = request(app, "GET", "/og/ko", None).await;
    let again = request(app, "GET", "/og/ko?v=1", None).await;
    assert_eq!(ko.body, again.body, "drawn once, a query changes nothing");
    let head = request(app, "HEAD", "/og/ko", None).await;
    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.header("cache-control"), Some("public, max-age=86400"));
    assert!(head.body.is_empty());

    let root = request(app, "GET", "/opengraph-image?abc", None).await;
    assert_eq!(root.status, StatusCode::OK);
    assert_eq!(
        root.header("cache-control"),
        Some("public, max-age=0, must-revalidate")
    );
    assert_eq!(root.header("x-nextjs-cache"), Some("HIT"));
    assert_eq!(root.body, ko.body, "the root card is the Korean card");
}

#[tokio::test]
async fn the_quiz_card_and_its_404() {
    let app = app(&[]).await;
    let card = request(app, "GET", QUIZ, None).await;
    assert_eq!(card.status, StatusCode::OK);
    assert_eq!(card.header("content-type"), Some("image/png"));
    assert_eq!(
        card.header("cache-control"),
        Some("public, max-age=86400, s-maxage=604800")
    );
    assert_eq!(card.header("x-nextjs-cache"), None);
    assert_eq!(card.header("content-language"), Some("ko"));

    for bad in [
        "/og/quiz/a005",
        "/og/quiz/a008aaaaaaa1aaaaaaa2aaaaaaa3",
        "/og/quiz/x",
    ] {
        let missing = request(app, "GET", bad, None).await;
        assert_eq!(missing.status, StatusCode::NOT_FOUND, "{bad}");
        assert_eq!(missing.body, b"Not found");
        assert_eq!(
            missing.header("content-type"),
            Some("text/plain; charset=utf-8")
        );
        assert_eq!(missing.header("cache-control"), None);
    }
}

/// The share cards with a database that cannot be read: the Korean card
/// falls back to the curated card or the default card, the translated one
/// to the default card with `no-store`.
#[tokio::test]
async fn a_share_card_without_its_database_falls_back_as_the_typescript_does() {
    let app = app(&[]).await;
    let curated = request(
        app,
        "GET",
        "/memes/jkm2022k-jung-kkuk-ma/opengraph-image-k2cx9c",
        None,
    )
    .await;
    assert_eq!(curated.status, StatusCode::OK);
    assert_eq!(curated.header("content-type"), Some("image/png"));
    // A curated card shows no photo: `x-share-photo: 0` is `no-store`.
    assert_eq!(curated.header("cache-control"), Some("no-store"));
    assert_eq!(curated.header("content-language"), Some("ko"));
    let unknown = request(app, "GET", "/memes/zzzzzzzz/opengraph-image-k2cx9c", None).await;
    assert_eq!(
        unknown.header("cache-control"),
        Some("public, max-age=0, must-revalidate")
    );
    assert_ne!(unknown.body, curated.body);
    let translated = request(app, "GET", "/zh-tw/memes/r10og01/opengraph-image", None).await;
    assert_eq!(translated.status, StatusCode::OK);
    assert_eq!(translated.header("cache-control"), Some("no-store"));
    assert_eq!(translated.header("content-language"), Some("zh-Hant"));
    // Another first segment is Next's, as is a key Next would not decode.
}

/// The export route before its quota: the locale, then the session.
#[tokio::test]
async fn the_export_route_answers_its_refusals() {
    let app = app(&[]).await;
    let bad = request(app, "GET", "/memes/r10og01/export?locale=xx", None).await;
    assert_eq!(bad.status, StatusCode::BAD_REQUEST);
    assert_eq!(bad.body, br#"{"error":"invalid_locale"}"#);
    assert_eq!(bad.header("cache-control"), Some("private, no-store"));
    assert_eq!(bad.header("x-content-type-options"), Some("nosniff"));
    let signed_out = request(app, "GET", "/memes/r10og01/export?locale=ja", None).await;
    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(signed_out.body, br#"{"error":"signed_out"}"#);
    assert_eq!(signed_out.header("content-language"), Some("ja"));
}
