//! Route ids, methods, hosts and locale prefixes: what stays native and what
//! goes to Next. None of these tests reaches a database.

use super::*;

/// Every path of every new route id.
const ROUTES: [(&str, &[&str]); 6] = [
    ("llms", &["/llms.txt"]),
    ("llms-full", &["/llms-full.txt"]),
    ("feed", &["/feed.xml"]),
    ("feed-updated", &["/feed/updated.xml"]),
    (
        "llms-localized",
        &[
            "/en/llms.txt",
            "/ja/llms.txt",
            "/zh/llms.txt",
            "/zh-tw/llms.txt",
        ],
    ),
    (
        "llms-full-localized",
        &[
            "/en/llms-full.txt",
            "/ja/llms-full.txt",
            "/zh/llms-full.txt",
            "/zh-tw/llms-full.txt",
        ],
    ),
];

fn assert_from_upstream(reply: &Reply, method: &str, path: &str) {
    assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{method} {path}");
    assert_eq!(
        reply.body,
        format!("upstream saw {method} {path}"),
        "{method} {path}"
    );
    // Nothing added on the way back.
    assert!(!reply.headers.contains_key("vary"), "{method} {path}");
    assert!(!reply.headers.contains_key("allow"), "{method} {path}");
    assert!(
        !reply.headers.contains_key("x-memecatch-release-sha"),
        "{method} {path}"
    );
}

#[tokio::test]
async fn each_route_id_in_axum_disabled_routes_falls_through_to_the_upstream() {
    let upstream = marker_upstream().await;

    for (id, paths) in ROUTES {
        // A dead database makes any native answer differ from the marker.
        let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", id)]).await;

        for path in paths {
            let reply = get(app, path).await;

            assert_from_upstream(&reply, "GET", path);
        }
    }
}

#[tokio::test]
async fn disabling_one_route_leaves_the_others_native() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", "llms,llms-localized")]).await;

    let (llms, localized, full, feed) = tokio::join!(
        get(app, "/llms.txt"),
        get(app, "/en/llms.txt"),
        get(app, "/en/llms-full.txt"),
        get(app, "/feed.xml"),
    );

    assert_from_upstream(&llms, "GET", "/llms.txt");
    assert_from_upstream(&localized, "GET", "/en/llms.txt");
    // Native answers of a server whose database is down.
    assert_eq!(full.status, StatusCode::OK);
    assert_eq!(full.header("content-language"), Some("en-US"));
    assert_eq!(feed.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(feed.body, UNAVAILABLE);
}

#[tokio::test]
async fn methods_a_route_does_not_handle_go_to_the_upstream() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    for (method, path) in [
        ("POST", "/llms.txt"),
        ("OPTIONS", "/llms-full.txt"),
        ("PUT", "/feed.xml"),
        ("DELETE", "/feed/updated.xml"),
        ("POST", "/en/llms.txt"),
        ("OPTIONS", "/zh-tw/llms-full.txt"),
    ] {
        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_from_upstream(&reply, method, path);
    }
}

#[tokio::test]
async fn www_host_requests_are_left_to_the_upstream() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    for (_, paths) in ROUTES {
        for path in paths {
            let reply = send(
                app,
                "GET",
                path,
                &[("host", "WWW.CatchMeme.com:443")],
                Body::empty(),
            )
            .await;

            // proxy.ts answers the www host with a 301 before any route runs.
            assert_from_upstream(&reply, "GET", path);
        }
    }
}

#[tokio::test]
async fn any_other_locale_prefix_is_answered_by_the_upstream() {
    let app = app_without_db(marker_upstream().await, &[]).await;

    // Next's `[locale]` segment matches these too; what it answers (404, a
    // redirect, another route) is its own.
    for path in [
        "/ko/llms.txt",
        "/fr/llms-full.txt",
        "/EN/llms.txt",
        "/%65n/llms.txt",
        "/en/llms.txt/",
        "/api/llms.txt",
        "/en/extra/llms.txt",
    ] {
        let reply = get(app, path).await;

        assert_from_upstream(&reply, "GET", path);
    }
}
