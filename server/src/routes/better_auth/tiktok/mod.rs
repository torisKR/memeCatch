//! TikTok login (docs/axum-migration/PLAN.md, A4): `GET /auth/tiktok`
//! (app/auth/tiktok/route.ts) and `GET /auth/tiktok/callback`
//! (app/auth/tiktok/callback/route.ts), under one route id (`auth-tiktok`):
//! the state, `next` and `import` cookies are the same bytes on both servers,
//! so a login started on either is finished on either.
//!
//! These are Next route handlers, not better-auth endpoints. What they call
//! of better-auth (`signUpEmail`, `getSession`, `signInEmail`, `signOut`)
//! runs here as A1 and A2 run it, and the cookies those calls set reach the
//! answer as Next's `cookies()` hands them on (`next.rs`).
//!
//! Handed to Next as they came: methods other than `GET`, `HEAD`, an `RSC`
//! request, a request target with a byte outside ASCII, the `www` host
//! (`proxy.ts` moves the start to the apex), and every request when the
//! site URL is not a URL (`getTikTokRedirectUri` throws, Next answers 500).
//!
//! On purpose unlike Next (PLAN.md A4-2): `Location` is the path, query and
//! fragment the handler built. Next sends them on its own listen address
//! (`http://localhost:3000`, and `https://0.0.0.0:3000` as the image runs),
//! which is no address a browser can reach.

mod flow;
mod next;
pub mod provider;

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::header::{HeaderValue, LOCATION, SET_COOKIE};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

use self::next::{CookieStore, FLOW_COOKIES};
use self::provider::RedirectUri;
use super::BetterAuth;
use crate::auth::now_ms;
use crate::routes::request::{first_param, query_pairs};
use crate::AppState;

const AUTHORIZE: &str = "https://www.tiktok.com/v2/auth/authorize/";
/// Where a `Location` that would leave the site goes instead.
const FALLBACK: &str = "/login?error=auth&next=%2F";

/// `getTikTokRedirectUri` throws on a site URL that is no URL: 500.
fn redirect_uri_throws(auth: &BetterAuth) -> Option<Response> {
    (auth.tiktok.redirect_uri == RedirectUri::Throws)
        .then(|| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// `GET /auth/tiktok`.
pub async fn start(state: State<AppState>, auth: Arc<BetterAuth>, request: Request) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    if let Some(refused) = redirect_uri_throws(&auth) {
        return refused;
    }
    let query = query_pairs(request.uri());
    let next = next::safe_next(first_param(&query, "next"));
    let import = first_param(&query, "import") == Some("1");
    let (Some(client_key), RedirectUri::Set(redirect_uri)) =
        (&auth.tiktok.client_key, &auth.tiktok.redirect_uri)
    else {
        return redirect(&auth, &next::login_error(&next), Vec::new());
    };
    let mut random = [0u8; 32];
    rand::Rng::fill_bytes(&mut rand::rng(), &mut random);
    let oauth_state = URL_SAFE_NO_PAD.encode(random);
    let scope = if import {
        "user.info.basic,video.list"
    } else {
        "user.info.basic"
    };
    let authorize = format!(
        "{AUTHORIZE}?{}",
        url::form_urlencoded::Serializer::new(String::new())
            .append_pair("client_key", client_key)
            .append_pair("scope", scope)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", redirect_uri)
            .append_pair("state", &oauth_state)
            .finish()
    );
    let secure = state.config.use_secure_cookies;
    let now = now_ms();
    let values = [
        oauth_state.as_str(),
        next.as_str(),
        if import { "1" } else { "" },
    ];
    let cookies = FLOW_COOKIES
        .iter()
        .zip(values)
        .map(|(name, value)| next::flow_cookie(name, value, secure, now))
        .collect();
    found(&authorize, cookies)
}

/// `GET /auth/tiktok/callback`.
pub async fn callback(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    if let Some(refused) = redirect_uri_throws(&auth) {
        return refused;
    }
    let headers = request.headers();
    let query = query_pairs(request.uri());
    let expected = next::request_cookie(headers, FLOW_COOKIES[0]);
    let returned = first_param(&query, "state");
    let code = first_param(&query, "code").filter(|code| !code.is_empty());
    let next = next::safe_next(next::request_cookie(headers, FLOW_COOKIES[1]).as_deref());
    let import = next::request_cookie(headers, FLOW_COOKIES[2]).as_deref() == Some("1");
    let valid_state = is_valid_state(expected.as_deref(), returned);
    let has_error = query.iter().any(|(key, _)| key == "error");
    let now = now_ms();
    let mut store = CookieStore::default();
    let mut location = next::login_error(&next);
    if let (true, Some(code), RedirectUri::Set(redirect_uri), false) =
        (valid_state, code, &auth.tiktok.redirect_uri, has_error)
    {
        let signed_in =
            flow::sign_in_with_code(&state, &auth, headers, code, redirect_uri, &mut store, now)
                .await;
        if let Ok(session) = signed_in {
            let outcome = if !import {
                None
            } else if !session.scopes.iter().any(|scope| scope == "video.list") {
                Some((true, None))
            } else {
                Some(match import_videos(&state, &auth, &session).await {
                    Ok(count) => (false, Some(count)),
                    Err(()) => (true, None),
                })
            };
            location = next::signed_in(&next, outcome);
        }
    }
    redirect(&auth, &location, store.callback_lines(now))
}

/// `isValidTikTokOAuthState`: both set and the same bytes, compared in
/// constant time once the lengths match (`timingSafeEqual`).
fn is_valid_state(expected: Option<&str>, returned: Option<&str>) -> bool {
    let (Some(expected), Some(returned)) = (expected, returned) else {
        return false;
    };
    let (expected, returned) = (expected.as_bytes(), returned.as_bytes());
    !expected.is_empty()
        && expected.len() == returned.len()
        && expected
            .iter()
            .zip(returned)
            .fold(0u8, |diff, (a, b)| diff | (a ^ b))
            == 0
}

/// `importTikTokVideosAsSubmissions(session)`.
async fn import_videos(
    state: &AppState,
    auth: &BetterAuth,
    session: &flow::SignedIn,
) -> Result<usize, ()> {
    let videos = auth.tiktok.videos(&session.access_token).await?;
    flow::import_videos(&state.db, &session.user_id, videos).await
}

/// A redirect on the site: A3-12's guard, so that whatever the handler
/// built, the browser does not leave the site.
fn redirect(auth: &BetterAuth, location: &str, cookies: Vec<String>) -> Response {
    let site = url::Url::parse(&auth.site_url).map(|site| site.origin().ascii_serialization());
    let on_site = location.starts_with('/')
        && site.is_ok_and(|site| {
            super::oauth::callback::resolves_to_trusted(
                location,
                &site,
                std::slice::from_ref(&site),
            )
        });
    found(if on_site { location } else { FALLBACK }, cookies)
}

/// `NextResponse.redirect(url)`: 307, no body.
fn found(location: &str, cookies: Vec<String>) -> Response {
    let Ok(location) = HeaderValue::try_from(location) else {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    };
    let mut response = StatusCode::TEMPORARY_REDIRECT.into_response();
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
    fn a_state_is_valid_only_when_both_are_set_and_equal() {
        assert!(is_valid_state(Some("abc"), Some("abc")));
        for (expected, returned) in [
            (None, Some("abc")),
            (Some("abc"), None),
            (Some(""), Some("")),
            (Some("abc"), Some("abd")),
            (Some("abc"), Some("abcd")),
            (Some("밈"), Some("abc")),
        ] {
            assert!(
                !is_valid_state(expected, returned),
                "{expected:?} {returned:?}"
            );
        }
    }
}
