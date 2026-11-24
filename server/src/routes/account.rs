//! The account writes of lib/actions/auth.ts that no better-auth endpoint
//! makes, as endpoints for the native pages of batch B6 (PLAN.md section
//! B6). Each has its own route id, so it can be handed back to Next alone.
//!
//! | Route id | Path | Action |
//! | --- | --- | --- |
//! | `account-password` | `POST /api/account/password` | `updatePassword` without a reset token |
//!
//! Like a server action: a request from another origin is refused before
//! anything runs (`origin::request_is_trusted`), the body is the form's
//! fields as JSON, the answer is the action's state as JSON with 200, and
//! the cookies the action's `getSession` set are on it
//! (`better_auth::action_user`).

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::SET_COOKIE;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::post;
use serde_json::json;

use super::Routes;
use super::better_auth::{action_user, passwords};
use super::origin::request_is_trusted;
use super::request::{self, Json, property};
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};

/// Two passwords of at most better-auth's 128 characters, as JSON.
const MAX_BODY_BYTES: usize = 4 * 1024;

const WEAK: &str = "비밀번호는 영문과 숫자를 포함해 12자 이상이어야 해요";
const MISMATCH: &str = "두 비밀번호가 서로 달라요";
const EXPIRED: &str = "재설정 링크가 만료됐거나 유효하지 않아요. 메일을 다시 요청해 주세요.";
const FAILED: &str = "비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.";

/// `db.auth.updateUser({ password })` of lib/db/server.ts.
const UPDATE_PASSWORD: &str = r#"UPDATE account SET password = $1, "updatedAt" = now()
 WHERE "userId" = $2::uuid AND "providerId" = 'credential'"#;

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("account-password", "/api/account/password", post(password))
        .build()
}

/// The action's state as the answer, with the cookies the action set.
fn state_answer(body: serde_json::Value, cookies: Vec<String>) -> Response {
    let mut response = request::json(StatusCode::OK, body.to_string());
    for line in cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            response.headers_mut().append(SET_COOKIE, value);
        }
    }
    response
}

/// `STRONG_PASSWORD_RE`, `/^(?=.*[A-Za-z])(?=.*\d).{12,}$/`: no line
/// terminator anywhere (`.` matches none), at least 12 UTF-16 units, an ASCII
/// letter and an ASCII digit.
pub fn is_strong(password: &str) -> bool {
    !password.contains(['\n', '\r', '\u{2028}', '\u{2029}'])
        && password.encode_utf16().count() >= 12
        && password.contains(|c: char| c.is_ascii_alphabetic())
        && password.contains(|c: char| c.is_ascii_digit())
}

/// `String(formData.get(name) ?? "")` for a field the page sends as a JSON
/// string: anything else reads as empty.
fn field(entries: &[(String, Json)], name: &str) -> String {
    property(entries, name)
        .and_then(Json::as_str)
        .unwrap_or_default()
        .to_owned()
}

/// `updatePassword` for a signed-in user (the form without a `token`).
async fn password(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return request::json(
            StatusCode::FORBIDDEN,
            json!({ "formError": FAILED }).to_string(),
        );
    }
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_BODY_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    let (password, confirm) = (field(&entries, "password"), field(&entries, "confirm"));
    if !is_strong(&password) {
        return state_answer(json!({ "fieldErrors": { "password": WEAK } }), Vec::new());
    }
    if password != confirm {
        return state_answer(
            json!({ "fieldErrors": { "password": MISMATCH } }),
            Vec::new(),
        );
    }
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return state_answer(json!({ "formError": EXPIRED }), cookies);
    };
    let Ok(hash) = passwords::hash(&password).await else {
        return state_answer(json!({ "formError": FAILED }), cookies);
    };
    let user_id = user.id.clone();
    // As the pool the action's query runs on: the login role that owns the
    // better-auth tables.
    let updated = state
        .db
        .with_identity(
            &DbIdentity::better_auth(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query(UPDATE_PASSWORD)
                        .bind(hash)
                        .bind(user_id)
                        .execute(tx)
                        .await
                })
            },
        )
        .await;
    match updated {
        // `redirect("/my")`
        Ok(_) => state_answer(json!({ "redirect": "/my" }), cookies),
        Err(error) => {
            tracing::warn!(code = ?error.as_database_error().and_then(|e| e.code()), "account password update failed");
            state_answer(json!({ "formError": FAILED }), cookies)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values: STRONG_PASSWORD_RE.test(...) under Node.
    #[test]
    fn strong_means_what_the_actions_pattern_means() {
        for (password, strong) in [
            ("abcdefghijk1", true),
            ("abcdefghij1", false),
            ("123456789012", false),
            ("abcdefghijkl", false),
            ("가나다라마바사아자차카1a", true),
            ("가나다라마바사아자차카1", false),
            ("abcdefghijk\n1", false),
            ("abcdefghijk\u{2028}1", false),
            ("abcdefghij\u{1f600}1", true),
            ("ａbcdefghijk1", true),
            ("abcdefghijk１", false),
        ] {
            assert_eq!(is_strong(password), strong, "{password:?}");
        }
    }
}
