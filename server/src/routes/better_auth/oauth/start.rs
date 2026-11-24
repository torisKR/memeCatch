//! `POST /api/auth/sign-in/social`: better-auth's `signInSocial`
//! (dist/api/routes/sign-in.mjs:118-237) for its redirect branch, behind
//! `originCheckMiddleware` (dist/api/middlewares/origin-check.mjs:45-73).
//!
//! Answered here: a JSON object of `provider` (a string), `callbackURL`, and
//! optionally `errorCallbackURL`, `newUserCallbackURL` and a boolean
//! `disableRedirect`, the URLs in a form this server can tell better-auth
//! trusts (`trusted_url`). That is what the app sends
//! (`signInWithOAuth` in lib/db/client.ts, server/ui/save.js). An `idToken`
//! sign-in, `scopes`, `loginHint`, `additionalParams`, `additionalData`,
//! `requestSignUp`, other keys, and URLs in any other form are refused
//! before anything is written (`forms::refused`).
//!
//! In better-auth's order: the limit (3 per 10 s), the origin check when
//! the request has cookies, `PROVIDER_NOT_FOUND` (404) for a provider that is
//! not set, then the state (the signed cookie, the `verification` row) and
//! `{url, redirect}` with `Location` unless `disableRedirect`.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{HeaderValue, LOCATION};
use axum::response::Response;
use serde_json::{Map, Value};

use super::super::sign_in::server_error;
use super::super::{BetterAuth, answer, api_error, forms};
use super::state::{self, Flow};
use crate::AppState;
use crate::auth::now_ms;

const KEYS: [&str; 5] = [
    "provider",
    "callbackURL",
    "errorCallbackURL",
    "newUserCallbackURL",
    "disableRedirect",
];

pub async fn sign_in_social(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::super::cookie_too_large(request.headers()) {
        return refused;
    }
    let trusted = |url: &str| trusted_url(url, &auth.trusted_origins);
    let request = match forms::json_request(request, |_, body| answerable(body, trusted)).await {
        Ok(request) => request,
        Err(next) => return next,
    };
    let headers = &request.parts.headers;
    if let Some(limited) = auth.limit(headers, "/sign-in/social") {
        return limited;
    }
    if let Some(refused) = forms::validate_origin(&auth, headers, false) {
        return refused;
    }
    let body = &request.body;
    let provider_id = forms::string(body, "provider").unwrap_or_default();
    let Some(provider) = auth.oauth.get(provider_id) else {
        tracing::error!(
            provider = provider_id,
            "Provider not found. Make sure to add the provider in your auth config"
        );
        return api_error(
            StatusCode::NOT_FOUND,
            b"NOT_FOUND",
            "Provider not found",
            "PROVIDER_NOT_FOUND",
            Vec::new(),
            false,
        );
    };
    let flow = Flow {
        callback_url: forms::string(body, "callbackURL").unwrap_or_default(),
        error_url: forms::string(body, "errorCallbackURL"),
        new_user_url: forms::string(body, "newUserCallbackURL"),
    };
    let started = match state::start(&state.db, &auth, &flow, now_ms()).await {
        Ok(started) => started,
        Err(error) => {
            tracing::error!(%error, "sign-in/social could not store the state");
            return server_error();
        }
    };
    let redirect_uri = format!("{}/callback/{}", auth.api_base_url, provider.id.as_str());
    let url = provider.authorization_url(&started.state, &started.code_verifier, &redirect_uri);
    let redirect = body.get("disableRedirect") != Some(&Value::Bool(true));
    let json = format!(
        r#"{{"url":{},"redirect":{redirect}}}"#,
        Value::from(url.as_str())
    );
    let mut response = answer(
        StatusCode::OK,
        b"OK",
        json,
        vec![started.cookie_line],
        false,
    );
    if redirect && let Ok(location) = HeaderValue::try_from(url) {
        response.headers_mut().insert(LOCATION, location);
    }
    response
}

/// The body schema with the URL forms answered here.
fn answerable(body: &Map<String, Value>, trusted: impl Fn(&str) -> bool) -> bool {
    let url = |key: &str, required: bool| match body.get(key) {
        None => !required,
        Some(Value::String(url)) => !url.is_empty() && trusted(url),
        Some(_) => false,
    };
    forms::only_keys(body, &KEYS)
        && forms::string(body, "provider").is_some()
        && url("callbackURL", true)
        && url("errorCallbackURL", false)
        && url("newUserCallbackURL", false)
        && forms::optional_bool(body, "disableRedirect")
}

/// A URL `isTrustedOrigin(url, { allowRelativePaths: true })` accepts, in a
/// form this server reads exactly as `new URL` does: a plain root-relative
/// path (`forms::is_plain_path`), or `http://` / `https://`, a host of
/// lowercase letters, digits, dots and hyphens with an optional port, a
/// trusted origin, and the rest visible ASCII without quotes, angle
/// brackets, backslashes or the characters `URL` would escape.
fn trusted_url(url: &str, trusted_origins: &[String]) -> bool {
    if forms::is_plain_path(url) {
        return true;
    }
    let Some(rest) = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
    else {
        return false;
    };
    let authority_end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
    let authority = &rest[..authority_end];
    let plain_authority = !authority.is_empty()
        && authority.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || b".-:".contains(&byte)
        });
    let plain_rest = rest[authority_end..]
        .bytes()
        .all(|byte| (0x21..=0x7e).contains(&byte) && !b"\"'<>\\^`{|}".contains(&byte));
    if !plain_authority || !plain_rest {
        return false;
    }
    url::Url::parse(url).is_ok_and(|parsed| {
        let origin = parsed.origin().ascii_serialization();
        trusted_origins.contains(&origin)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn origins() -> Vec<String> {
        ["https://catchmeme.com", "http://localhost:3000"]
            .map(str::to_owned)
            .to_vec()
    }

    #[test]
    fn only_urls_better_auth_trusts_are_answered_here() {
        for trusted in [
            "/",
            "/my/page?x=1",
            "https://catchmeme.com/auth/callback?next=%2Fexplore%3Fsort%3Drecent",
            "https://catchmeme.com",
            "https://catchmeme.com:443/x",
            "http://localhost:3000/auth/callback?next=%2F",
        ] {
            assert!(trusted_url(trusted, &origins()), "{trusted}");
        }
        for refused in [
            "https://evil.example/",
            "//evil.example/x",
            "/\\evil.example",
            "\\\\evil.example",
            "/%2F%2Fevil.example",
            "https://catchmeme.com@evil.example/",
            "https://catchmeme.com.evil.example/",
            "https://CatchMeme.com/",
            "javascript:alert(1)",
            "JavaScript://catchmeme.com/%0aalert(1)",
            "https://catchmeme.com/a b",
            "https://catchmeme.com/\\evil",
            "http://catchmeme.com/",
            "data:text/html,x",
            "",
        ] {
            assert!(!trusted_url(refused, &origins()), "{refused}");
        }
    }

    #[test]
    fn bodies_outside_the_app_s_shape_go_to_next() {
        let object = |text: &str| match serde_json::from_str(text) {
            Ok(Value::Object(object)) => object,
            _ => panic!("{text}"),
        };
        let trusted = |url: &str| trusted_url(url, &origins());
        assert!(answerable(
            &object(r#"{"provider":"kakao","callbackURL":"/","disableRedirect":true}"#),
            trusted
        ));
        assert!(answerable(
            &object(r#"{"provider":"github","callbackURL":"/","errorCallbackURL":"/login"}"#),
            trusted
        ));
        for body in [
            r#"{"provider":"google"}"#,
            r#"{"provider":"google","callbackURL":""}"#,
            r#"{"provider":"google","callbackURL":"https://evil.example/"}"#,
            r#"{"provider":"google","callbackURL":"/","errorCallbackURL":"//evil.example"}"#,
            r#"{"provider":"google","callbackURL":"/","newUserCallbackURL":7}"#,
            r#"{"provider":"google","callbackURL":"/","disableRedirect":"true"}"#,
            r#"{"provider":"google","callbackURL":"/","idToken":{"token":"t"}}"#,
            r#"{"provider":"google","callbackURL":"/","scopes":["x"]}"#,
            r#"{"provider":1,"callbackURL":"/"}"#,
        ] {
            assert!(!answerable(&object(body), trusted), "{body}");
        }
    }
}
