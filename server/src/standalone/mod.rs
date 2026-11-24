//! Without an upstream (`AXUM_NO_UPSTREAM=true`): what the Next server does
//! that no route file shows, so that Axum alone answers every request as
//! Next did. `docs/axum-migration/inventory/next-implicit.md` lists each
//! behaviour; PLAN.md (section C1) lists what still differs.
//!
//! [`before_routing`] wraps the whole router and does what Next does before
//! a route runs: its URL normalisation, its redirects, and the redirects and
//! sign-in gate of `proxy.ts`. [`answer`] takes the place of the upstream
//! for a request no native route took: the service worker, the public files,
//! `/_next/image`, then Next's route table (`next_routes.json`) decides
//! between 404, 405 and `501` with `x-axum-not-ported: <Next route>` for a
//! route only Next can answer yet. Those 501s are the cutover blocker list.

pub mod auth_gate;
pub mod image;
pub mod next_routes;
pub mod not_found;
pub mod redirects;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{ALLOW, CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE, VARY};
use axum::http::uri::PathAndQuery;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, Uri};
use axum::middleware::Next;
use axum::response::Response;

use self::next_routes::Kind;
use self::not_found::Variant;
use self::redirects::SEO_CONTENT_LOCALES;
use crate::pages::retired;
use crate::{AppState, next_rules, public_files};

const ROUTER_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
const WORKER: &str = include_str!("worker.js");
pub const NOT_PORTED_HEADER: &str = "x-axum-not-ported";
// `rankingsLocaleRewriteSource()`: every locale but Korean.
const RANKING_LOCALES: [&str; 18] = [
    "en", "ja", "zh-tw", "zh", "th", "vi", "mn", "id", "ar", "ru", "es", "de", "fr", "it", "pt",
    "tr", "ms", "hi",
];

/// The outermost layer without an upstream.
pub async fn before_routing(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    resolve_dot_segments(&mut request);
    let target = target(&request).to_owned();
    if let Some(redirect) = redirects::before_proxy(&target) {
        return redirect;
    }
    let path = request.uri().path().to_owned();
    let query = request.uri().query().map(str::to_owned);
    if let Some(redirect) = redirects::proxy(
        &state.native_headers,
        request.method(),
        request.headers(),
        &target,
    ) {
        return redirect;
    }
    if next_rules::proxy_matches(&path)
        && let Some(redirect) =
            auth_gate::check(&state, request.headers(), &path, query.as_deref()).await
    {
        return redirect;
    }
    next.run(request).await
}

fn target(request: &Request) -> &str {
    request
        .uri()
        .path_and_query()
        .map_or("/", PathAndQuery::as_str)
}

/// Next routes the URL after `new URL()` has resolved `.` and `..` segments
/// (`/icons/../ads.txt` is `/ads.txt`), without a redirect.
fn resolve_dot_segments(request: &mut Request) {
    let path = request.uri().path();
    let has_dots = path.split('/').any(|segment| {
        let lower = segment.to_ascii_lowercase();
        matches!(
            lower.as_str(),
            "." | ".." | "%2e" | "%2e%2e" | ".%2e" | "%2e."
        )
    });
    if !has_dots {
        return;
    }
    let Ok(parsed) = url::Url::parse(&format!("http://h{}", target(request))) else {
        return;
    };
    let resolved = match parsed.query() {
        Some(query) => format!("{}?{query}", parsed.path()),
        None => parsed.path().to_owned(),
    };
    if let Ok(uri) = resolved.parse::<Uri>() {
        *request.uri_mut() = uri;
    }
}

/// The answer in the upstream's place (`proxy::forward`).
pub async fn answer(state: &AppState, request: Request) -> Response {
    let path = request.uri().path().to_owned();
    let method = request.method().clone();
    let reading = method == Method::GET || method == Method::HEAD;
    if path == "/sw.js" && reading {
        return worker(state);
    }
    let (uri, headers) = (request.uri().clone(), request.headers().clone());
    drop(request);
    let request_headers = headers.clone();
    if let Some(file) = public_files::serve(state, &method, &uri, &headers).await {
        return file;
    }
    if path == "/_next/image" {
        return image::serve(state, &uri, &headers).await;
    }
    if path.starts_with("/_next/static/") {
        return next_static_missing(state);
    }
    let target = uri
        .path_and_query()
        .map_or("/", PathAndQuery::as_str)
        .to_owned();
    let routed = rewritten(&path).unwrap_or_else(|| path.clone());
    let Some(route) = next_routes::find(&routed) else {
        return not_found::response(state, Variant::Global, &path, &target);
    };
    let first = routed.split('/').nth(1).unwrap_or_default();
    if route.under_locale() && !SEO_CONTENT_LOCALES.contains(&first) {
        let prerendered = route.path == "/[locale]";
        return not_found::response(state, Variant::Locale { prerendered }, &path, &target);
    }
    let mut headers = HeaderMap::new();
    if next_rules::proxy_matches(&path) {
        let language = retired::content_language(&path, uri.query());
        headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static(language));
    }
    let method = method.as_str();
    if route.path == "/api/auth/[...all]" && route.allows(method) {
        // better-auth's own answer, when it needs no endpoint (C3-3).
        if let Some(answer) =
            crate::routes::better_auth::unrouted(state, method, &path, &request_headers)
        {
            // A route handler's answer: Next's headers, the body chunked.
            let (mut parts, body) = answer.into_parts();
            parts.headers.extend(headers);
            state.native_headers.apply(&mut parts.headers);
            return Response::from_parts(parts, chunked(body));
        }
    }
    match route.kind {
        Kind::Page if reading => not_ported(state, headers, &route.path),
        // Next answers 400 with no body.
        Kind::Page if method == "OPTIONS" => {
            routed_answer(state, headers, StatusCode::BAD_REQUEST, "")
        }
        // Next renders the page for any method; no native page does.
        Kind::Page => {
            headers.insert(ALLOW, HeaderValue::from_static("GET, HEAD"));
            routed_answer(state, headers, StatusCode::METHOD_NOT_ALLOWED, "")
        }
        Kind::Route if route.allows(method) => not_ported(state, headers, &route.path),
        Kind::Route if route.is_static => {
            headers.append(ALLOW, HeaderValue::from_static("GET"));
            headers.append(ALLOW, HeaderValue::from_static("HEAD"));
            if let Some(cache) = next_rules::config_cache_control(&path) {
                headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache));
            }
            routed_answer(
                state,
                headers,
                StatusCode::METHOD_NOT_ALLOWED,
                "Method Not Allowed",
            )
        }
        Kind::Route if method == "OPTIONS" => {
            let mut allowed: Vec<&str> = route.methods.iter().map(String::as_str).collect();
            if allowed.contains(&"GET") {
                allowed.push("HEAD");
            }
            allowed.push("OPTIONS");
            allowed.sort_unstable();
            allowed.dedup();
            if let Ok(value) = HeaderValue::from_str(&allowed.join(", ")) {
                headers.insert(ALLOW, value);
            }
            routed_answer(state, headers, StatusCode::NO_CONTENT, "")
        }
        Kind::Route => routed_answer(state, headers, StatusCode::METHOD_NOT_ALLOWED, ""),
    }
}

/// The `next.config.ts` rewrites that run after the files:
/// `/{locale}/rankings` and `/ar/opengraph-image/*`.
fn rewritten(path: &str) -> Option<String> {
    let lower = path.to_ascii_lowercase();
    let parts: Vec<&str> = lower.trim_end_matches('/').split('/').skip(1).collect();
    match parts.as_slice() {
        [locale, "rankings"] if RANKING_LOCALES.contains(locale) => {
            Some(format!("/locale-rankings/{locale}"))
        }
        ["ar", "opengraph-image", ..] => Some("/ar".to_owned()),
        _ => None,
    }
}

/// Next sends these chunked: a body of no known size, so no `Content-Length`
/// (none on a `HEAD` either).
pub(crate) fn chunked(body: impl Into<Body>) -> Body {
    Body::from_stream(body.into().into_data_stream())
}

fn respond(status: StatusCode, headers: HeaderMap, body: impl Into<Body>) -> Response {
    let mut response = Response::new(chunked(body));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

/// An answer of Next's router: the `next.config.ts` headers and its `Vary`.
fn routed_answer(
    state: &AppState,
    mut headers: HeaderMap,
    status: StatusCode,
    body: &'static str,
) -> Response {
    headers.insert(VARY, HeaderValue::from_static(ROUTER_VARY));
    state.native_headers.apply_config(&mut headers);
    respond(status, headers, body)
}

/// A Next route no native route replaces yet: a cutover blocker.
fn not_ported(state: &AppState, mut headers: HeaderMap, route: &str) -> Response {
    if let Ok(value) = HeaderValue::from_str(route) {
        headers.insert(NOT_PORTED_HEADER, value);
    }
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(NO_STORE));
    state.native_headers.apply_config(&mut headers);
    respond(
        StatusCode::NOT_IMPLEMENTED,
        headers,
        format!("Not ported to Axum: {route}\n"),
    )
}

/// Next's answer for a build file it does not have.
fn next_static_missing(state: &AppState) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(NO_STORE));
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
    state.native_headers.apply_config(&mut headers);
    respond(StatusCode::NOT_FOUND, headers, "Not Found")
}

/// `/sw.js`: `worker.js`, with the headers Next gave its own worker file.
fn worker(state: &AppState) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("public, max-age=0"));
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/javascript; charset=UTF-8"),
    );
    headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
    state.native_headers.apply_config(&mut headers);
    respond(StatusCode::OK, headers, WORKER)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rankings_and_the_arabic_card_are_rewritten() {
        assert_eq!(
            rewritten("/en/rankings"),
            Some("/locale-rankings/en".to_owned())
        );
        assert_eq!(
            rewritten("/AR/rankings"),
            Some("/locale-rankings/ar".to_owned())
        );
        assert_eq!(rewritten("/ko/rankings"), None);
        assert_eq!(rewritten("/ar/opengraph-image/x"), Some("/ar".to_owned()));
        assert_eq!(rewritten("/ar/opengraph-image"), Some("/ar".to_owned()));
        assert_eq!(rewritten("/rankings"), None);
    }

    #[test]
    fn dot_segments_are_resolved_like_new_url() {
        let resolve = |target: &str| {
            let mut request = Request::builder().uri(target).body(Body::empty()).unwrap();
            resolve_dot_segments(&mut request);
            request.uri().to_string()
        };
        assert_eq!(resolve("/icons/../ads.txt"), "/ads.txt");
        assert_eq!(resolve("/a/./b?x=../y"), "/a/b?x=../y");
        assert_eq!(resolve("/a/%2e%2E/b"), "/b");
        assert_eq!(resolve("/a/b..c"), "/a/b..c");
    }
}
