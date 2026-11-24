//! `POST /api/auth/sign-in/email`: better-auth's `signInEmail`
//! (dist/api/routes/sign-in.mjs:240-368) with this app's options: email and
//! password, `requireEmailVerification` without `sendOnSignIn`, the password
//! check of lib/auth/passwords.ts.
//!
//! Answered here: a JSON object of `email`, `password` (strings) and an
//! optional boolean `rememberMe`. A `callbackURL` (a redirect after sign-in),
//! other keys or types, and form bodies are refused (`forms::refused`).
//!
//! The answers, in better-auth's order: the rate limit (3 per 10 s), the
//! origin and form-CSRF checks (403), `INVALID_EMAIL` and
//! `PASSWORD_TOO_LONG` (400), then 401 `INVALID_EMAIL_OR_PASSWORD` for an
//! unknown address, an account without a password and a wrong password
//! alike (the first two hash the password too, so they take as long), 403
//! `EMAIL_NOT_VERIFIED` after a right password on an unverified address, and
//! otherwise a new session: its cookie and `{redirect, token, user}`.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::header::USER_AGENT;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{Map, Value};

use super::accounts::{self, NewSession};
use super::cookies::{SESSION_MAX_AGE_SECS, SetCookies};
use super::forms;
use super::passwords::{self, Verdict};
use super::session::user_json;
use super::{BetterAuth, MAX_PASSWORD_LENGTH, answer, api_error, random_id};
use crate::AppState;
use crate::auth::{cookie_header, cookie_value, now_ms, verify_signed_value};
use crate::routes::request::header_text;

/// `rememberMe: false`: a session of one day and a cookie without `Max-Age`.
const DONT_REMEMBER_SECS: i64 = 86_400;

pub async fn sign_in(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let request = match forms::json_request(request, |_, body| answerable(body)).await {
        Ok(request) => request,
        Err(next) => return next,
    };
    let headers = &request.parts.headers;
    if let Some(limited) = auth.limit(headers, "/sign-in/email") {
        return limited;
    }
    if let Some(refused) =
        forms::validate_origin(&auth, headers, false).or_else(|| forms::form_csrf(&auth, headers))
    {
        return refused;
    }
    let email = forms::string(&request.body, "email")
        .unwrap_or_default()
        .to_owned();
    let password = forms::string(&request.body, "password")
        .unwrap_or_default()
        .to_owned();
    if !forms::is_email(&email) {
        return bad_request("Invalid email", "INVALID_EMAIL");
    }
    if forms::js_length(&password) > MAX_PASSWORD_LENGTH {
        return bad_request("Password too long", "PASSWORD_TOO_LONG");
    }
    let found = match accounts::find_for_sign_in(&state.db, email.to_lowercase()).await {
        Ok(found) => found,
        Err(error) => return failed(&error),
    };
    let Some((user, Some(stored))) = found else {
        // `await ctx.context.password.hash(password)`: the same work as a
        // wrong password, so the answer does not tell an address exists.
        if passwords::hash(&password).await.is_err() {
            return super::rate_limit::overloaded();
        }
        return wrong_credentials();
    };
    match passwords::verify(&stored, &password).await {
        Verdict::Match => {}
        Verdict::Mismatch => return wrong_credentials(),
        Verdict::Unreadable => {
            tracing::error!("a stored password hash could not be read");
            return super::sign_in::server_error();
        }
        Verdict::Overloaded => return super::rate_limit::overloaded(),
    }
    if !user.email_verified {
        return api_error(
            StatusCode::FORBIDDEN,
            b"FORBIDDEN",
            "Email not verified",
            "EMAIL_NOT_VERIFIED",
            Vec::new(),
            false,
        );
    }
    let dont_remember = request.body.get("rememberMe") == Some(&Value::Bool(false));
    let now = now_ms();
    let token = random_id(32);
    let session = NewSession {
        user_id: user.id.clone(),
        ip_address: super::rate_limit::client_ip(headers).unwrap_or_default(),
        user_agent: header_text(headers, &USER_AGENT, ", ").unwrap_or_default(),
        expires_at_ms: now
            + 1000
                * if dont_remember {
                    DONT_REMEMBER_SECS
                } else {
                    SESSION_MAX_AGE_SECS
                },
        now_ms: now,
        token: token.clone(),
    };
    if let Err(error) = accounts::create_session(&state.db, session).await {
        return failed(&error);
    }
    let set = session_cookies(&auth, headers, &token, dont_remember);
    let body = format!(
        r#"{{"redirect":false,"token":{},"user":{}}}"#,
        Value::from(token),
        user_json(&user)
    );
    answer(StatusCode::OK, b"OK", body, set.into_lines(), false)
}

/// The body schema: `email` and `password` strings, `rememberMe` a boolean
/// when present, and no other key (`callbackURL` is refused).
fn answerable(body: &Map<String, Value>) -> bool {
    forms::only_keys(body, &["email", "password", "rememberMe"])
        && forms::string(body, "email").is_some()
        && forms::string(body, "password").is_some()
        && forms::optional_bool(body, "rememberMe")
}

/// `setSessionCookie(ctx, { session, user }, dontRememberMe)`: the signed
/// token for 7 days, or without `Max-Age` plus a signed `dont_remember`
/// cookie; a `dont_remember` cookie the request carried is expired otherwise.
pub(super) fn session_cookies(
    auth: &BetterAuth,
    headers: &HeaderMap,
    token: &str,
    dont_remember: bool,
) -> SetCookies {
    let names = &auth.cookies;
    let mut set = SetCookies::default();
    let max_age = (!dont_remember).then_some(SESSION_MAX_AGE_SECS);
    set.set(
        &names.session_token,
        names.signed(&names.session_token, token, &auth.secret, max_age),
    );
    if dont_remember {
        set.set(
            &names.dont_remember,
            names.signed(&names.dont_remember, "true", &auth.secret, None),
        );
    } else if carries_dont_remember(auth, headers) {
        set.set(&names.dont_remember, names.expired(&names.dont_remember));
    }
    set
}

/// `ctx.getSignedCookie(dontRememberToken)` is truthy.
pub(super) fn carries_dont_remember(auth: &BetterAuth, headers: &HeaderMap) -> bool {
    cookie_header(headers)
        .and_then(|header| cookie_value(&header, &auth.cookies.dont_remember))
        .is_some_and(|value| {
            verify_signed_value(&value, &auth.secret).is_some_and(|text| !text.is_empty())
        })
}

fn wrong_credentials() -> Response {
    api_error(
        StatusCode::UNAUTHORIZED,
        b"UNAUTHORIZED",
        "Invalid email or password",
        "INVALID_EMAIL_OR_PASSWORD",
        Vec::new(),
        false,
    )
}

pub(super) fn bad_request(message: &str, code: &str) -> Response {
    api_error(
        StatusCode::BAD_REQUEST,
        b"BAD_REQUEST",
        message,
        code,
        Vec::new(),
        false,
    )
}

/// A database error: better-call's bare 500.
pub(super) fn failed(error: &sqlx::Error) -> Response {
    tracing::error!(%error, "better-auth endpoint failed");
    server_error()
}

/// An error better-auth does not turn into an `APIError`: a bare 500.
pub(super) fn server_error() -> Response {
    StatusCode::INTERNAL_SERVER_ERROR.into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(text: &str) -> Map<String, Value> {
        match serde_json::from_str(text) {
            Ok(Value::Object(object)) => object,
            _ => panic!("{text}"),
        }
    }

    #[test]
    fn only_the_schema_s_plain_bodies_are_answered_here() {
        assert!(answerable(&object(r#"{"email":"a@b.co","password":"x"}"#)));
        assert!(answerable(&object(
            r#"{"email":"a","password":"","rememberMe":false}"#
        )));
        for body in [
            r#"{"email":"a@b.co"}"#,
            r#"{"email":1,"password":"x"}"#,
            r#"{"email":"a@b.co","password":"x","rememberMe":null}"#,
            r#"{"email":"a@b.co","password":"x","callbackURL":"/"}"#,
            r#"{"email":"a@b.co","password":"x","other":1}"#,
        ] {
            assert!(!answerable(&object(body)), "{body}");
        }
    }
}
