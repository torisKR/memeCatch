//! `GET /api/auth/get-session`: better-auth's `getSession` endpoint
//! (dist/api/routes/session.mjs:12-234) with this app's options. The steps
//! that apply, in order:
//!
//! 1. `cache-control: no-store`, `pragma: no-cache` (:33-34).
//! 2. The signed session cookie (:40). A bad signature reads as no token.
//! 3. A `session_data` cookie without the cookie cache: its chunks are
//!    expired (:42-46).
//! 4. No token: `null` (:47).
//! 5. `findSession`; none, or expired: the session cookies are deleted, an
//!    expired row is deleted, `null` (:153-165).
//! 6. A signed `dont_remember` cookie: the session as it is (:170-177).
//! 7. Due for refresh (`expiresAt - 7 d + 1 d <= now`, :178-183): the row
//!    gets `expiresAt = now + 7 d` and `updatedAt = now`, the cookie is set
//!    again for 7 days, and the updated row is returned (:198-220). A row
//!    that vanished in between: the cookies are deleted, 401 (:203-209).
//! 8. Otherwise the session as it is (:222-228).
//!
//! Any database error: 500 `FAILED_TO_GET_SESSION` (:229-233).
//!
//! `nextCookies` (dist/integrations/next-js.mjs:33-103) skips the refresh for
//! a React Server Component render, but its hooks return at once for a
//! request through the HTTP handler (`_flag === "router"`), and Next answers
//! an `RSC` request to this path with a redirect before better-auth runs.
//! Such requests are handed to Next.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{Method, StatusCode};
use axum::response::Response;

use super::cookies::{self, SESSION_MAX_AGE_SECS, SetCookies};
use super::store::{self, SessionRow, UserRow};
use super::{BetterAuth, answer, api_error};
use crate::auth::{cookie_header, cookie_value, now_ms, verify_signed_value};
use crate::{AppState, proxy};

/// `session.updateAge` default: one day.
const UPDATE_AGE_MS: i64 = 86_400_000;
const EXPIRES_IN_MS: i64 = SESSION_MAX_AGE_SECS * 1000;

pub async fn get_session(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let handed_to_next = request.method() == Method::HEAD
        || request.uri().query().is_some()
        || request.headers().contains_key("rsc");
    if handed_to_next {
        return proxy::forward(State(state), request).await;
    }
    if let Some(limiter) = &auth.limiter
        && let Some(limited) = limiter.check(request.headers(), "/get-session", now_ms())
    {
        return limited;
    }
    let header = cookie_header(request.headers());
    let mut set = SetCookies::default();
    match respond(&state, &auth, header.as_deref(), &mut set).await {
        Ok(body) => answer(StatusCode::OK, b"OK", body, set.into_lines(), true),
        Err(Failure::Unauthorized) => failed(StatusCode::UNAUTHORIZED, b"UNAUTHORIZED", set),
        Err(Failure::Database(error)) => {
            tracing::error!(%error, "get-session failed");
            failed(
                StatusCode::INTERNAL_SERVER_ERROR,
                b"INTERNAL_SERVER_ERROR",
                set,
            )
        }
    }
}

enum Failure {
    Unauthorized,
    Database(sqlx::Error),
}

impl From<sqlx::Error> for Failure {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

fn failed(status: StatusCode, reason: &'static [u8], set: SetCookies) -> Response {
    let message = "Failed to get session";
    api_error(
        status,
        reason,
        message,
        "FAILED_TO_GET_SESSION",
        set.into_lines(),
        true,
    )
}

/// `ctx.getSignedCookie(name, secret)` as far as truthiness goes: the token
/// when the signature is good and the value is not empty.
fn signed_value(header: Option<&str>, name: &str, secret: &str) -> Option<String> {
    let value = cookie_value(header?, name)?;
    verify_signed_value(&value, secret)
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
}

/// The body of the answer, as JSON text.
async fn respond(
    state: &AppState,
    auth: &BetterAuth,
    header: Option<&str>,
    set: &mut SetCookies,
) -> Result<String, Failure> {
    let names = &auth.cookies;
    let chunks = cookies::existing_chunks(header, &names.session_data);
    if cookies::has_chunked_cookie(header, &names.session_data) {
        set.clean_chunks(names, &chunks);
    }
    let Some(token) = signed_value(header, &names.session_token, &auth.secret) else {
        return Ok("null".to_owned());
    };
    let dont_remember = signed_value(header, &names.dont_remember, &auth.secret).is_some();
    let found = store::find(&state.db, token.clone()).await?;
    let now = now_ms();
    let (session, user) = match found {
        Some((session, user)) if session.expires_at_ms >= now => (session, user),
        expired => {
            set.delete_session_cookie(names, &chunks);
            if expired.is_some() {
                store::delete(&state.db, token).await?;
            }
            return Ok("null".to_owned());
        }
    };
    let due = session.expires_at_ms - EXPIRES_IN_MS + UPDATE_AGE_MS <= now;
    if dont_remember || !due {
        return Ok(body(&session, &user));
    }
    let Some(updated) = store::extend(&state.db, token.clone(), now + EXPIRES_IN_MS, now).await?
    else {
        set.delete_session_cookie(names, &chunks);
        return Err(Failure::Unauthorized);
    };
    let line = names.signed(
        &names.session_token,
        &token,
        &auth.secret,
        Some(SESSION_MAX_AGE_SECS),
    );
    set.set(&names.session_token, line);
    Ok(body(&updated, &user))
}

/// `{ session, user }` as `ctx.json` writes the parsed rows: the fields of
/// better-auth's schema in its order, then `id` (measured on Next); dates as
/// `Date.prototype.toJSON` writes them.
fn body(session: &SessionRow, user: &UserRow) -> String {
    let text = |value: &str| serde_json::Value::from(value).to_string();
    let optional = |value: &Option<String>| value.as_deref().map_or("null".to_owned(), text);
    format!(
        concat!(
            r#"{{"session":{{"expiresAt":{},"token":{},"createdAt":{},"updatedAt":{},"#,
            r#""ipAddress":{},"userAgent":{},"userId":{},"id":{}}},"#,
            r#""user":{}}}"#
        ),
        iso(session.expires_at_ms),
        text(&session.token),
        iso(session.created_at_ms),
        iso(session.updated_at_ms),
        optional(&session.ip_address),
        optional(&session.user_agent),
        text(&session.user_id),
        text(&session.id),
        user_json(user),
    )
}

/// `parseUserOutput(options, user)` as JSON: name, email, emailVerified,
/// image, createdAt, updatedAt, then id (measured on Next).
pub(super) fn user_json(user: &UserRow) -> String {
    let text = |value: &str| serde_json::Value::from(value).to_string();
    let optional = |value: &Option<String>| value.as_deref().map_or("null".to_owned(), text);
    format!(
        r#"{{"name":{},"email":{},"emailVerified":{},"image":{},"createdAt":{},"updatedAt":{},"id":{}}}"#,
        text(&user.name),
        text(&user.email),
        user.email_verified,
        optional(&user.image),
        iso(user.created_at_ms),
        iso(user.updated_at_ms),
        text(&user.id),
    )
}

/// `JSON.stringify(new Date(ms))`: `"YYYY-MM-DDTHH:MM:SS.mmmZ"`.
fn iso(ms: i64) -> String {
    let at = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(ms) * 1_000_000)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    format!(
        "\"{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z\"",
        at.year(),
        u8::from(at.month()),
        at.day(),
        at.hour(),
        at.minute(),
        at.second(),
        at.millisecond()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates_are_written_as_javascript_writes_them() {
        assert_eq!(iso(1_795_461_961_942), "\"2026-11-23T19:26:01.942Z\"");
        assert_eq!(iso(0), "\"1970-01-01T00:00:00.000Z\"");
    }

    #[test]
    fn the_body_has_the_keys_in_the_order_next_sends() {
        let session = SessionRow {
            id: "s".into(),
            expires_at_ms: 0,
            token: "t".into(),
            created_at_ms: 0,
            updated_at_ms: 0,
            ip_address: Some(String::new()),
            user_agent: None,
            user_id: "u".into(),
        };
        let user = UserRow {
            id: "u".into(),
            name: "n\"".into(),
            email: "e".into(),
            email_verified: true,
            image: None,
            created_at_ms: 0,
            updated_at_ms: 0,
        };
        let zero = "\"1970-01-01T00:00:00.000Z\"";
        assert_eq!(
            body(&session, &user),
            format!(
                r#"{{"session":{{"expiresAt":{zero},"token":"t","createdAt":{zero},"updatedAt":{zero},"ipAddress":"","userAgent":null,"userId":"u","id":"s"}},"user":{{"name":"n\"","email":"e","emailVerified":true,"image":null,"createdAt":{zero},"updatedAt":{zero},"id":"u"}}}}"#
            )
        );
    }
}
