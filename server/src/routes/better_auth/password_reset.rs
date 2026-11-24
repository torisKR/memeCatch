//! Password reset: better-auth's `requestPasswordReset` and `resetPassword`
//! (dist/api/routes/password.mjs), with the app's `sendResetPassword`
//! (lib/auth/server.ts), which mails a link to its own page
//! `<SITE_URL>/reset-password?token=…`.
//!
//! The token is a `verification` row: identifier `reset-password:<token>`
//! (24 letters and digits), value the user's id, valid for an hour, spent by
//! its first use in the same transaction as the password change.
//!
//! Answered here:
//! - `POST /request-password-reset`: `email` (an address as zod reads one)
//!   and an optional `redirectTo` that is a plain root-relative path. The
//!   answer is the same whether the address exists or not.
//! - `POST /reset-password`: `newPassword` and `token`, both strings, no
//!   query string.
//!
//! The link `GET /reset-password/:token` is not answered here: the app's mail
//! does not point to it.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::{Map, Value};

use super::accounts::{self, Reset};
use super::forms;
use super::mail::{Mail, Mailer};
use super::passwords;
use super::sign_in::{bad_request, failed};
use super::{BetterAuth, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, answer, random_id};
use crate::AppState;
use crate::auth::now_ms;

/// `resetPasswordTokenExpiresIn` default.
const TOKEN_TTL_MS: i64 = 3_600_000;
const SENT: &str = r#"{"status":true,"message":"If this email exists in our system, check your email for the reset link"}"#;

pub async fn request_password_reset(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let answerable = |body: &Map<String, Value>| {
        forms::only_keys(body, &["email", "redirectTo"])
            && forms::string(body, "email").is_some_and(forms::is_email)
            && body
                .get("redirectTo")
                .is_none_or(|url| url.as_str().is_some_and(forms::is_plain_path))
    };
    let request = match forms::json_or_next(&state, request, |_, body| answerable(body)).await {
        Ok(request) => request,
        Err(next) => return next,
    };
    let headers = &request.parts.headers;
    if let Some(limited) = auth.limit(headers, "/request-password-reset") {
        return limited;
    }
    if let Some(refused) = forms::validate_origin(&auth, headers, false) {
        return refused;
    }
    let email = forms::string(&request.body, "email").unwrap_or_default();
    match send_link(&state, &auth.mailer, &auth.site_url, email).await {
        Ok(()) => sent(),
        Err(error) => failed(&error),
    }
}

/// The work of `requestPasswordReset` once its body is accepted: a token for
/// the account of `email` (lower-cased), mailed as a link to `site_url`.
/// Nothing is sent for an unknown address, but the dummy lookup still runs.
pub(super) async fn send_link(
    state: &AppState,
    mailer: &Mailer,
    site_url: &str,
    email: &str,
) -> Result<(), sqlx::Error> {
    let email = email.to_lowercase();
    let Some(user) = accounts::find_user_by_email(&state.db, email).await? else {
        // `findVerificationValue("dummy-verification-token")`: the lookup and
        // its cleanup run for an unknown address too.
        accounts::find_verification(&state.db, "dummy-verification-token".into(), now_ms()).await?;
        return Ok(());
    };
    let now = now_ms();
    let token = random_id(24);
    let identifier = format!("reset-password:{token}");
    accounts::create_verification(
        &state.db,
        identifier,
        user.id.clone(),
        now + TOKEN_TTL_MS,
        now,
    )
    .await?;
    mailer
        .send(Mail {
            to: user.email,
            subject: "Reset your MemeCatch password",
            // `encodeURIComponent(token)`: the token is letters and digits.
            url: format!("{site_url}/reset-password?token={token}"),
            not_delivered: "password_reset_not_delivered",
        })
        .await;
    Ok(())
}

fn sent() -> Response {
    answer(StatusCode::OK, b"OK", SENT.to_owned(), Vec::new(), false)
}

pub async fn reset_password(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let answerable = |body: &Map<String, Value>| {
        forms::only_keys(body, &["newPassword", "token"])
            && forms::string(body, "newPassword").is_some()
            && body.get("token").is_none_or(Value::is_string)
    };
    let request = match forms::json_or_next(&state, request, |_, body| answerable(body)).await {
        Ok(request) => request,
        Err(next) => return next,
    };
    let headers = &request.parts.headers;
    if let Some(limited) = auth.limit(headers, "/reset-password") {
        return limited;
    }
    if let Some(refused) = forms::validate_origin(&auth, headers, false) {
        return refused;
    }
    let token = forms::string(&request.body, "token")
        .unwrap_or_default()
        .to_owned();
    if token.is_empty() {
        return invalid_token();
    }
    let password = forms::string(&request.body, "newPassword")
        .unwrap_or_default()
        .to_owned();
    if forms::js_length(&password) < MIN_PASSWORD_LENGTH {
        return bad_request("Password too short", "PASSWORD_TOO_SHORT");
    }
    if forms::js_length(&password) > MAX_PASSWORD_LENGTH {
        return bad_request("Password too long", "PASSWORD_TOO_LONG");
    }
    let identifier = format!("reset-password:{token}");
    let found = match accounts::find_verification(&state.db, identifier.clone(), now_ms()).await {
        Ok(found) => found,
        Err(error) => return failed(&error),
    };
    let Some(verification) = found.filter(|row| row.expires_at_ms >= now_ms()) else {
        return invalid_token();
    };
    match accounts::find_user_by_id(&state.db, verification.value.clone()).await {
        Ok(Some(_)) => {}
        Ok(None) => return bad_request("User not found", "USER_NOT_FOUND"),
        Err(error) => return failed(&error),
    }
    let Ok(hash) = passwords::hash(&password).await else {
        return super::rate_limit::overloaded();
    };
    match accounts::reset_password(&state.db, identifier, verification.value, hash, now_ms()).await
    {
        Ok(Reset::Done) => answer(
            StatusCode::OK,
            b"OK",
            r#"{"status":true}"#.to_owned(),
            Vec::new(),
            false,
        ),
        Ok(Reset::TokenSpent) => invalid_token(),
        Err(error) => failed(&error),
    }
}

fn invalid_token() -> Response {
    bad_request("Invalid token", "INVALID_TOKEN")
}
