//! The sign-in gate of `proxy.ts` (lines 356-397): `/my*` and `/submit*`
//! need a session, `/admin*` a session whose user `is_operator()`. Without
//! one the answer is a 307 to `/login?next=<path>`; a signed-in user who is
//! not an operator goes to `/`. A database error counts as signed out.
//!
//! `/{en,ja,zh,zh-tw}/...` is gated as the path without its prefix, and
//! `next` carries that path: `/en/my` returns to `/my`.

use axum::http::header::{CONTENT_LANGUAGE, LOCATION};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::Response;

use super::redirects::SEO_CONTENT_LOCALES;
use crate::AppState;
use crate::auth::{is_operator, resolve_session};
use crate::pages::retired;

const QUERY_MAX: usize = 200;
const NAME_MAX: usize = 100;
const RETURN_KEYS: [&str; 4] = ["focus", "q", "status", "origin"];
const STATUS_VALUES: [&str; 6] = [
    "pending",
    "fact_checking",
    "rights_checking",
    "approved",
    "limited",
    "rejected",
];

/// The gate's redirect for `path` (as received), or `None` to go on.
pub async fn check(
    state: &AppState,
    headers: &HeaderMap,
    path: &str,
    query: Option<&str>,
) -> Option<Response> {
    let path_in_locale = without_locale(path);
    let gated = path_in_locale.starts_with("/my") || path_in_locale.starts_with("/submit");
    let admin = path_in_locale.starts_with("/admin");
    // The retired product decision comes first in proxy.ts (`/admin/creator-products`).
    if !(gated || admin) || retired::decision(path).is_some() {
        return None;
    }
    let user = resolve_session(state, headers).await.ok().flatten();
    let location = match &user {
        None => login_location(path_in_locale, query),
        Some(user) if admin => match is_operator(state, user).await {
            Ok(true) => return None,
            _ => "/".to_owned(),
        },
        Some(_) => return None,
    };
    let mut response = Response::new(super::chunked(location.clone()));
    *response.status_mut() = StatusCode::TEMPORARY_REDIRECT;
    let out = response.headers_mut();
    out.insert(LOCATION, HeaderValue::from_str(&location).ok()?);
    let language = retired::content_language(path, query);
    out.insert(CONTENT_LANGUAGE, HeaderValue::from_static(language));
    state.native_headers.apply_config(out);
    Some(response)
}

/// `pathWithoutLocalePrefix` for an SEO content locale.
fn without_locale(path: &str) -> &str {
    for locale in SEO_CONTENT_LOCALES {
        if let Some(rest) = path
            .strip_prefix('/')
            .and_then(|rest| rest.strip_prefix(locale))
        {
            if rest.is_empty() {
                return "/";
            }
            if rest.starts_with('/') {
                return rest;
            }
        }
    }
    path
}

/// `/login?next=<buildAuthReturnPath>` as `URLSearchParams` writes it.
fn login_location(path: &str, query: Option<&str>) -> String {
    let return_path = if path.starts_with("/admin") || path == "/submit" {
        with_allowlisted_search(path, query.unwrap_or(""))
    } else {
        path.to_owned()
    };
    let next = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("next", &return_path)
        .finish();
    format!("/login?{next}")
}

/// `withAllowlistedSearch` in lib/safe-redirect.ts.
fn with_allowlisted_search(path: &str, query: &str) -> String {
    let params: Vec<(String, String)> = url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect();
    let keys: &[&str] = if path == "/submit" {
        &["name"]
    } else {
        &RETURN_KEYS
    };
    let mut kept = url::form_urlencoded::Serializer::new(String::new());
    let mut any = false;
    for key in keys {
        let values: Vec<&str> = params
            .iter()
            .filter(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
            .collect();
        if let [value] = values.as_slice()
            && allowed(key, value)
        {
            kept.append_pair(key, value);
            any = true;
        }
    }
    if any {
        format!("{path}?{}", kept.finish())
    } else {
        path.to_owned()
    }
}

/// `isAllowedAuthReturnValue`. Lengths are JavaScript's (UTF-16 units).
fn allowed(key: &str, value: &str) -> bool {
    if value.is_empty() || value.chars().any(|c| c <= '\u{1f}' || c == '\u{7f}') {
        return false;
    }
    let length = value.encode_utf16().count();
    match key {
        "focus" => value == "unsourced",
        "q" => length <= QUERY_MAX,
        "name" => length <= NAME_MAX,
        "status" => STATUS_VALUES.contains(&value),
        "origin" => value == "house_original",
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_return_path_keeps_only_allowlisted_queries() {
        assert_eq!(login_location("/my", Some("x=1")), "/login?next=%2Fmy");
        assert_eq!(
            login_location("/submit", Some("x=1")),
            "/login?next=%2Fsubmit"
        );
        assert_eq!(
            login_location("/submit", Some("name=a b")),
            "/login?next=%2Fsubmit%3Fname%3Da%2Bb"
        );
        assert_eq!(
            login_location("/admin/memes", Some("status=pending&q=x&q=y&focus=other")),
            "/login?next=%2Fadmin%2Fmemes%3Fstatus%3Dpending"
        );
        assert_eq!(
            login_location("/submit/x", Some("name=a")),
            "/login?next=%2Fsubmit%2Fx"
        );
    }

    #[test]
    fn a_locale_prefix_is_dropped_for_the_seo_locales_only() {
        assert_eq!(without_locale("/en/my"), "/my");
        assert_eq!(without_locale("/zh-tw/admin/x"), "/admin/x");
        assert_eq!(without_locale("/en"), "/");
        assert_eq!(without_locale("/ko/my"), "/ko/my");
        assert_eq!(without_locale("/enx/my"), "/enx/my");
    }
}
