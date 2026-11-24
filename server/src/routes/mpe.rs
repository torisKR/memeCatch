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

mod candidate_post;
mod candidates;
mod create;
mod draft;
#[cfg(test)]
mod fixture_tests;
mod jobs;
mod matches;
mod matching;
pub(crate) mod renders;
mod rows;
mod structured;
mod uploads;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, RETRY_AFTER};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};

use super::Routes;
use super::openrouter::OpenRouter;
use super::public::csp_report::now_ms;
use super::public::rate_limit::{RateLimit, RateLimiter};
use super::request::SiteOrigin;
use crate::AppState;

const WINDOW_MS: i64 = 60_000;

pub fn router(state: &AppState) -> Router<AppState> {
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    let routes = Routes::new(state)
        .add("mpe-job", "/api/mpe/jobs/{id}", get(jobs::job))
        .add_each("/api/admin/mpe-candidates", candidate_methods(state))
        .add(
            "mpe-renders",
            "/api/mpe/renders",
            post(move |state: State<AppState>, request: Request| {
                renders::queue(state, limiter.clone(), request)
            }),
        );
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let Some(site) = site else {
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

/// `GET` and, when the site URL and the OpenRouter client allow, `POST` of
/// `/api/admin/mpe-candidates`, each under its own id.
fn candidate_methods(
    state: &AppState,
) -> Vec<(&'static str, axum::routing::MethodRouter<AppState>)> {
    let mut methods = vec![("admin-mpe-candidates", get(candidates::list))];
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let client = OpenRouter::new(state.config.openrouter.test_origin.as_deref());
    match (site, client) {
        (Some(site), Ok(client)) => methods.push((
            "admin-mpe-candidates-post",
            post(move |state: State<AppState>, request: Request| {
                candidate_post::post(state, site.clone(), client.clone(), request)
            }),
        )),
        (_, Err(error)) => {
            tracing::error!(%error, "admin-mpe-candidates-post left to the upstream")
        }
        (None, _) => {}
    }
    methods
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
