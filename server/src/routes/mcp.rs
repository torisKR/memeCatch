//! The ChatGPT connector routes (integrations/memecatch-chatgpt):
//!
//! - `mcp`: `/api/mcp`, the public MCP server (`public.rs`);
//! - `mcp-oauth-metadata`, `mcp-resource-metadata`: the two OAuth metadata
//!   documents under `/.well-known`;
//! - `mcp-operator`: `GET /api/mcp-operator`, the authorization challenge;
//! - `mcp-operator-post`, `mcp-oauth-authorize`, `mcp-oauth-token`,
//!   `mcp-github`, `mcp-events-cron`: the stateful operator routes.
//!
//! The stateful routes seal their state with `MCP_EVENT_STATE_KEY`. Without
//! the key (production: compose does not pass it to Next) each of them
//! fails at `stateKey()` with a fixed answer, which is what these ports
//! give; no token, code or subscription can exist then. With a key set,
//! Axum does not register them and Next keeps the OAuth server and the
//! event broker (PLAN.md section 14).

mod authorize;
mod corpus;
mod operator;
mod protocol;
mod public;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::header::{
    ACCEPT, ACCEPT_LANGUAGE, CACHE_CONTROL, CONTENT_TYPE, HeaderValue, PRAGMA, USER_AGENT,
};
use axum::http::{HeaderName, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use futures_util::StreamExt;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;

use super::public::www_to_upstream;
use super::{Routes, proxy, request};
use crate::AppState;

/// `ORIGIN` of oauth.mjs: fixed, whatever the site URL.
pub const ORIGIN: &str = "https://catchmeme.com";

/// `headers` of http.mjs. Its `Referrer-Policy` never reaches the client:
/// next.config's global `strict-origin-when-cross-origin` replaces it, and
/// `headers::apply` adds that one here.
fn route_headers(response: &mut Response) {
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
}

/// `json(data, status, extra)` of http.mjs, for JSON already written.
pub fn json(status: StatusCode, body: impl Into<String>) -> Response {
    let mut response = (status, [(CONTENT_TYPE, "application/json")], body.into()).into_response();
    route_headers(&mut response);
    response
}

/// The JSON of a string.
pub fn string(value: &str) -> String {
    serde_json::to_string(value).expect("a string serializes")
}

/// Why a GET gave no answer or no body, as `fetch` and its reader reject.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    /// `TypeError: fetch failed`: no connection, or a redirect.
    Network,
    /// `TypeError: terminated`: the body broke off.
    Terminated,
    /// `AbortSignal.timeout` fired (a `DOMException`, not a `TypeError`).
    TimedOut,
    /// Past the size limit.
    TooLarge,
}

/// A GET answer read in full.
pub struct Fetched {
    pub status: StatusCode,
    pub body: Result<Bytes, Failure>,
    pub content_length: Option<String>,
}

/// GET requests to the two outside documents these routes read
/// (`llms-full.txt` and ChatGPT's client metadata), with the headers undici
/// sends (no `accept-encoding`). `AXUM_TEST_MCP_ORIGIN` sends them to a
/// local stub instead (tests only).
#[derive(Clone)]
pub struct Outbound {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    test_origin: Option<String>,
}

impl Outbound {
    pub fn new(test_origin: Option<&str>) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            test_origin: test_origin.map(str::to_owned),
        })
    }

    fn target(&self, url: &str) -> String {
        match &self.test_origin {
            Some(origin) => ["https://catchmeme.com", "https://chatgpt.com"]
                .iter()
                .find_map(|known| {
                    url.strip_prefix(known)
                        .map(|path| format!("{origin}{path}"))
                })
                .unwrap_or_else(|| url.to_owned()),
            None => url.to_owned(),
        }
    }

    /// `fetch(url, { redirect: "error", signal: AbortSignal.timeout(...) })`
    /// and the read of its body, with the reason each can reject for.
    pub async fn get(
        &self,
        url: &str,
        accept: &'static str,
        no_store: bool,
        timeout: Duration,
        max: usize,
    ) -> Result<Fetched, Failure> {
        let mut request = axum::http::Request::builder()
            .method(Method::GET)
            .uri(self.target(url))
            .header(ACCEPT, accept)
            .header(ACCEPT_LANGUAGE, "*")
            .header(HeaderName::from_static("sec-fetch-mode"), "cors")
            .header(USER_AGENT, "node");
        if no_store {
            request = request
                .header(CACHE_CONTROL, "no-cache")
                .header(PRAGMA, "no-cache");
        }
        let request = request.body(Body::empty()).map_err(|_| Failure::Network)?;
        let deadline = tokio::time::Instant::now() + timeout;
        let response = tokio::time::timeout_at(deadline, self.client.request(request))
            .await
            .map_err(|_| Failure::TimedOut)?
            .map_err(|_| Failure::Network)?;
        if matches!(response.status().as_u16(), 301 | 302 | 303 | 307 | 308) {
            return Err(Failure::Network);
        }
        let (parts, incoming) = response.into_parts();
        let content_length = parts
            .headers
            .get(axum::http::header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .map(str::to_owned);
        let body = tokio::time::timeout_at(deadline, read_body(Body::new(incoming), max))
            .await
            .unwrap_or(Err(Failure::TimedOut));
        Ok(Fetched {
            status: parts.status,
            body,
            content_length,
        })
    }
}

/// The reader loop of the TypeScript: `TooLarge` past `max` bytes.
async fn read_body(body: Body, max: usize) -> Result<Bytes, Failure> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| Failure::Terminated)?;
        if bytes.len() + chunk.len() > max {
            return Err(Failure::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(Bytes::from(bytes))
}

/// `MCP_EVENT_STATE_KEY` is unset or empty: every stateful route fails at
/// `stateKey()`.
fn stateless(state: &AppState) -> bool {
    state
        .config
        .mcp
        .state_key
        .as_deref()
        .is_none_or(str::is_empty)
}

pub fn router(state: &AppState) -> Router<AppState> {
    let outbound = match Outbound::new(state.config.mcp.test_origin.as_deref()) {
        Ok(outbound) => outbound,
        Err(error) => {
            tracing::error!(%error, "the MCP routes are left to the upstream");
            return Router::new();
        }
    };
    let public = Arc::new(public::Public::new(outbound.clone()));
    let mut api = Routes::new(state).add(
        "mcp",
        "/api/mcp",
        post({
            let public = public.clone();
            move |state: State<AppState>, request: Request| {
                public::post(state, public.clone(), request)
            }
        })
        .get(|| std::future::ready(public::get())),
    );
    let mut operator = vec![(
        "mcp-operator",
        get(|| std::future::ready(operator::challenge())),
    )];
    if stateless(state) {
        operator.push(("mcp-operator-post", post(operator::post)));
        api = stateful(api, outbound);
    }
    let api = api.add_each("/api/mcp-operator", operator).build();
    // proxy.ts runs for /.well-known: www requests go to Next.
    let metadata = Routes::new(state)
        .add(
            "mcp-oauth-metadata",
            "/.well-known/oauth-authorization-server",
            get(|| std::future::ready(operator::metadata())),
        )
        .add(
            "mcp-resource-metadata",
            "/.well-known/oauth-protected-resource/api/mcp-operator",
            get(|| std::future::ready(operator::resource_metadata())),
        )
        .build()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            www_to_upstream,
        ));
    api.merge(metadata).layer(middleware::from_fn_with_state(
        state.clone(),
        ascii_or_upstream,
    ))
}

/// Next answers 400 to a request target with a byte outside ASCII before
/// any route runs: those go to it.
async fn ascii_or_upstream(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if request::has_ascii_target(request.uri()) {
        return next.run(request).await;
    }
    proxy::forward(State(state), request).await
}

/// The routes registered only without a state key.
fn stateful(routes: Routes<'_>, outbound: Outbound) -> Routes<'_> {
    let client = Arc::new(authorize::ClientCheck::new(outbound));
    routes
        .add(
            "mcp-oauth-token",
            "/api/mcp-operator/oauth/token",
            post(|| std::future::ready(operator::token())),
        )
        .add(
            "mcp-oauth-authorize",
            "/api/mcp-operator/oauth/authorize",
            get(move |state: State<AppState>, request: Request| {
                authorize::get(state, client.clone(), request)
            })
            .post(authorize::post),
        )
        .add(
            "mcp-github",
            "/api/mcp-operator/github",
            post(operator::github),
        )
        .add(
            "mcp-events-cron",
            "/api/cron/mcp-events",
            get(operator::cron),
        )
}
