//! The account writes of lib/actions/auth.ts that no better-auth endpoint
//! makes, as endpoints for the native pages of batch B6 (PLAN.md section
//! B6). Each has its own route id, so it can be handed back to Next alone.
//!
//! | Route id | Path | Action |
//! | --- | --- | --- |
//! | `account-password` | `POST /api/account/password` | `updatePassword` without a reset token |
//! | `account-onboarding` | `POST /api/account/onboarding` | `completeOnboarding` |
//! | `account-nickname` | `POST /api/account/nickname` | `updateNickname` |
//! | `support-inquiry` | `POST /api/support/inquiry` | `createInquiry` (lib/actions/support.ts) |
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
use crate::routes::public::js;

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
        .add("account-nickname", "/api/account/nickname", post(nickname))
        .add("support-inquiry", "/api/support/inquiry", post(inquiry))
        .add(
            "account-onboarding",
            "/api/account/onboarding",
            post(onboarding),
        )
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

/// The onboarding form's fields: a few short strings and three short lists.
const MAX_ONBOARDING_BYTES: usize = 8 * 1024;
const AGE_GROUPS: [&str; 5] = ["10s", "20s", "30s", "40s", "50s+"];
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const USE_PURPOSES: [&str; 3] = ["creator", "brand", "global"];
const PLATFORMS: [&str; 4] = ["instagram", "tiktok", "x", "youtube"];

/// What `parseOnboardingPreferences` and the nickname check of
/// `completeOnboarding` make of the form.
#[derive(Debug, PartialEq, Eq)]
pub struct Onboarding {
    pub next: String,
    pub interests: Vec<String>,
    pub age_group: Option<String>,
    pub use_purpose: String,
    pub platforms: Vec<String>,
    /// Kept only when it is 2 to 20 UTF-16 units once trimmed.
    pub nickname: Option<String>,
}

/// `formData.getAll(name)` filtered to the known values, in order.
fn known_list(entries: &[(String, Json)], name: &str, known: &[&str]) -> Vec<String> {
    let values = match property(entries, name) {
        Some(Json::Array(items)) => items.iter().filter_map(Json::as_str).collect(),
        Some(Json::String(one)) => vec![one.as_str()],
        _ => Vec::new(),
    };
    values
        .into_iter()
        .filter(|value| known.contains(value))
        .map(str::to_owned)
        .collect()
}

pub fn parse_onboarding(entries: &[(String, Json)]) -> Onboarding {
    let age = field(entries, "age_group");
    let purpose = field(entries, "use_purpose");
    let nickname = js::trim(&field(entries, "nickname")).to_owned();
    let length = js::utf16_len(&nickname);
    Onboarding {
        next: crate::routes::next_compat::safe_next(
            property(entries, "next").and_then(Json::as_str),
        ),
        interests: known_list(entries, "interests", &CATEGORIES),
        age_group: AGE_GROUPS.contains(&age.as_str()).then_some(age),
        use_purpose: if USE_PURPOSES.contains(&purpose.as_str()) {
            purpose
        } else {
            "creator".to_owned()
        },
        platforms: known_list(entries, "preferred_platforms", &PLATFORMS),
        nickname: (2..=20).contains(&length).then_some(nickname),
    }
}

/// `completeOnboarding`: the preferences (and the nickname, when it is the
/// right length) on the user's profile, then `redirect(next)`. Without a
/// user, `redirect("/login")`. A failed update throws on Next, which shows
/// the error page: `{ "error": true }` here.
async fn onboarding(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return request::json(StatusCode::FORBIDDEN, json!({ "error": true }).to_string());
    }
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_ONBOARDING_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    let input = parse_onboarding(&entries);
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return state_answer(json!({ "redirect": "/login" }), cookies);
    };
    let identity = DbIdentity::authenticated(user.id.as_str());
    let user_id = user.id.clone();
    let Onboarding {
        next,
        interests,
        age_group,
        use_purpose,
        platforms,
        nickname,
    } = input;
    let updated = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let query = if nickname.is_some() {
                    "update public.profiles set interests = $1, age_group = $2, use_purpose = $3, preferred_platforms = $4, nickname = $6 where id = $5::uuid"
                } else {
                    "update public.profiles set interests = $1, age_group = $2, use_purpose = $3, preferred_platforms = $4 where id = $5::uuid"
                };
                let mut query = sqlx::query(query)
                    .bind(interests)
                    .bind(age_group)
                    .bind(use_purpose)
                    .bind(platforms)
                    .bind(user_id);
                if let Some(nickname) = nickname {
                    query = query.bind(nickname);
                }
                query.execute(tx).await
            })
        })
        .await;
    match updated {
        Ok(_) => state_answer(json!({ "redirect": next }), cookies),
        Err(error) => {
            tracing::warn!(code = ?error.as_database_error().and_then(|e| e.code()), "onboarding update failed");
            state_answer(json!({ "error": true }), cookies)
        }
    }
}

const NICKNAME_LENGTH: &str = "닉네임은 2~20자로 지어 주세요";
const NICKNAME_TAKEN: &str = "이미 사용 중인 닉네임이에요";
const NICKNAME_FAILED: &str = "닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요";

/// `/my?nickname_error=…` as the action builds it (`encodeURIComponent`).
fn nickname_error(message: &str) -> String {
    format!("/my?nickname_error={}", js::encode_uri_component(message))
}

/// `updateNickname`: every answer is where the action redirects. Without a
/// user, sign in and come back; a nickname of other than 2 to 20 UTF-16
/// units once trimmed, or one the database refuses, comes back with its
/// message; else `/my?nickname_saved=1`.
async fn nickname(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return request::json(
            StatusCode::FORBIDDEN,
            json!({ "redirect": nickname_error(NICKNAME_FAILED) }).to_string(),
        );
    }
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_BODY_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    let nickname = js::trim(&field(&entries, "nickname")).to_owned();
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return state_answer(json!({ "redirect": "/login?next=/my" }), cookies);
    };
    if !(2..=20).contains(&js::utf16_len(&nickname)) {
        return state_answer(
            json!({ "redirect": nickname_error(NICKNAME_LENGTH) }),
            cookies,
        );
    }
    let identity = DbIdentity::authenticated(user.id.as_str());
    let user_id = user.id.clone();
    let updated = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query("update public.profiles set nickname = $1 where id = $2::uuid")
                    .bind(nickname)
                    .bind(user_id)
                    .execute(tx)
                    .await
            })
        })
        .await;
    let target = match updated {
        Ok(_) => "/my?nickname_saved=1".to_owned(),
        Err(error) => {
            let code = error
                .as_database_error()
                .and_then(|e| e.code())
                .map(|code| code.into_owned());
            if code.as_deref() == Some("23505") {
                nickname_error(NICKNAME_TAKEN)
            } else {
                tracing::warn!(?code, "nickname update failed");
                nickname_error(NICKNAME_FAILED)
            }
        }
    };
    state_answer(json!({ "redirect": target }), cookies)
}

/// The inquiry's fields as JSON: a subject of 120 and a body of 2,000 UTF-16
/// units, with room for escapes.
const MAX_INQUIRY_BYTES: usize = 64 * 1024;

/// zod's message for a value of the wrong type.
fn expected_string(value: Option<&Json>) -> String {
    let received = match value {
        None => "undefined",
        Some(Json::Null) => "null",
        Some(Json::Bool(_)) => "boolean",
        Some(Json::Number(_)) => "number",
        Some(Json::String(_)) => "string",
        Some(Json::Array(_)) => "array",
        Some(Json::Object(_)) => "object",
    };
    format!("Invalid input: expected string, received {received}")
}

/// `createInquirySchema.safeParse(input)`: the first issue's message, in the
/// order of the schema's keys.
pub fn parse_inquiry(entries: &[(String, Json)]) -> Result<(String, String, String), String> {
    let categories: Vec<&str> = crate::pages::account::support::CATEGORIES
        .iter()
        .map(|(value, _)| *value)
        .collect();
    let category = match property(entries, "category") {
        Some(Json::String(value)) if categories.contains(&value.as_str()) => value.clone(),
        _ => {
            let options: Vec<String> = categories
                .iter()
                .map(|value| format!("\"{value}\""))
                .collect();
            return Err(format!(
                "Invalid option: expected one of {}",
                options.join("|")
            ));
        }
    };
    let text =
        |key: &str, min: usize, max: usize, short: &str, long: &str| -> Result<String, String> {
            let value = property(entries, key);
            let Some(Json::String(raw)) = value else {
                return Err(expected_string(value));
            };
            let trimmed = js::trim(raw).to_owned();
            let length = js::utf16_len(&trimmed);
            if length < min {
                Err(short.to_owned())
            } else if length > max {
                Err(long.to_owned())
            } else {
                Ok(trimmed)
            }
        };
    let subject = text(
        "subject",
        1,
        120,
        "제목을 입력해 주세요.",
        "제목은 120자까지 쓸 수 있어요.",
    )?;
    let body = text(
        "body",
        10,
        2000,
        "내용을 10자 이상 적어 주세요.",
        "내용은 2,000자까지 쓸 수 있어요.",
    )?;
    Ok((category, subject, body))
}

/// `createInquiry`: the action's result, and on success the list as
/// `revalidatePath("/support")` shows it again.
async fn inquiry(State(state): State<AppState>, request: Request) -> Response {
    const FAILED: &str = "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
    if !request_is_trusted(&state, request.headers()) {
        return request::json(
            StatusCode::FORBIDDEN,
            json!({ "ok": false, "error": "server_error", "message": FAILED }).to_string(),
        );
    }
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_INQUIRY_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    let (category, subject, text) = match parse_inquiry(&entries) {
        Ok(input) => input,
        Err(message) => {
            return state_answer(
                json!({ "ok": false, "error": "invalid_input", "message": message }),
                Vec::new(),
            );
        }
    };
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return state_answer(
            json!({ "ok": false, "error": "login_required", "message": "로그인이 필요해요. 쓰던 내용은 저장해 둘게요." }),
            cookies,
        );
    };
    let identity = DbIdentity::authenticated(user.id.as_str());
    let user_id = user.id.clone();
    let inserted = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query("insert into public.support_inquiries (user_id, category, subject, body) values ($1::uuid, $2, $3, $4)")
                    .bind(user_id)
                    .bind(category)
                    .bind(subject)
                    .bind(text)
                    .execute(tx)
                    .await
            })
        })
        .await;
    if let Err(error) = inserted {
        let code = error
            .as_database_error()
            .and_then(|e| e.code())
            .map(|code| code.into_owned());
        let message = error
            .as_database_error()
            .map(|e| e.message().to_owned())
            .unwrap_or_default();
        if message.contains("rate_limited") || code.as_deref() == Some("P0429") {
            return state_answer(
                json!({ "ok": false, "error": "rate_limited", "message": "하루에 보낼 수 있는 문의 수를 넘었어요. 내일 다시 시도해 주세요." }),
                cookies,
            );
        }
        tracing::warn!(?code, "support inquiry insert failed");
        return state_answer(
            json!({ "ok": false, "error": "server_error", "message": FAILED }),
            cookies,
        );
    }
    let list = crate::pages::account::support::inquiries(&state, &user.id)
        .await
        .unwrap_or_default();
    let list = crate::pages::account::support::inquiries_section(&list).into_string();
    state_answer(json!({ "ok": true, "list": list }), cookies)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn onboarding_input_is_read_as_the_action_reads_it() {
        let entries = |text: &str| {
            Json::parse(text)
                .and_then(|json| json.as_object().map(<[_]>::to_vec))
                .unwrap()
        };
        let input = parse_onboarding(&entries(
            r#"{"next":"/about?x=1","interests":["dance","nope","dance"],"age_group":"20s","use_purpose":"brand","preferred_platforms":["x","myspace"],"nickname":"  밈러  "}"#,
        ));
        assert_eq!(
            input,
            Onboarding {
                next: "/about?x=1".into(),
                interests: vec!["dance".into(), "dance".into()],
                age_group: Some("20s".into()),
                use_purpose: "brand".into(),
                platforms: vec!["x".into()],
                nickname: Some("밈러".into()),
            }
        );
        let input = parse_onboarding(&entries(
            r#"{"next":"//evil","age_group":"","use_purpose":"x","nickname":"a"}"#,
        ));
        assert_eq!(input.next, "/");
        assert_eq!(input.age_group, None);
        assert_eq!(input.use_purpose, "creator");
        assert_eq!(input.nickname, None);
        assert!(input.interests.is_empty());
        let long = parse_onboarding(&entries(&format!(
            r#"{{"nickname":"{}"}}"#,
            "가".repeat(21)
        )));
        assert_eq!(long.nickname, None);
    }

    #[test]
    fn the_nickname_messages_travel_as_the_action_encodes_them() {
        assert_eq!(
            nickname_error(NICKNAME_TAKEN),
            "/my?nickname_error=%EC%9D%B4%EB%AF%B8%20%EC%82%AC%EC%9A%A9%20%EC%A4%91%EC%9D%B8%20%EB%8B%89%EB%84%A4%EC%9E%84%EC%9D%B4%EC%97%90%EC%9A%94"
        );
    }

    // Expected values: createInquirySchema.safeParse under zod 4.4.
    #[test]
    fn an_inquiry_is_read_as_its_schema_reads_it() {
        let read = |text: &str| {
            parse_inquiry(
                &Json::parse(text)
                    .and_then(|json| json.as_object().map(<[_]>::to_vec))
                    .unwrap(),
            )
        };
        assert_eq!(
            read(r#"{"category":"bug","subject":"  제목 ","body":" 열 글자가 넘는 내용이에요 "}"#),
            Ok((
                "bug".into(),
                "제목".into(),
                "열 글자가 넘는 내용이에요".into()
            ))
        );
        assert_eq!(
            read(r#"{"category":"x","subject":"","body":""}"#).unwrap_err(),
            r#"Invalid option: expected one of "bug"|"content"|"account"|"billing"|"suggestion"|"other""#
        );
        assert_eq!(
            read(r#"{"category":"bug","subject":"   ","body":""}"#).unwrap_err(),
            "제목을 입력해 주세요."
        );
        assert_eq!(
            read(r#"{"category":"bug","subject":"a","body":"짧아"}"#).unwrap_err(),
            "내용을 10자 이상 적어 주세요."
        );
        assert_eq!(
            read(r#"{"category":"bug","subject":1,"body":"x"}"#).unwrap_err(),
            "Invalid input: expected string, received number"
        );
        let long = format!(
            r#"{{"category":"bug","subject":"{}","body":"0123456789"}}"#,
            "가".repeat(121)
        );
        assert_eq!(read(&long).unwrap_err(), "제목은 120자까지 쓸 수 있어요.");
    }

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
