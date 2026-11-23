//! The meme production (MPE) API: `GET /api/mpe/jobs/{id}`,
//! `POST /api/mpe/renders`, `POST /api/mpe/uploads` and
//! `GET /api/admin/mpe-candidates`. Each has a route id for
//! `AXUM_DISABLED_ROUTES`: `mpe-job`, `mpe-renders`, `mpe-uploads`,
//! `admin-mpe-candidates`. `mpe-uploads` is registered only when objects are
//! kept in R2 (`routes/upload.rs`).
//!
//! The jobs these routes queue and read are worked by the `mpe-worker`
//! service (`scripts/mpe-media-worker.mjs`), which stays in Node. Rows are
//! written only by the database functions the TypeScript calls, with the same
//! arguments, so the worker sees what it saw before.

mod candidates;
mod jobs;
mod renders;
mod uploads;

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
use super::request::SiteOrigin;
use crate::AppState;

const WINDOW_MS: i64 = 60_000;

pub fn router(state: &AppState) -> Router<AppState> {
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    let routes = Routes::new(state)
        .add("mpe-job", "/api/mpe/jobs/{id}", get(jobs::job))
        .add(
            "admin-mpe-candidates",
            "/api/admin/mpe-candidates",
            get(candidates::list),
        )
        .add(
            "mpe-renders",
            "/api/mpe/renders",
            post(move |state: State<AppState>, request: Request| {
                renders::queue(state, limiter.clone(), request)
            }),
        );
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let (Some(site), false) = (site, state.storage.is_local()) else {
        return routes.build();
    };
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    routes
        .add(
            "mpe-uploads",
            "/api/mpe/uploads",
            post(move |state: State<AppState>, request: Request| {
                uploads::upload(state, site.clone(), limiter.clone(), request)
            }),
        )
        .build()
}

/// `Response.json(body, { status })` for a body already written as JSON.
pub(crate) fn json(status: StatusCode, body: impl Into<String>) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body.into()).into_response()
}

/// `{ ok: false, error }`.
pub(crate) fn failure(status: StatusCode, error: &str) -> Response {
    json(status, format!(r#"{{"ok":false,"error":"{error}"}}"#))
}

/// A body nobody may cache: `headers: { "cache-control": "no-store" }`.
pub(crate) fn no_store(status: StatusCode, body: String) -> Response {
    let mut response = json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
    response
}

/// `rateLimit(key, { limit, windowMs: 60_000 })`: the 429 the MPE routes
/// answer with when it refuses, `None` when the request may go on.
pub(crate) fn rate_limited(limiter: &RateLimiter, key: String, limit: usize) -> Option<Response> {
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
