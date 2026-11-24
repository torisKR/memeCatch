//! What runs around the routes: [`before_routing`] wraps the whole router
//! (URL normalisation, the site's redirects and the sign-in gate), and
//! [`answer`] answers a request no route took (`fallback::answer`).

pub mod auth_gate;
pub mod image;
pub mod not_found;
pub mod redirects;

use std::time::Duration;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{ALLOW, CACHE_CONTROL, CONNECTION, CONTENT_LANGUAGE, CONTENT_TYPE, VARY};
use axum::http::uri::PathAndQuery;
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, Uri};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

use self::not_found::Variant;
use crate::{AppState, next_rules, public_files};

const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
const WORKER: &str = include_str!("worker.js");
const API_NOT_FOUND: &str = r#"{"error":"not_found"}"#;
/// The most of an unneeded body [`answer`] reads before it gives up on it.
const DRAIN_LIMIT: usize = 1024 * 1024;
const DRAIN_TIME: Duration = Duration::from_secs(5);

/// The outermost layer, around the whole router.
pub async fn before_routing(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    if !crate::routes::request::has_ascii_target(request.uri()) {
        return bad_target(&state);
    }
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

/// A request target with a byte outside ASCII (a browser percent-encodes
/// those): 400 before any route runs.
fn bad_target(state: &AppState) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/plain; charset=utf-8"),
    );
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(NO_STORE));
    state.native_headers.apply_config(&mut headers);
    respond(StatusCode::BAD_REQUEST, headers, "Bad Request")
}

fn target(request: &Request) -> &str {
    request
        .uri()
        .path_and_query()
        .map_or("/", PathAndQuery::as_str)
}

/// The URL is routed after `.` and `..` segments are resolved as `new URL()`
/// resolves them (`/icons/../ads.txt` is `/ads.txt`), without a redirect.
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

/// The answer for a request no route takes (`fallback::answer`): the service
/// worker, the public files, the image optimizer, better-auth's own answers
/// under `/api/auth/`, and otherwise a 404: JSON under `/api/`, the
/// not-found document elsewhere. The body is read first (up to
/// [`DRAIN_LIMIT`]); one left unread closes the connection.
pub async fn answer(state: &AppState, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let drained = drain(body).await;
    let mut response = unrouted(state, &parts.method, &parts.uri, &parts.headers).await;
    if !drained {
        response
            .headers_mut()
            .insert(CONNECTION, HeaderValue::from_static("close"));
    }
    response
}

/// Reads and drops a body the answer does not need, so the client is not
/// left waiting to send it. False when it was larger than [`DRAIN_LIMIT`],
/// broke off or took longer than [`DRAIN_TIME`].
async fn drain(body: Body) -> bool {
    let read = tokio::time::timeout(DRAIN_TIME, axum::body::to_bytes(body, DRAIN_LIMIT)).await;
    matches!(read, Ok(Ok(_)))
}

async fn unrouted(state: &AppState, method: &Method, uri: &Uri, headers: &HeaderMap) -> Response {
    let path = uri.path();
    let reading = method == Method::GET || method == Method::HEAD;
    if path == "/sw.js" && reading {
        return worker(state);
    }
    if let Some(file) = public_files::serve(state, method, uri, headers).await {
        return file;
    }
    if path == "/_next/image" {
        return image::serve(state, uri, headers).await;
    }
    if path.starts_with("/_next/static/") {
        return next_static_missing(state);
    }
    if path.starts_with("/api/auth/") {
        return auth_unrouted(state, method, path, headers);
    }
    if path == "/api" || path.starts_with("/api/") {
        return api_not_found(state);
    }
    let target = uri.path_and_query().map_or(path, PathAndQuery::as_str);
    // One segment (`/nope`) is the shape of a locale home: the not-found
    // document in the site frame.
    let one_segment = path.len() > 1 && !path[1..].contains('/');
    let variant = if one_segment && reading {
        Variant::Locale { prerendered: true }
    } else {
        Variant::Global
    };
    not_found::response(state, variant, path, target)
}

/// better-auth's router for an endpoint no route here answers: its 404 for
/// an unknown path, its 415 for a body type the endpoint refuses, its rate
/// limit; an endpoint the site never calls is a 404 as well. `GET` and
/// `POST` are its methods.
fn auth_unrouted(state: &AppState, method: &Method, path: &str, headers: &HeaderMap) -> Response {
    if method != Method::GET && method != Method::HEAD && method != Method::POST {
        let mut headers = HeaderMap::new();
        headers.insert(ALLOW, HeaderValue::from_static("GET,HEAD,POST"));
        state.native_headers.apply_config(&mut headers);
        return respond(StatusCode::METHOD_NOT_ALLOWED, headers, "");
    }
    let answer = crate::routes::better_auth::unrouted(state, method.as_str(), path, headers)
        .unwrap_or_else(|| StatusCode::NOT_FOUND.into_response());
    let (mut parts, body) = answer.into_parts();
    state.native_headers.apply(&mut parts.headers);
    Response::from_parts(parts, chunked(body))
}

/// The 404 under `/api/`.
fn api_not_found(state: &AppState) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    state.native_headers.apply_config(&mut headers);
    respond(StatusCode::NOT_FOUND, headers, API_NOT_FOUND)
}

/// Sent chunked: a body of no known size, so no `Content-Length` (none on a
/// `HEAD` either).
pub(crate) fn chunked(body: impl Into<Body>) -> Body {
    Body::from_stream(body.into().into_data_stream())
}

fn respond(status: StatusCode, headers: HeaderMap, body: impl Into<Body>) -> Response {
    let mut response = Response::new(chunked(body));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

/// The answer for a `/_next/static/*` file, of which there are none.
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

/// `/sw.js`: `worker.js`.
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
