//! Requests no route takes: the router's own answers (PLAN.md L2-1).

mod common;

use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::http::StatusCode;
use common::{UNUSED_DATABASE_URL, config_alone, send, spawn_app};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

/// Every request here must be answered well within this.
const DEADLINE: Duration = Duration::from_secs(5);

async fn app() -> SocketAddr {
    spawn_app(config_alone(UNUSED_DATABASE_URL, &[])).await
}

#[tokio::test]
async fn an_unknown_api_path_is_a_json_404() {
    let app = app().await;
    for method in ["GET", "POST", "PUT", "DELETE", "OPTIONS"] {
        let reply = send(app, method, "/api/no-such-route", &[], "{}").await;
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{method}");
        assert_eq!(
            reply.header("content-type"),
            Some("application/json"),
            "{method}"
        );
        assert_eq!(reply.body, r#"{"error":"not_found"}"#, "{method}");
        assert_eq!(reply.header("cache-control"), Some("no-store"), "{method}");
    }
    let head = send(app, "HEAD", "/api/no/such/route", &[], Body::empty()).await;
    assert_eq!(head.status, StatusCode::NOT_FOUND);
    assert_eq!(head.body, "");
}

#[tokio::test]
async fn an_unknown_page_path_is_the_not_found_document() {
    let app = app().await;
    for method in ["GET", "POST", "DELETE"] {
        let reply = send(app, method, "/no/such/page", &[], "x=1").await;
        assert_eq!(reply.status, StatusCode::NOT_FOUND, "{method}");
        assert!(
            reply.body.contains("<title>페이지를 찾을 수 없어요 | 밈캐치</title>"),
            "{method}: {}",
            reply.body
        );
    }
}

#[tokio::test]
async fn a_known_path_with_another_method_is_405_with_allow() {
    let app = app().await;
    for (method, path, allowed) in [
        ("PUT", "/api/health", "GET,HEAD"),
        ("OPTIONS", "/api/health", "GET,HEAD"),
        ("DELETE", "/about", "GET,HEAD"),
        ("POST", "/robots.txt", "GET,HEAD"),
        ("GET", "/api/db/query", "POST"),
        ("OPTIONS", "/api/db/query", "POST"),
    ] {
        let reply = send(app, method, path, &[], "{}").await;
        assert_eq!(
            reply.status,
            StatusCode::METHOD_NOT_ALLOWED,
            "{method} {path}"
        );
        assert_eq!(reply.header("allow"), Some(allowed), "{method} {path}");
        assert!(reply.header("x-axum-not-ported").is_none(), "{method} {path}");
    }
}

/// Writes `head` and then `body_bytes` zero bytes from another task, reads
/// the answer's head, and returns it with whether the writer finished.
async fn post_large(app: SocketAddr, path: &str, body_bytes: usize) -> (String, bool) {
    let socket = TcpStream::connect(app).await.expect("connect");
    let (mut reader, mut writer) = socket.into_split();
    let head = format!(
        "POST {path} HTTP/1.1\r\nHost: {app}\r\nContent-Type: application/json\r\nContent-Length: {body_bytes}\r\n\r\n"
    );
    let upload = tokio::spawn(async move {
        writer.write_all(head.as_bytes()).await?;
        let chunk = vec![b' '; 64 * 1024];
        let mut sent = 0;
        while sent < body_bytes {
            let size = chunk.len().min(body_bytes - sent);
            writer.write_all(&chunk[..size]).await?;
            sent += size;
        }
        Ok::<_, std::io::Error>(())
    });
    let mut answer = Vec::new();
    let mut buffer = [0u8; 4096];
    let read_head = timeout(DEADLINE, async {
        while !answer.windows(4).any(|window| window == b"\r\n\r\n") {
            let read = reader.read(&mut buffer).await.expect("read");
            assert!(read > 0, "closed before an answer");
            answer.extend_from_slice(&buffer[..read]);
        }
    })
    .await;
    assert!(read_head.is_ok(), "no answer to POST {path} within {DEADLINE:?}");
    // The upload ends, one way or the other: read in full, or refused by a
    // closed connection. It must not wait forever on a server that stopped
    // reading.
    let finished = timeout(DEADLINE, upload).await.is_ok();
    (String::from_utf8_lossy(&answer).into_owned(), finished)
}

#[tokio::test]
async fn a_large_unread_body_neither_hangs_the_answer_nor_the_upload() {
    let app = app().await;
    for path in ["/api/no-such-route", "/no/such/page", "/api/health"] {
        let (head, finished) = post_large(app, path, 8 * 1024 * 1024).await;
        assert!(
            head.starts_with("HTTP/1.1 404") || head.starts_with("HTTP/1.1 405"),
            "{path}: {head}"
        );
        assert!(finished, "{path}: the upload hung");
    }
}

/// A small body the answer did not need is read, so the connection serves
/// the next request.
#[tokio::test]
async fn a_small_unread_body_leaves_the_connection_usable() {
    let app = app().await;
    let mut socket = TcpStream::connect(app).await.expect("connect");
    let body = r#"{"event":"x"}"#;
    let requests = format!(
        "POST /api/no-such-route HTTP/1.1\r\nHost: {app}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}\
         GET /api/no-such-route HTTP/1.1\r\nHost: {app}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    socket.write_all(requests.as_bytes()).await.expect("write");
    let mut answers = Vec::new();
    timeout(DEADLINE, socket.read_to_end(&mut answers))
        .await
        .expect("both answers in time")
        .expect("read");
    let answers = String::from_utf8_lossy(&answers);
    assert_eq!(answers.matches("HTTP/1.1 404").count(), 2, "{answers}");
}
