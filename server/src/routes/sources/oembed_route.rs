//! `GET /api/oembed` (`app/api/oembed/route.ts`): a signed-in visitor's
//! embed data for a content URL, through the shared oEmbed client.
//!
//! The route first reserves a request with `reserve_oembed_request()`, a
//! function no migration creates. Without it every signed-in request is 429,
//! as in production today; the rest is ported for when it exists.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request, State};
use axum::http::header::{CACHE_CONTROL, RETRY_AFTER};
use axum::http::request::Parts;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;

use super::db;
use crate::AppState;
use crate::oembed::http::FetchError;
use crate::oembed::{Failure, OEmbedResult};
use crate::routes::js_string::JsString;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::rate_limit::{self, RateLimit, RateLimiter};
use crate::routes::request;

const SIGNED_OUT: &str = r#"{"error":"로그인이 필요해요.","code":"SIGNED_OUT"}"#;
const RATE_LIMITED: &str =
    r#"{"error":"요청이 너무 많아요. 잠시 후 다시 시도해 주세요.","code":"RATE_LIMITED"}"#;
const RESERVE: &str = "select public.reserve_oembed_request()";
const PER_MINUTE: usize = 20;

pub async fn get(
    State(state): State<AppState>,
    limiter: Arc<RateLimiter>,
    request: Request,
) -> Response {
    let (mut parts, _) = request.into_parts();
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return request::json(StatusCode::UNAUTHORIZED, SIGNED_OUT);
    };
    let reserved = db::call_function(
        &state,
        &user.db_identity(),
        "reserve_oembed_request",
        RESERVE,
        Vec::new(),
    )
    .await;
    if reserved.is_err() {
        return request::json(StatusCode::TOO_MANY_REQUESTS, RATE_LIMITED);
    }
    if let Some(limited) = rate_limited(&limiter, &parts) {
        return limited;
    }
    let pairs = request::query_pairs(&parts.uri);
    let url = request::first_param(&pairs, "url").unwrap_or_default();
    answer(state.oembed.get(url).await)
}

/// `rateLimit(`oembed:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 })`.
fn rate_limited(limiter: &RateLimiter, parts: &Parts) -> Option<Response> {
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let key = [
        b"oembed:".as_slice(),
        &rate_limit::client_ip(&parts.headers, peer),
    ]
    .concat();
    let RateLimit::Limited { retry_after_sec } = limiter.check(key, PER_MINUTE, 60_000, now_ms())
    else {
        return None;
    };
    let mut response = request::json(StatusCode::TOO_MANY_REQUESTS, RATE_LIMITED);
    response
        .headers_mut()
        .insert(RETRY_AFTER, HeaderValue::from(retry_after_sec));
    Some(response)
}

/// The answer for `getOEmbed`'s result, as the route's `try`/`catch` gives it.
fn answer(result: Result<OEmbedResult, Failure>) -> Response {
    match result {
        Ok(result) => {
            let mut response = request::json(StatusCode::OK, result.json());
            response.headers_mut().insert(
                CACHE_CONTROL,
                HeaderValue::from_static("private, max-age=3600"),
            );
            response
        }
        Err(Failure::OEmbed(error)) => {
            let body = format!(
                r#"{{"error":{},"code":"{}"}}"#,
                JsString::from(error.message.as_str()).json(),
                error.code
            );
            request::json(
                StatusCode::from_u16(error.status).unwrap_or(StatusCode::BAD_GATEWAY),
                body,
            )
        }
        Err(failure) => {
            let message = if failure == Failure::Fetch(FetchError::Timeout) {
                "플랫폼 응답 시간이 초과되었습니다."
            } else {
                "콘텐츠 정보를 불러오는 중 오류가 발생했습니다."
            };
            let body = format!(r#"{{"error":"{message}","code":"UPSTREAM_ERROR"}}"#);
            request::json(StatusCode::BAD_GATEWAY, body)
        }
    }
}
