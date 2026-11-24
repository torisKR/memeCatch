//! better-auth's session endpoints, answered here (docs/axum-migration/UI-PLAN.md
//! section 4, steps 1 and 2): `GET /api/auth/get-session` and
//! `POST /api/auth/sign-out`. Every other `/api/auth/*` path and method stays
//! with Next (`app/api/auth/[...all]/route.ts`).
//!
//! | Route id | Path | Method |
//! | --- | --- | --- |
//! | `auth-get-session` | `/api/auth/get-session` | `GET` |
//! | `auth-sign-out` | `/api/auth/sign-out` | `POST` |
//!
//! What runs is what better-auth 1.7.20 runs with this app's options
//! (lib/auth/server.ts): no cookie cache, no secondary storage, no
//! `deferSessionRefresh`, sessions of 7 days refreshed after 1 day, the rate
//! limiter on in production. Each step names the file of
//! `node_modules/better-auth/dist` (or `better-call/dist`) it follows.
//!
//! Requests these handlers cannot answer as better-auth would go to Next
//! unchanged: `HEAD` (better-call has no such route and Next answers 404),
//! any query string (`disableRefresh`, `disableCookieCache`), the `RSC`
//! header (Next answers it with a redirect before better-auth runs), and the
//! sign-out bodies listed in `sign_out.rs`.
//!
//! A request whose `Cookie` headers are longer than 16 KiB gets Node's 431
//! before anything else (`cookie_too_large`): Node refuses such headers
//! before Next runs, and a header that size is never parsed here.
//!
//! The session rows are written as better-auth writes them: as the login role
//! that owns the tables (`DbIdentity::better_auth`). Nothing here writes
//! `user`, `account` or `verification`.

mod cookies;
mod rate_limit;
mod session;
mod sign_out;
mod store;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::HeaderMap;
use axum::http::StatusCode;
use axum::http::header::{
    CACHE_CONTROL, CONNECTION, CONTENT_TYPE, COOKIE, HeaderValue, PRAGMA, SET_COOKIE,
};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use hyper::ext::ReasonPhrase;

use self::cookies::AuthCookies;
use self::rate_limit::AuthRateLimiter;
use super::Routes;
use crate::AppState;
use crate::config::Config;

/// What both endpoints share, built once from the configuration.
pub(crate) struct BetterAuth {
    secret: String,
    cookies: AuthCookies,
    /// `ctx.context.trustedOrigins` (dist/context/helpers.mjs:60-86).
    trusted_origins: Vec<String>,
    /// `None` outside production, where better-auth's limiter is off.
    limiter: Option<AuthRateLimiter>,
}

impl BetterAuth {
    fn new(config: &Config) -> Self {
        // `SITE_URL` of lib/site.ts: trailing slashes dropped.
        let site_url = config.site_url.trim_end_matches('/').to_owned();
        // `baseURL: process.env.BETTER_AUTH_URL?.trim() || SITE_URL`
        // (lib/auth/server.ts:64); its origin is trusted.
        let base_url = config
            .better_auth_url
            .clone()
            .unwrap_or_else(|| site_url.clone());
        let mut trusted_origins = Vec::new();
        if let Ok(base) = url::Url::parse(&base_url) {
            trusted_origins.push(base.origin().ascii_serialization());
        }
        // `trustedOrigins` of lib/auth/server.ts:66, then the environment's.
        trusted_origins.extend([
            site_url,
            "http://localhost:3000".to_owned(),
            "http://127.0.0.1:3000".to_owned(),
        ]);
        trusted_origins.extend(config.better_auth_trusted_origins.iter().cloned());
        Self {
            secret: config.better_auth_secret.expose().to_owned(),
            cookies: AuthCookies::new(config.use_secure_cookies),
            trusted_origins,
            limiter: config.node_env_production.then(AuthRateLimiter::new),
        }
    }

    /// Whether every trusted origin is a plain origin, compared by equality
    /// (`matchesOriginPattern`, dist/auth/trusted-origins.mjs:103-129). A
    /// wildcard or custom-scheme pattern from `BETTER_AUTH_TRUSTED_ORIGINS`
    /// is not ported: with one, sign-out stays with Next.
    fn origins_are_plain(&self) -> bool {
        self.trusted_origins.iter().all(|origin| {
            !origin.contains(['*', '?'])
                && (origin.starts_with("http://") || origin.starts_with("https://"))
        })
    }
}

pub fn router(state: &AppState) -> Router<AppState> {
    let auth = Arc::new(BetterAuth::new(&state.config));
    let for_session = auth.clone();
    let routes = Routes::new(state).add(
        "auth-get-session",
        "/api/auth/get-session",
        get(move |state: State<AppState>, request: Request| {
            session::get_session(state, for_session.clone(), request)
        }),
    );
    if !auth.origins_are_plain() {
        tracing::warn!(
            "BETTER_AUTH_TRUSTED_ORIGINS holds a pattern this server does not match: \
             /api/auth/sign-out stays with the upstream"
        );
        return routes.build();
    }
    routes
        .add(
            "auth-sign-out",
            "/api/auth/sign-out",
            post(move |state: State<AppState>, request: Request| {
                sign_out::sign_out(state, auth.clone(), request)
            }),
        )
        .build()
}

/// Node's `--max-http-header-size` default. A request whose `Cookie` headers
/// alone are longer never reaches better-auth: Node answers 431 with no body
/// and closes the connection.
const NODE_MAX_HEADER_BYTES: usize = 16 * 1024;

/// Node's 431 for a `Cookie` header over `NODE_MAX_HEADER_BYTES`. Checked
/// first, so an oversized header is never parsed.
fn cookie_too_large(headers: &HeaderMap) -> Option<Response> {
    let len: usize = headers.get_all(COOKIE).iter().map(HeaderValue::len).sum();
    (len > NODE_MAX_HEADER_BYTES).then(|| {
        let mut response = StatusCode::REQUEST_HEADER_FIELDS_TOO_LARGE.into_response();
        response
            .headers_mut()
            .insert(CONNECTION, HeaderValue::from_static("close"));
        response
    })
}

/// A better-call answer: `status` with better-call's reason phrase, a JSON
/// body, the `Set-Cookie` lines in order, and `cache-control: no-store` plus
/// `pragma: no-cache` when the endpoint had set them (`get-session` sets them
/// first, dist/api/routes/session.mjs:33-34; they stay on its errors).
fn answer(
    status: StatusCode,
    reason: &'static [u8],
    body: String,
    set_cookies: Vec<String>,
    no_store: bool,
) -> Response {
    let mut response = (status, body).into_response();
    let headers = response.headers_mut();
    if no_store {
        headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
        headers.insert(PRAGMA, HeaderValue::from_static("no-cache"));
    }
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    for line in set_cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            headers.append(SET_COOKIE, value);
        }
    }
    // Node writes the reason better-call gives: the status key for an
    // `APIError` ("UNAUTHORIZED"), the code itself for `new APIError(400)`.
    response
        .extensions_mut()
        .insert(ReasonPhrase::from_static(reason));
    response
}

/// `APIError.from(status, ...)` as JSON: `{"message":...,"code":...}`, in
/// that key order.
fn api_error(
    status: StatusCode,
    reason: &'static [u8],
    message: &str,
    code: &str,
    set_cookies: Vec<String>,
    no_store: bool,
) -> Response {
    let text = |value: &str| serde_json::Value::from(value).to_string();
    let body = format!(r#"{{"message":{},"code":{}}}"#, text(message), text(code));
    answer(status, reason, body, set_cookies, no_store)
}
