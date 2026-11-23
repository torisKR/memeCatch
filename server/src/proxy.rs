//! Fallback reverse proxy: every request no native route answers goes to the
//! Next server at `UPSTREAM_URL`.
//!
//! The request target is forwarded byte for byte. `http::Uri` keeps the path
//! and query exactly as received, so percent-encoded Hangul (`%EC%A4%91`),
//! lowercase escapes (`%2f`) and raw UTF-8 all reach Next untouched. Next's
//! `proxy.ts` decides canonical redirects from those exact bytes. One
//! difference from Node: hyper answers 400 to a target that is not valid UTF-8.
//!
//! Request headers pass through as received, `Host` included. Caddy already
//! sets `X-Forwarded-*`; `proxy.ts` and `lib/rate-limit.ts` read them and
//! `CF-Connecting-IP`, so nothing is added, rewritten or appended here.
//!
//! Bodies stream in both directions: no buffering, no decompression, no size
//! limit and no response timeout (`/api/memes/chat` streams for a long time).
//! Redirects are passed through, never followed.
//!
//! WebSocket upgrade is not needed in production. `Upgrade` and `Connection`
//! are hop-by-hop and are stripped, so the upstream sees a plain request and
//! its answer is returned as is.

use std::time::Duration;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{
    CONNECTION, CONTENT_TYPE, HeaderMap, HeaderName, PROXY_AUTHENTICATE, PROXY_AUTHORIZATION, TE,
    TRAILER, TRANSFER_ENCODING, UPGRADE,
};
use axum::http::uri::{Authority, PathAndQuery, Scheme, Uri};
use axum::http::{StatusCode, Version};
use axum::response::{IntoResponse, Response};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;

use crate::AppState;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
// Node closes an idle keep-alive connection after 5 s (`server.keepAliveTimeout`).
// Dropping ours first avoids sending a request into a socket Node is closing,
// which would surface as a 502.
const POOL_IDLE_TIMEOUT: Duration = Duration::from_secs(4);

const HOP_BY_HOP: [HeaderName; 8] = [
    CONNECTION,
    HeaderName::from_static("keep-alive"),
    PROXY_AUTHENTICATE,
    PROXY_AUTHORIZATION,
    TE,
    TRAILER,
    TRANSFER_ENCODING,
    UPGRADE,
];

#[derive(Clone)]
pub struct Upstream {
    client: Client<HttpConnector, Body>,
    authority: Authority,
}

impl Upstream {
    pub fn new(authority: Authority) -> Self {
        let mut connector = HttpConnector::new();
        connector.set_connect_timeout(Some(CONNECT_TIMEOUT));
        connector.set_nodelay(true);
        let client = Client::builder(TokioExecutor::new())
            .pool_idle_timeout(POOL_IDLE_TIMEOUT)
            .build(connector);
        Self { client, authority }
    }
}

/// The router fallback, and the fallback of every native route for methods it
/// does not handle.
pub async fn forward(State(state): State<AppState>, mut request: Request) -> Response {
    let upstream = &state.upstream;
    let path_and_query = request
        .uri()
        .path_and_query()
        .cloned()
        .unwrap_or_else(|| PathAndQuery::from_static("/"));
    let path = path_and_query.path().to_owned();
    let method = request.method().clone();

    let mut parts = axum::http::uri::Parts::default();
    parts.scheme = Some(Scheme::HTTP);
    parts.authority = Some(upstream.authority.clone());
    parts.path_and_query = Some(path_and_query);
    *request.uri_mut() = Uri::from_parts(parts).expect("scheme, authority and path are all set");
    *request.version_mut() = Version::HTTP_11;
    strip_hop_by_hop(request.headers_mut());

    match upstream.client.request(request).await {
        Ok(response) => {
            let (mut parts, body) = response.into_parts();
            strip_hop_by_hop(&mut parts.headers);
            // A stream has no known length. With a body whose length is known,
            // axum adds a `Content-Length` the upstream never sent: `0` on a
            // HEAD or 304 response, which would misdescribe the resource.
            let body = Body::from_stream(Body::new(body).into_data_stream());
            Response::from_parts(parts, body)
        }
        Err(error) => {
            // The query string can carry tokens, so only the path is logged.
            tracing::error!(
                %method,
                path,
                upstream = %upstream.authority,
                cause = %error_chain(&error),
                "upstream request failed"
            );
            (
                StatusCode::BAD_GATEWAY,
                [(CONTENT_TYPE, "text/plain; charset=utf-8")],
                "Bad Gateway",
            )
                .into_response()
        }
    }
}

/// Removes the hop-by-hop headers and any header `Connection` names.
fn strip_hop_by_hop(headers: &mut HeaderMap) {
    let named_by_connection: Vec<HeaderName> = headers
        .get_all(CONNECTION)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .filter_map(|name| HeaderName::from_bytes(name.trim().as_bytes()).ok())
        .collect();
    for name in named_by_connection.iter().chain(&HOP_BY_HOP) {
        headers.remove(name);
    }
}

fn error_chain(error: &dyn std::error::Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        message.push_str(": ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }
    message
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn strips_hop_by_hop_and_connection_named_headers_only() {
        let mut headers = HeaderMap::new();
        for (name, value) in [
            ("connection", "keep-alive, X-Per-Hop"),
            ("keep-alive", "timeout=5"),
            ("proxy-authenticate", "Basic"),
            ("proxy-authorization", "Basic abc"),
            ("te", "trailers"),
            ("trailer", "Expires"),
            ("transfer-encoding", "chunked"),
            ("upgrade", "websocket"),
            ("x-per-hop", "1"),
            ("host", "catchmeme.com"),
            ("x-forwarded-for", "203.0.113.7"),
            ("content-length", "12"),
        ] {
            headers.insert(name, HeaderValue::from_static(value));
        }
        headers.append("set-cookie", HeaderValue::from_static("a=1"));
        headers.append("set-cookie", HeaderValue::from_static("b=2"));

        strip_hop_by_hop(&mut headers);

        let mut kept: Vec<&str> = headers.keys().map(HeaderName::as_str).collect();
        kept.sort_unstable();
        assert_eq!(
            kept,
            ["content-length", "host", "set-cookie", "x-forwarded-for"]
        );
        assert_eq!(headers.get_all("set-cookie").iter().count(), 2);
    }
}
