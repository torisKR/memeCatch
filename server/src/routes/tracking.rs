//! What visitors do: the view counter (`app/api/memes/view/route.ts`) and the
//! analytics events (`app/api/analytics/events/route.ts`).
//!
//! | Route id | Path | Method |
//! | --- | --- | --- |
//! | `memes-view` | `/api/memes/view` | `POST` |
//! | `analytics-events` | `/api/analytics/events` | `POST` |
//!
//! Both write through a database function as `service_role`, and both key
//! their hashes and the `mc_growth_session` cookie with
//! `MEMECATCH_SIGNING_SECRET`. Without that secret here the routes are not
//! registered: Next may hold it, and then only Next can answer correctly.
//!
//! `/api/memes/{id}/view` is not ported. Its only accepted `Origin` is the
//! address Next itself listens on, which this process cannot know.

mod events;
mod growth;
mod view;

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
             /api/memes/view and /api/analytics/events stay with the upstream"
        );
        return Router::new();
    };
    let tracking = Arc::new(Tracking {
        keys: GrowthKeys::new(secret.expose()),
        site,
        limiter: RateLimiter::new(now_ms()),
    });
    let for_events = tracking.clone();
    Routes::new(state)
        .add(
            "memes-view",
            "/api/memes/view",
            post(move |state: State<AppState>, request: Request| {
                view::record(state, tracking.clone(), request)
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

/// The client address two ways (`rate_limit.rs`): the rate limit key, which
/// is an IP address or `unknown`, and the text `getClientIp` returns, which
/// is what Next hashes.
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
        Self {
            limit_key: rate_limit::client_ip(&parts.headers, peer),
            // Node reads a header as Latin-1 and hashes its UTF-8 encoding.
            address: rate_limit::client_address(&parts.headers, peer)
                .into_iter()
                .map(char::from)
                .collect(),
        }
    }
}
