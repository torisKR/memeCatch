//! `POST /api/db/query` (route id `db-query`): the browser's door to the
//! database. `lib/db/client.ts` and the Axum pages' scripts post a query plan
//! (`lib/db/plan.ts`); the route checks its shape (`boundPlan`), finds the
//! caller's session, and runs it with `executePlan` (lib/db/execute.ts) as
//! that caller. Row-level security and grants decide what the caller may
//! read and write; this route decides only what SQL a plan becomes.
//!
//! | Module | TypeScript |
//! | --- | --- |
//! | `mod.rs` | app/api/db/query/route.ts |
//! | `bound.rs` | `boundPlan` |
//! | `compile.rs`, `write.rs` | the statement builders of lib/db/execute.ts |
//! | `exec.rs` | `executePlanWithDb`, `shapeRows`, `queryError` |
//! | `meta.rs` | `loadMeta`, `loadFunctions` |
//! | `run.rs` | `runQuery` through node-pg |
//! | `js.rs` | the JavaScript coercions the checks rely on |
//!
//! The route is native only with `CRON_SECRET` and an absolute
//! `NEXT_PUBLIC_SITE_URL`: a committed Instagram video verification expires
//! Next's cache through Next's internal route, which takes the cron bearer.

mod bound;
mod compile;
mod exec;
mod js;
mod meta;
mod run;
#[cfg(test)]
mod sql_tests;
mod write;

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Router;
use axum::extract::{ConnectInfo, FromRequestParts, Request, State};
use axum::http::StatusCode;
use axum::http::header::{HeaderValue, RETRY_AFTER};
use axum::http::request::Parts;
use axum::response::Response;
use axum::routing::post;

use self::exec::{Failure, Outcome, execute_plan};
use self::meta::MetaCache;
use super::Routes;
use super::public::csp_report::now_ms;
use super::public::rate_limit::{self, RateLimit, RateLimiter};
use super::request::{self, BodyError, Json, SiteOrigin, property};
use crate::AppState;
use crate::auth::RequestIdentity;
use crate::db::DbIdentity;
use crate::proxy::{self, CacheScope};

const OPS: [&str; 6] = ["select", "insert", "update", "delete", "upsert", "rpc"];
// Explore pagination sends the discovery index as UUIDs in an IN filter.
const MAX_BODY_BYTES: usize = 1024 * 1024;
const MAX_ACTIVE_QUERIES: usize = 6;
const GLOBAL_LIMIT: usize = 1200;
const ADDRESS_LIMIT: usize = 180;
const WINDOW_MS: i64 = 60_000;
const VIDEO_VERIFICATION: &str = "record_instagram_post_video_verification";
const SERIALIZATION_FAILURE: &str = "40001";
const VIDEO_ATTEMPTS: usize = 3;
const SAFE_MESSAGES: [&str; 2] = ["login_required", "premium_save_limit"];
const CACHE_RETRY_PATH: &str = "/api/admin/instagram-video-verification/revalidate";

/// The route's process state: what the TypeScript keeps in module scope.
pub struct DbQuery {
    site: SiteOrigin,
    cron_secret: String,
    /// `lib/rate-limit.ts` keeps one map; `db-query:all` and
    /// `db-query:<address>` share this one the same way.
    limits: RateLimiter,
    /// `activeQueries`.
    active: AtomicUsize,
    meta: MetaCache,
}

pub fn router(state: &AppState) -> Router<AppState> {
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    let secret = state
        .config
        .cron_secret
        .as_ref()
        .map(|secret| secret.expose().to_owned());
    let (Some(site), Some(cron_secret)) = (site, secret) else {
        tracing::warn!(
            "CRON_SECRET is not set or NEXT_PUBLIC_SITE_URL is not an absolute URL: \
             /api/db/query stays with the upstream"
        );
        return Router::new();
    };
    let route = Arc::new(DbQuery {
        site,
        cron_secret,
        limits: RateLimiter::new(now_ms()),
        active: AtomicUsize::new(0),
        meta: MetaCache::default(),
    });
    Routes::new(state)
        .add(
            "db-query",
            "/api/db/query",
            post(move |state: State<AppState>, request: Request| {
                query(state, route.clone(), request)
            }),
        )
        .build()
}

/// `POST(request)`.
async fn query(State(state): State<AppState>, route: Arc<DbQuery>, request: Request) -> Response {
    // `hasTrustedOrigin`. Another origin may be Next's own, which only Next
    // knows: those requests, and targets Next refuses before the route runs,
    // go to Next.
    let trusted = request::trusted_origin(request.headers(), &route.site);
    let (true, Some(trusted)) = (request::has_ascii_target(request.uri()), trusted) else {
        return proxy::forward(State(state), request).await;
    };
    if !trusted {
        return failure("untrusted origin", StatusCode::FORBIDDEN, None);
    }
    let (mut parts, body) = request.into_parts();
    if let Some(limited) = rate_limited(&route, &parts) {
        return limited;
    }
    let plan = match request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await {
        Err(BodyError::TooLarge) => {
            return failure("request too large", StatusCode::PAYLOAD_TOO_LARGE, None);
        }
        Err(BodyError::Unreadable) => None,
        Ok(text) => Json::parse(&text).as_ref().and_then(checked_plan),
    };
    let Some(plan) = plan else {
        return failure("invalid plan", StatusCode::BAD_REQUEST, None);
    };
    let Some(_active) = Active::enter(&route.active) else {
        return failure(
            "database busy",
            StatusCode::SERVICE_UNAVAILABLE,
            Some(HeaderValue::from_static("1")),
        );
    };
    let identity = match RequestIdentity::from_request_parts(&mut parts, &state).await {
        Ok(RequestIdentity(user)) => user
            .map(|user| user.db_identity())
            .unwrap_or_else(DbIdentity::anon),
        Err(_) => {
            return failure(
                "database unavailable",
                StatusCode::SERVICE_UNAVAILABLE,
                None,
            );
        }
    };
    answer(&state, &route, &plan, &identity).await
}

/// The two `rateLimit` calls: everyone, then this address.
fn rate_limited(route: &DbQuery, parts: &Parts) -> Option<Response> {
    let now = now_ms();
    let peer: Option<IpAddr> = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let address = [
        &b"db-query:"[..],
        &rate_limit::client_ip(&parts.headers, peer),
    ]
    .concat();
    for (key, limit) in [
        (b"db-query:all".to_vec(), GLOBAL_LIMIT),
        (address, ADDRESS_LIMIT),
    ] {
        if let RateLimit::Limited { retry_after_sec } =
            route.limits.check(key, limit, WINDOW_MS, now)
        {
            let retry = HeaderValue::from(retry_after_sec);
            return Some(failure(
                "rate_limited",
                StatusCode::TOO_MANY_REQUESTS,
                Some(retry),
            ));
        }
    }
    None
}

/// `body?.plan`, when it is an object with a known `op` that `boundPlan`
/// accepts; the plan with its default limits.
fn checked_plan(body: &Json) -> Option<Json> {
    let plan = property(body.as_object()?, "plan")?;
    let op = property(plan.as_object()?, "op").and_then(Json::as_str)?;
    if !OPS.contains(&op) {
        return None;
    }
    bound::bound_plan(plan)
}

/// One of the six `activeQueries` slots, given back on drop.
struct Active<'a>(&'a AtomicUsize);

impl<'a> Active<'a> {
    fn enter(active: &'a AtomicUsize) -> Option<Self> {
        active
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |n| {
                (n < MAX_ACTIVE_QUERIES).then_some(n + 1)
            })
            .ok()
            .map(|_| Self(active))
    }
}

impl Drop for Active<'_> {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::AcqRel);
    }
}

async fn answer(state: &AppState, route: &DbQuery, plan: &Json, identity: &DbIdentity) -> Response {
    let fn_name = plan
        .as_object()
        .and_then(|entries| property(entries, "fn"))
        .and_then(Json::as_str);
    let op = plan
        .as_object()
        .and_then(|entries| property(entries, "op"))
        .and_then(Json::as_str);
    let video = op == Some("rpc") && fn_name == Some(VIDEO_VERIFICATION);
    let mut outcome = execute_plan(state, &route.meta, plan, identity).await;
    // SQLSTATE 40001 means the transaction was rolled back, so this retry
    // cannot replay a committed decision.
    let mut attempt = 1;
    while video && is_serialization_failure(&outcome) && attempt < VIDEO_ATTEMPTS {
        outcome = execute_plan(state, &route.meta, plan, identity).await;
        attempt += 1;
    }
    match outcome {
        Outcome::Failed(_) if video && is_serialization_failure(&outcome) => failure(
            "verification_conflict_retry",
            StatusCode::SERVICE_UNAVAILABLE,
            Some(HeaderValue::from_static("1")),
        ),
        Outcome::Failed(error) => query_failed(&error),
        Outcome::Head { count } => json(
            StatusCode::OK,
            format!(
                r#"{{"data":null,"error":null,"count":{}}}"#,
                count_text(count)
            ),
        ),
        Outcome::Rows { data, count } if video => verified(state, route, data, count).await,
        Outcome::Rows { data, count } => json(StatusCode::OK, rows_body(&data, count)),
    }
}

fn is_serialization_failure(outcome: &Outcome) -> bool {
    matches!(outcome, Outcome::Failed(Failure { code: Some(code), .. }) if code == SERIALIZATION_FAILURE)
}

/// A committed verification: expire Next's cache, or say that is pending.
async fn verified(state: &AppState, route: &DbQuery, data: String, count: Option<i64>) -> Response {
    let expired = state
        .upstream
        .expire_cache(CacheScope::InstagramVideoVerification, &route.cron_secret)
        .await;
    match expired {
        Ok(()) => json(StatusCode::OK, rows_body(&data, count)),
        Err(error) => {
            tracing::error!(%error, event = "instagram_video_verification_cache_invalidation_pending");
            // The decision is committed. Retry only the separate cache
            // endpoint, never the mutation, which could overwrite a more
            // recent decision.
            json(
                StatusCode::ACCEPTED,
                format!(
                    r#"{{"data":{data},"count":null,"error":null,"cacheInvalidationPending":true,"cacheRetryPath":"{CACHE_RETRY_PATH}"}}"#
                ),
            )
        }
    }
}

fn rows_body(data: &str, count: Option<i64>) -> String {
    format!(
        r#"{{"data":{data},"error":null,"count":{},"status":200,"statusText":"OK"}}"#,
        count_text(count)
    )
}

fn count_text(count: Option<i64>) -> String {
    count.map_or_else(|| "null".to_owned(), |count| count.to_string())
}

/// The error answer: documented application messages pass, every other
/// database message becomes `query failed`; the code is kept.
fn query_failed(error: &Failure) -> Response {
    let message = if SAFE_MESSAGES.contains(&error.message.as_str()) {
        error.message.as_str()
    } else {
        "query failed"
    };
    let code = error
        .code
        .as_ref()
        .map(|code| format!(r#","code":{}"#, quoted(code)))
        .unwrap_or_default();
    let status = StatusCode::from_u16(error.status).unwrap_or(StatusCode::BAD_REQUEST);
    json(
        status,
        format!(
            r#"{{"data":null,"error":{{"message":{}{code},"status":{}}},"count":null}}"#,
            quoted(message),
            status.as_u16()
        ),
    )
}

/// `failure(message, status, headers)`.
fn failure(message: &str, status: StatusCode, retry_after: Option<HeaderValue>) -> Response {
    let body = format!(
        r#"{{"data":null,"error":{{"message":{},"status":{}}},"count":null}}"#,
        quoted(message),
        status.as_u16()
    );
    let mut response = json(status, body);
    if let Some(retry_after) = retry_after {
        response.headers_mut().insert(RETRY_AFTER, retry_after);
    }
    response
}

fn quoted(text: &str) -> String {
    serde_json::to_string(text).expect("a string serializes")
}

fn json(status: StatusCode, body: String) -> Response {
    request::json(status, body)
}
