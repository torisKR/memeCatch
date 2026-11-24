//! The provider GET of `lib/oembed.ts` and `lib/sources/youtube.server.ts`:
//! Node's `fetch` (undici) with `AbortSignal.timeout(...)`.
//!
//! Like `fetch` it sends undici's headers,
//! except `accept-encoding`: this client does not decompress, so it asks for
//! none (the radar client of R8 does the same). `cache: "no-store"` adds
//! `cache-control` and `pragma`. Unlike `fetch` (20 redirects to any http(s)
//! host) it follows at most 5 redirects, each to https on the host it asked
//! (D2-9, B6 follow-up review S2); any other is `fetch failed`.

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

/// Redirects followed, all within the provider's host. undici's are 20.
const MAX_REDIRECTS: usize = 5;
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
                // Only within the provider host that was asked (D2-9, B6
                // follow-up review S2): undici follows any http(s) host.
                if next.scheme() != "https" || next.host_str() != url.host_str() {
                    tracing::warn!(from = %url.host_str().unwrap_or_default(), "oEmbed provider redirected elsewhere");
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

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use axum::Router;
    use axum::extract::Request;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    use super::*;

    /// A provider stub under the test origin. It records every path it is
    /// asked for; `?to=` makes it redirect there, `/loop` redirects to itself.
    async fn stub() -> (Http, Arc<Mutex<Vec<String>>>) {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let log = seen.clone();
        let app = Router::new().fallback(move |request: Request| {
            let log = log.clone();
            async move {
                log.lock().unwrap().push(request.uri().to_string());
                let to =
                    url::form_urlencoded::parse(request.uri().query().unwrap_or("").as_bytes())
                        .find(|(key, _)| key == "to")
                        .map(|(_, value)| value.into_owned())
                        .or_else(|| {
                            request
                                .uri()
                                .path()
                                .ends_with("/loop")
                                .then(|| "/loop".to_owned())
                        });
                match to {
                    Some(to) => (StatusCode::FOUND, [(LOCATION, to)]).into_response(),
                    None => (StatusCode::OK, r#"{"title":"ok"}"#).into_response(),
                }
            }
        });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        (Http::new(Some(&origin)).unwrap(), seen)
    }

    fn deadline() -> Instant {
        Instant::now() + std::time::Duration::from_secs(5)
    }

    fn endpoint(to: &str) -> Url {
        let mut url = Url::parse("https://www.tiktok.com/oembed?url=x").unwrap();
        url.query_pairs_mut().append_pair("to", to);
        url
    }

    #[tokio::test]
    async fn a_redirect_to_another_host_is_not_followed() {
        let (http, seen) = stub().await;
        for foreign in [
            "https://evil.example/steal",
            "https://127.0.0.1/admin",
            "//evil.example/steal",
            "http://www.tiktok.com/oembed",
        ] {
            let result = http.get(&endpoint(foreign), false, deadline()).await;
            assert_eq!(result.unwrap_err(), FetchError::Failed, "{foreign}");
        }
        let seen = seen.lock().unwrap();
        assert_eq!(seen.len(), 4, "only the first request of each: {seen:?}");
        assert!(
            seen.iter()
                .all(|path| path.starts_with("/www.tiktok.com/oembed?")),
            "{seen:?}"
        );
    }

    #[tokio::test]
    async fn a_redirect_within_the_host_is_followed_up_to_the_cap() {
        let (http, seen) = stub().await;
        let fetched = http
            .get(&endpoint("/oembed?url=y"), false, deadline())
            .await
            .unwrap();
        assert_eq!(fetched.status, 200);
        assert_eq!(
            seen.lock().unwrap().last().unwrap(),
            "/www.tiktok.com/oembed?url=y"
        );

        seen.lock().unwrap().clear();
        let looping = Url::parse("https://www.tiktok.com/loop").unwrap();
        let result = http.get(&looping, false, deadline()).await;
        assert_eq!(result.unwrap_err(), FetchError::Failed);
        assert_eq!(seen.lock().unwrap().len(), MAX_REDIRECTS + 1);
    }
}
