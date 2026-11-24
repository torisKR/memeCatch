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
async fn each_route_id_in_axum_disabled_routes_falls_through_to_the_upstream() {
    let upstream = marker_upstream().await;

    for (id, method, path, _) in ROUTES {
        let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", id)]).await;

        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{id}");
        assert_eq!(reply.body, upstream_saw(method, path), "{id}");
        // Nothing added on the way back.
        assert!(!reply.headers.contains_key("vary"), "{id}");
        assert!(
            !reply.headers.contains_key("x-memecatch-release-sha"),
            "{id}"
        );
    }
}

#[tokio::test]
async fn disabling_one_route_leaves_the_others_native_and_all_seven_can_be_disabled() {
    let upstream = marker_upstream().await;
    let all_ids = ROUTES.map(|(id, ..)| id).join(",");
    let all_off = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", all_ids.as_str())]).await;

    for (id, method, path, _) in ROUTES {
        let reply = send(all_off, method, path, &[], Body::empty()).await;
        assert_eq!(reply.body, upstream_saw(method, path), "{id}");
    }
    for (disabled, ..) in ROUTES {
        let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", disabled)]).await;
        for (id, method, path, status) in ROUTES {
            if id == disabled {
                continue;
            }
            let reply = send(app, method, path, &[], Body::empty()).await;
            assert_eq!(
                reply.status.as_u16(),
                status,
                "{id} while {disabled} is disabled"
            );
        }
    }
}

#[tokio::test]
async fn methods_a_route_does_not_handle_go_to_the_upstream() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    for (method, path) in [
        ("POST", "/api/quiz"),
        ("OPTIONS", "/api/quiz"),
        ("POST", "/api/meme-cards"),
        ("DELETE", "/api/meme-cards/mc-0001"),
        ("POST", "/api/meme-cards/collection"),
        ("GET", "/api/meme-cards/claim"),
        ("OPTIONS", "/api/meme-cards/claim"),
        ("GET", "/api/memes/view"),
        ("PUT", "/api/analytics/events"),
        // R11 ports only its POST.
        (
            "GET",
            "/api/memes/11111111-1111-4111-8111-111111111111/view",
        ),
    ] {
        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.body, upstream_saw(method, path));
        assert!(!reply.headers.contains_key("allow"), "{method} {path}");
        assert!(!reply.headers.contains_key("vary"), "{method} {path}");
    }
}

#[tokio::test]
async fn without_the_signing_secret_or_a_site_url_the_routes_that_need_them_stay_with_next() {
    let upstream = marker_upstream().await;
    let no_secret = app_without_db(upstream, &[("MEMECATCH_SIGNING_SECRET", " ")]).await;
    let no_site = app_without_db(upstream, &[("NEXT_PUBLIC_SITE_URL", "catchmeme.com")]).await;

    for (app, proxied) in [
        (no_secret, &["memes-view", "analytics-events"][..]),
        (
            no_site,
            &["meme-cards-claim", "memes-view", "analytics-events"],
        ),
    ] {
        for (id, method, path, status) in ROUTES {
            let reply = send(app, method, path, &[], Body::empty()).await;

            if proxied.contains(&id) {
                assert_eq!(reply.body, upstream_saw(method, path), "{id}");
            } else {
                assert_eq!(reply.status.as_u16(), status, "{id}");
            }
        }
    }
}

// The TypeScript also accepts the origin Next takes for itself, which this
// server cannot know: Next answers those requests.
#[tokio::test]
async fn a_request_from_an_origin_that_is_not_the_site_is_answered_by_next() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    for path in [
        "/api/meme-cards/claim",
        "/api/memes/view",
        "/api/analytics/events",
    ] {
        for origin in [
            "http://localhost:3001",
            "https://evil.example",
            "https://MEMES.example",
        ] {
            let reply = post(app, path, &[("origin", origin)], "{}").await;
            assert_eq!(reply.body, upstream_saw("POST", path), "{origin}");
        }
        // The site's own origin is answered here.
        let own = post(app, path, &[("origin", SITE_URL)], "{").await;
        assert_eq!(own.status, StatusCode::BAD_REQUEST, "{path}: {}", own.body);
    }
}

#[tokio::test]
async fn targets_next_treats_specially_are_answered_by_next() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[]).await;
    let siblings_off = app_without_db(
        upstream,
        &[(
            "AXUM_DISABLED_ROUTES",
            "meme-cards-collection,meme-cards-claim",
        )],
    )
    .await;

    // Next decodes the id segment, and answers 500 to some escapes itself.
    for path in [
        "/api/meme-cards/mc%2D0001",
        "/api/meme-cards/%ff",
        "/api/meme-cards/mc-0001%2F",
    ] {
        assert_eq!(get(app, path, &[]).await.body, upstream_saw("GET", path));
    }
    // A byte outside ASCII in the target: Next answers 400 before any route.
    for path in [
        "/api/quiz?set=밈",
        "/api/meme-cards?query=밈",
        "/api/meme-cards/밈",
        "/api/meme-cards/collection?query=밈",
    ] {
        let reply = get(app, path, &[]).await;
        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{path}");
    }
    for path in [
        "/api/meme-cards/claim?x=밈",
        "/api/memes/view?x=밈",
        "/api/analytics/events?x=밈",
    ] {
        let reply = post(app, path, &[("origin", SITE_URL)], "{}").await;
        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{path}");
    }
    // The paths of the two sibling routes are never taken for a card id.
    for path in ["/api/meme-cards/collection", "/api/meme-cards/claim"] {
        assert_eq!(
            get(siblings_off, path, &[]).await.body,
            upstream_saw("GET", path)
        );
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
