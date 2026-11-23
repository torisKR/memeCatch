//! The fallback proxy against in-process stub upstreams. No database needed.

mod common;

use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use common::{
    UNUSED_DATABASE_URL, client, closed_addr, config, parse_head, raw_request, raw_upstream,
    spawn_app, spawn_router,
};
use futures_util::stream;
use http_body_util::BodyExt;
use tokio::sync::{Notify, mpsc};
use tokio::time::timeout;

const STEP_TIMEOUT: Duration = Duration::from_secs(5);
const OK_RESPONSE: &str = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok";

#[tokio::test]
async fn request_target_and_headers_reach_the_upstream_byte_for_byte() {
    // Percent-encoded Hangul, an encoded slash in both cases, a plus sign,
    // raw UTF-8 and empty parameters.
    let target = "/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88/%2F%2f%20x?q=%ED%95%9C%EA%B8%80&a=b+c%2B&raw=한글&empty=&&k";
    let (upstream, head) = raw_upstream(OK_RESPONSE).await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;

    let response = raw_request(
        app,
        &format!(
            "GET {target} HTTP/1.1\r\n\
             Host: catchmeme.com\r\n\
             X-Forwarded-For: 203.0.113.7\r\n\
             X-Forwarded-Proto: https\r\n\
             X-Forwarded-Host: catchmeme.com\r\n\
             CF-Connecting-IP: 203.0.113.7\r\n\
             Cookie: a=1; b=2\r\n\
             User-Agent: proxy-test\r\n\
             Connection: close, X-Per-Hop\r\n\
             X-Per-Hop: 1\r\n\
             Keep-Alive: timeout=5\r\n\
             TE: trailers\r\n\
             Upgrade: websocket\r\n\
             Proxy-Authorization: Basic abc\r\n\r\n"
        ),
    )
    .await;

    let (request_line, headers) = parse_head(&head.await.expect("upstream saw a request"));
    assert_eq!(request_line, format!("GET {target} HTTP/1.1"));
    // Exactly the end-to-end headers that were sent: `Host` is the original
    // one, nothing is added or appended, hop-by-hop headers are gone.
    let expected = [
        ("cf-connecting-ip", "203.0.113.7"),
        ("cookie", "a=1; b=2"),
        ("host", "catchmeme.com"),
        ("user-agent", "proxy-test"),
        ("x-forwarded-for", "203.0.113.7"),
        ("x-forwarded-host", "catchmeme.com"),
        ("x-forwarded-proto", "https"),
    ]
    .map(|(name, value)| (name.to_owned(), value.to_owned()));
    assert_eq!(headers, expected);
    assert!(response.starts_with("HTTP/1.1 200 OK\r\n"), "{response}");
    assert!(response.ends_with("\r\n\r\nok"), "{response}");
}

#[tokio::test]
async fn redirect_is_passed_through_unfollowed_with_each_set_cookie_kept_separate() {
    let (upstream, _head) = raw_upstream(
        "HTTP/1.1 308 Permanent Redirect\r\n\
         Location: /memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88\r\n\
         Set-Cookie: a=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT\r\n\
         Set-Cookie: b=2; HttpOnly\r\n\
         Keep-Alive: timeout=5\r\n\
         Connection: keep-alive, X-Per-Hop\r\n\
         X-Per-Hop: 1\r\n\
         Content-Length: 0\r\n\r\n",
    )
    .await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;

    let response = raw_request(
        app,
        "GET /memes/rk3w632x HTTP/1.1\r\nHost: catchmeme.com\r\nConnection: close\r\n\r\n",
    )
    .await;

    let (status_line, headers) = parse_head(&response);
    let values = |name: &str| -> Vec<&str> {
        headers
            .iter()
            .filter(|(header, _)| header == name)
            .map(|(_, value)| value.as_str())
            .collect()
    };
    assert_eq!(status_line, "HTTP/1.1 308 Permanent Redirect");
    assert_eq!(
        values("location"),
        ["/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88"]
    );
    assert_eq!(
        values("set-cookie"),
        [
            "a=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
            "b=2; HttpOnly"
        ]
    );
    // Hop-by-hop response headers stop at the proxy, and a proxied response
    // gets none of the native-route headers.
    assert!(values("keep-alive").is_empty());
    assert!(values("x-per-hop").is_empty());
    assert!(values("content-security-policy").is_empty());
    assert!(values("strict-transport-security").is_empty());
}

#[tokio::test]
async fn bodiless_responses_keep_exactly_the_length_headers_the_upstream_sent() {
    // What Node sends: no length on a HEAD answer for a chunked resource or on
    // a 304, and the real length on a HEAD answer for a sized resource.
    let cases = [
        (
            "HEAD",
            "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\n",
        ),
        (
            "HEAD",
            "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 1234\r\n\r\n",
        ),
        ("GET", "HTTP/1.1 304 Not Modified\r\nETag: \"abc\"\r\n\r\n"),
        ("POST", "HTTP/1.1 204 No Content\r\nX-Marker: 1\r\n\r\n"),
    ];

    for (method, upstream_response) in cases {
        let (upstream, _head) = raw_upstream(upstream_response).await;
        let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;

        let response = raw_request(
            app,
            &format!(
                "{method} /explore HTTP/1.1\r\nHost: catchmeme.com\r\nConnection: close\r\n\r\n"
            ),
        )
        .await;

        let (status_line, mut headers) = parse_head(&response);
        let (expected_status_line, expected_headers) = parse_head(upstream_response);
        // hyper stamps the date and answers our `Connection: close`.
        headers.retain(|(name, _)| name != "date" && name != "connection");
        assert_eq!(status_line, expected_status_line);
        assert_eq!(headers, expected_headers, "{upstream_response:?}");
        assert!(
            response.ends_with("\r\n\r\n"),
            "unexpected body in {response:?}"
        );
    }
}

#[tokio::test]
async fn response_chunk_arrives_before_the_upstream_finishes() {
    let gate = Arc::new(Notify::new());
    let upstream = spawn_router(
        Router::new()
            .route(
                "/api/memes/chat",
                get(|State(gate): State<Arc<Notify>>| async move {
                    let first = stream::once(async { Ok::<_, Infallible>(Bytes::from("first\n")) });
                    let second = stream::once(async move {
                        gate.notified().await;
                        Ok(Bytes::from("second\n"))
                    });
                    Body::from_stream(futures_util::StreamExt::chain(first, second))
                }),
            )
            .with_state(gate.clone()),
    )
    .await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;

    let response = client()
        .get(format!("http://{app}/api/memes/chat").parse().unwrap())
        .await
        .expect("response head");
    let mut body = response.into_body();

    // The upstream is still waiting on the gate, so this frame can only
    // arrive if the proxy streams.
    let first = timeout(STEP_TIMEOUT, body.frame())
        .await
        .expect("first chunk arrives while the upstream is still open")
        .expect("frame")
        .expect("body")
        .into_data()
        .expect("data frame");
    assert_eq!(first, "first\n");

    gate.notify_one();
    let rest = timeout(STEP_TIMEOUT, body.collect())
        .await
        .expect("rest of the body")
        .expect("body")
        .to_bytes();
    assert_eq!(rest, "second\n");
}

#[tokio::test]
async fn request_body_is_streamed_to_the_upstream_without_a_size_limit() {
    let (seen_tx, mut seen_rx) = mpsc::channel::<usize>(1);
    let upstream = spawn_router(
        Router::new()
            .route(
                "/api/media/upload",
                post(
                    |State(seen): State<mpsc::Sender<usize>>, request: Request| async move {
                        let mut body = request.into_body();
                        let mut total = 0;
                        while let Some(frame) = body.frame().await {
                            let size = frame
                                .expect("frame")
                                .into_data()
                                .map_or(0, |data| data.len());
                            if total == 0 {
                                seen.send(size).await.expect("report first chunk");
                            }
                            total += size;
                        }
                        total.to_string()
                    },
                ),
            )
            .with_state(seen_tx),
    )
    .await;
    let app = spawn_app(config(upstream, UNUSED_DATABASE_URL, &[])).await;
    let (chunk_tx, chunk_rx) = mpsc::channel::<Bytes>(1);
    let body = Body::from_stream(stream::unfold(chunk_rx, |mut chunks| async move {
        chunks
            .recv()
            .await
            .map(|chunk| (Ok::<_, Infallible>(chunk), chunks))
    }));
    let request = Request::post(format!("http://{app}/api/media/upload"))
        .body(body)
        .unwrap();
    let response = tokio::spawn(async move { client().request(request).await });

    // The upstream reports the first chunk while the request is still open.
    chunk_tx.send(Bytes::from("first")).await.unwrap();
    let first_seen = timeout(STEP_TIMEOUT, seen_rx.recv())
        .await
        .expect("upstream receives the first chunk before the body ends");
    assert_eq!(first_seen, Some(5));

    // 3 MiB more: above axum's 2 MiB default extractor limit.
    let megabyte = Bytes::from(vec![b'x'; 1024 * 1024]);
    for _ in 0..3 {
        chunk_tx.send(megabyte.clone()).await.unwrap();
    }
    drop(chunk_tx);
    let response = timeout(STEP_TIMEOUT, response)
        .await
        .expect("response")
        .unwrap()
        .expect("response head");

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body, (5 + 3 * 1024 * 1024).to_string());
}

#[tokio::test]
async fn unreachable_upstream_returns_502_with_a_plain_body() {
    let app = spawn_app(config(closed_addr().await, UNUSED_DATABASE_URL, &[])).await;

    let response = client()
        .get(format!("http://{app}/anything?x=1").parse().unwrap())
        .await
        .expect("response");

    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    assert_eq!(
        response.headers().get("content-type").unwrap(),
        "text/plain; charset=utf-8"
    );
    let body = response.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body, "Bad Gateway");
}
