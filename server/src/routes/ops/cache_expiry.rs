//! The two routes whose whole work is to expire Next's cache.
//!
//! - `POST /api/cron/source-refresh`: `revalidateTag(PUBLIC_CATALOG_CACHE_TAG)`
//!   after a content correction applied outside the app, for the cron bearer.
//! - `POST /api/admin/instagram-video-verification/revalidate`: the retry path
//!   `/api/db/query` names when a video verification is committed but its
//!   cache expiry failed (`expireInstagramVideoVerificationCache`), for an
//!   operator.
//!
//! Next's cache is in Next's process, so Next does the expiry
//! (`Upstream::expire_cache`); a failure there is answered as the TypeScript
//! answers a `revalidateTag` that throws.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, HeaderValue, RETRY_AFTER};
use axum::http::request::Parts;
use axum::response::Response;

use crate::AppState;
use crate::auth::{self, CronAuthorized};
use crate::proxy::{self, CacheScope};
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::rate_limit::{self, RateLimit, RateLimiter};
use crate::routes::request::{self, SiteOrigin};

const NOT_OK: &str = r#"{"ok":false}"#;
const OK: &str = r#"{"ok":true}"#;
const RATE_PREFIX: &str = "instagram-video-cache:";
const RATE_LIMIT: usize = 30;
const RATE_WINDOW_MS: i64 = 60_000;

/// `POST /api/cron/source-refresh`.
pub async fn source_refresh(_: CronAuthorized, State(state): State<AppState>) -> Response {
    let secret = state
        .config
        .cron_secret
        .as_ref()
        .map(|secret| secret.expose());
    let expired = match secret {
        Some(secret) => {
            state
                .upstream
                .expire_cache(CacheScope::PublicCatalog, secret)
                .await
        }
        None => Err("CRON_SECRET is not set".to_owned()),
    };
    match expired {
        Ok(()) => no_store(request::json(StatusCode::OK, OK)),
        Err(error) => {
            tracing::error!(%error, "catalog cache expiry failed");
            request::json(
                StatusCode::INTERNAL_SERVER_ERROR,
                r#"{"ok":false,"error":"REVALIDATION_FAILED"}"#,
            )
        }
    }
}

/// The operator route's own state: the site origin `hasTrustedOrigin`
/// compares with, and its rate limiter. `lib/rate-limit.ts` keeps one map for
/// the process; the key prefix keeps this route's counts apart there too.
#[derive(Clone)]
pub struct OperatorExpiry(Arc<(SiteOrigin, RateLimiter)>);

impl OperatorExpiry {
    pub fn new(site: SiteOrigin) -> Self {
        Self(Arc::new((site, RateLimiter::new(now_ms()))))
    }
}

/// `POST /api/admin/instagram-video-verification/revalidate`.
pub async fn instagram_video(
    State(state): State<AppState>,
    expiry: OperatorExpiry,
    request: Request,
) -> Response {
    let (site, limiter) = &*expiry.0;
    // `hasTrustedOrigin`. Another origin may be Next's own, which only Next
    // knows: those requests, and targets Next refuses before the route runs,
    // go to Next.
    let trusted = request::trusted_origin(request.headers(), site);
    let (true, Some(trusted)) = (request::has_ascii_target(request.uri()), trusted) else {
        return proxy::forward(State(state), request).await;
    };
    if !trusted {
        return request::json(StatusCode::FORBIDDEN, NOT_OK);
    }
    let (mut parts, _body) = request.into_parts();
    let key = [RATE_PREFIX.as_bytes(), &client_key(&parts)].concat();
    if let RateLimit::Limited { retry_after_sec } =
        limiter.check(key, RATE_LIMIT, RATE_WINDOW_MS, now_ms())
    {
        let mut response = request::json(StatusCode::TOO_MANY_REQUESTS, NOT_OK);
        response
            .headers_mut()
            .insert(RETRY_AFTER, HeaderValue::from(retry_after_sec));
        return response;
    }
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return request::json(StatusCode::UNAUTHORIZED, NOT_OK);
    };
    // `error || !isOperator`: a check that fails is a refusal here, not a 503.
    if !matches!(auth::is_operator(&state, &user).await, Ok(true)) {
        return request::json(StatusCode::FORBIDDEN, NOT_OK);
    }
    expire_for_operator(&state).await
}

async fn expire_for_operator(state: &AppState) -> Response {
    let secret = state
        .config
        .cron_secret
        .as_ref()
        .map(|secret| secret.expose());
    let expired = match secret {
        Some(secret) => {
            state
                .upstream
                .expire_cache(CacheScope::InstagramVideoVerification, secret)
                .await
        }
        None => Err("CRON_SECRET is not set".to_owned()),
    };
    match expired {
        Ok(()) => no_store(request::json(StatusCode::OK, OK)),
        Err(error) => {
            tracing::error!(
                %error,
                event = "instagram_video_verification_cache_invalidation_pending"
            );
            let mut response = request::json(StatusCode::SERVICE_UNAVAILABLE, NOT_OK);
            response
                .headers_mut()
                .insert(RETRY_AFTER, HeaderValue::from_static("1"));
            response
        }
    }
}

fn client_key(parts: &Parts) -> Vec<u8> {
    let peer: Option<IpAddr> = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    rate_limit::client_ip(&parts.headers, peer)
}

fn no_store(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}
