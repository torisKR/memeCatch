//! `/api/health` and the route registry. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::time::{Duration, Instant};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{Response, StatusCode};
use common::{
    client, closed_addr, config, database_url, parse_head, raw_request, spawn_app, spawn_router,
};
use http_body_util::BodyExt;
use hyper::body::Incoming;

/// An upstream that answers every request with 418 and names what it saw.
async fn marker_upstream() -> std::net::SocketAddr {
    spawn_router(Router::new().fallback(|request: Request| async move {
        (
            StatusCode::IM_A_TEAPOT,
            format!("upstream saw {} {}", request.method(), request.uri()),
        )
    }))
    .await
}

async fn send(app: std::net::SocketAddr, method: &str, path: &str) -> (Response<()>, String) {
    let request = Request::builder()
        .method(method)
        .uri(format!("http://{app}{path}"))
        .body(Body::empty())
        .unwrap();
    let response: Response<Incoming> = client().request(request).await.expect("response");
    let (parts, body) = response.into_parts();
    let body = body.collect().await.expect("body").to_bytes();
    (
        Response::from_parts(parts, ()),
        String::from_utf8(body.to_vec()).expect("utf-8 body"),
    )
}

#[tokio::test]
async fn health_returns_200_ok_true_with_the_next_config_headers() {
    let app = spawn_app(config(
        closed_addr().await,
        &database_url(),
        &[("RELEASE_SHA", "abc123")],
    ))
    .await;

    let (response, body) = send(app, "GET", "/api/health").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(body, r#"{"ok":true}"#);
    let headers = response.headers();
    assert_eq!(headers.get("content-type").unwrap(), "application/json");
    assert_eq!(headers.get("x-memecatch-release-sha").unwrap(), "abc123");
    assert_eq!(headers.get("x-content-type-options").unwrap(), "nosniff");
    assert_eq!(
        headers.get("vary").unwrap(),
        "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch"
    );
    assert!(headers.contains_key("content-security-policy"));
    assert_eq!(
        headers.get("reporting-endpoints").unwrap(),
        "csp-endpoint=\"https://catchmeme.com/api/csp-report\""
    );
}

#[tokio::test]
async fn health_returns_503_ok_false_when_the_database_is_down() {
    let dead_database = format!(
        "postgresql://memecatch:unused@{}/memecatch",
        closed_addr().await
    );
    let app = spawn_app(config(closed_addr().await, &dead_database, &[])).await;
    let started = Instant::now();

    let (response, body) = send(app, "GET", "/api/health").await;

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body, r#"{"ok":false}"#);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "application/json"
    );
    // Inside the 5 s the compose healthcheck allows.
    assert!(
        started.elapsed() < Duration::from_secs(5),
        "{:?}",
        started.elapsed()
    );
}

/// Headers of a response without `date`, which each server stamps itself.
fn headers_without_date(response: &Response<()>) -> Vec<(String, String)> {
    let mut headers: Vec<(String, String)> = response
        .headers()
        .iter()
        .filter(|(name, _)| *name != "date")
        .map(|(name, value)| (name.to_string(), value.to_str().unwrap().to_owned()))
        .collect();
    headers.sort();
    headers
}

#[tokio::test]
async fn a_disabled_route_id_sends_the_request_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = spawn_app(config(
        upstream,
        &database_url(),
        &[
            ("AXUM_DISABLED_ROUTES", "health"),
            ("RELEASE_SHA", "abc123"),
        ],
    ))
    .await;

    let (direct, _) = send(upstream, "GET", "/api/health").await;
    let (response, body) = send(app, "GET", "/api/health").await;

    assert_eq!(response.status(), StatusCode::IM_A_TEAPOT);
    assert_eq!(body, "upstream saw GET /api/health");
    // Nothing added on the way back: no native-route headers.
    assert_eq!(
        headers_without_date(&response),
        headers_without_date(&direct)
    );
}

#[tokio::test]
async fn a_method_the_native_route_does_not_handle_goes_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = spawn_app(config(
        upstream,
        &database_url(),
        &[("RELEASE_SHA", "abc123")],
    ))
    .await;

    for method in ["POST", "OPTIONS", "DELETE", "PROPFIND"] {
        let (direct, _) = send(upstream, method, "/api/health").await;
        let (response, body) = send(app, method, "/api/health").await;

        assert_eq!(response.status(), StatusCode::IM_A_TEAPOT, "{method}");
        assert_eq!(body, format!("upstream saw {method} /api/health"));
        // Nothing added on the way back: no native-route headers and no
        // `Allow` from the method router.
        assert_eq!(
            headers_without_date(&response),
            headers_without_date(&direct),
            "{method}"
        );
    }
}

#[tokio::test]
async fn head_on_health_is_answered_natively_without_a_body() {
    let app = spawn_app(config(marker_upstream().await, &database_url(), &[])).await;

    let (response, body) = send(app, "HEAD", "/api/health").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(body, "");
    assert!(response.headers().contains_key("content-security-policy"));
}

/// The framing headers of the answer to `method /api/health`, as sent.
async fn framing_headers(app: std::net::SocketAddr, method: &str) -> Vec<(String, String)> {
    let response = raw_request(
        app,
        &format!(
            "{method} /api/health HTTP/1.1\r\nHost: catchmeme.com\r\nConnection: close\r\n\r\n"
        ),
    )
    .await;
    let (status_line, headers) = parse_head(&response);
    assert_eq!(status_line, "HTTP/1.1 200 OK", "{method}");
    headers
        .into_iter()
        .filter(|(name, _)| name == "content-length" || name == "transfer-encoding")
        .collect()
}

// Next sends a route handler's body chunked and puts no length on the HEAD
// answer. axum would send `Content-Length: 11` on both.
#[tokio::test]
async fn native_answers_declare_no_body_length_as_next_does() {
    let app = spawn_app(config(marker_upstream().await, &database_url(), &[])).await;

    let get = framing_headers(app, "GET").await;
    let head = framing_headers(app, "HEAD").await;

    assert_eq!(head, [], "HEAD");
    assert_eq!(
        get,
        [("transfer-encoding".to_owned(), "chunked".to_owned())],
        "GET"
    );
}
