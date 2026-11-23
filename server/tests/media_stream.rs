//! `GET /api/media/signed` passes an object on as it arrives. A render video
//! can be larger than the memory this server may use, so the handler must not
//! hold a whole object. `media_signed.rs` has the contract of the route.

mod common;

use std::time::Duration;

use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, client, closed_addr, config, spawn_router};
use http_body_util::BodyExt;
use memecatch_server::storage::Storage;
use memecatch_server::{AppState, build_app};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::time::timeout;

const FIRST_PART: usize = 64 * 1024;
const REST: usize = 1024 * 1024;
const PATIENCE: Duration = Duration::from_secs(5);

/// A stand-in for R2: it answers one request with the first part of an object
/// and sends the rest only when `release` fires.
async fn slow_r2(release: oneshot::Receiver<()>) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept");
        let mut head = Vec::new();
        let mut chunk = [0u8; 4096];
        while !head.windows(4).any(|window| window == b"\r\n\r\n") {
            let read = socket.read(&mut chunk).await.expect("read request head");
            assert!(read > 0, "connection closed before the request head ended");
            head.extend_from_slice(&chunk[..read]);
        }
        let response_head = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: video/mp4\r\ncontent-length: {}\r\n\r\n",
            FIRST_PART + REST
        );
        socket.write_all(response_head.as_bytes()).await.unwrap();
        socket.write_all(&vec![b'a'; FIRST_PART]).await.unwrap();
        socket.flush().await.unwrap();
        // The source has not produced the rest yet.
        release.await.ok();
        socket.write_all(&vec![b'b'; REST]).await.unwrap();
        socket.shutdown().await.ok();
    });
    format!("http://{addr}")
}

#[tokio::test]
async fn the_first_bytes_of_an_r2_object_arrive_before_r2_has_sent_the_rest() {
    let (release, released) = oneshot::channel();
    let endpoint = slow_r2(released).await;
    let config = config(
        closed_addr().await,
        UNUSED_DATABASE_URL,
        &[
            ("R2_ACCOUNT_ID", "account-is-not-used-with-a-test-endpoint"),
            ("R2_ACCESS_KEY_ID", "test-access-key"),
            ("R2_SECRET_ACCESS_KEY", "test-secret-key"),
            ("R2_BUCKET", "bucket"),
        ],
    );
    let storage = Storage::with_r2_endpoint(&config, &endpoint).expect("storage");
    let mut state = AppState::new(config).expect("app state");
    state.storage = storage.clone();
    let app = spawn_router(build_app(state)).await;
    let url = storage
        .signed_object_url("renders", "job/out.mp4", 60)
        .unwrap();
    let path = &url[url.find("/api/media/signed").expect("signed path")..];
    let request = Request::builder()
        .uri(format!("http://{app}{path}"))
        .body(Body::empty())
        .unwrap();

    // Both waits would time out if the handler collected the object first.
    let response = timeout(PATIENCE, client().request(request))
        .await
        .expect("the answer starts while R2 is still sending")
        .expect("response");
    let (head, mut body) = response.into_parts();
    let mut received = Vec::new();
    while received.len() < FIRST_PART {
        let frame = timeout(PATIENCE, body.frame())
            .await
            .expect("the first part arrives while R2 holds the rest")
            .expect("more body")
            .expect("frame");
        received.extend_from_slice(frame.data_ref().expect("data frame"));
    }
    let before_release = received.len();
    release.send(()).expect("stand-in still running");
    received.extend_from_slice(&body.collect().await.expect("rest").to_bytes());

    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.headers.get("content-type").unwrap(), "video/mp4");
    assert_eq!(
        head.headers.get("cache-control").unwrap(),
        "private, max-age=60"
    );
    // Sent chunked, as Next sends it.
    assert!(!head.headers.contains_key("content-length"));
    assert_eq!(before_release, FIRST_PART);
    assert_eq!(received.len(), FIRST_PART + REST);
    assert!(received[..FIRST_PART].iter().all(|byte| *byte == b'a'));
    assert!(received[FIRST_PART..].iter().all(|byte| *byte == b'b'));
}
