//! What the native better-auth endpoints share about a request: which ones
//! they answer (the rest go to Next as they came), better-call's body
//! parsing for those, and better-auth's origin checks
//! (dist/api/middlewares/origin-check.mjs).
//!
//! Answered here is a request whose answer can be worked out exactly: no
//! query string, a JSON content type, a body that is a JSON object of the
//! endpoint's keys with the types its schema wants, and URLs (callback,
//! redirect) that are plain root-relative paths. Anything else, which
//! better-call or zod would refuse with messages of their own or which would
//! need more of better-auth's URL matching, goes to Next unchanged.

use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::header::{CONTENT_TYPE, ORIGIN, REFERER};
use axum::http::request::Parts;
use axum::http::{HeaderMap, HeaderName, StatusCode};
use axum::response::Response;
use futures_util::stream::{self, StreamExt};
use serde_json::{Map, Value};

use super::{BetterAuth, api_error};
use crate::routes::request::header_text;
use crate::{AppState, fallback};

/// The most of a body read before deciding; a longer one is handed to Next.
const MAX_BODY_BYTES: usize = 64 * 1024;

/// A request this server answers: its head and its JSON object body.
pub struct JsonRequest {
    pub parts: Parts,
    pub body: Map<String, Value>,
    raw: Bytes,
}

/// Reads the body and keeps the request when `answerable` accepts it;
/// otherwise forwards it to Next as it came and returns Next's answer.
pub async fn json_or_next(
    state: &AppState,
    request: Request,
    answerable: impl FnOnce(&Parts, &Map<String, Value>) -> bool,
) -> Result<JsonRequest, Response> {
    let (parts, body) = request.into_parts();
    let (bytes, rest) = read_prefix(body).await;
    let object = match (&rest, plain_request(&parts)) {
        (None, true) => match serde_json::from_slice::<Value>(&bytes) {
            Ok(Value::Object(object)) => Some(object),
            _ => None,
        },
        _ => None,
    };
    if let Some(body) = object
        && answerable(&parts, &body)
    {
        return Ok(JsonRequest {
            parts,
            body,
            raw: bytes,
        });
    }
    let body = match rest {
        None => Body::from(bytes),
        Some(rest) => Body::from_stream(stream::iter([Ok::<_, axum::Error>(bytes)]).chain(rest)),
    };
    Err(fallback::answer(State(state.clone()), Request::from_parts(parts, body)).await)
}

/// Forwards a request already read to Next, for an answer only Next can give
/// once the work has started without side effects (an unreadable hash).
pub async fn to_next(state: &AppState, request: JsonRequest) -> Response {
    fallback::answer(
        State(state.clone()),
        Request::from_parts(request.parts, Body::from(request.raw)),
    )
    .await
}

/// No query string, a JSON content type, not the `Origin: null`
/// same-origin fetch whose origin better-auth infers from the request URL,
/// and no `RSC` header: Next answers that with a 307 to `?_rsc=…` before the
/// route runs, whatever the method (PLAN.md A2-13).
fn plain_request(parts: &Parts) -> bool {
    parts.uri.query().is_none()
        && is_json_content_type(&parts.headers)
        && !same_origin_null(&parts.headers)
        && !parts.headers.contains_key("rsc")
}

/// Reads up to `MAX_BODY_BYTES`. `Some(rest)` when the body goes on.
pub async fn read_prefix(
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
pub fn is_json_content_type(headers: &HeaderMap) -> bool {
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

/// `origin === "null" && sec-fetch-site === "same-origin"`: better-auth then
/// validates an origin inferred from the request URL (origin-check.mjs:104).
pub fn same_origin_null(headers: &HeaderMap) -> bool {
    let fetch_site = HeaderName::from_static("sec-fetch-site");
    header_text(headers, &ORIGIN, ", ").as_deref() == Some("null")
        && header_text(headers, &fetch_site, ", ").as_deref() == Some("same-origin")
}

/// The body has only `allowed` keys.
pub fn only_keys(body: &Map<String, Value>, allowed: &[&str]) -> bool {
    body.keys().all(|key| allowed.contains(&key.as_str()))
}

/// `body[key]` is a string; `None` when it is anything else or missing.
pub fn string<'a>(body: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    body.get(key).and_then(Value::as_str)
}

/// `key` is missing or a boolean (`z.boolean().optional()`).
pub fn optional_bool(body: &Map<String, Value>, key: &str) -> bool {
    body.get(key).is_none_or(Value::is_boolean)
}

/// zod 4.6.7's `z.email()` (v4/core/regexes.js `email`):
/// `^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$`.
pub fn is_email(text: &str) -> bool {
    let local_char =
        |byte: u8| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'\'' | b'+' | b'-');
    let Some((local, domain)) = text.split_once('@') else {
        return false;
    };
    let mut labels: Vec<&str> = local.split('.').collect();
    let last = labels.pop().unwrap_or_default();
    let local_ok = labels
        .iter()
        .all(|label| !label.is_empty() && label.bytes().all(local_char))
        && last.bytes().all(local_char)
        && last.bytes().last().is_some_and(|byte| byte != b'\'');
    let mut parts: Vec<&str> = domain.split('.').collect();
    let top = parts.pop().unwrap_or_default();
    let domain_ok = !parts.is_empty()
        && parts.iter().all(|label| {
            label
                .bytes()
                .next()
                .is_some_and(|byte| byte.is_ascii_alphanumeric())
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
        && top.len() >= 2
        && top.bytes().all(|byte| byte.is_ascii_alphabetic());
    local_ok && domain_ok
}

/// A root-relative URL of plain characters (`/`, `/my/page`,
/// `/reset-password?x=1`). better-auth trusts each one
/// (`isSafeRelativeURL`, dist/auth/trusted-origins.mjs) and writes it back
/// unchanged; other forms go to Next.
pub fn is_plain_path(url: &str) -> bool {
    let (path, query) = match url.split_once('?') {
        Some((path, query)) => (path, Some(query)),
        None => (url, None),
    };
    let path_char =
        |byte: u8| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'~' | b'.' | b'/');
    let query_char = |byte: u8| {
        byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'~' | b'.' | b'=' | b'&')
    };
    path.starts_with('/')
        && !path.starts_with("//")
        && path.bytes().all(path_char)
        && path
            .split('/')
            .all(|segment| segment != "." && segment != "..")
        && query.is_none_or(|query| !query.is_empty() && query.bytes().all(query_char))
}

/// The JavaScript `length` of a string: UTF-16 code units, as better-auth
/// compares password lengths.
pub fn js_length(text: &str) -> usize {
    text.encode_utf16().count()
}

/// `validateOrigin(ctx, force)`: with a Cookie header (or when forced), the
/// request's `Origin` (or its `Referer`) must be a trusted origin. `Some` is
/// the 403.
pub fn validate_origin(auth: &BetterAuth, headers: &HeaderMap, force: bool) -> Option<Response> {
    if !force && !headers.contains_key(axum::http::header::COOKIE) {
        return None;
    }
    let origin = header_text(headers, &ORIGIN, ", ").filter(|origin| !origin.is_empty());
    let candidate = origin
        .or_else(|| header_text(headers, &REFERER, ", ").filter(|referer| !referer.is_empty()))
        .unwrap_or_default();
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

/// `formCsrfMiddleware` (origin-check.mjs:131-152), on the sign-in and
/// sign-up endpoints: with cookies the plain origin check; without, Fetch
/// Metadata decides, and a cross-site navigation is refused outright.
pub fn form_csrf(auth: &BetterAuth, headers: &HeaderMap) -> Option<Response> {
    if headers.contains_key(axum::http::header::COOKIE) {
        return validate_origin(auth, headers, false);
    }
    let get = |name: &'static str| header_text(headers, &HeaderName::from_static(name), ", ");
    let (site, mode, dest) = (
        get("sec-fetch-site"),
        get("sec-fetch-mode"),
        get("sec-fetch-dest"),
    );
    let present =
        |value: &Option<String>| value.as_deref().is_some_and(|text| !text.trim().is_empty());
    if present(&site) || present(&mode) || present(&dest) {
        if site.as_deref() == Some("cross-site") && mode.as_deref() == Some("navigate") {
            return Some(forbidden(
                "Cross-site navigation login blocked. This request appears to be a CSRF attack.",
                "CROSS_SITE_NAVIGATION_LOGIN_BLOCKED",
            ));
        }
        return validate_origin(auth, headers, true);
    }
    let has =
        |name: &HeaderName| header_text(headers, name, ", ").is_some_and(|value| !value.is_empty());
    if has(&ORIGIN) || has(&REFERER) {
        return validate_origin(auth, headers, true);
    }
    None
}

fn forbidden(message: &str, code: &str) -> Response {
    api_error(
        StatusCode::FORBIDDEN,
        b"FORBIDDEN",
        message,
        code,
        Vec::new(),
        false,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emails_are_what_zod_calls_an_email() {
        for valid in [
            "a@example.com",
            "a.b+c_d-e'f1@sub.example.co",
            "A@EXAMPLE.COM",
            "x@kakao.memecatch.internal",
            "1@a-b.cd",
        ] {
            assert!(is_email(valid), "{valid}");
        }
        for invalid in [
            "nobody",
            "a@b",
            "a@b.c",
            ".a@example.com",
            "a.@example.com",
            "a..b@example.com",
            "a'@example.com",
            "a@-x.com",
            "a@x.c0m",
            "a@@example.com",
            "a b@example.com",
            "é@example.com",
            "a@example.com\n",
            "",
        ] {
            assert!(!is_email(invalid), "{invalid:?}");
        }
    }

    #[test]
    fn plain_paths_are_the_ones_answered_here() {
        for plain in ["/", "/my", "/reset-password", "/a/b.c?x=1&y=", "/~u"] {
            assert!(is_plain_path(plain), "{plain}");
        }
        for other in [
            "",
            "//evil.example",
            "/\\evil",
            "https://catchmeme.com/",
            "/a/../b",
            "/./a",
            "/a?",
            "/a#b",
            "/%2F",
            "/a?b=%20",
            "/a b",
            "/é",
        ] {
            assert!(!is_plain_path(other), "{other:?}");
        }
    }

    #[test]
    fn lengths_count_utf16_units() {
        assert_eq!(js_length("abc"), 3);
        assert_eq!(js_length("비밀"), 2);
        assert_eq!(js_length("😀"), 2);
    }
}
