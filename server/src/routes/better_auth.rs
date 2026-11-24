//! better-auth's session and email-password endpoints, answered here
//! (docs/axum-migration/UI-PLAN.md section 4, steps 1 to 4): session read and
//! sign-out (A1), email sign-in, sign-up, email verification and password
//! reset (A2), Google and Kakao sign-in (A3, `oauth/`). Every other
//! `/api/auth/*` path gets better-auth's router answers (`catch_all.rs`).
//!
//! | Route id | Path | Method |
//! | --- | --- | --- |
//! | `auth-get-session` | `/api/auth/get-session` | `GET` |
//! | `auth-sign-out` | `/api/auth/sign-out` | `POST` |
//! | `auth-sign-in-email` | `/api/auth/sign-in/email` | `POST` |
//! | `auth-sign-up-email` | `/api/auth/sign-up/email` | `POST` |
//! | `auth-verify-email` | `/api/auth/verify-email` | `GET` |
//! | `auth-request-password-reset` | `/api/auth/request-password-reset` | `POST` |
//! | `auth-reset-password` | `/api/auth/reset-password` | `POST` |
//! | `auth-oauth` | `/api/auth/sign-in/social` | `POST` |
//! | `auth-oauth` | `/api/auth/callback/google`, `/api/auth/callback/kakao` | `GET` |
//! | `auth-callback` | `/auth/callback` | `GET` (B6, `callback.rs`) |
//! | `auth-tiktok` | `/auth/tiktok`, `/auth/tiktok/callback` (A4, `tiktok/`: route handlers that run better-auth's calls) | `GET` |
//!
//! What runs is what better-auth 1.7.20 runs with this app's options
//! (lib/auth/server.ts): no cookie cache, no secondary storage, no
//! `deferSessionRefresh`, sessions of 7 days refreshed after 1 day, the rate
//! limiter on in production. Each step names the file of
//! `node_modules/better-auth/dist` (or `better-call/dist`) it follows.
//!
//! `HEAD` of a `GET` endpoint is better-call's 404 (`not_found`); a body
//! outside an endpoint's shape is 415 or better-call's 400 validation error
//! (`forms.rs`).
//!
//! A request whose `Cookie` headers are longer than 16 KiB gets 431 before
//! anything else (`cookie_too_large`), so a header that size is never parsed.
//!
//! The rows are written as better-auth writes them: as the login role that
//! owns the tables (`DbIdentity::better_auth`).

mod accounts;
mod callback;
mod catch_all;
mod cookies;
mod email_token;
mod forms;
mod mail;
mod oauth;
mod password_reset;
pub(crate) mod passwords;
pub(crate) mod rate_limit;
mod session;
mod sign_in;
mod sign_out;
mod sign_up;
mod store;
mod tiktok;
mod verify_email;

pub(crate) use self::catch_all::unrouted;
/// `hashNewPassword` (lib/auth/passwords.ts), for the operator's password action.
pub(crate) use self::passwords::hash as hash_password;

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
use self::mail::Mailer;
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
    /// `None` outside production, where better-auth's limiter is off. The
    /// router's is `AppState::auth_limiter`, which the catch-all shares.
    limiter: Option<Arc<AuthRateLimiter>>,
    /// `ctx.context.baseURL`: `baseURL` with the `/api/auth` path, the
    /// start of the verification link.
    api_base_url: String,
    /// `SITE_URL` of lib/site.ts, the start of the reset link.
    site_url: String,
    mailer: Mailer,
    /// Google and Kakao, when their client id and secret are set.
    oauth: oauth::Providers,
    /// TikTok (`app/auth/tiktok`).
    tiktok: tiktok::provider::TikTok,
}

/// `minPasswordLength` (lib/auth/server.ts) and better-auth's default
/// `maxPasswordLength`, in UTF-16 units.
const MIN_PASSWORD_LENGTH: usize = 12;
pub(crate) const MAX_PASSWORD_LENGTH: usize = 128;

/// `generateId(size)`: letters and digits, uniformly.
fn random_id(size: usize) -> String {
    use rand::RngExt;
    rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(size)
        .map(char::from)
        .collect()
}

/// `crypto.randomUUID()`: a version 4 UUID.
fn uuid_v4() -> String {
    use rand::Rng;
    let mut bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = hex::encode(bytes);
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

/// `withPath(baseURL, "/api/auth")` (dist/utils/url.mjs:42-49): a URL that
/// already has a path is kept; otherwise trailing slashes go and the path is
/// appended.
fn api_base_url(base_url: &str) -> String {
    let has_path =
        url::Url::parse(base_url).is_ok_and(|url| !url.path().trim_end_matches('/').is_empty());
    if has_path {
        base_url.to_owned()
    } else {
        format!("{}/api/auth", base_url.trim_end_matches('/'))
    }
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
            limiter: config
                .node_env_production
                .then(|| Arc::new(AuthRateLimiter::new())),
            api_base_url: api_base_url(&base_url),
            site_url: config.site_url.trim_end_matches('/').to_owned(),
            mailer: Mailer::new(config.auth_email_webhook.clone()),
            oauth: oauth::Providers::new(config),
            tiktok: tiktok::provider::TikTok::new(config),
        }
    }

    /// better-auth's limiter for `path` (below `/api/auth`): `Some` is the 429.
    fn limit(&self, headers: &HeaderMap, path: &str) -> Option<Response> {
        self.limiter
            .as_ref()
            .and_then(|limiter| limiter.check(headers, path, crate::auth::now_ms()))
    }

    /// Whether every trusted origin is a plain origin. Origins are compared
    /// by equality, so a wildcard or custom-scheme pattern from
    /// `BETTER_AUTH_TRUSTED_ORIGINS` trusts nothing.
    fn origins_are_plain(&self) -> bool {
        self.trusted_origins.iter().all(|origin| {
            !origin.contains(['*', '?'])
                && (origin.starts_with("http://") || origin.starts_with("https://"))
        })
    }
}

/// `db.auth.resetPasswordForEmail(email)` of lib/db/server.ts:
/// `auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } })`
/// called inside the app, so without the HTTP endpoint's rate limit and
/// origin check. better-auth throws on an address zod does not accept, and
/// the caller ignores every failure: so does this.
pub(crate) async fn reset_password_for_email(state: &AppState, email: &str) {
    if !forms::is_email(email) {
        return;
    }
    let mailer = Mailer::new(state.config.auth_email_webhook.clone());
    let site_url = state.config.site_url.trim_end_matches('/');
    if let Err(error) = password_reset::send_link(state, &mailer, site_url, email).await {
        tracing::warn!(%error, "password reset for an operator failed");
    }
}

pub fn router(state: &AppState) -> Router<AppState> {
    let auth = Arc::new(BetterAuth {
        limiter: state.auth_limiter.clone(),
        ..BetterAuth::new(&state.config)
    });
    let tiktok = tiktok_router(state, &auth);
    let for_session = auth.clone();
    let for_callback = auth.clone();
    let routes = Routes::new(state)
        .add(
            "auth-get-session",
            "/api/auth/get-session",
            get(move |state: State<AppState>, request: Request| {
                session::get_session(state, for_session.clone(), request)
            }),
        )
        .add(
            "auth-callback",
            "/auth/callback",
            get(move |state: State<AppState>, request: Request| {
                callback::callback(state, for_callback.clone(), request)
            }),
        );
    if !auth.origins_are_plain() {
        tracing::warn!(
            "BETTER_AUTH_TRUSTED_ORIGINS holds a pattern: patterns are not matched, only plain origins are trusted"
        );
    }
    let route = |handler: Handler| {
        let auth = auth.clone();
        move |state: State<AppState>, request: Request| handler(state, auth.clone(), request)
    };
    routes
        .add(
            "auth-sign-out",
            "/api/auth/sign-out",
            post(route(|s, a, r| Box::pin(sign_out::sign_out(s, a, r)))),
        )
        .add(
            "auth-sign-in-email",
            "/api/auth/sign-in/email",
            post(route(|s, a, r| Box::pin(sign_in::sign_in(s, a, r)))),
        )
        .add(
            "auth-sign-up-email",
            "/api/auth/sign-up/email",
            post(route(|s, a, r| Box::pin(sign_up::sign_up(s, a, r)))),
        )
        .add(
            "auth-verify-email",
            "/api/auth/verify-email",
            get(route(|s, a, r| {
                Box::pin(verify_email::verify_email(s, a, r))
            })),
        )
        .add(
            "auth-request-password-reset",
            "/api/auth/request-password-reset",
            post(route(|s, a, r| {
                Box::pin(password_reset::request_password_reset(s, a, r))
            })),
        )
        .add(
            "auth-reset-password",
            "/api/auth/reset-password",
            post(route(|s, a, r| {
                Box::pin(password_reset::reset_password(s, a, r))
            })),
        )
        // Start and callbacks under one id.
        .add(
            "auth-oauth",
            "/api/auth/sign-in/social",
            post(route(|s, a, r| {
                Box::pin(oauth::start::sign_in_social(s, a, r))
            })),
        )
        .add(
            "auth-oauth",
            "/api/auth/callback/google",
            get(route(|s, a, r| Box::pin(oauth::callback::google(s, a, r)))),
        )
        .add(
            "auth-oauth",
            "/api/auth/callback/kakao",
            get(route(|s, a, r| Box::pin(oauth::callback::kakao(s, a, r)))),
        )
        .build()
        .merge(tiktok)
}

/// `app/auth/tiktok` and its callback, under one id. Outside `/api`, so a
/// `www` start is moved to the apex before routing.
fn tiktok_router(state: &AppState, auth: &Arc<BetterAuth>) -> Router<AppState> {
    let (for_start, for_callback) = (auth.clone(), auth.clone());
    Routes::new(state)
        .add(
            "auth-tiktok",
            "/auth/tiktok",
            get(move |state: State<AppState>, request: Request| {
                tiktok::start(state, for_start.clone(), request)
            }),
        )
        .add(
            "auth-tiktok",
            "/auth/tiktok/callback",
            get(move |state: State<AppState>, request: Request| {
                tiktok::callback(state, for_callback.clone(), request)
            }),
        )
        .build()
}

/// The signed-in user of a page: `createClient()` of lib/db/server.ts,
/// `currentSession()` with its failures read as signed out. better-auth's
/// `getSession` runs in full: a session due for refresh is extended and an
/// expired one deleted, but the cookies it sets are not sent with a page.
pub async fn page_user(state: &AppState, headers: &HeaderMap) -> Option<PageUser> {
    let auth = BetterAuth::new(&state.config);
    let header = crate::auth::cookie_header(headers);
    let mut ignored = cookies::SetCookies::default();
    match session::current(state, &auth, header.as_deref(), &mut ignored).await {
        Ok(found) => found.map(|(_, user)| PageUser {
            id: user.id,
            email: user.email,
            name: user.name,
        }),
        Err(session::Failure::Database(error)) => {
            tracing::warn!(%error, "page session lookup failed");
            None
        }
        Err(session::Failure::Unauthorized) => None,
    }
}

/// The signed-in user as a server action sees it: `page_user`, except that
/// an action can set cookies, so those `getSession` set come back as the
/// `Set-Cookie` lines of the action's answer.
pub async fn action_user(state: &AppState, headers: &HeaderMap) -> (Option<PageUser>, Vec<String>) {
    let (found, cookies) = action_session(state, headers).await;
    (found.map(|(user, _)| user), cookies)
}

/// `action_user` with the token of the session it read.
pub async fn action_session(
    state: &AppState,
    headers: &HeaderMap,
) -> (Option<(PageUser, String)>, Vec<String>) {
    let auth = BetterAuth::new(&state.config);
    let header = crate::auth::cookie_header(headers);
    let mut set = cookies::SetCookies::default();
    let found = session::current(state, &auth, header.as_deref(), &mut set).await;
    let mut store = crate::routes::next_compat::CookieStore::default();
    let user = match found {
        Ok(found) => {
            store.take(set.into_lines());
            found.map(|(session, user)| {
                (
                    PageUser {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                    },
                    session.token,
                )
            })
        }
        Err(session::Failure::Unauthorized) => {
            store.take(set.into_lines());
            None
        }
        Err(session::Failure::Database(error)) => {
            tracing::warn!(%error, "action session lookup failed");
            None
        }
    };
    (user, store.lines(crate::auth::now_ms()))
}

/// `{ id, email, name }` of `currentSession()`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PageUser {
    pub id: String,
    pub email: String,
    pub name: String,
}

/// A native endpoint: the state, what both share, the request.
type Handler = fn(
    State<AppState>,
    Arc<BetterAuth>,
    Request,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Response> + Send>>;

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
/// better-auth's refusal of a password over `MAX_PASSWORD_LENGTH`, as its
/// sign-up, sign-in and reset send it (400 `PASSWORD_TOO_LONG`).
/// better-auth's limiter for `/change-password` (3 per 10 s), for
/// `/api/account/password`, which counts both the client address and the
/// user. Off outside production, as better-auth's is.
pub(crate) struct PasswordLimiter(Option<AuthRateLimiter>);

impl PasswordLimiter {
    const PATH: &'static str = "/change-password";

    pub(crate) fn new(config: &Config) -> Self {
        Self(config.node_env_production.then(AuthRateLimiter::new))
    }

    /// `Some` is the 429 for the client address (`client_address::trusted_client`).
    pub(crate) fn by_address(&self, headers: &HeaderMap) -> Option<Response> {
        self.0
            .as_ref()?
            .check(headers, Self::PATH, crate::auth::now_ms())
    }

    /// `Some` is the 429 for the user.
    pub(crate) fn by_user(&self, user_id: &str) -> Option<Response> {
        self.0.as_ref()?.check_key(
            &format!("user:{user_id}"),
            Self::PATH,
            crate::auth::now_ms(),
        )
    }
}

/// `changePassword`'s refusals (`BASE_ERROR_CODES`): no credential account,
/// or a current password that does not match.
pub(crate) fn credential_account_not_found(set_cookies: Vec<String>) -> Response {
    api_error(
        StatusCode::BAD_REQUEST,
        b"BAD_REQUEST",
        "Credential account not found",
        "CREDENTIAL_ACCOUNT_NOT_FOUND",
        set_cookies,
        false,
    )
}

pub(crate) fn invalid_password(set_cookies: Vec<String>) -> Response {
    api_error(
        StatusCode::BAD_REQUEST,
        b"BAD_REQUEST",
        "Invalid password",
        "INVALID_PASSWORD",
        set_cookies,
        false,
    )
}

/// The 429 better-auth answers when no password hash could be queued.
pub(crate) fn hashing_overloaded() -> Response {
    rate_limit::overloaded()
}

pub(crate) fn password_too_long() -> Response {
    api_error(
        StatusCode::BAD_REQUEST,
        b"BAD_REQUEST",
        "Password too long",
        "PASSWORD_TOO_LONG",
        Vec::new(),
        false,
    )
}

/// better-call's 404 for a method an endpoint does not take (`HEAD` of a
/// `GET` endpoint).
fn not_found() -> Response {
    catch_all::not_found()
}

/// better-call's 400 for input the endpoint's schema refuses.
fn validation_error(message: &str) -> Response {
    api_error(
        StatusCode::BAD_REQUEST,
        b"BAD_REQUEST",
        message,
        "VALIDATION_ERROR",
        Vec::new(),
        false,
    )
}

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
