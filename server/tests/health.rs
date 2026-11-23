//! `/api/health` and the route registry. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::time::{Duration, Instant};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{Response, StatusCode};
use axum::routing::get;
use common::{
    UNUSED_DATABASE_URL, client, closed_addr, config, database_url, parse_head, raw_request,
    spawn_app, spawn_router,
};
use http_body_util::BodyExt;
use hyper::body::Incoming;
use memecatch_server::AppState;
use tokio::net::TcpListener;

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

/// An upstream whose own `GET /api/health` passes, as a running Next's does.
/// Everything else is answered like [`marker_upstream`].
async fn healthy_upstream() -> std::net::SocketAddr {
    let health = get(|| async { ([("content-type", "application/json")], r#"{"ok":true}"#) });
    spawn_router(Router::new().route("/api/health", health).fallback(
        |request: Request| async move {
            (
                StatusCode::IM_A_TEAPOT,
                format!("upstream saw {} {}", request.method(), request.uri()),
            )
        },
    ))
    .await
}

/// An upstream that accepts connections and never answers.
async fn silent_upstream() -> std::net::SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        let mut held = Vec::new();
        while let Ok((socket, _)) = listener.accept().await {
            held.push(socket);
        }
    });
    addr
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
        healthy_upstream().await,
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

// Axum fronts Next, so "healthy" has to mean that pages are served too. The
// compose healthcheck and the deploy gate both ask this route.
#[tokio::test]
async fn health_is_503_ok_false_while_the_upstream_is_down() {
    let app = spawn_app(config(closed_addr().await, &database_url(), &[])).await;

    let (get, body) = send(app, "GET", "/api/health").await;
    let (head, _) = send(app, "HEAD", "/api/health").await;

    assert_eq!(get.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body, r#"{"ok":false}"#);
    assert_eq!(
        get.headers().get("content-type").unwrap(),
        "application/json"
    );
    assert!(get.headers().contains_key("content-security-policy"));
    assert_eq!(head.status(), StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn health_is_503_after_about_3_s_while_the_upstream_does_not_answer() {
    let app = spawn_app(config(silent_upstream().await, &database_url(), &[])).await;
    let started = Instant::now();

    let (response, body) = send(app, "GET", "/api/health").await;
    let took = started.elapsed();

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body, r#"{"ok":false}"#);
    // The probe's own limit, inside the 5 s the compose healthcheck allows.
    assert!(took >= Duration::from_millis(2_900), "{took:?}");
    assert!(took < Duration::from_secs(4), "{took:?}");
}

#[tokio::test]
async fn health_is_503_while_the_upstream_reports_itself_unhealthy() {
    // What Next answers while it cannot reach the database.
    let unhealthy = spawn_router(
        Router::new().fallback(|| async { (StatusCode::SERVICE_UNAVAILABLE, r#"{"ok":false}"#) }),
    )
    .await;
    let app = spawn_app(config(unhealthy, &database_url(), &[])).await;

    let (response, body) = send(app, "GET", "/api/health").await;

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body, r#"{"ok":false}"#);
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

const ROUTE_IDS: [&str; 7] = [
    "health",
    "media-signed",
    "robots",
    "memes-random",
    "random-meme",
    "csp-report",
    "daily-quiz",
];

// `AXUM_DISABLED_ROUTES` is the rollback switch. A typo that was ignored
// would leave the route native while the operator believes it went back.
#[tokio::test]
async fn an_unknown_id_in_axum_disabled_routes_is_refused_at_startup() {
    let state = |disabled: &str| {
        AppState::new(config(
            "127.0.0.1:1".parse().unwrap(),
            UNUSED_DATABASE_URL,
            &[("AXUM_DISABLED_ROUTES", disabled)],
        ))
    };

    // An underscore for the hyphen, and a misspelling, next to a valid id.
    let refused = state("health, media_signed,robotz").err();
    let every_id_at_once = state(&ROUTE_IDS.join(","));

    let message = refused.expect("startup is refused");
    assert!(message.contains("AXUM_DISABLED_ROUTES"), "{message}");
    assert!(message.contains("media_signed, robotz"), "{message}");
    for id in ROUTE_IDS {
        assert!(message.contains(id), "valid id {id} not listed: {message}");
    }
    assert!(every_id_at_once.is_ok());
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
    let app = spawn_app(config(healthy_upstream().await, &database_url(), &[])).await;

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
    let app = spawn_app(config(healthy_upstream().await, &database_url(), &[])).await;

    let get = framing_headers(app, "GET").await;
    let head = framing_headers(app, "HEAD").await;

    assert_eq!(head, [], "HEAD");
    assert_eq!(
        get,
        [("transfer-encoding".to_owned(), "chunked".to_owned())],
        "GET"
    );
}
