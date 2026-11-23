// Each test binary uses a different subset of these helpers.
#![allow(dead_code)]

use std::net::SocketAddr;

use axum::Router;
use axum::body::Body;
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use memecatch_server::config::Config;
use memecatch_server::{AppState, build_app};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

/// A URL nothing connects to: the pools are lazy and proxy tests never query.
pub const UNUSED_DATABASE_URL: &str = "postgresql://memecatch:unused@127.0.0.1:1/memecatch";

/// The test database from `scripts/test-db.sh up`. Tests write rows, so
/// anything that is not on this machine is refused.
pub fn database_url() -> String {
    let url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL is not set. Run: export DATABASE_URL=\"$(scripts/test-db.sh up)\"");
    assert!(
        url.contains("@127.0.0.1:") || url.contains("@localhost:"),
        "refusing to run tests against a database that is not on localhost"
    );
    url
}

pub fn config(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> Config {
    let upstream_url = format!("http://{upstream}");
    let base = [
        ("DATABASE_URL", database_url),
        ("BETTER_AUTH_SECRET", "test-only-auth-secret"),
        ("UPSTREAM_URL", upstream_url.as_str()),
    ];
    Config::from_lookup(|name| {
        base.iter()
            .chain(extra)
            .find(|(key, _)| *key == name)
            .map(|(_, value)| (*value).to_owned())
    })
    .expect("valid test config")
}

/// Serves the real application on an ephemeral local port.
pub async fn spawn_app(config: Config) -> SocketAddr {
    spawn_router(build_app(AppState::new(config).expect("app state"))).await
}

pub async fn spawn_router(router: Router) -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move { axum::serve(listener, router).await.expect("serve") });
    addr
}

/// A local address with nothing listening on it.
pub async fn closed_addr() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    listener.local_addr().expect("local addr")
}

/// A one-shot upstream that speaks raw bytes: it hands back the exact request
/// head it received and answers with `response` verbatim.
pub async fn raw_upstream(response: &'static str) -> (SocketAddr, oneshot::Receiver<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    let (head_tx, head_rx) = oneshot::channel();
    tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.expect("accept");
        let mut received = Vec::new();
        let mut chunk = [0u8; 4096];
        while !received.windows(4).any(|window| window == b"\r\n\r\n") {
            let read = socket.read(&mut chunk).await.expect("read request head");
            assert!(read > 0, "connection closed before the request head ended");
            received.extend_from_slice(&chunk[..read]);
        }
        socket.write_all(response.as_bytes()).await.expect("write");
        socket.shutdown().await.ok();
        head_tx
            .send(String::from_utf8(received).expect("utf-8 request head"))
            .ok();
    });
    (addr, head_rx)
}

/// Sends raw bytes and returns everything the server answers until it closes
/// the connection. The request must carry `Connection: close`.
pub async fn raw_request(addr: SocketAddr, request: &str) -> String {
    let mut socket = TcpStream::connect(addr).await.expect("connect");
    socket.write_all(request.as_bytes()).await.expect("write");
    let mut response = Vec::new();
    socket.read_to_end(&mut response).await.expect("read");
    String::from_utf8(response).expect("utf-8 response")
}

/// Splits a raw HTTP head into its first line and `(lowercase name, value)`
/// pairs, sorted.
pub fn parse_head(raw: &str) -> (String, Vec<(String, String)>) {
    let head = raw.split("\r\n\r\n").next().expect("head");
    let mut lines = head.split("\r\n");
    let first = lines.next().expect("first line").to_owned();
    let mut headers: Vec<(String, String)> = lines
        .map(|line| {
            let (name, value) = line.split_once(':').expect("header line");
            (name.to_ascii_lowercase(), value.trim().to_owned())
        })
        .collect();
    headers.sort();
    (first, headers)
}

pub fn client() -> Client<HttpConnector, Body> {
    Client::builder(TokioExecutor::new()).build(HttpConnector::new())
}
