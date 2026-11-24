//! `GET /api/auth/verify-email?token=…&callbackURL=…`: better-auth's
//! `verifyEmail` (dist/api/routes/email-verification.mjs:124-314), the link of
//! the verification mail, with `autoSignInAfterVerification: false` and the
//! app's `afterEmailVerification` (`syncAuthUser` with `emailVerified`).
//!
//! Answered here: `token`, and optionally a `callbackURL` that is a plain
//! root-relative path (the mail always has `%2F`), each once, nothing else in
//! the query. The token is this app's JWT (email_token.rs); a correctly
//! signed token of another shape, such as the change-email flow's, goes to
//! Next, as do `HEAD`, `RSC` requests and other queries.
//!
//! The answers: with a `callbackURL`, a 302 to it (with `?error=<code>` on a
//! failure); without, `{"status":true,"user":null}` or a 401 with the code.
//! A token can be used until it expires: a second use finds the address
//! verified and answers as the first did.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::header::LOCATION;
use axum::http::{HeaderValue, Method, StatusCode};
use axum::response::Response;

use super::accounts;
use super::email_token::{self, Rejected};
use super::forms;
use super::sign_in::failed;
use super::{BetterAuth, answer, api_error};
use crate::auth::now_ms;
use crate::AppState;

pub async fn verify_email(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    if request.method() != Method::GET {
        return super::not_found();
    }
    let Some((token, callback)) = parse_query(request.uri().query().unwrap_or_default()) else {
        return super::validation_error("Invalid query parameters");
    };
    // A token of another flow's shape is an invalid token here.
    let verified = email_token::verify(&token, &auth.secret, now_ms().div_euclid(1000));
    // The limiter runs before the endpoint, so it counts every token.
    if let Some(limited) = auth.limit(request.headers(), "/verify-email") {
        return limited;
    }
    let claims = match verified {
        Ok(claims) => claims,
        Err(Rejected::Expired) => {
            return refuse(callback.as_deref(), "Token expired", "TOKEN_EXPIRED");
        }
        Err(_) => return refuse(callback.as_deref(), "Invalid token", "INVALID_TOKEN"),
    };
    let user = match accounts::find_user_by_email(&state.db, claims.email.clone()).await {
        Ok(Some(user)) => user,
        Ok(None) => return refuse(callback.as_deref(), "User not found", "USER_NOT_FOUND"),
        Err(error) => return failed(&error),
    };
    if claims.user_id.as_deref().is_some_and(|id| id != user.id) {
        return refuse(callback.as_deref(), "Invalid token", "INVALID_TOKEN");
    }
    if !user.email_verified {
        let updated = match accounts::mark_verified(&state.db, claims.email, now_ms()).await {
            Ok(Some(updated)) => updated,
            Ok(None) => return super::sign_in::server_error(),
            Err(error) => return failed(&error),
        };
        if let Err(error) = accounts::sync_auth_user(&state.db, &updated, true).await {
            tracing::error!(%error, "syncAuthUser failed after email verification");
            return super::sign_in::server_error();
        }
    }
    match callback {
        Some(callback) => redirect(&callback),
        None => answer(
            StatusCode::OK,
            b"OK",
            r#"{"status":true,"user":null}"#.to_owned(),
            Vec::new(),
            false,
        ),
    }
}

/// `token` and an optional plain-path `callbackURL`, each once, as
/// `URLSearchParams` decodes them; `None` sends the request to Next.
fn parse_query(query: &str) -> Option<(String, Option<String>)> {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(query.as_bytes())
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    let mut token = None;
    let mut callback = None;
    for (key, value) in pairs {
        let slot = match key.as_str() {
            "token" => &mut token,
            "callbackURL" => &mut callback,
            _ => return None,
        };
        if slot.replace(value).is_some() {
            return None;
        }
    }
    let token = token?;
    if callback
        .as_deref()
        .is_some_and(|url| !forms::is_plain_path(url))
    {
        return None;
    }
    Some((token, callback))
}

/// `redirectOnError(code)`: a 302 to `callbackURL?error=<code>`, or the 401.
fn refuse(callback: Option<&str>, message: &str, code: &str) -> Response {
    match callback {
        Some(callback) => {
            // `appendQueryParams`: `?` for a URL without a query, `&` after
            // one unless it already ends with `&`.
            let separator = match callback.split_once('?') {
                None => "?",
                Some((_, query)) if query.ends_with('&') => "",
                Some(_) => "&",
            };
            redirect(&format!("{callback}{separator}error={code}"))
        }
        None => api_error(
            StatusCode::UNAUTHORIZED,
            b"UNAUTHORIZED",
            message,
            code,
            Vec::new(),
            false,
        ),
    }
}

/// `ctx.redirect(url)`: 302 with `Location` and no body.
fn redirect(location: &str) -> Response {
    let mut response = answer(
        StatusCode::FOUND,
        b"FOUND",
        String::new(),
        Vec::new(),
        false,
    );
    if let Ok(value) = HeaderValue::try_from(location) {
        response.headers_mut().insert(LOCATION, value);
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_query_is_a_token_and_maybe_a_plain_callback() {
        assert_eq!(
            parse_query("token=a.b.c&callbackURL=%2F"),
            Some(("a.b.c".into(), Some("/".into())))
        );
        assert_eq!(parse_query("token=a"), Some(("a".into(), None)));
        for other in [
            "",
            "callbackURL=%2F",
            "token=a&token=b",
            "token=a&x=1",
            "token=a&callbackURL=https%3A%2F%2Fevil.example",
            "token=a&callbackURL=%2F%2Fevil.example",
        ] {
            assert_eq!(parse_query(other), None, "{other}");
        }
    }

    #[test]
    fn a_failure_is_appended_to_the_callback_as_better_auth_appends_it() {
        let location = |callback| {
            refuse(Some(callback), "Invalid token", "INVALID_TOKEN").headers()[LOCATION].clone()
        };
        assert_eq!(location("/"), "/?error=INVALID_TOKEN");
        assert_eq!(location("/a?b=1"), "/a?b=1&error=INVALID_TOKEN");
        assert_eq!(location("/a?b=1&"), "/a?b=1&error=INVALID_TOKEN");
    }
}
