//! The meme production (MPE) API: `GET /api/mpe/jobs/{id}` and
//! `POST /api/mpe/renders`. Each has a route id for `AXUM_DISABLED_ROUTES`:
//! `mpe-job`, `mpe-renders`.
//!
//! The jobs these routes queue and read are worked by the `mpe-worker`
//! service (`scripts/mpe-media-worker.mjs`), which stays in Node. Rows are
//! written only by the database functions the TypeScript calls, with the same
//! arguments, so the worker sees what it saw before.

mod jobs;
mod renders;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, RETRY_AFTER};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};

use super::Routes;
use super::public::csp_report::now_ms;
use super::public::rate_limit::{RateLimit, RateLimiter};
use crate::AppState;

const WINDOW_MS: i64 = 60_000;

pub fn router(state: &AppState) -> Router<AppState> {
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    Routes::new(state)
        .add("mpe-job", "/api/mpe/jobs/{id}", get(jobs::job))
        .add(
            "mpe-renders",
            "/api/mpe/renders",
            post(move |state: State<AppState>, request: Request| {
                renders::queue(state, limiter.clone(), request)
            }),
        )
        .build()
}

/// `Response.json(body, { status })` for a body already written as JSON.
fn json(status: StatusCode, body: impl Into<String>) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body.into()).into_response()
}

/// `{ ok: false, error }`.
fn failure(status: StatusCode, error: &str) -> Response {
    json(status, format!(r#"{{"ok":false,"error":"{error}"}}"#))
}

/// A body nobody may cache: `headers: { "cache-control": "no-store" }`.
fn no_store(status: StatusCode, body: String) -> Response {
    let mut response = json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
    response
}

/// `rateLimit(key, { limit, windowMs: 60_000 })`: the 429 the MPE routes
/// answer with when it refuses, `None` when the request may go on.
fn rate_limited(limiter: &RateLimiter, key: String, limit: usize) -> Option<Response> {
    match limiter.check(key.into_bytes(), limit, WINDOW_MS, now_ms()) {
        RateLimit::Ok => None,
        RateLimit::Limited { retry_after_sec } => {
            let mut response = failure(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
            response
                .headers_mut()
                .insert(RETRY_AFTER, retry_after_sec.into());
            Some(response)
        }
    }
}
