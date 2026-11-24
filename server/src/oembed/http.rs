//! The provider GET of `lib/oembed.ts` and `lib/sources/youtube.server.ts`:
//! Node's `fetch` (undici) with `AbortSignal.timeout(...)`.
//!
//! Like `fetch` it follows up to 20 redirects and sends undici's headers,
//! except `accept-encoding`: this client does not decompress, so it asks for
//! none (the radar client of R8 does the same). `cache: "no-store"` adds
//! `cache-control` and `pragma`.

use axum::body::{Body, Bytes};
use axum::http::header::{
    ACCEPT, ACCEPT_LANGUAGE, CACHE_CONTROL, CONTENT_LENGTH, HeaderName, LOCATION, PRAGMA,
    USER_AGENT,
};
use axum::http::{Method, Request};
use futures_util::StreamExt;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use tokio::time::Instant;
use url::Url;

/// undici's `maxRedirections` for `fetch`.
const MAX_REDIRECTS: usize = 20;
/// Bodies larger than this are treated as unreadable. Next reads and caches
/// any size; no oEmbed or `videos.list` answer comes near it.
// ponytail: fixed cap, raise it if a provider ever answers with more.
const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

/// An answer with its status. `body` is `None` when reading it failed (the
/// deadline, a broken connection, or more than `MAX_BODY_BYTES`).
#[derive(Clone, Debug)]
pub struct Fetched {
    pub status: u16,
    /// `response.headers.get("content-length")`.
    pub content_length: Option<Vec<u8>>,
    pub body: Option<Bytes>,
}

/// Why `fetch` rejected.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FetchError {
    /// The signal fired before the response headers: a `TimeoutError`.
    Timeout,
    /// `TypeError: fetch failed`.
    Failed,
}

impl FetchError {
    /// The rejection's `message`.
    pub fn message(self) -> &'static str {
        match self {
            Self::Timeout => "The operation was aborted due to timeout",
            Self::Failed => "fetch failed",
        }
    }
}

#[derive(Clone)]
pub struct Http {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    test_origin: Option<String>,
}

impl Http {
    pub fn new(test_origin: Option<&str>) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for the oEmbed client: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            test_origin: test_origin.map(|origin| origin.trim_end_matches('/').to_owned()),
        })
    }

    /// `fetch(url, { signal })` whose signal fires at `deadline`, then the
    /// body read under the same signal.
    pub async fn get(
        &self,
        url: &Url,
        no_store: bool,
        deadline: Instant,
    ) -> Result<Fetched, FetchError> {
        let mut current = url.clone();
        for _ in 0..=MAX_REDIRECTS {
            let response = tokio::time::timeout_at(deadline, self.send(&current, no_store))
                .await
                .map_err(|_| FetchError::Timeout)??;
            let status = response.status().as_u16();
            let location = matches!(status, 301 | 302 | 303 | 307 | 308)
                .then(|| response.headers().get(LOCATION))
                .flatten()
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            if let Some(location) = location {
                let next = current.join(&location).map_err(|_| FetchError::Failed)?;
                if !matches!(next.scheme(), "http" | "https") {
                    return Err(FetchError::Failed);
                }
                current = next;
                continue;
            }
            let content_length = crate::routes::origin::header(response.headers(), CONTENT_LENGTH);
            let body =
                tokio::time::timeout_at(deadline, read_body(Body::new(response.into_body())))
                    .await
                    .ok()
                    .flatten();
            return Ok(Fetched {
                status,
                content_length,
                body,
            });
        }
        Err(FetchError::Failed)
    }

    async fn send(
        &self,
        url: &Url,
        no_store: bool,
    ) -> Result<hyper::Response<hyper::body::Incoming>, FetchError> {
        let mut request = Request::builder()
            .method(Method::GET)
            .uri(self.target(url))
            .header(ACCEPT, "*/*")
            .header(ACCEPT_LANGUAGE, "*")
            .header(HeaderName::from_static("sec-fetch-mode"), "cors")
            .header(USER_AGENT, "node");
        if no_store {
            request = request
                .header(CACHE_CONTROL, "no-cache")
                .header(PRAGMA, "no-cache");
        }
        let request = request
            .body(Body::empty())
            .map_err(|_| FetchError::Failed)?;
        self.client.request(request).await.map_err(|error| {
            tracing::warn!(%error, "oEmbed provider request failed");
            FetchError::Failed
        })
    }

    /// The URL itself, or under the test origin as `/<host><path>`.
    fn target(&self, url: &Url) -> String {
        let mut url = url.clone();
        url.set_fragment(None);
        match &self.test_origin {
            Some(origin) => format!(
                "{origin}/{}{}",
                url.host_str().unwrap_or_default(),
                &url[url::Position::BeforePath..]
            ),
            None => url.to_string(),
        }
    }
}

async fn read_body(body: Body) -> Option<Bytes> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.ok()?;
        if bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    Some(Bytes::from(bytes))
}
