//! Route ids, methods, and the requests a native route hands to Next.

use super::*;

/// A request each route answers itself without the database, and the
/// status it answers with: route id, method, target, status.
const ROUTES: [(&str, &str, &str, u16); 7] = [
    ("quiz", "GET", "/api/quiz?set=", 400),
    ("meme-cards", "GET", "/api/meme-cards?page=0", 400),
    ("meme-card", "GET", "/api/meme-cards/nope", 400),
    (
        "meme-cards-collection",
        "GET",
        "/api/meme-cards/collection?page=0",
        400,
    ),
    ("meme-cards-claim", "POST", "/api/meme-cards/claim", 403),
    ("memes-view", "POST", "/api/memes/view", 400),
    ("analytics-events", "POST", "/api/analytics/events", 403),
];

#[tokio::test]
async fn every_route_answers_itself_with_the_headers_next_adds() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    for (id, method, path, status) in ROUTES {
        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.status.as_u16(), status, "{id}: {}", reply.body);
        assert_eq!(
            reply.header("content-type"),
            Some("application/json"),
            "{id}"
        );
        assert_eq!(reply.header("vary"), Some(NEXT_VARY), "{id}");
        assert_eq!(
            reply.header("x-memecatch-release-sha"),
            Some("abc123"),
            "{id}"
        );
        assert_eq!(
            reply.header("x-content-type-options"),
            Some("nosniff"),
            "{id}"
        );
        // Sent as Next sends a route handler's body: no length.
        assert_eq!(reply.header("content-length"), None, "{id}");
    }
}

#[tokio::test]
async fn bad_requests_are_refused_before_the_database_is_asked() {
    // The database refuses connections: a query would hold the answer for
    // seconds and end in another status.
    let app = app_without_db(closed_addr().await, &[]).await;
    let site = ("origin", SITE_URL);
    let big_claim = format!(r#"{{"cardId":"mc-0001","pad":"{}"}}"#, "p".repeat(1024));
    let big_event = format!(
        r#"{{"eventName":"copy","pad":"{}"}}"#,
        "p".repeat(16 * 1024)
    );
    let ip = unique_ip();
    let from = ("x-forwarded-for", ip.as_str());

    for (path, headers, body, status, expected) in [
        (
            "/api/meme-cards/claim",
            &[][..],
            "{}",
            403,
            r#"{"error":"invalid_origin"}"#,
        ),
        (
            "/api/meme-cards/claim",
            &[("sec-fetch-site", "same-site")],
            "{}",
            403,
            r#"{"error":"invalid_origin"}"#,
        ),
        (
            "/api/meme-cards/claim",
            &[("sec-fetch-site", "same-origin")],
            "{",
            400,
            r#"{"error":"invalid_input"}"#,
        ),
        (
            "/api/meme-cards/claim",
            &[site],
            big_claim.as_str(),
            413,
            r#"{"error":"body_too_large"}"#,
        ),
        (
            "/api/meme-cards/claim",
            &[site],
            r#"{"cardId":"mc-0001","x":1}"#,
            400,
            r#"{"error":"invalid_input"}"#,
        ),
        (
            "/api/meme-cards/claim",
            &[site],
            r#"{"cardId":"mc-0000"}"#,
            400,
            r#"{"error":"invalid_input"}"#,
        ),
        (
            "/api/memes/view",
            &[from],
            "{",
            400,
            r#"{"ok":false,"error":"invalid_json"}"#,
        ),
        (
            "/api/memes/view",
            &[from],
            "[]",
            400,
            r#"{"ok":false,"error":"invalid_meme"}"#,
        ),
        (
            "/api/memes/view",
            &[from, site],
            r#"{"memeId":"nope"}"#,
            400,
            r#"{"ok":false,"error":"invalid_meme"}"#,
        ),
        (
            "/api/analytics/events",
            &[from],
            "{}",
            403,
            r#"{"ok":false,"error":"origin_not_allowed"}"#,
        ),
        (
            "/api/analytics/events",
            &[from, site],
            "{",
            400,
            r#"{"ok":false,"error":"invalid_json"}"#,
        ),
        (
            "/api/analytics/events",
            &[from, site],
            "[]",
            400,
            r#"{"ok":false,"error":"invalid_payload"}"#,
        ),
        (
            "/api/analytics/events",
            &[from, site],
            r#"{"eventName":"renewal"}"#,
            400,
            r#"{"ok":false,"error":"invalid_event"}"#,
        ),
        (
            "/api/analytics/events",
            &[from, site],
            r#"{"eventName":"copy","params":{"meme_id":"nope"}}"#,
            400,
            r#"{"ok":false,"error":"invalid_meme"}"#,
        ),
        (
            "/api/analytics/events",
            &[from, site],
            big_event.as_str(),
            413,
            r#"{"ok":false,"error":"payload_too_large"}"#,
        ),
    ] {
        let reply = post(app, path, headers, body).await;

        assert_eq!(reply.status.as_u16(), status, "{path} {body:.40}");
        assert_eq!(reply.body, expected, "{path} {body:.40}");
        assert_eq!(reply.header("set-cookie"), None, "{path} {body:.40}");
    }
    // The claim route marks every answer private.
    let claim = post(app, "/api/meme-cards/claim", &[], "{}").await;
    assert_eq!(claim.header("cache-control"), Some("private, no-store"));
}
