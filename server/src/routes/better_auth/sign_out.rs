//! `POST /api/auth/sign-out`: better-auth's `signOut` endpoint
//! (dist/api/routes/sign-out.mjs) behind better-call's body parsing
//! (better-call dist/utils.mjs:4-30) and the origin check
//! (dist/api/middlewares/origin-check.mjs:44-120).
//!
//! Answered here: no query string, a JSON content type and a body that is a
//! JSON object without any of the schema's keys (`callbackURL`,
//! `disableRedirect`, `state`) or the keys the origin check validates
//! (`redirectTo`, `errorCallbackURL`, `newUserCallbackURL`), which is what
//! the page frame sends (`{}`). Every other request goes to Next as it came:
//! a missing or other content type (415), a body that is not JSON or not an
//! object (400), and those keys, which better-auth checks against the trusted
//! origins (403, or 400 for a non-string). So does any query string: the
//! origin check reads `callbackURL` from the query too
//! (origin-check.mjs:51), and Next answers 400 to a raw non-ASCII byte in it.
//! So does `Origin: null` on a same-origin fetch, which better-auth replaces
//! with an origin it infers from the request.
//!
//! What it does: with a Cookie header, the request's `Origin` (or its
//! `Referer`) must be a trusted origin (403 otherwise); the session of a
//! validly signed cookie is deleted; the session cookies are expired; the
//! answer is `{"success":true}`. When the row cannot be deleted (after one
//! retry on a pool timeout) the cookies are still expired but the answer is
//! 500 `FAILED_TO_SIGN_OUT`, where better-auth answers success (PLAN.md A1-4). No provider of this app has an end-session
//! URL (Google has none; the Kakao plugin has no end-session endpoint), so
//! there is never a logout redirect.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::{Map, Value};

use super::cookies::{self, SetCookies};
use super::forms::{self, JsonRequest};
use super::{BetterAuth, answer, api_error};
use crate::AppState;
use crate::auth::{cookie_header, cookie_value, now_ms, verify_signed_value};
/// The body schema's keys, then the ones `originCheckMiddleware` validates
/// (origin-check.mjs:50-54): a body with any of them goes to Next.
const NEXT_KEYS: [&str; 6] = [
    "callbackURL",
    "disableRedirect",
    "state",
    "redirectTo",
    "errorCallbackURL",
    "newUserCallbackURL",
];

pub async fn sign_out(
    State(state): State<AppState>,
    auth: Arc<BetterAuth>,
    request: Request,
) -> Response {
    if let Some(refused) = super::cookie_too_large(request.headers()) {
        return refused;
    }
    let parts = match forms::json_request(request, |_, body| answerable(body)).await {
        Ok(JsonRequest { parts, .. }) => parts,
        Err(next) => return next,
    };
    if let Some(limiter) = &auth.limiter
        && let Some(limited) = limiter.check(&parts.headers, "/sign-out", now_ms())
    {
        return limited;
    }
    if let Some(refused) = forms::validate_origin(&auth, &parts.headers, false) {
        return refused;
    }
    let header = cookie_header(&parts.headers);
    let names = &auth.cookies;
    let token = header
        .as_deref()
        .and_then(|header| cookie_value(header, &names.session_token))
        .and_then(|value| verify_signed_value(&value, &auth.secret).map(str::to_owned))
        .filter(|token| !token.is_empty());
    let deleted = match token {
        None => Ok(()),
        Some(token) => delete_waiting(&state.db, token).await,
    };
    let mut set = SetCookies::default();
    let chunks = cookies::existing_chunks(header.as_deref(), &names.session_data);
    set.delete_session_cookie(names, &chunks);
    match deleted {
        Ok(()) => answer(
            StatusCode::OK,
            b"OK",
            r#"{"success":true}"#.to_owned(),
            set.into_lines(),
            false,
        ),
        // better-auth logs "Failed to delete session from database" and
        // answers 200 success with the row still there. Here the answer says
        // the session did not end (PLAN.md A1-4); this device's cookies are
        // expired all the same.
        Err(error) => {
            tracing::error!(%error, "sign-out could not delete the session");
            api_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                b"INTERNAL_SERVER_ERROR",
                "Failed to sign out",
                "FAILED_TO_SIGN_OUT",
                set.into_lines(),
                false,
            )
        }
    }
}

/// `deleteSession(token)`, waiting for a connection as node-pg does: a pool
/// timeout is tried once more before it counts as a database failure.
async fn delete_waiting(db: &crate::db::Db, token: String) -> Result<(), sqlx::Error> {
    match super::store::delete(db, token.clone()).await {
        Err(sqlx::Error::PoolTimedOut) => super::store::delete(db, token).await,
        done => done,
    }
}

/// A body without any of `NEXT_KEYS`.
fn answerable(body: &Map<String, Value>) -> bool {
    NEXT_KEYS.iter().all(|key| !body.contains_key(*key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_bodies_better_auth_takes_as_is_are_answered_here() {
        let object = |text: &str| match serde_json::from_str::<Value>(text) {
            Ok(Value::Object(object)) => object,
            _ => panic!("{text}"),
        };
        assert!(answerable(&object("{}")));
        assert!(answerable(&object(r#"{"x":1}"#)));
        for body in [
            r#"{"callbackURL":"/"}"#,
            r#"{"state":"s"}"#,
            r#"{"redirectTo":"/"}"#,
            r#"{"errorCallbackURL":1}"#,
            r#"{"newUserCallbackURL":null}"#,
        ] {
            assert!(!answerable(&object(body)), "{body}");
        }
    }

    #[test]
    fn only_application_json_is_answered_here() {
        let with = |value: &'static str| {
            let mut headers = axum::http::HeaderMap::new();
            headers.insert(axum::http::header::CONTENT_TYPE, value.parse().unwrap());
            forms::is_json_content_type(&headers)
        };
        assert!(with("application/json"));
        assert!(with("Application/JSON; charset=utf-8"));
        assert!(!with("text/plain"));
        assert!(!with("application/ld+json"));
        assert!(!forms::is_json_content_type(&axum::http::HeaderMap::new()));
    }
}
