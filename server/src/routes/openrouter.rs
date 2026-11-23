//! The HTTP client for OpenRouter, shared by the meme chat
//! (lib/meme-chat.server.ts) and the MPE evidence draft
//! (lib/mpe/openrouter.server.ts). Both send to `https://openrouter.ai`;
//! the TypeScript cannot be pointed anywhere else in production.
//! `AXUM_TEST_OPENROUTER_ORIGIN` sends the same requests to a local stub
//! instead, for the tests and the parity scripts only (`Config`).

use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::http::header::{
    ACCEPT, ACCEPT_LANGUAGE, AUTHORIZATION, CACHE_CONTROL, CONTENT_TYPE, HeaderMap, HeaderName,
    PRAGMA, USER_AGENT,
};
use axum::http::{Method, Request, StatusCode};
use futures_util::StreamExt;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;

pub const ORIGIN: &str = "https://openrouter.ai";

/// An answer read in full.
pub struct Answer {
    pub status: StatusCode,
    pub headers: HeaderMap,
    /// `None` when the body was longer than the limit given, broke off, or
    /// was still arriving at the deadline.
    pub body: Option<Bytes>,
}

/// Why no answer came: the TypeScript's fetch rejecting.
#[derive(Debug, PartialEq, Eq)]
pub enum Failure {
    /// The time allowed ran out (`AbortSignal.timeout`).
    Timeout,
    /// The connection failed or broke (`TypeError: fetch failed`).
    Network,
}

#[derive(Clone)]
pub struct OpenRouter {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    origin: String,
}

impl OpenRouter {
    /// `test_origin` replaces `https://openrouter.ai` (tests only).
    pub fn new(test_origin: Option<&str>) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for OpenRouter: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            origin: test_origin
                .unwrap_or(ORIGIN)
                .trim_end_matches('/')
                .to_owned(),
        })
    }

    /// POSTs `body` as JSON to `path` (`/api/v1/...`) with the key, and reads
    /// the answer, at most `max_bytes` of it, all within `timeout`. Running
    /// out of time before the answer's head is `Timeout`; after it, no body. The
    /// headers are those undici's `fetch` sends, without `accept-encoding`
    /// (this client does not decompress).
    pub async fn post(
        &self,
        path: &str,
        key: &str,
        body: String,
        timeout: Duration,
        max_bytes: usize,
    ) -> Result<Answer, Failure> {
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("{}{path}", self.origin))
            .header(AUTHORIZATION, format!("Bearer {key}"))
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "*/*")
            .header(ACCEPT_LANGUAGE, "*")
            .header(HeaderName::from_static("sec-fetch-mode"), "cors")
            .header(USER_AGENT, "node")
            // What undici adds for `cache: "no-store"`.
            .header(CACHE_CONTROL, "no-cache")
            .header(PRAGMA, "no-cache")
            .body(Body::from(body))
            .map_err(|_| Failure::Network)?;
        let deadline = tokio::time::Instant::now() + timeout;
        let response = tokio::time::timeout_at(deadline, self.client.request(request))
            .await
            .map_err(|_| Failure::Timeout)?
            .map_err(|_| Failure::Network)?;
        let (parts, incoming) = response.into_parts();
        // A body cut off by the deadline or the connection is no body:
        // `readBoundedText(...).catch(() => "")` and a failed `response.json()`.
        let body = tokio::time::timeout_at(deadline, read_at_most(Body::new(incoming), max_bytes))
            .await
            .ok()
            .flatten();
        Ok(Answer {
            status: parts.status,
            headers: parts.headers,
            body,
        })
    }
}

/// The whole body; `None` past `max_bytes` or when it breaks off.
async fn read_at_most(body: Body, max_bytes: usize) -> Option<Bytes> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.ok()?;
        if bytes.len() + chunk.len() > max_bytes {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    Some(Bytes::from(bytes))
}
