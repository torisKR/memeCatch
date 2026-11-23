//! `POST /api/auth/sign-out`: better-auth's `signOut` endpoint
//! (dist/api/routes/sign-out.mjs) behind better-call's body parsing
//! (better-call dist/utils.mjs:4-30) and the origin check
//! (dist/api/middlewares/origin-check.mjs:44-120).
//!
//! Answered here: no query string, a JSON content type and a body that is a
//! JSON object without any of the schema's keys (`callbackURL`,
//! `disableRedirect`, `state`) or the keys the origin check validates
//! (`redirectTo`, `errorCallbackURL`, `newUserCallbackURL`), which is what
//! the page frame sends (`{}`). Every other request goes to Next as it came:
//! a missing or other content type (415), a body that is not JSON or not an
//! object (400), and those keys, which better-auth checks against the trusted
//! origins (403, or 400 for a non-string). So does any query string: the
//! origin check reads `callbackURL` from the query too
//! (origin-check.mjs:51), and Next answers 400 to a raw non-ASCII byte in it.
//! So does `Origin: null` on a same-origin fetch, which better-auth replaces
//! with an origin it infers from the request.
//!
//! What it does: with a Cookie header, the request's `Origin` (or its
//! `Referer`) must be a trusted origin (403 otherwise); the session of a
//! validly signed cookie is deleted; the session cookies are expired; the
//! answer is `{"success":true}`. When the row cannot be deleted (after one
//! retry on a pool timeout) the cookies are still expired but the answer is
//! 500 `FAILED_TO_SIGN_OUT`, where better-auth answers success (PLAN.md A1-4). No provider of this app has an end-session
//! URL (Google has none; the Kakao plugin has no end-session endpoint), so
//! there is never a logout redirect.

use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_TYPE, ORIGIN, REFERER};
use axum::response::Response;
use futures_util::stream::{self, StreamExt};

use super::cookies::{self, SetCookies};
use super::{BetterAuth, answer, api_error};
use crate::auth::{cookie_header, cookie_value, now_ms, verify_signed_value};
use crate::routes::request::header_text;
use crate::{AppState, proxy};

/// The most of a body read before deciding; a longer one is handed to Next.
const MAX_BODY_BYTES: usize = 64 * 1024;
/// The body schema's keys, then the ones `originCheckMiddleware` validates
/// (origin-check.mjs:50-54): a body with any of them goes to Next.
const NEXT_KEYS: [&str; 6] = [
    "callbackURL",
    "disableRedirect",
    "state",
    "redirectTo",
    "errorCallbackURL",
    "newUserCallbackURL",
];

pub async fn sign_out(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let (parts, body) = request.into_parts();
    let (bytes, rest) = read_prefix(body).await;
    let handled = rest.is_none()
        && parts.uri.query().is_none()
        && is_json_content_type(&parts.headers)
        && is_plain_object(&bytes)
        && !same_origin_null(&parts.headers);
    if !handled {
        let body = match rest {
            None => Body::from(bytes),
            Some(rest) => {
                Body::from_stream(stream::iter([Ok::<_, axum::Error>(bytes)]).chain(rest))
            }
        };
        return proxy::forward(State(state), Request::from_parts(parts, body)).await;
    }
    if let Some(limiter) = &auth.limiter
        && let Some(limited) = limiter.check(&parts.headers, "/sign-out", now_ms())
    {
        return limited;
    }
    if parts.headers.contains_key(axum::http::header::COOKIE)
        && let Some(refused) = check_origin(&auth, &parts.headers)
    {
        return refused;
    }
    let header = cookie_header(&parts.headers);
    let names = &auth.cookies;
    let token = header
        .as_deref()
        .and_then(|header| cookie_value(header, &names.session_token))
        .and_then(|value| verify_signed_value(&value, &auth.secret).map(str::to_owned))
        .filter(|token| !token.is_empty());
    let deleted = match token {
        None => Ok(()),
        Some(token) => delete_waiting(&state.db, token).await,
    };
    let mut set = SetCookies::default();
    let chunks = cookies::existing_chunks(header.as_deref(), &names.session_data);
    set.delete_session_cookie(names, &chunks);
    match deleted {
        Ok(()) => answer(
            StatusCode::OK,
            b"OK",
            r#"{"success":true}"#.to_owned(),
            set.into_lines(),
            false,
        ),
        // better-auth logs "Failed to delete session from database" and
        // answers 200 success with the row still there. Here the answer says
        // the session did not end (PLAN.md A1-4); this device's cookies are
        // expired all the same.
        Err(error) => {
            tracing::error!(%error, "sign-out could not delete the session");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                b"INTERNAL_SERVER_ERROR",
                "Failed to sign out",
                "FAILED_TO_SIGN_OUT",
                set.into_lines(),
                false,
            )
        }
    }
}

/// `deleteSession(token)`, waiting for a connection as node-pg does: a pool
/// timeout is tried once more before it counts as a database failure.
async fn delete_waiting(db: &crate::db::Db, token: String) -> Result<(), sqlx::Error> {
    match super::store::delete(db, token.clone()).await {
        Err(sqlx::Error::PoolTimedOut) => super::store::delete(db, token).await,
        done => done,
    }
}

/// Reads up to `MAX_BODY_BYTES`. `Some(rest)` when the body goes on.
async fn read_prefix(
    body: Body,
) -> (
    Bytes,
    Option<impl futures_util::Stream<Item = Result<Bytes, axum::Error>> + Send + 'static>,
) {
    let mut stream = body.into_data_stream();
    let mut read = Vec::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(chunk) => {
                read.extend_from_slice(&chunk);
                if read.len() > MAX_BODY_BYTES {
                    return (Bytes::from(read), Some(stream));
                }
            }
            // A broken body: Next would fail to read it too.
            Err(_) => return (Bytes::from(read), Some(stream)),
        }
    }
    (Bytes::from(read), None)
}

/// better-call's `allowedMediaTypes` check (dist/utils.mjs:8-21): the media
/// type before `;`, lowercased and trimmed, is `application/json`. That also
/// passes `jsonContentTypeRegex`, so the body is parsed as JSON.
fn is_json_content_type(headers: &axum::http::HeaderMap) -> bool {
    header_text(headers, &CONTENT_TYPE, ", ").is_some_and(|value| {
        value
            .to_ascii_lowercase()
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            == "application/json"
    })
}

/// The body parses as a JSON object without any of `NEXT_KEYS`.
fn is_plain_object(bytes: &[u8]) -> bool {
    match serde_json::from_slice::<serde_json::Value>(bytes) {
        Ok(serde_json::Value::Object(object)) => {
            NEXT_KEYS.iter().all(|key| !object.contains_key(*key))
        }
        _ => false,
    }
}

/// `origin === "null" && sec-fetch-site === "same-origin"`: better-auth then
/// validates an origin inferred from the request URL (origin-check.mjs:104).
fn same_origin_null(headers: &axum::http::HeaderMap) -> bool {
    let fetch_site = axum::http::HeaderName::from_static("sec-fetch-site");
    header_text(headers, &ORIGIN, ", ").as_deref() == Some("null")
        && header_text(headers, &fetch_site, ", ").as_deref() == Some("same-origin")
}

/// `validateOrigin(ctx)` for a request with cookies: `Some` is the 403.
fn check_origin(auth: &BetterAuth, headers: &axum::http::HeaderMap) -> Option<Response> {
    let origin = header_text(headers, &ORIGIN, ", ").filter(|origin| !origin.is_empty());
    let candidate = origin
        .or_else(|| header_text(headers, &REFERER, ", ").filter(|referer| !referer.is_empty()))
        .unwrap_or_default();
    let forbidden = |message: &str, code: &str| {
        api_error(
            StatusCode::FORBIDDEN,
            b"FORBIDDEN",
            message,
            code,
            Vec::new(),
            false,
        )
    };
    if candidate.is_empty() || candidate == "null" {
        return Some(forbidden(
            "Missing or null Origin",
            "MISSING_OR_NULL_ORIGIN",
        ));
    }
    // `matchesOriginPattern(url, pattern)` with plain patterns: a relative
    // URL never matches; otherwise `getOrigin(url) === pattern`.
    let origin = (!candidate.starts_with('/'))
        .then(|| url::Url::parse(&candidate).ok())
        .flatten()
        .map(|url| url.origin().ascii_serialization())
        .filter(|origin| origin != "null");
    match origin {
        Some(origin) if auth.trusted_origins.contains(&origin) => None,
        _ => Some(forbidden("Invalid origin", "INVALID_ORIGIN")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_bodies_better_auth_takes_as_is_are_answered_here() {
        assert!(is_plain_object(b"{}"));
        assert!(is_plain_object(br#"{"x":1}"#));
        for body in [
            &b""[..],
            b"null",
            b"[]",
            b"{",
            br#"{"callbackURL":"/"}"#,
            br#"{"state":"s"}"#,
            br#"{"redirectTo":"/"}"#,
            br#"{"errorCallbackURL":1}"#,
            br#"{"newUserCallbackURL":null}"#,
        ] {
            assert!(!is_plain_object(body), "{}", String::from_utf8_lossy(body));
        }
    }

    #[test]
    fn only_application_json_is_answered_here() {
        let with = |value: &'static str| {
            let mut headers = axum::http::HeaderMap::new();
            headers.insert(CONTENT_TYPE, value.parse().unwrap());
            is_json_content_type(&headers)
        };
        assert!(with("application/json"));
        assert!(with("Application/JSON; charset=utf-8"));
        assert!(!with("text/plain"));
        assert!(!with("application/ld+json"));
        assert!(!is_json_content_type(&axum::http::HeaderMap::new()));
    }
}
