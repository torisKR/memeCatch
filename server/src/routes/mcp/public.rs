//! `/api/mcp`: `app/api/mcp/route.js`, the public MCP server (JSON-RPC over
//! POST; `GET` answers 405 with a description). Route id `mcp`.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::header::{ALLOW, CACHE_CONTROL, CONTENT_TYPE, HeaderValue, ORIGIN, RETRY_AFTER};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};

use super::corpus::Corpus;
use super::protocol::{self, RpcError};
use super::{Outbound, string};
use crate::AppState;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::rate_limit::{self, RateLimit, RateLimiter};
use crate::routes::request::{self, BodyError, Json};

const MAX_BODY: usize = 256 * 1024;
const UI_HTML: &str = include_str!("app.html");

pub struct Public {
    corpus: Corpus,
    limiter: RateLimiter,
}

impl Public {
    pub fn new(outbound: Outbound) -> Self {
        Self {
            corpus: Corpus::new(outbound),
            limiter: RateLimiter::new(now_ms()),
        }
    }
}

/// `Response.json(body, { status, headers: responseHeaders })`.
fn answer(status: StatusCode, body: String) -> Response {
    let mut response = (status, [(CONTENT_TYPE, "application/json")], body).into_response();
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

pub fn get() -> Response {
    let body = format!(
        r#"{{"service":"memecatch","protocolVersion":"{}","events":"disabled","usage":"POST JSON-RPC requests to this endpoint."}}"#,
        protocol::VERSION
    );
    let mut response = answer(StatusCode::METHOD_NOT_ALLOWED, body);
    response
        .headers_mut()
        .insert(ALLOW, HeaderValue::from_static("POST"));
    response
}

/// `"id": …` for an error answer: present when the id is neither absent nor null.
fn id_member(id: Option<&Json>) -> String {
    match id {
        None | Some(Json::Null) => String::new(),
        Some(id) => format!(r#","id":{}"#, protocol::json(id)),
    }
}

fn rpc_error(id: Option<&Json>, error: RpcError) -> Response {
    let data = error
        .data
        .map(|data| format!(r#","data":{data}"#))
        .unwrap_or_default();
    let body = format!(
        r#"{{"jsonrpc":"2.0"{},"error":{{"code":{},"message":{}{data}}}}}"#,
        id_member(id),
        error.code,
        string(&error.message)
    );
    answer(
        StatusCode::from_u16(error.status).unwrap_or(StatusCode::OK),
        body,
    )
}

/// The two per-process limits of `tools/call`; `None` when it may go on.
fn limited(
    limiter: &RateLimiter,
    headers: &HeaderMap,
    peer: Option<std::net::IpAddr>,
    id: Option<&Json>,
) -> Option<Response> {
    let global = limiter.check(b"mcp:tools:all".to_vec(), 1200, 60_000, now_ms());
    let outcome = match global {
        RateLimit::Ok => {
            let key = [
                b"mcp:tools:ip:".as_slice(),
                &rate_limit::client_ip(headers, peer),
            ]
            .concat();
            limiter.check(key, 120, 60_000, now_ms())
        }
        limited => limited,
    };
    let RateLimit::Limited { retry_after_sec } = outcome else {
        return None;
    };
    let error = protocol::error(-32000, "Too many requests.", None, 429);
    let mut response = rpc_error(id, error);
    response
        .headers_mut()
        .insert(RETRY_AFTER, retry_after_sec.into());
    Some(response)
}

fn refused_origin(headers: &HeaderMap) -> bool {
    let origin = request::header_text(headers, &ORIGIN, ", ").filter(|origin| !origin.is_empty());
    origin
        .is_some_and(|origin| origin != "https://chatgpt.com" && origin != "https://catchmeme.com")
}

/// The checks before the message is read: the origin, the content type,
/// the size and the JSON.
async fn read_message(headers: &HeaderMap, body: Body) -> Result<Json, Response> {
    if refused_origin(headers) {
        return Err(answer(
            StatusCode::FORBIDDEN,
            r#"{"error":"Origin not allowed."}"#.to_owned(),
        ));
    }
    let content_type = request::header_text(headers, &CONTENT_TYPE, ", ").unwrap_or_default();
    if !content_type.to_lowercase().starts_with("application/json") {
        return Err(answer(
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            r#"{"error":"Use application/json."}"#.to_owned(),
        ));
    }
    let raw = match request::read_at_most(body, MAX_BODY).await {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(BodyError::TooLarge) => {
            let error = protocol::error(-32600, "Request too large.", None, 413);
            return Err(rpc_error(None, error));
        }
        Err(BodyError::Unreadable) => {
            let error = protocol::error(-32603, "Internal server error.", None, 200);
            return Err(rpc_error(None, error));
        }
    };
    Json::parse(&raw)
        .ok_or_else(|| rpc_error(None, protocol::error(-32700, "Invalid JSON.", None, 400)))
}

/// 202 with no body: a notification.
fn accepted() -> Response {
    let mut response = Body::empty().into_response();
    *response.status_mut() = StatusCode::ACCEPTED;
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

/// `POST` of app/api/mcp/route.js.
pub async fn post(
    State(_state): State<AppState>,
    public: Arc<Public>,
    request: Request,
) -> Response {
    let (parts, body) = request.into_parts();
    let message = match read_message(&parts.headers, body).await {
        Ok(message) => message,
        Err(response) => return response,
    };
    let id = protocol::get(Some(&message), "id");
    if let Err(error) = protocol::validate(&message, &parts.headers) {
        return rpc_error(id, error);
    }
    let method = protocol::get(Some(&message), "method")
        .and_then(Json::as_str)
        .unwrap_or_default();
    if method.starts_with("events/") {
        let message = "Events require the separately authenticated persistent server.";
        return rpc_error(id, protocol::error(-32601, message, None, 404));
    }
    let Some(id) = id else { return accepted() };
    if method == "tools/call" {
        let peer = parts
            .extensions
            .get::<ConnectInfo<SocketAddr>>()
            .map(|ConnectInfo(address)| address.ip());
        if let Some(response) = limited(&public.limiter, &parts.headers, peer, Some(id)) {
            return response;
        }
    }
    match protocol::dispatch(&message, &public.corpus, UI_HTML).await {
        Ok(outcome) => {
            let result =
                protocol::result_json(outcome, protocol::is_legacy(method, &parts.headers));
            let body = format!(
                r#"{{"jsonrpc":"2.0","id":{},"result":{result}}}"#,
                protocol::json(id)
            );
            answer(StatusCode::OK, body)
        }
        Err(error) => rpc_error(Some(id), error),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_embedded_app_is_the_integrations_file() {
        let original = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../integrations/memecatch-chatgpt/ui/app.html"
        ))
        .expect("the app");
        assert_eq!(
            super::UI_HTML,
            original,
            "copy integrations/memecatch-chatgpt/ui/app.html to src/routes/mcp/app.html"
        );
    }
}
