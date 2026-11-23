//! Route ids, methods and hosts: what stays native and what goes to Next.

use super::*;

const ROUTES: [(&str, &str, &str); 5] = [
    ("robots", "GET", "/robots.txt"),
    ("random-meme", "GET", "/api/random-meme"),
    ("memes-random", "GET", "/memes/random"),
    ("csp-report", "POST", "/api/csp-report"),
    ("daily-quiz", "GET", "/api/daily-quiz"),
];

#[tokio::test]
async fn each_route_id_in_axum_disabled_routes_falls_through_to_the_upstream() {
    let upstream = marker_upstream().await;

    for (id, method, path) in ROUTES {
        // A dead database makes any native answer differ from the marker
        // without the test waiting on a query.
        let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", id)]).await;

        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{id}");
        assert_eq!(reply.body, format!("upstream saw {method} {path}"), "{id}");
        // Nothing added on the way back.
        assert!(!reply.headers.contains_key("vary"), "{id}");
        assert!(
            !reply.headers.contains_key("x-memecatch-release-sha"),
            "{id}"
        );
    }
}

#[tokio::test]
async fn disabling_one_route_leaves_the_others_native_and_all_five_can_be_disabled() {
    let upstream = marker_upstream().await;
    let only_robots_off = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", "robots")]).await;
    let all_off = app_without_db(
        upstream,
        &[(
            "AXUM_DISABLED_ROUTES",
            "robots,random-meme,memes-random,csp-report,daily-quiz",
        )],
    )
    .await;

    let csp = send(
        only_robots_off,
        "POST",
        "/api/csp-report",
        &[],
        Body::empty(),
    )
    .await;
    let robots = get(all_off, "/robots.txt").await;
    let csp_off = send(all_off, "POST", "/api/csp-report", &[], Body::empty()).await;

    assert_eq!(csp.status, StatusCode::NO_CONTENT);
    assert_eq!(robots.body, "upstream saw GET /robots.txt");
    assert_eq!(csp_off.body, "upstream saw POST /api/csp-report");
}

#[tokio::test]
async fn methods_a_route_does_not_handle_go_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[]).await;

    for (method, path) in [
        ("POST", "/robots.txt"),
        ("OPTIONS", "/robots.txt"),
        ("POST", "/api/random-meme"),
        ("DELETE", "/memes/random"),
        ("GET", "/api/csp-report"),
        ("OPTIONS", "/api/csp-report"),
        ("PUT", "/api/daily-quiz"),
    ] {
        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.body, format!("upstream saw {method} {path}"));
        assert!(!reply.headers.contains_key("allow"), "{method} {path}");
        assert!(!reply.headers.contains_key("vary"), "{method} {path}");
    }
}

#[tokio::test]
async fn www_host_requests_for_the_non_api_routes_are_left_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[]).await;

    for host in ["www.catchmeme.com", "WWW.CatchMeme.com:443"] {
        for path in ["/robots.txt", "/memes/random"] {
            let reply = send(app, "GET", path, &[("host", host)], Body::empty()).await;

            assert_eq!(reply.body, format!("upstream saw GET {path}"), "{host}");
            // Not passed through the native-route header layer.
            assert!(!reply.headers.contains_key("vary"), "{host} {path}");
        }
    }
    // proxy.ts never runs for /api, so the host makes no difference there.
    let api = send(
        app,
        "POST",
        "/api/csp-report",
        &[("host", "www.catchmeme.com")],
        Body::empty(),
    )
    .await;
    let apex = send(
        app,
        "GET",
        "/robots.txt",
        &[("host", "catchmeme.com")],
        Body::empty(),
    )
    .await;
    assert_eq!(api.status, StatusCode::NO_CONTENT);
    assert_eq!(apex.status, StatusCode::OK);
}
