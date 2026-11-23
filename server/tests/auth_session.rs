//! `GET /api/auth/get-session` and `POST /api/auth/sign-out` at their limits:
//! an oversized `Cookie` header, and a database that refuses connections or
//! has no free connection. Needs no database.

mod common;

use axum::body::Body;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, config, marker_upstream, send, spawn_app};

/// Node's `--max-http-header-size` default (16 KiB): a request whose headers
/// are longer gets 431 before Next runs.
const NODE_HEADER_LIMIT: usize = 16 * 1024;
const ORIGIN: &str = "http://localhost:3000";

fn cookie_of(len: usize) -> String {
    format!("a={}", "x".repeat(len - 2))
}

#[tokio::test]
async fn a_cookie_header_over_16_kib_gets_node_s_431() {
    let upstream = marker_upstream().await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;
    let json = ("content-type", "application/json");
    for (len, expected) in [
        (NODE_HEADER_LIMIT, StatusCode::OK),
        (
            NODE_HEADER_LIMIT + 1,
            StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE,
        ),
        (400_000, StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE),
    ] {
        let cookie = cookie_of(len);
        let get = send(
            app,
            "GET",
            "/api/auth/get-session",
            &[("cookie", &cookie)],
            Body::empty(),
        )
        .await;
        let sign_out = send(
            app,
            "POST",
            "/api/auth/sign-out",
            &[("cookie", &cookie), ("origin", ORIGIN), json],
            Body::from("{}"),
        )
        .await;
        for (route, reply) in [("get-session", get), ("sign-out", sign_out)] {
            assert_eq!(reply.status, expected, "{route} with a {len}-byte cookie");
            if expected == StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE {
                assert_eq!(reply.body, "", "{route}");
                assert_eq!(reply.header("connection"), Some("close"), "{route}");
                assert_eq!(reply.header("set-cookie"), None, "{route}");
            }
        }
    }
    // Two Cookie headers count together, as Node counts every header byte.
    let half = cookie_of(NODE_HEADER_LIMIT / 2 + 1);
    let reply = send(
        app,
        "GET",
        "/api/auth/get-session",
        &[("cookie", &half), ("cookie", &half)],
        Body::empty(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE);
}
