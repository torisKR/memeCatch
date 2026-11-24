//! `GET /api/auth/callback/google` and `/callback/kakao`: better-auth's
//! `callbackOAuth` (dist/api/routes/callback.mjs), the provider's redirect
//! back with `code` and `state`, or with `error`.
//!
//! Handed to Next as they came: `POST` (better-auth turns it into a
//! redirect to the `GET`), `HEAD`, an `RSC` request (Next answers it before
//! better-auth), a query naming one of the schema's keys twice (better-call
//! answers 400 before the endpoint), and a state row of a flow this server
//! does not finish (an account link and the like, `state::Refused::ToNext`).
//!
//! The rest is answered here, in better-auth's order: `state_not_found`
//! without a state; the state taken (`state.rs`), refusals to the error page;
//! the provider's `error`; `no_code`; a provider that is not set; the token
//! exchange (`invalid_code`); the profile (`unable_to_get_user_info`); the
//! missing address (`email_not_found`); the user and session (`link.rs`);
//! then a 302 to the flow's URL with the session cookie. Every refusal after
//! the state was read is a 302 to the flow's `errorCallbackURL` or to
//! `<baseURL>/error`, with `error` (and `error_description`) appended.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::header::{CONTENT_TYPE, HeaderValue, LOCATION, SET_COOKIE};
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use hyper::ext::ReasonPhrase;

use super::super::sign_in::{carries_dont_remember, server_error, session_cookies};
use super::super::{BetterAuth, answer};
use super::link::{self, Callback, Failed};
use super::providers::Id;
use super::state::{self, Refused, Stored};
use crate::auth::now_ms;
use crate::{AppState, proxy};

/// The keys of the callback's query schema.
const KEYS: [&str; 7] = [
    "code",
    "error",
    "device_id",
    "error_description",
    "state",
    "user",
    "iss",
];

pub async fn google(state: State<AppState>, auth: Arc<BetterAuth>, request: Request) -> Response {
    callback(state, auth, request, Id::Google).await
}

pub async fn kakao(state: State<AppState>, auth: Arc<BetterAuth>, request: Request) -> Response {
    callback(state, auth, request, Id::Kakao).await
}

/// The query as `URLSearchParams` decodes it. `None` when a key of the
/// schema comes twice: better-call makes it an array, which zod refuses.
fn read_query(query: Option<&str>) -> Option<Vec<(String, String)>> {
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    let twice = KEYS
        .iter()
        .any(|key| pairs.iter().filter(|(name, _)| name == key).count() > 1);
    (!twice).then_some(pairs)
}

fn value<'a>(query: &'a [(String, String)], key: &str) -> Option<&'a str> {
    query
        .iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.as_str())
}

async fn callback(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
    provider_id: Id,
) -> Response {
    if let Some(refused) = super::super::cookie_too_large(request.headers()) {
        return refused;
    }
    let raw_query = request.uri().query().map(str::to_owned);
    let to_next = request.method() != Method::GET
        || request.headers().contains_key("rsc")
        || raw_query.as_deref().is_some_and(|query| !query.is_ascii());
    let query = match read_query(raw_query.as_deref()) {
        Some(query) if !to_next => query,
        _ => return proxy::forward(State(state), request).await,
    };
    let headers = request.headers().clone();
    let headers = &headers;
    let path = format!("/callback/{}", provider_id.as_str());
    if let Some(limited) = auth.limit(headers, &path) {
        return limited;
    }
    let default_error = format!("{}/error", auth.api_base_url);
    let Some(state_param) = value(&query, "state").filter(|state| !state.is_empty()) else {
        tracing::error!("State not found");
        return redirect_error(&default_error, "state_not_found", None, Vec::new());
    };
    let now = now_ms();
    let stored = match state::take(&state.db, &auth, headers, state_param, now).await {
        Ok(Ok(stored)) => stored,
        Ok(Err(Refused::ToNext)) => return proxy::forward(State(state), request).await,
        Ok(Err(Refused::Redirect {
            code,
            error_url,
            expired_cookie,
        })) => {
            tracing::error!(code, "Failed to parse state");
            let cookies = if expired_cookie {
                vec![auth.cookies.expired(&auth.cookies.state)]
            } else {
                Vec::new()
            };
            let to = error_url.unwrap_or_else(|| default_error.clone());
            return redirect_error(&to, code, None, cookies);
        }
        Err(error) => {
            tracing::error!(%error, "Failed to parse state");
            return redirect_error(&default_error, "internal_server_error", None, Vec::new());
        }
    };
    let flow = Flow {
        stored,
        default_error,
        cookies: vec![auth.cookies.expired(&auth.cookies.state)],
    };
    finish(&state, &auth, headers, &query, provider_id, flow, now).await
}

/// What the callback knows once the state is taken.
struct Flow {
    stored: Stored,
    default_error: String,
    /// The `Set-Cookie` lines so far: the expired `state` cookie.
    cookies: Vec<String>,
}

impl Flow {
    /// `redirectOnError(error, description)` of the callback.
    fn refuse(&self, error: &str, description: Option<&str>) -> Response {
        let to = self
            .stored
            .error_url
            .as_deref()
            .unwrap_or(&self.default_error);
        redirect_error(to, error, description, self.cookies.clone())
    }
}

async fn finish(
    state: &AppState,
    auth: &BetterAuth,
    headers: &axum::http::HeaderMap,
    query: &[(String, String)],
    provider_id: Id,
    flow: Flow,
    now: i64,
) -> Response {
    if let Some(error) = value(query, "error").filter(|error| !error.is_empty()) {
        let description = value(query, "error_description").filter(|text| !text.is_empty());
        return flow.refuse(error, description);
    }
    let Some(code) = value(query, "code").filter(|code| !code.is_empty()) else {
        tracing::warn!("Code not found");
        return flow.refuse("no_code", None);
    };
    let Some(provider) = auth.oauth.get(provider_id.as_str()) else {
        tracing::warn!(provider = provider_id.as_str(), "OAuth provider not found");
        return flow.refuse("oauth_provider_not_found", None);
    };
    let client = auth.oauth.client();
    let redirect_uri = format!("{}/callback/{}", auth.api_base_url, provider_id.as_str());
    let Ok(tokens) = provider
        .exchange(client, code, &flow.stored.code_verifier, &redirect_uri, now)
        .await
    else {
        return flow.refuse("invalid_code", None);
    };
    let user = match provider.user_info(client, &tokens).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::error!("Unable to get user info");
            return flow.refuse("unable_to_get_user_info", None);
        }
        Err(_) => return server_error(),
    };
    if flow.stored.callback_url.is_empty() {
        tracing::error!("No callback URL found");
        return flow.refuse("no_callback_url", None);
    }
    let Some(email) = user.email.as_deref().filter(|email| !email.is_empty()) else {
        tracing::error!(
            provider = provider_id.as_str(),
            "Provider did not return an email"
        );
        return flow.refuse("email_not_found", None);
    };
    let callback = Callback {
        provider: provider_id,
        user: &user,
        email,
        tokens: &tokens,
        callback_url: &flow.stored.callback_url,
        headers,
    };
    let signed_in = match link::sign_in(&state.db, auth, &callback, now).await {
        Ok(signed_in) => signed_in,
        Err(Failed::Redirect(error)) => return flow.refuse(error, None),
        Err(Failed::Internal) => {
            return redirect_error(
                &flow.default_error,
                "internal_server_error",
                None,
                flow.cookies.clone(),
            );
        }
        Err(Failed::Blocked) => {
            return answer(
                StatusCode::BAD_REQUEST,
                b"BAD_REQUEST",
                r#"{"message":"blocked email domain"}"#.to_owned(),
                flow.cookies,
                false,
            );
        }
        Err(Failed::Thrown) => return server_error(),
    };
    let dont_remember = carries_dont_remember(auth, headers);
    let mut cookies = flow.cookies.clone();
    cookies.extend(
        session_cookies(auth, headers, &signed_in.session_token, dont_remember).into_lines(),
    );
    let to = match (&flow.stored.new_user_url, signed_in.is_register) {
        (Some(url), true) if !url.is_empty() => url.as_str(),
        _ => flow.stored.callback_url.as_str(),
    };
    found(to, cookies)
}

/// `throw c.redirect(url)`: 302 with the endpoint's `Set-Cookie` lines, no
/// body, and the `content-type: application/json` better-call's
/// `toResponse` gives every answer it writes (measured on Next). A URL that
/// is not a header value throws (an empty 500).
fn found(to: &str, cookies: Vec<String>) -> Response {
    let Ok(location) = HeaderValue::try_from(to) else {
        return server_error();
    };
    let mut response = StatusCode::FOUND.into_response();
    let headers = response.headers_mut();
    headers.insert(LOCATION, location);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    for line in cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            headers.append(SET_COOKIE, value);
        }
    }
    response
        .extensions_mut()
        .insert(ReasonPhrase::from_static(b"Found"));
    response
}

/// `redirectOnError`: `error` and the description appended to `to` as
/// `appendQueryParams` appends them.
fn redirect_error(
    to: &str,
    error: &str,
    description: Option<&str>,
    cookies: Vec<String>,
) -> Response {
    let mut params = url::form_urlencoded::Serializer::new(String::new());
    params.append_pair("error", error);
    if let Some(description) = description {
        params.append_pair("error_description", description);
    }
    match append_query_params(to, &params.finish()) {
        Some(url) => found(&url, cookies),
        None => server_error(),
    }
}

/// Where `appendQueryParams` resolves a root-relative URL.
const URL_REFERENCE_ORIGIN: &str = "https://better-auth.invalid";

/// `appendQueryParams(input, params)` (@better-auth/core
/// dist/utils/url.mjs:40-50): the URL parsed (a root-relative one against a
/// reference origin), the parameters added to its query, written back as
/// `href` (without the reference origin). `None` where it throws.
pub fn append_query_params(input: &str, query: &str) -> Option<String> {
    if input.starts_with("//") || input.starts_with("/\\") {
        return None;
    }
    let relative = input.starts_with('/');
    let mut url = if relative {
        url::Url::parse(URL_REFERENCE_ORIGIN)
            .ok()?
            .join(input)
            .ok()?
    } else {
        url::Url::parse(input).ok()?
    };
    if relative && url.origin().ascii_serialization() != URL_REFERENCE_ORIGIN {
        return None;
    }
    if query.is_empty() {
        return Some(input.to_owned());
    }
    let search = url
        .query()
        .filter(|search| !search.is_empty())
        .map(str::to_owned);
    let joined = match search {
        Some(search) if search.ends_with('&') => format!("{search}{query}"),
        Some(search) => format!("{search}&{query}"),
        None => query.to_owned(),
    };
    url.set_query(Some(&joined));
    let href = url.as_str();
    Some(if relative {
        href[URL_REFERENCE_ORIGIN.len()..].to_owned()
    } else {
        href.to_owned()
    })
}

/// Whether the browser, given `location` after a callback, stays on a
/// trusted origin: resolved as `Location` is against the callback's URL
/// (dot segments, leading slashes and backslashes, tabs and newlines, the
/// scheme's case), with no user name or password. Not in better-auth,
/// whose `appendQueryParams` can write `//host` (PLAN.md A3-12).
pub fn location_on_site(location: &str, auth: &BetterAuth) -> bool {
    resolves_to_trusted(location, &auth.api_base_url, &auth.trusted_origins)
}

fn resolves_to_trusted(location: &str, base: &str, trusted_origins: &[String]) -> bool {
    url::Url::parse(base)
        .and_then(|base| base.join(location))
        .is_ok_and(|url| {
            url.username().is_empty()
                && url.password().is_none()
                && trusted_origins.contains(&url.origin().ascii_serialization())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_locations_that_stay_on_a_trusted_origin_are_sent() {
        let base = "https://catchmeme.com/api/auth";
        let trusted = ["https://catchmeme.com", "http://localhost:3000"].map(str::to_owned);
        let lands = |location: &str| resolves_to_trusted(location, base, &trusted);
        for kept in [
            "/",
            "/login?error=state_mismatch",
            "login",
            "/%2F%2Fevil.example",
            "%2F%2Fevil.example",
            "https://catchmeme.com/api/auth/error?error=x",
            "HTTPS://CatchMeme.com/x",
            "http://localhost:3000/auth/callback?next=%2F",
            "",
        ] {
            assert!(lands(kept), "{kept}");
        }
        for refused in [
            "//evil.example?error=state_mismatch",
            "/\\evil.example",
            "\\\\evil.example",
            "/\t/evil.example",
            "\t//evil.example",
            "///evil.example",
            "https://evil.example/",
            "HtTpS://EVIL.example/",
            "https://catchmeme.com@evil.example/",
            "https://user@catchmeme.com/",
            "https://user:pw@catchmeme.com/",
            "https://catchmeme.com.evil.example/",
            "http://catchmeme.com/",
            "javascript:alert(1)",
            "JavaScript://catchmeme.com/%0aalert(1)",
            "data:text/html,x",
        ] {
            assert!(!lands(refused), "{refused}");
        }
        // better-auth's `appendQueryParams` turns these into `//evil.example?…`.
        for input in [
            "/a/..//evil.example",
            "/..//evil.example",
            "/x/%2e%2e//evil.example",
        ] {
            let location = append_query_params(input, "error=state_mismatch").expect("appended");
            assert_eq!(location, "//evil.example?error=state_mismatch", "{input}");
            assert!(!lands(&location), "{input}");
        }
    }

    // Expected values: `appendQueryParams` of @better-auth/core 1.7.20 on
    // the same inputs (node -e, PLAN.md A3).
    #[test]
    fn error_params_are_appended_as_better_auth_appends_them() {
        let params = "error=access_denied&error_description=User+denied";
        for (input, expected) in [
            (
                "/login",
                "/login?error=access_denied&error_description=User+denied",
            ),
            (
                "/login?x=1",
                "/login?x=1&error=access_denied&error_description=User+denied",
            ),
            (
                "/login?x=1&",
                "/login?x=1&error=access_denied&error_description=User+denied",
            ),
            (
                "/login?",
                "/login?error=access_denied&error_description=User+denied",
            ),
            (
                "/login#top",
                "/login?error=access_denied&error_description=User+denied#top",
            ),
            (
                "https://catchmeme.com/api/auth/error",
                "https://catchmeme.com/api/auth/error?error=access_denied&error_description=User+denied",
            ),
            (
                "https://catchmeme.com",
                "https://catchmeme.com/?error=access_denied&error_description=User+denied",
            ),
        ] {
            assert_eq!(
                append_query_params(input, params).as_deref(),
                Some(expected),
                "{input}"
            );
        }
        assert_eq!(append_query_params("//evil.example", params), None);
        assert_eq!(append_query_params("/\\evil.example", params), None);
    }

    #[test]
    fn a_repeated_schema_key_goes_to_next() {
        assert!(read_query(Some("state=a&state=b")).is_none());
        assert!(read_query(Some("code=a&x=1&x=2")).is_some());
        let query = read_query(Some("error=a%20b&error_description=c+d")).expect("read");
        assert_eq!(value(&query, "error"), Some("a b"));
        assert_eq!(value(&query, "error_description"), Some("c d"));
        assert_eq!(read_query(None), Some(Vec::new()));
    }
}
