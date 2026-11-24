//! The operator screens under `/admin` (`app/(default)/admin/**` and
//! `app/(admin)/admin/**`), each under its own page route id, off until
//! `AXUM_PILOT_ROUTES` names it. Their server actions are native endpoints in
//! `routes/admin`.
//!
//! Every screen first does what `proxy.ts` does for `/admin` before Next
//! renders anything: a visitor without a session goes to
//! `/login?next=<path and allowlisted query>`, and one who is not an
//! operator (or whose check fails) goes to `/`, both with a 307.
//! `requireOperatorPage` then asks again; its redirects are the same.

pub mod activity;
pub mod dashboard;
pub mod format;
pub mod ga4;
pub mod growth;
pub mod publisher_readiness;
pub mod radar_safety;
pub mod shell;
pub mod users;

use axum::http::header::{CONTENT_LANGUAGE, LOCATION};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use maud::Markup;

use self::shell::Root;
use crate::AppState;
use crate::auth::{self, SessionUser};
use crate::headers::AnsweredBeforeRouting;
use crate::routes::Routes;
use crate::routes::public::js;

/// Adds every operator screen to the page routes.
pub fn routes(routes: Routes<'_>) -> Routes<'_> {
    routes
        .add("page-admin", "/admin", get(dashboard::page))
        .add(
            "page-admin-analytics",
            "/admin/analytics",
            get(dashboard::analytics),
        )
        .add(
            "page-admin-activity",
            "/admin/activity",
            get(activity::page),
        )
        .add("page-admin-growth", "/admin/growth", get(growth::page))
        .add(
            "page-admin-publisher-readiness",
            "/admin/publisher-readiness",
            get(publisher_readiness::page),
        )
        .add(
            "page-admin-radar-safety",
            "/admin/radar-safety",
            get(radar_safety::page),
        )
        .add("page-admin-users", "/admin/users", get(users::list))
        .add("page-admin-user", "/admin/users/{id}", get(users::detail))
}

/// `AUTH_RETURN_QUERY_KEYS` of lib/safe-redirect.ts, in its order.
const RETURN_KEYS: [&str; 4] = ["focus", "q", "status", "origin"];
const RETURN_STATUSES: [&str; 6] = [
    "pending",
    "fact_checking",
    "rights_checking",
    "approved",
    "limited",
    "rejected",
];
const RETURN_Q_MAX: usize = 200;

/// `isAllowedAuthReturnValue` for the keys of an `/admin` path.
fn allowed_return_value(key: &str, value: &str) -> bool {
    if value.is_empty() || value.chars().any(|c| c <= '\u{1f}' || c == '\u{7f}') {
        return false;
    }
    match key {
        "focus" => value == "unsourced",
        "q" => js::utf16_len(value) <= RETURN_Q_MAX,
        "status" => RETURN_STATUSES.contains(&value),
        "origin" => value == "house_original",
        _ => false,
    }
}

/// `withAllowlistedSearch(path, searchParams)`: the path with only the
/// allowlisted keys that appear once with an allowed value.
pub fn allowlisted_return(path: &str, query: Option<&str>) -> String {
    if !path.starts_with('/') || path.starts_with("//") || path.contains('?') {
        return path.to_owned();
    }
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    let mut kept = url::form_urlencoded::Serializer::new(String::new());
    let mut any = false;
    for key in RETURN_KEYS {
        let values: Vec<&str> = pairs
            .iter()
            .filter(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
            .collect();
        if let [value] = values[..]
            && allowed_return_value(key, value)
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

/// A 307 from `proxy.ts` (`applyLocale(NextResponse.redirect(url))`): the
/// body is the location, and the router's `Vary` is not sent.
fn redirect(location: &str) -> Response {
    let mut response = (StatusCode::TEMPORARY_REDIRECT, location.to_owned()).into_response();
    response.extensions_mut().insert(AnsweredBeforeRouting);
    let headers = response.headers_mut();
    headers.remove(axum::http::header::CONTENT_TYPE);
    headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    if let Ok(value) = HeaderValue::from_str(location) {
        headers.insert(LOCATION, value);
    }
    response
}

/// The `/login?next=` address for `path` and its query.
pub fn login_location(path: &str, query: Option<&str>) -> String {
    let next = allowlisted_return(path, query);
    let mut search = url::form_urlencoded::Serializer::new(String::new());
    search.append_pair("next", &next);
    format!("/login?{}", search.finish())
}

/// The `/admin` gate of `proxy.ts`: the operator, or the redirect to send.
pub async fn require_operator(
    state: &AppState,
    headers: &HeaderMap,
    path: &str,
    query: Option<&str>,
) -> Result<SessionUser, Response> {
    let user = match auth::resolve_session(state, headers).await {
        Ok(Some(user)) => user,
        // `authFailed || !user`.
        Ok(None) => return Err(redirect(&login_location(path, query))),
        Err(error) => {
            tracing::warn!(%error, "session lookup failed");
            return Err(redirect(&login_location(path, query)));
        }
    };
    match auth::is_operator(state, &user).await {
        Ok(true) => Ok(user),
        Ok(false) => Err(redirect("/")),
        Err(error) => {
            tracing::warn!(%error, "operator check failed");
            Err(redirect("/"))
        }
    }
}

/// A rendered screen with the headers Next sends on a page it renders on
/// request.
pub fn screen(state: &AppState, root: Root, title: &str, pathname: &str, main: Markup) -> Response {
    super::html(
        StatusCode::OK,
        shell::document(&state.pages.site, root, title, pathname, main),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_return_path_keeps_only_allowlisted_single_values() {
        assert_eq!(
            login_location("/admin/activity", Some("q=1&focus=x&zz=2")),
            "/login?next=%2Fadmin%2Factivity%3Fq%3D1"
        );
        assert_eq!(
            login_location("/admin/users", Some("q=%ED%95%9C&q=2&status=pending")),
            "/login?next=%2Fadmin%2Fusers%3Fstatus%3Dpending"
        );
        assert_eq!(
            allowlisted_return(
                "/admin/sources",
                Some("focus=unsourced&origin=house_original&q=a+b")
            ),
            "/admin/sources?focus=unsourced&q=a+b&origin=house_original"
        );
        assert_eq!(allowlisted_return("/admin", Some("q=")), "/admin");
        assert_eq!(allowlisted_return("/admin", Some("q=%01")), "/admin");
        assert_eq!(
            allowlisted_return("/admin", Some(&format!("q={}", "가".repeat(201)))),
            "/admin"
        );
        assert_eq!(
            allowlisted_return("/admin", Some(&format!("q={}", "가".repeat(200)))),
            format!("/admin?q={}", "%EA%B0%80".repeat(200))
        );
    }
}
