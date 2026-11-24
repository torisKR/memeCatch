//! Without an upstream, the `/api/auth/*` requests no native endpoint takes
//! (`PLAN.md` C3-3): what better-auth's router answers before an endpoint
//! runs, as `app/api/auth/[...all]/route.ts` hands it every `GET`, `POST` and
//! (through `GET`) `HEAD`. In order (better-auth dist/api/index.mjs `router`,
//! better-call 1.4.5 dist/router.mjs and dist/utils.mjs `getBody`):
//!
//! 1. the rate limiter (production), for every path;
//! 2. 404 with no body for a method and path no endpoint has (a `HEAD`, a
//!    path with `//`, a trailing slash);
//! 3. 415 for a `POST` whose `Content-Type` the endpoint does not take: Next
//!    hands better-auth a body stream even when none was sent.
//!
//! What remains is an endpoint that would run. The app calls only the native
//! ones; any other stays `None` here, a 501 without Next. Next's 405 and
//! `OPTIONS` for the other methods are `standalone::answer`'s.

use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use hyper::ext::ReasonPhrase;

use super::{api_base_url, api_error};
use crate::AppState;

/// better-auth 1.7.20's endpoints with this app's options (no plugins):
/// path, methods, and the media types when the endpoint sets its own
/// (`metadata.allowedMediaTypes`). Generated from `getAuth().api`, leaving
/// out `SERVER_ONLY` ones. `:x` is one path segment.
type Endpoint = (
    &'static str,
    &'static [&'static str],
    Option<&'static [&'static str]>,
);

const ENDPOINTS: [Endpoint; 30] = [
    ("/account-info", &["GET"], None),
    ("/callback/:id", &["GET", "POST"], Some(FORM_OR_JSON)),
    ("/change-email", &["POST"], None),
    ("/change-password", &["POST"], None),
    ("/delete-user", &["POST"], None),
    ("/delete-user/callback", &["GET"], None),
    ("/error", &["GET"], None),
    ("/get-access-token", &["POST"], None),
    ("/get-session", &["GET", "POST"], None),
    ("/link-social", &["POST"], None),
    ("/list-accounts", &["GET"], None),
    ("/list-sessions", &["GET"], None),
    ("/ok", &["GET"], None),
    ("/refresh-token", &["POST"], None),
    ("/request-password-reset", &["POST"], None),
    ("/reset-password", &["POST"], None),
    ("/reset-password/:token", &["GET"], None),
    ("/revoke-other-sessions", &["POST"], None),
    ("/revoke-session", &["POST"], None),
    ("/revoke-sessions", &["POST"], None),
    ("/send-verification-email", &["POST"], None),
    ("/sign-in/email", &["POST"], Some(FORM_OR_JSON)),
    ("/sign-in/social", &["POST"], None),
    ("/sign-out", &["POST"], None),
    ("/sign-up/email", &["POST"], Some(FORM_OR_JSON)),
    ("/unlink-account", &["POST"], None),
    ("/update-session", &["POST"], None),
    ("/update-user", &["POST"], None),
    ("/verify-email", &["GET"], None),
    ("/verify-password", &["POST"], None),
];
const FORM_OR_JSON: &[&str] = &["application/x-www-form-urlencoded", "application/json"];
/// The router's `allowedMediaTypes`.
const JSON_ONLY: &[&str] = &["application/json"];

/// rou3's `findRoute`: a static segment matches itself, `:x` any one
/// non-empty segment. The media types the endpoint takes.
fn find(method: &str, path: &str) -> Option<&'static [&'static str]> {
    let segments: Vec<&str> = path.split('/').collect();
    ENDPOINTS.iter().find_map(|(pattern, methods, media)| {
        let parts: Vec<&str> = pattern.split('/').collect();
        let same = parts.len() == segments.len()
            && parts.iter().zip(&segments).all(|(part, segment)| {
                *part == *segment || (part.starts_with(':') && !segment.is_empty())
            });
        (same && methods.contains(&method)).then_some(media.unwrap_or(JSON_ONLY))
    })
}

/// better-call's empty 404.
pub(super) fn not_found() -> Response {
    let mut response = StatusCode::NOT_FOUND.into_response();
    response
        .extensions_mut()
        .insert(ReasonPhrase::from_static(b"Not Found"));
    response
}

/// `getBody`'s refusal (`new APIError(415, ...)`, reason "415").
pub(super) fn unsupported(content_type: &str, allowed: &[&str]) -> Response {
    let allowed = allowed.join(", ");
    let message = if content_type.is_empty() {
        format!("Content-Type is required. Allowed types: {allowed}")
    } else {
        format!("Content-Type \"{content_type}\" is not allowed. Allowed types: {allowed}")
    };
    let status = StatusCode::UNSUPPORTED_MEDIA_TYPE;
    api_error(
        status,
        b"415",
        &message,
        "UNSUPPORTED_MEDIA_TYPE",
        Vec::new(),
        false,
    )
}

/// better-auth's answer to `method` (`GET`, `POST` or `HEAD`) at `pathname`
/// (`/api/auth/...`), or `None` when an endpoint would run.
pub(crate) fn unrouted(
    state: &AppState,
    method: &str,
    pathname: &str,
    headers: &HeaderMap,
) -> Option<Response> {
    let base_url = api_base_url(
        state
            .config
            .better_auth_url
            .as_deref()
            .unwrap_or(&state.config.site_url),
    );
    let base_path = url::Url::parse(&base_url)
        .map(|url| url.path().trim_end_matches('/').to_owned())
        .unwrap_or_default();
    let path = pathname.strip_prefix(&base_path)?;
    // `onRequestRateLimit`, keyed by `normalizePathname`.
    if let Some(limiter) = &state.auth_limiter {
        let key = path.trim_end_matches('/');
        let key = if key.is_empty() { "/" } else { key };
        if let Some(limited) = limiter.check(headers, key, crate::auth::now_ms()) {
            return Some(limited);
        }
    }
    if path.is_empty() || path.contains("//") || path.ends_with('/') {
        return Some(not_found());
    }
    let Some(allowed) = find(method, path) else {
        return Some(not_found());
    };
    if method != "POST" {
        return None;
    }
    let content_type = headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let essence = content_type.to_lowercase();
    let essence = essence.split(';').next().unwrap_or_default().trim();
    let accepted = allowed.contains(&essence);
    (!accepted).then(|| unsupported(content_type, allowed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_path_matches_an_endpoint_of_its_method_only() {
        assert_eq!(find("GET", "/get-session"), Some(JSON_ONLY));
        assert_eq!(find("POST", "/get-session"), Some(JSON_ONLY));
        assert_eq!(find("HEAD", "/get-session"), None);
        assert_eq!(find("GET", "/sign-out"), None);
        assert_eq!(find("POST", "/sign-in/email"), Some(FORM_OR_JSON));
        assert_eq!(find("GET", "/callback/google"), Some(FORM_OR_JSON));
        assert_eq!(find("GET", "/callback/a/b"), None);
        assert_eq!(find("GET", "/reset-password/abc"), Some(JSON_ONLY));
        assert_eq!(find("GET", "/reset-password"), None);
        assert_eq!(find("GET", "/Get-Session"), None);
        assert_eq!(find("GET", "/nope"), None);
    }
}
