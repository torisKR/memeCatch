//! `GET /auth/callback` (`app/auth/callback/route.ts`), route id
//! `auth-callback`. Where OAuth sign-ins come back to (the login form sends
//! `callbackURL: /auth/callback?next=...`), and the target of old reset
//! links.
//!
//! In the handler's order: `createClient()` reads the session
//! (`currentSession`, so `getSession` with its refresh and its cookie
//! deletions, any failure read as signed out); a non-empty `code` goes to
//! `/login?error=auth` (the code exchange always fails under better-auth);
//! otherwise `getUser()` reads the session again when the first read found
//! none, and a user goes to `next`, anyone else to `/login?error=auth`.
//! Both answers are 307 with an absolute `Location` on `SITE_URL`. The
//! cookies `getSession` set are on the answer as Next writes them
//! (`next_compat::CookieStore`).
//!
//! A request with the `RSC` header goes to Next, which answers it with a
//! redirect to an `_rsc` URL before the handler runs; only Next's client
//! router sends one.

use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{LOCATION, SET_COOKIE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

use super::BetterAuth;
use super::cookies::SetCookies;
use super::session::{self, Failure};
use crate::auth::{cookie_header, now_ms};
use crate::routes::next_compat::{CookieStore, safe_next};
use crate::AppState;

pub async fn callback(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let (code, raw_next) = params(request.uri().query());
    // `rawNext === "/reset-password" ? rawNext : safeNext(rawNext)`
    let next = match raw_next.as_deref() {
        Some("/reset-password") => "/reset-password".to_owned(),
        other => safe_next(other),
    };
    let header = cookie_header(request.headers());
    let mut store = CookieStore::default();
    let signed_in = read(&state, &auth, header.as_deref(), &mut store).await
        || (code.is_none() && read(&state, &auth, header.as_deref(), &mut store).await);
    let target = if code.is_none() && signed_in {
        next
    } else {
        "/login?error=auth".to_owned()
    };
    redirect(&format!("{}{target}", auth.site_url), store.lines(now_ms()))
}

/// `searchParams.get("code")` when not empty (the handler tests its
/// truthiness), and `searchParams.get("next")`.
fn params(query: Option<&str>) -> (Option<String>, Option<String>) {
    let mut code = None;
    let mut next = None;
    for (key, value) in url::form_urlencoded::parse(query.unwrap_or("").as_bytes()) {
        match key.as_ref() {
            "code" if code.is_none() => code = Some(value.into_owned()),
            "next" if next.is_none() => next = Some(value.into_owned()),
            _ => {}
        }
    }
    (code.filter(|code| !code.is_empty()), next)
}

/// `currentSession().catch(() => null)`: whether a user came back. The
/// cookies `getSession` set reach Next's `cookies()` unless the database
/// failed before it answered.
async fn read(
    state: &AppState,
    auth: &BetterAuth,
    header: Option<&str>,
    store: &mut CookieStore,
) -> bool {
    let mut set = SetCookies::default();
    match session::current(state, auth, header, &mut set).await {
        Ok(found) => {
            store.take(set.into_lines());
            found.is_some()
        }
        Err(Failure::Unauthorized) => {
            store.take(set.into_lines());
            false
        }
        Err(Failure::Database(error)) => {
            tracing::warn!(%error, "auth callback: session lookup failed");
            false
        }
    }
}

/// `NextResponse.redirect(url)`: 307, no body.
fn redirect(location: &str, cookies: Vec<String>) -> Response {
    let Ok(location) = HeaderValue::from_str(location) else {
        // `safeNext` returns a serialized URL, so this is unreachable.
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let mut response = Response::new(Body::empty());
    *response.status_mut() = StatusCode::TEMPORARY_REDIRECT;
    let headers = response.headers_mut();
    headers.insert(LOCATION, location);
    for line in cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            headers.append(SET_COOKIE, value);
        }
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_query_is_read_as_url_search_params_reads_it() {
        assert_eq!(params(None), (None, None));
        assert_eq!(params(Some("code=")), (None, None));
        assert_eq!(
            params(Some("code=a&code=b&next=%2Fmy+x&next=%2Fz")),
            (Some("a".into()), Some("/my x".into()))
        );
        assert_eq!(params(Some("next=")), (None, Some(String::new())));
    }
}
