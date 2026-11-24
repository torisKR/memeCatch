//! The redirects made before any route runs, in this order:
//!
//! 1. a path with `//` or `\` goes to the cleaned path (308);
//! 2. the site's redirects (`lib/retired-product-redirects.ts`), matched
//!    without regard to case, never for `/_next/*` (308);
//! 3. the www host to the apex (301) and the landing locale of `/` (302).
//!
//! 1 and 2 carry `Location`, `Refresh` and the location as body, nothing
//! else; 3 carries the site's headers.

use axum::http::header::{CACHE_CONTROL, COOKIE, HOST, LOCATION, REFRESH};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::Response;

use crate::headers::NativeRouteHeaders;
use crate::next_rules;

// SEO_CONTENT_LOCALES in lib/i18n-routing.ts.
pub const SEO_CONTENT_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
const WWW_HOST: &str = "www.catchmeme.com";
const APEX_ORIGIN: &str = "https://catchmeme.com";
const WWW_KEEP_PREFIXES: [&str; 3] = ["/api", "/auth/callback", "/auth/tiktok/callback"];
const LOCALE_COOKIE: &str = "memecatch_locale";

/// `target`: the request's path and query as received.
pub fn before_proxy(target: &str) -> Option<Response> {
    let (path, query) = split(target);
    if path.contains("//") || path.contains('\\') {
        let clean = collapse_slashes(&path.replace('\\', "/"));
        return Some(next_redirect(&with_query(&clean, query)));
    }
    config_redirect(path).map(|location| next_redirect(&with_query(&location, query)))
}

/// What `proxy.ts` redirects before it looks at the route.
pub fn proxy(
    headers: &NativeRouteHeaders,
    method: &Method,
    request: &HeaderMap,
    target: &str,
) -> Option<Response> {
    let (path, query) = split(target);
    // proxy.ts runs for the first matcher's paths, or for the second's when
    // the raw `Host` matches its (case-sensitive) pattern.
    let runs = next_rules::proxy_matches(path) || www_matcher(request, path);
    if runs && is_www(request) && (method == Method::GET || method == Method::HEAD) {
        let kept = WWW_KEEP_PREFIXES.iter().any(|prefix| {
            path.strip_prefix(prefix)
                .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
        });
        if !kept {
            let location = format!("{APEX_ORIGIN}{}", with_query(path, query));
            let mut response = proxy_redirect(headers, StatusCode::MOVED_PERMANENTLY, &location);
            // `headers()` applies to proxy.ts's answers too.
            if let Some(cache) = next_rules::config_cache_control(path) {
                response
                    .headers_mut()
                    .insert(CACHE_CONTROL, HeaderValue::from_static(cache));
            }
            return Some(response);
        }
    }
    if path == "/"
        && let Some(locale) = locale_cookie(request)
    {
        let location = with_query(&format!("/{locale}"), query);
        return Some(proxy_redirect(headers, StatusCode::FOUND, &location));
    }
    None
}

fn split(target: &str) -> (&str, Option<&str>) {
    match target.split_once('?') {
        Some((path, query)) => (path, Some(query)),
        None => (target, None),
    }
}

fn with_query(path: &str, query: Option<&str>) -> String {
    match query {
        Some(query) if !query.is_empty() => format!("{path}?{query}"),
        _ => path.to_owned(),
    }
}

fn collapse_slashes(path: &str) -> String {
    let mut clean = String::with_capacity(path.len());
    for character in path.chars() {
        if !(character == '/' && clean.ends_with('/')) {
            clean.push(character);
        }
    }
    clean
}

/// The destination of the first `redirects()` entry that matches, or `None`.
fn config_redirect(path: &str) -> Option<String> {
    let lower = path.to_ascii_lowercase();
    if lower.starts_with("/_next") {
        return None;
    }
    // `(?:/)?$`: every source also takes one trailing slash.
    let bare = lower
        .strip_suffix('/')
        .filter(|bare| !bare.is_empty())
        .unwrap_or(&lower);
    let under = |prefix: &str| {
        bare.strip_prefix(prefix)
            .is_some_and(|rest| rest.starts_with('/'))
    };
    if bare == "/en/products" || under("/en/products") {
        return Some("/en".to_owned());
    }
    if ["/pricing", "/premium", "/daily"].contains(&bare) || under("/premium") {
        return Some("/".to_owned());
    }
    // `/:locale(en|ja|zh|zh-tw)/(pricing|daily)`: the destination keeps the
    // segment as written.
    let mut parts = bare.splitn(3, '/').skip(1);
    if let (Some(locale), Some(page), None) = (parts.next(), parts.next(), parts.next())
        && SEO_CONTENT_LOCALES.contains(&locale)
        && (page == "pricing" || page == "daily")
    {
        return Some(format!("/{}", &path[1..=locale.len()]));
    }
    // DEFAULT_TRAILING_SLASH_REDIRECT: `/:path+/`, one slash per hop.
    if path.len() > 1 && path.ends_with('/') {
        return Some(path[..path.len() - 1].to_owned());
    }
    None
}

fn next_redirect(location: &str) -> Response {
    let mut response = Response::new(super::chunked(location.to_owned()));
    *response.status_mut() = StatusCode::PERMANENT_REDIRECT;
    if let (Ok(value), Ok(refresh)) = (
        HeaderValue::from_str(location),
        HeaderValue::from_str(&format!("0;url={location}")),
    ) {
        response.headers_mut().insert(LOCATION, value);
        response.headers_mut().insert(REFRESH, refresh);
    }
    response
}

fn proxy_redirect(headers: &NativeRouteHeaders, status: StatusCode, location: &str) -> Response {
    let mut response = Response::new(super::chunked(location.to_owned()));
    *response.status_mut() = status;
    if let Ok(value) = HeaderValue::from_str(location) {
        response.headers_mut().insert(LOCATION, value);
    }
    headers.apply_config(response.headers_mut());
    response
}

/// The second `proxy.ts` matcher: `has` host `www\.catchmeme\.com(?::\d+)?`
/// (as written, case included), for every path but `/api/` and the callbacks.
fn www_matcher(request: &HeaderMap, path: &str) -> bool {
    let host_matches = request
        .get(HOST)
        .and_then(|host| host.to_str().ok())
        .and_then(|host| host.strip_prefix(WWW_HOST))
        .is_some_and(|port| {
            port.is_empty()
                || port.strip_prefix(':').is_some_and(|digits| {
                    !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit())
                })
        });
    let rest = path.strip_prefix('/').unwrap_or(path);
    let skipped = ["api/", "auth/callback", "auth/tiktok/callback"]
        .iter()
        .any(|prefix| rest.starts_with(prefix));
    host_matches && !skipped
}

/// `wwwApexRedirect`: the `Host` header, lowercased, without its port.
fn is_www(request: &HeaderMap) -> bool {
    request
        .get(HOST)
        .and_then(|host| host.to_str().ok())
        .map(|host| host.to_ascii_lowercase())
        .is_some_and(|host| host.split(':').next() == Some(WWW_HOST))
}

/// `resolveLandingRedirectLocale`: the cookie, when it names an SEO locale.
fn locale_cookie(request: &HeaderMap) -> Option<&'static str> {
    let value = request
        .get_all(COOKIE)
        .iter()
        .filter_map(|header| header.to_str().ok())
        .flat_map(|header| header.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(name, _)| *name == LOCALE_COOKIE)
        .map(|(_, value)| value.trim())?;
    SEO_CONTENT_LOCALES
        .iter()
        .copied()
        .find(|locale| *locale == value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn location(target: &str) -> Option<(u16, String)> {
        before_proxy(target).map(|response| {
            let location = response.headers()[LOCATION].to_str().unwrap().to_owned();
            (response.status().as_u16(), location)
        })
    }

    #[test]
    fn config_redirects_match_next_build() {
        let to = |target: &str, expected: &str| {
            assert_eq!(
                location(target),
                Some((308, expected.to_owned())),
                "{target}"
            );
        };
        to("/about/", "/about");
        to("/about/?x=1", "/about?x=1");
        to("/pricing", "/");
        to("/PRICING", "/");
        to("/pricing/?x=1", "/?x=1");
        to("/premium/a/b/", "/");
        to("/daily", "/");
        to("/en/products", "/en");
        to("/En/Products", "/en");
        to("/en/products/x/", "/en");
        to("/en/daily?z=2", "/en?z=2");
        to("/zh-tw/pricing", "/zh-tw");
        to("//about", "/about");
        to("/about//x?q=a//b", "/about/x?q=a//b");
        to("/a\\b", "/a/b");
        assert_eq!(location("/about"), None);
        assert_eq!(location("/_next/x/"), None);
        assert_eq!(location("/"), None);
        assert_eq!(location("/ko/pricing"), None);
        assert_eq!(location("/en/pricingx"), None);
    }
}
