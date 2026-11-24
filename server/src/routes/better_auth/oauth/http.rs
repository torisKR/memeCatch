//! The requests to the providers: what better-auth's `betterFetch` (and the
//! app's `fetch` for Kakao's profile) sees of an answer.
//!
//! Redirects are not followed. better-auth refuses one on the token request
//! (`fetchRefusingRedirects`); the app's profile `fetch` would follow it,
//! and here it is a failed request (PLAN.md A3). Node's `fetch` has no
//! overall limit; these stop after `TIMEOUT` and read at most `MAX_BODY`.

use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::http::header::CONTENT_TYPE;
use axum::http::{Request, StatusCode};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;

const TIMEOUT: Duration = Duration::from_secs(30);
const MAX_BODY: usize = 1024 * 1024;

pub struct HttpClient(Client<HttpsConnector<HttpConnector>, Body>);

/// An answer, read to the end.
pub struct Fetched {
    pub status: StatusCode,
    content_type: Option<String>,
    pub body: Bytes,
}

impl HttpClient {
    pub fn new() -> Self {
        let mut http = HttpConnector::new();
        // `AXUM_TEST_OAUTH_ORIGIN` is plain HTTP; the providers' are HTTPS.
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .expect("ring's default provider has protocol versions")
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Self(Client::builder(TokioExecutor::new()).build(connector))
    }

    pub async fn fetch(&self, request: Request<Body>) -> Result<Fetched, String> {
        let read = async {
            let answer = self.0.request(request).await.map_err(|e| e.to_string())?;
            let status = answer.status();
            let content_type = answer
                .headers()
                .get(CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let body = axum::body::to_bytes(Body::new(answer.into_body()), MAX_BODY)
                .await
                .map_err(|e| e.to_string())?;
            Ok(Fetched {
                status,
                content_type,
                body,
            })
        };
        tokio::time::timeout(TIMEOUT, read)
            .await
            .map_err(|_| "timed out".to_owned())?
    }
}

impl Fetched {
    /// `response.ok`.
    pub fn ok(&self) -> bool {
        self.status.is_success()
    }

    /// betterFetch's `detectResponseType` is `json` or `text`: the body is
    /// read as text and parsed as JSON when it parses. Otherwise it is a
    /// `Blob`, which has none of the token fields.
    pub fn is_json_or_text(&self) -> bool {
        let Some(content_type) = &self.content_type else {
            return true;
        };
        let media = content_type.split(';').next().unwrap_or_default();
        is_json_media_type(media)
            || media.starts_with("text/")
            || [
                "image/svg",
                "application/xml",
                "application/xhtml",
                "application/html",
            ]
            .contains(&media)
    }
}

/// `/^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i` on the part before
/// the first `;`.
fn is_json_media_type(media: &str) -> bool {
    let lower = media.to_ascii_lowercase();
    let Some(subtype) = lower.strip_prefix("application/") else {
        return false;
    };
    let Some(prefix) = subtype.strip_suffix("json") else {
        return false;
    };
    prefix.is_empty()
        || prefix.strip_suffix('+').is_some_and(|suffix| {
            suffix
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || b"_!#$%&*.^`~-".contains(&byte))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fetched(content_type: Option<&str>) -> Fetched {
        Fetched {
            status: StatusCode::OK,
            content_type: content_type.map(str::to_owned),
            body: Bytes::new(),
        }
    }

    #[test]
    fn response_types_are_detected_as_better_fetch_detects_them() {
        for json_or_text in [
            None,
            Some("application/json"),
            Some("application/json;charset=UTF-8"),
            Some("Application/JSON"),
            Some("application/vnd.api+json"),
            Some("text/plain"),
            Some("application/xml"),
        ] {
            assert!(fetched(json_or_text).is_json_or_text(), "{json_or_text:?}");
        }
        for blob in [
            Some("application/octet-stream"),
            Some("application/json "),
            Some("application/x-www-form-urlencoded"),
            Some("application/a b+json"),
        ] {
            assert!(!fetched(blob).is_json_or_text(), "{blob:?}");
        }
    }
}
