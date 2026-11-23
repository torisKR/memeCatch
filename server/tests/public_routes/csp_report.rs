//! `POST /api/csp-report`.

use super::*;

const LEGACY_REPORT: &str = r#"{"csp-report":{"document-uri":"https://catchmeme.com/","blocked-uri":"https://evil.example/x.js","violated-directive":"script-src"}}"#;

async fn csp(app: SocketAddr, headers: &[(&str, &str)], body: impl Into<Body>) -> Reply {
    send(app, "POST", "/api/csp-report", headers, body).await
}

#[tokio::test]
async fn csp_report_answers_204_with_no_body_whatever_it_is_sent() {
    let app = app_without_db(closed_addr().await, &[]).await;
    let report = [("content-type", "application/csp-report")];
    let oversized = "x".repeat(16 * 1024 + 1);
    // No Content-Length: the limit is found while reading.
    let oversized_stream = Body::from_stream(futures_util::stream::iter(
        (0..20).map(|_| Ok::<_, std::convert::Infallible>(vec![b'x'; 1024])),
    ));

    let cases = [
        (
            "accepted legacy report",
            csp(app, &report, LEGACY_REPORT).await,
        ),
        (
            "accepted reporting api report",
            csp(
                app,
                &[("content-type", "application/reports+json; charset=utf-8")],
                r#"[{"type":"csp-violation","body":{"blocked-uri":"inline"}}]"#,
            )
            .await,
        ),
        (
            "oversized with a length",
            csp(app, &report, oversized).await,
        ),
        (
            "oversized without a length",
            csp(app, &report, oversized_stream).await,
        ),
        ("malformed json", csp(app, &report, "{not json").await),
        ("empty body", csp(app, &report, Body::empty()).await),
        (
            "wrong content type",
            csp(app, &[("content-type", "application/json")], LEGACY_REPORT).await,
        ),
        ("no content type", csp(app, &[], LEGACY_REPORT).await),
    ];

    for (name, reply) in cases {
        assert_eq!(reply.status, StatusCode::NO_CONTENT, "{name}");
        assert_eq!(reply.body, "", "{name}");
        assert_eq!(reply.header("retry-after"), None, "{name}");
        assert_eq!(reply.header("content-length"), None, "{name}");
        assert_eq!(reply.header("vary"), Some(NEXT_VARY), "{name}");
    }
}

#[tokio::test]
async fn csp_report_limits_each_client_ip_to_60_requests_a_minute() {
    let app = app_without_db(closed_addr().await, &[]).await;
    let from = |ip: &'static str| {
        [
            ("x-forwarded-for", ip),
            ("content-type", "application/csp-report"),
        ]
    };

    for request in 1..=60 {
        let reply = csp(app, &from("203.0.113.7"), LEGACY_REPORT).await;
        assert_eq!(reply.status, StatusCode::NO_CONTENT, "request {request}");
        assert_eq!(reply.header("retry-after"), None, "request {request}");
    }
    let over_limit = csp(app, &from("203.0.113.7"), LEGACY_REPORT).await;
    // The first entry of the list is the client, so this is the same bucket.
    let same_client_via_proxy = csp(app, &from("203.0.113.7, 10.0.0.1"), LEGACY_REPORT).await;
    let another_client = csp(app, &from("203.0.113.8"), LEGACY_REPORT).await;

    assert_eq!(over_limit.status, StatusCode::NO_CONTENT);
    assert_eq!(over_limit.body, "");
    // 60 s after the first request, rounded up; the 61 requests took well
    // under a second.
    assert_eq!(over_limit.header("retry-after"), Some("60"));
    assert_eq!(same_client_via_proxy.header("retry-after"), Some("60"));
    assert_eq!(another_client.header("retry-after"), None);
}

// Next would give each of these made-up clients its own bucket. Here they
// share one, so a caller cannot grow the limiter's memory with header text.
#[tokio::test]
async fn csp_report_counts_every_value_that_is_not_an_address_as_one_client() {
    let app = app_without_db(closed_addr().await, &[]).await;
    let huge_value = "x".repeat(120_000);

    for request in 1..=59 {
        let made_up = format!("client-{request}");
        let reply = csp(app, &[("x-forwarded-for", made_up.as_str())], "").await;
        assert_eq!(reply.header("retry-after"), None, "request {request}");
    }
    let huge = csp(app, &[("x-forwarded-for", huge_value.as_str())], "").await;
    let over_limit = csp(app, &[("x-forwarded-for", "client-61")], "").await;
    let an_address = csp(app, &[("x-forwarded-for", "203.0.113.9")], "").await;

    assert_eq!(huge.status, StatusCode::NO_CONTENT);
    assert_eq!(huge.header("retry-after"), None, "request 60");
    assert_eq!(over_limit.status, StatusCode::NO_CONTENT);
    assert_eq!(over_limit.header("retry-after"), Some("60"));
    assert_eq!(an_address.header("retry-after"), None);
}

/// The app served the way `main.rs` serves it: handlers can see the address
/// of the TCP peer. (`common::spawn_app` serves without it.)
async fn app_with_peer_address() -> SocketAddr {
    let state =
        AppState::new(config(closed_addr().await, UNUSED_DATABASE_URL, &[])).expect("state");
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(
            listener,
            build_app(state).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("serve")
    });
    addr
}

#[tokio::test]
async fn csp_report_keys_a_request_without_x_forwarded_for_by_its_peer_address() {
    let app = app_with_peer_address().await;

    // Next fills in the missing header with the peer address before the
    // route runs, so X-Real-IP plays no part: these all count as 127.0.0.1.
    for request in 0..60 {
        let real_ip = format!("198.51.100.{request}");
        let reply = csp(app, &[("x-real-ip", real_ip.as_str())], "").await;
        assert_eq!(reply.header("retry-after"), None, "request {request}");
    }
    let without_header = csp(app, &[("x-real-ip", "198.51.100.200")], "").await;
    let same_address_spelled_out = csp(app, &[("x-forwarded-for", "127.0.0.1")], "").await;
    let another_client = csp(app, &[("x-forwarded-for", "203.0.113.9")], "").await;

    assert_eq!(without_header.header("retry-after"), Some("60"));
    assert_eq!(same_address_spelled_out.header("retry-after"), Some("60"));
    assert_eq!(another_client.header("retry-after"), None);
}

#[tokio::test]
async fn csp_report_falls_back_to_x_real_ip_then_unknown_for_an_empty_first_entry() {
    let app = app_with_peer_address().await;
    let via_real_ip = [
        ("x-forwarded-for", " , 203.0.113.7"),
        ("x-real-ip", " 198.51.100.4 "),
    ];
    let unknown = [("x-forwarded-for", "")];

    for _ in 0..60 {
        csp(app, &via_real_ip, "").await;
        csp(app, &unknown, "").await;
    }
    let real_ip_over_limit = csp(app, &via_real_ip, "").await;
    let unknown_over_limit = csp(app, &unknown, "").await;
    // The same X-Real-IP address named as the forwarded client is that bucket.
    let same_bucket = csp(app, &[("x-forwarded-for", "198.51.100.4")], "").await;
    let peer_address = csp(app, &[], "").await;

    assert_eq!(real_ip_over_limit.header("retry-after"), Some("60"));
    assert_eq!(unknown_over_limit.header("retry-after"), Some("60"));
    assert_eq!(same_bucket.header("retry-after"), Some("60"));
    assert_eq!(peer_address.header("retry-after"), None);
}
