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
    AUTHORIZATION, CONNECTION, CONTENT_TYPE, HeaderMap, HeaderName, PROXY_AUTHENTICATE,
    PROXY_AUTHORIZATION, TE, TRAILER, TRANSFER_ENCODING, UPGRADE,
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
// Node sends a response with up to 2,000 headers (`maxHeadersCount`). hyper's
// client reads 100 by default and fails the response, which would be a 502
// for an answer Next alone delivers. The other direction is not raised: this
// server still refuses a request with more than 100 headers (431), where
// Node takes 2,000. `axum::serve` has no setting for it.
const MAX_UPSTREAM_HEADERS: usize = 2_000;

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
            .http1_max_headers(MAX_UPSTREAM_HEADERS)
            .build(connector);
        Self { client, authority }
    }

    /// The status of the upstream's own `GET /api/health`, for this server's
    /// health check. The caller sets the time limit.
    pub async fn health(&self) -> Result<StatusCode, String> {
        let uri = Uri::builder()
            .scheme(Scheme::HTTP)
            .authority(self.authority.clone())
            .path_and_query("/api/health")
            .build()
            .map_err(|error| error.to_string())?;
        let request = Request::get(uri)
            .body(Body::empty())
            .map_err(|error| error.to_string())?;
        let response = self.client.request(request).await;
        response
            .map(|response| response.status())
            .map_err(|error| error_chain(&error))
    }
}

/// A part of Next's cache that a native route expires after its work, where
/// the Next route would have called `revalidateTag` or `revalidatePath`. Next
/// does the expiry itself (`app/api/internal/cache/route.ts`): its cache is
/// in its own process.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheScope {
    /// `revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 })`.
    PublicCatalog,
    /// `expireInstagramVideoVerificationCache()`: the catalog tag and
    /// `revalidatePath("/", "layout")`.
    InstagramVideoVerification,
}

impl CacheScope {
    fn name(self) -> &'static str {
        match self {
            Self::PublicCatalog => "public-catalog",
            Self::InstagramVideoVerification => "instagram-video-verification",
        }
    }
}

/// How long a cache expiry may take. Next answers it without other work.
const CACHE_EXPIRY_TIMEOUT: Duration = Duration::from_secs(10);

impl Upstream {
    /// Asks Next to expire `scope`, with the cron bearer the internal route
    /// requires. `Err` when Next did not confirm: the caller answers as the
    /// TypeScript does when `revalidateTag` throws.
    pub async fn expire_cache(&self, scope: CacheScope, cron_secret: &str) -> Result<(), String> {
        let uri = Uri::builder()
            .scheme(Scheme::HTTP)
            .authority(self.authority.clone())
            .path_and_query(format!("/api/internal/cache?scope={}", scope.name()))
            .build()
            .map_err(|error| error.to_string())?;
        let request = Request::post(uri)
            .header(AUTHORIZATION, format!("Bearer {cron_secret}"))
            .body(Body::empty())
            .map_err(|error| error.to_string())?;
        let response = tokio::time::timeout(CACHE_EXPIRY_TIMEOUT, self.client.request(request))
            .await
            .map_err(|_| "timed out".to_owned())?
            .map_err(|error| error_chain(&error))?;
        if response.status() == StatusCode::OK {
            Ok(())
        } else {
            Err(format!("Next answered {}", response.status()))
        }
    }
}

/// Marks an answer that [`forward`] produced. A native handler that hands its
/// request to the upstream returns that answer, and the layer that adds the
/// headers of a native answer (`headers::apply`) must leave it as it is.
#[derive(Clone, Copy)]
pub struct FromUpstream;

/// The router fallback, and the fallback of every native route for methods it
/// does not handle.
pub async fn forward(state: State<AppState>, request: Request) -> Response {
    let mut response = send_upstream(state, request).await;
    response.extensions_mut().insert(FromUpstream);
    response
}

async fn send_upstream(State(state): State<AppState>, mut request: Request) -> Response {
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
