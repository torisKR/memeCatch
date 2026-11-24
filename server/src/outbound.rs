//! Outbound HTTPS for native routes that call a provider themselves, as the
//! TypeScript does with `fetch`. Today that is the saved-state email delivery
//! (`routes/ops/saved_state.rs`).
//!
//! It trusts the Mozilla roots compiled into the binary, as R2 does, plus the
//! certificates in `AXUM_EXTRA_CA_CERTS` when that names a PEM file: the
//! counterpart of `NODE_EXTRA_CA_CERTS`, which Node's `fetch` honours. Tests
//! use it to reach a local stub; production leaves it unset.
//!
//! What `fetch` does and this does not: it follows redirects, and it adds
//! `accept`, `accept-language`, `accept-encoding`, `sec-fetch-mode` and
//! `user-agent` headers of its own. A request here carries only the headers
//! the caller names, plus `host` and `content-length`.

use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::header::{HeaderName, HeaderValue};
use axum::http::{Method, Request, StatusCode, Uri};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use rustls::pki_types::CertificateDer;
use rustls::pki_types::pem::PemObject;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// Why a request got no status. The messages are the `message` of the error
/// Node's `fetch` throws in the same case; callers that store or report the
/// message, as the TypeScript does, store the same text.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OutboundError {
    /// No connection, a TLS failure, or a broken response:
    /// `TypeError: fetch failed`.
    Failed,
    /// `AbortSignal.timeout(...)` fired before the response headers arrived.
    Timeout,
}

impl OutboundError {
    pub fn message(self) -> &'static str {
        match self {
            Self::Failed => "fetch failed",
            Self::Timeout => "The operation was aborted due to timeout",
        }
    }
}

#[derive(Clone)]
pub struct Outbound {
    client: Client<HttpsConnector<HttpConnector>, Body>,
}

impl Outbound {
    /// `extra_ca_certs` is the path of `AXUM_EXTRA_CA_CERTS`. A file that
    /// cannot be read or holds no certificate is a startup error: a provider
    /// behind that CA would otherwise fail on every request.
    pub fn new(extra_ca_certs: Option<&str>) -> Result<Self, String> {
        let mut roots = rustls::RootCertStore::empty();
        roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
        if let Some(path) = extra_ca_certs {
            for certificate in extra_certificates(path)? {
                roots
                    .add(certificate)
                    .map_err(|error| format!("AXUM_EXTRA_CA_CERTS {path:?}: {error}"))?;
            }
        }
        let tls = rustls::ClientConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_safe_default_protocol_versions()
        .map_err(|error| error.to_string())?
        .with_root_certificates(roots)
        .with_no_client_auth();
        let mut http = HttpConnector::new();
        http.set_connect_timeout(Some(CONNECT_TIMEOUT));
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_tls_config(tls)
            .https_only()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
        })
    }

    /// POSTs `body` to `url` and returns the status, waiting at most
    /// `timeout` for the response headers. The response body is not read.
    pub async fn post(
        &self,
        url: &url::Url,
        headers: &[(HeaderName, HeaderValue)],
        body: String,
        timeout: Duration,
    ) -> Result<StatusCode, OutboundError> {
        let uri: Uri = url.as_str().parse().map_err(|_| OutboundError::Failed)?;
        let mut request = Request::builder().method(Method::POST).uri(uri);
        for (name, value) in headers {
            request = request.header(name, value);
        }
        let request = request
            .body(Body::from(body))
            .map_err(|_| OutboundError::Failed)?;
        match tokio::time::timeout(timeout, self.client.request(request)).await {
            Err(_) => Err(OutboundError::Timeout),
            Ok(Err(error)) => {
                tracing::warn!(%error, "outbound request failed");
                Err(OutboundError::Failed)
            }
            Ok(Ok(response)) => Ok(response.status()),
        }
    }
}

impl Outbound {
    /// POSTs `body` to `url` and reads the answer, all within `timeout`
    /// (`AbortSignal.timeout`, which also covers the body). A body over
    /// `limit` bytes is a failure.
    pub async fn post_read(
        &self,
        url: &url::Url,
        headers: &[(HeaderName, HeaderValue)],
        body: String,
        timeout: Duration,
        limit: usize,
    ) -> Result<(StatusCode, Vec<u8>), OutboundError> {
        let uri: Uri = url.as_str().parse().map_err(|_| OutboundError::Failed)?;
        let mut request = Request::builder().method(Method::POST).uri(uri);
        for (name, value) in headers {
            request = request.header(name, value);
        }
        let request = request
            .body(Body::from(body))
            .map_err(|_| OutboundError::Failed)?;
        let exchange = async {
            let response = self.client.request(request).await.map_err(|error| {
                tracing::warn!(%error, "outbound request failed");
                OutboundError::Failed
            })?;
            let status = response.status();
            let bytes = axum::body::to_bytes(Body::new(response.into_body()), limit)
                .await
                .map_err(|_| OutboundError::Failed)?;
            Ok((status, bytes.to_vec()))
        };
        tokio::time::timeout(timeout, exchange)
            .await
            .unwrap_or(Err(OutboundError::Timeout))
    }
}

fn extra_certificates(path: &str) -> Result<Vec<CertificateDer<'static>>, String> {
    let pem = std::fs::read(path)
        .map_err(|error| format!("AXUM_EXTRA_CA_CERTS {path:?} cannot be read: {error}"))?;
    let certificates = CertificateDer::pem_slice_iter(&pem)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("AXUM_EXTRA_CA_CERTS {path:?}: {error}"))?;
    if certificates.is_empty() {
        return Err(format!("AXUM_EXTRA_CA_CERTS {path:?} holds no certificate"));
    }
    Ok(certificates)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_or_empty_ca_file_stops_the_start() {
        assert!(Outbound::new(None).is_ok());
        let error = Outbound::new(Some("/nonexistent/ca.pem"))
            .err()
            .expect("a missing file is refused");
        assert!(error.contains("cannot be read"), "{error}");
        let empty = std::env::temp_dir().join("memecatch-axum-empty-ca.pem");
        std::fs::write(&empty, "not a certificate\n").expect("temp file");
        let error = Outbound::new(empty.to_str())
            .err()
            .expect("a file without a certificate is refused");
        assert!(error.contains("holds no certificate"), "{error}");
    }

    #[test]
    fn errors_carry_the_messages_of_node_fetch() {
        assert_eq!(OutboundError::Failed.message(), "fetch failed");
        assert_eq!(
            OutboundError::Timeout.message(),
            "The operation was aborted due to timeout"
        );
    }
}
