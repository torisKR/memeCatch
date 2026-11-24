//! What visitors do: the view counter (`app/api/memes/view/route.ts`) and the
//! analytics events (`app/api/analytics/events/route.ts`).
//!
//! | Route id | Path | Method |
//! | --- | --- | --- |
//! | `memes-view` | `/api/memes/view` | `POST` |
//! | `meme-view-id` | `/api/memes/{id}/view` | `POST` |
//! | `analytics-events` | `/api/analytics/events` | `POST` |
//!
//! Both write through a database function as `service_role`, and both key
//! their hashes and the `mc_growth_session` cookie with
//! `MEMECATCH_SIGNING_SECRET`. Without that secret each answers 503 with
//! its own error code, as the TypeScript did.
//!
//! `/api/memes/{id}/view` (R11) takes the origins every state-changing
//! route takes (`view_id.rs`).

mod events;
pub(crate) mod growth;
pub(crate) use events::iso_timestamp;
mod view;
mod view_id;

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use axum::Router;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::header::RETRY_AFTER;
use axum::http::request::Parts;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::post;

use self::growth::GrowthKeys;
use super::Routes;
use super::public::csp_report::now_ms;
use super::public::rate_limit::{self, RateLimit, RateLimiter};
use super::request::{self, SiteOrigin};
use crate::AppState;

const RATE_WINDOW_MS: i64 = 60_000;
const RATE_LIMITED: &str = r#"{"ok":false,"error":"rate_limited"}"#;
const ACCEPTED: &str = r#"{"ok":true}"#;

/// What the two routes share. One limiter for both, as `lib/rate-limit.ts`
/// has one map: its keys carry the route's prefix.
struct Tracking {
    keys: GrowthKeys,
    site: SiteOrigin,
    limiter: RateLimiter,
}

pub fn router(state: &AppState) -> Router<AppState> {
    let config = &state.config;
    let (Some(secret), Some(site)) = (
        config.signing_secret.as_ref(),
        SiteOrigin::from_site_url(&config.site_url),
    ) else {
        tracing::warn!(
            "MEMECATCH_SIGNING_SECRET is not set or NEXT_PUBLIC_SITE_URL is not an absolute URL: \
             /api/memes/view and /api/analytics/events answer 503"
        );
        return unavailable(state);
    };
    let tracking = Arc::new(Tracking {
        keys: GrowthKeys::new(secret.expose()),
        site,
        limiter: RateLimiter::new(now_ms()),
    });
    let for_events = tracking.clone();
    let for_view_id = tracking.clone();
    Routes::new(state)
        .add(
            "memes-view",
            "/api/memes/view",
            post(move |state: State<AppState>, request: Request| {
                view::record(state, tracking.clone(), request)
            }),
        )
        .add(
            "meme-view-id",
            "/api/memes/{id}/view",
            post(move |state: State<AppState>, request: Request| {
                view_id::record(state, for_view_id.clone(), request)
            }),
        )
        .add(
            "analytics-events",
            "/api/analytics/events",
            post(move |state: State<AppState>, request: Request| {
                events::record(state, for_events.clone(), request)
            }),
        )
        .build()
}

/// The routes without their secret: each refuses with its own code.
fn unavailable(state: &AppState) -> Router<AppState> {
    let refuse = |error: &'static str| {
        post(move || std::future::ready(refused(StatusCode::SERVICE_UNAVAILABLE, error)))
    };
    Routes::new(state)
        .add("memes-view", "/api/memes/view", refuse("view_unavailable"))
        .add(
            "meme-view-id",
            "/api/memes/{id}/view",
            refuse("unavailable"),
        )
        .add(
            "analytics-events",
            "/api/analytics/events",
            refuse("analytics_unavailable"),
        )
        .build()
}

impl Tracking {
    /// `rateLimit(prefix + key, { limit, windowMs: 60_000 })`. `Some` is the
    /// 429 to answer with.
    fn limited(&self, prefix: &str, key: &[u8], limit: usize) -> Option<Response> {
        let key = [prefix.as_bytes(), key].concat();
        match self.limiter.check(key, limit, RATE_WINDOW_MS, now_ms()) {
            RateLimit::Ok => None,
            RateLimit::Limited { retry_after_sec } => Some(rate_limited(retry_after_sec)),
        }
    }
}

fn rate_limited(retry_after_sec: i64) -> Response {
    let mut response = request::json(StatusCode::TOO_MANY_REQUESTS, RATE_LIMITED);
    response
        .headers_mut()
        .insert(RETRY_AFTER, HeaderValue::from(retry_after_sec));
    response
}

/// `Response.json({ ok: false, error }, { status })`.
fn refused(status: StatusCode, error: &'static str) -> Response {
    request::json(status, format!(r#"{{"ok":false,"error":"{error}"}}"#))
}

/// The client address (`rate_limit::client_ip`) as the rate limit key and as
/// the text the visitor hashes are made of. Both were `getClientIp`'s first
/// `X-Forwarded-For` entry, which a client chooses (D2-16).
struct Client {
    limit_key: Vec<u8>,
    address: String,
}

impl Client {
    fn of(parts: &Parts) -> Self {
        let peer: Option<IpAddr> = parts
            .extensions
            .get::<ConnectInfo<SocketAddr>>()
            .map(|ConnectInfo(address)| address.ip());
        let limit_key = rate_limit::client_ip(&parts.headers, peer);
        Self {
            address: String::from_utf8_lossy(&limit_key).into_owned(),
            limit_key,
        }
    }
}
