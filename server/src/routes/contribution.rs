//! `POST /api/memes/contribution`: `submitMemeContribution` of
//! `app/(default)/submit/actions.ts`, the server action behind the meme
//! page's "이 문서에 출처·예문 보태기" form, as an endpoint. Next keeps its
//! action for its own form; the native meme page posts here. Route id
//! `meme-contribution`, so it can be switched off alone (the native meme page
//! then hands the document to Next). Batch B6 reuses it for the other forms
//! that send contributions.
//!
//! In the action's order: submissions closed; the body as its zod schema
//! reads it (the first issue's message); signed in; then
//! `submit_meme_contribution` as that user, whose refusals become the
//! action's messages. The answer is the action's result, as JSON, with 200.
//! The action has no rate limit of its own: the database function is the
//! limit (ten an hour, twenty waiting for review).

use axum::Router;
use axum::extract::{FromRequestParts, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use axum::routing::post;
use serde_json::json;

use super::Routes;
use super::origin::request_is_trusted;
use super::public::js;
use super::request::{self, Json, property};
use crate::AppState;
use crate::auth::RequestIdentity;
use crate::db::IdentityOptions;

/// The form's fields are at most 1,420 UTF-16 units; a body far past that is
/// not the form.
const MAX_BODY_BYTES: usize = 16 * 1024;
const SUBMIT: &str = "select public.submit_meme_contribution($1::uuid, $2, $3, $4, $5, $6, $7)";

const CLOSED: &str = "지금은 제보를 잠시 받지 않고 있어요.";
const LOGIN: &str = "로그인하면 제보할 수 있어요.";
const FAILED: &str = "제보를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.";
const CHECK_INPUT: &str = "입력값을 확인해 주세요.";
const NOT_HTTPS: &str = "https://로 시작하는 링크를 넣어 주세요.";

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("meme-contribution", "/api/memes/contribution", post(submit))
        .build()
}

/// A valid contribution, trimmed.
#[derive(Debug, PartialEq, Eq)]
pub enum Contribution {
    Source { url: String, note: String },
    Example { situation: String, text: String },
}

#[derive(Debug, PartialEq, Eq)]
pub struct Input {
    pub meme_id: String,
    pub contribution: Contribution,
    pub credit_public: bool,
}

fn result(status: StatusCode, error: &str, message: &str) -> Response {
    let body = json!({ "ok": false, "error": error, "message": message });
    request::json(status, body.to_string())
}

pub async fn submit(State(state): State<AppState>, request: Request) -> Response {
    // Next refuses an action from another origin before it runs it.
    if !request_is_trusted(&state, request.headers()) {
        return result(StatusCode::FORBIDDEN, "failed", FAILED);
    }
    if !state.config.submissions_open {
        return result(StatusCode::OK, "closed", CLOSED);
    }
    let (mut parts, body) = request.into_parts();
    let Ok(bytes) = request::read_at_most(body, MAX_BODY_BYTES).await else {
        return result(StatusCode::OK, "invalid", CHECK_INPUT);
    };
    let parsed = Json::parse(&request::decode_text(&bytes))
        .ok_or_else(|| CHECK_INPUT.to_owned())
        .and_then(|json| parse(&json));
    let input = match parsed {
        Ok(input) => input,
        Err(message) => return result(StatusCode::OK, "invalid", &message),
    };
    // `getUser()` finds no user when there is no session or it cannot be read.
    let Ok(RequestIdentity(Some(user))) =
        RequestIdentity::from_request_parts(&mut parts, &state).await
    else {
        return result(StatusCode::OK, "login_required", LOGIN);
    };
    let (kind, url, note, situation, example) = match input.contribution {
        Contribution::Source { url, note } => {
            let note = (!note.is_empty()).then_some(note);
            ("source", Some(url), note, None, None)
        }
        Contribution::Example { situation, text } => {
            ("example", None, None, Some(situation), Some(text))
        }
    };
    let (meme_id, credit) = (input.meme_id, input.credit_public);
    let outcome = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(SUBMIT)
                    .bind(meme_id)
                    .bind(kind)
                    .bind(url)
                    .bind(note)
                    .bind(situation)
                    .bind(example)
                    .bind(credit)
                    .execute(tx)
                    .await
            })
        })
        .await;
    let error = match outcome {
        Ok(_) => return request::json(StatusCode::OK, r#"{"ok":true}"#),
        Err(error) => error,
    };
    let (code, message) = match &error {
        sqlx::Error::Database(database) => (
            database.code().map(|code| code.into_owned()),
            database.message().to_owned(),
        ),
        _ => (None, String::new()),
    };
    let (error_code, text) = refusal(code.as_deref(), &message);
    if error_code == "failed" {
        tracing::warn!(%error, "submit_meme_contribution failed");
    }
    result(StatusCode::OK, error_code, text)
}

/// The action's reading of the database function's refusal.
pub fn refusal(code: Option<&str>, message: &str) -> (&'static str, &'static str) {
    if message.contains("login_required") {
        ("login_required", LOGIN)
    } else if message.contains("too_many_pending") {
        (
            "too_many_pending",
            "검수를 기다리는 제보가 많아요. 먼저 보낸 제보가 처리되면 다시 보내 주세요.",
        )
    } else if code == Some("P0429") || message.contains("rate_limited") {
        (
            "rate_limited",
            "제보가 많아 잠시 쉬어 가요. 1시간 뒤에 다시 보내 주세요.",
        )
    } else if message.contains("already_linked") {
        ("duplicate", "이미 이 문서에 연결된 링크예요.")
    } else if message.contains("already_pending") {
        ("duplicate", "같은 링크가 이미 검토를 기다리고 있어요.")
    } else if message.contains("invalid_url") {
        ("invalid", NOT_HTTPS)
    } else {
        ("failed", FAILED)
    }
}

/// zod's name for what a value is, in "expected string, received …".
fn received(value: Option<&Json>) -> &'static str {
    match value {
        None => "undefined",
        Some(Json::Null) => "null",
        Some(Json::Bool(_)) => "boolean",
        Some(Json::Number(_)) => "number",
        Some(Json::String(_)) => "string",
        Some(Json::Array(_)) => "array",
        Some(Json::Object(_)) => "object",
    }
}

fn expected(kind: &str, value: Option<&Json>) -> String {
    format!(
        "Invalid input: expected {kind}, received {}",
        received(value)
    )
}

/// `z.uuid()`: versions 1 to 8 with the RFC variant (hex digits in either
/// case), or the nil or max UUID written in lower case only, as zod's
/// pattern spells them.
pub(crate) fn is_zod_uuid(value: &str) -> bool {
    if value == "00000000-0000-0000-0000-000000000000"
        || value == "ffffffff-ffff-ffff-ffff-ffffffffffff"
    {
        return true;
    }
    let bytes = value.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            14 => matches!(byte, b'1'..=b'8'),
            19 => matches!(byte.to_ascii_lowercase(), b'8' | b'9' | b'a' | b'b'),
            _ => byte.is_ascii_hexdigit(),
        })
}

/// `/^https:\/\/\S+\.\S+$/`: no JavaScript whitespace, and a dot with at
/// least one character on each side.
fn is_https_link(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("https://") else {
        return false;
    };
    let chars: Vec<char> = rest.chars().collect();
    !chars.iter().any(|c| js::is_space(*c))
        && chars.len() >= 3
        && chars[1..chars.len() - 1].contains(&'.')
}

/// A string field: trimmed, not empty when `required` says so, at most
/// `max` UTF-16 units.
fn text_field(
    object: &[(String, Json)],
    name: &str,
    required: Option<&str>,
    (max, too_long): (usize, &str),
) -> Result<String, String> {
    let value = property(object, name);
    let Some(text) = value.and_then(Json::as_str) else {
        return Err(expected("string", value));
    };
    let text = js::trim(text).to_owned();
    if let Some(message) = required.filter(|_| text.is_empty()) {
        return Err(message.to_owned());
    }
    if js::utf16_len(&text) > max {
        return Err(too_long.to_owned());
    }
    Ok(text)
}

/// `contributionSchema.safeParse(input)`: the input, or the message of the
/// first issue zod reports (field order: memeId, kind, then the kind's own).
pub fn parse(json: &Json) -> Result<Input, String> {
    let Some(object) = json.as_object() else {
        return Err(expected("object", Some(json)));
    };
    let kind = property(object, "kind").and_then(Json::as_str);
    if !matches!(kind, Some("source" | "example")) {
        return Err("Invalid discriminator value. Expected 'source' | 'example'".to_owned());
    }
    let meme_id = property(object, "memeId");
    let meme_id = match meme_id.and_then(Json::as_str) {
        Some(id) if is_zod_uuid(id) => id.to_owned(),
        Some(_) => return Err("Invalid UUID".to_owned()),
        None => return Err(expected("string", meme_id)),
    };
    let contribution = if kind == Some("source") {
        let url = text_field(
            object,
            "sourceUrl",
            None,
            (500, "링크는 500자까지 넣을 수 있어요."),
        )?;
        if !is_https_link(&url) {
            return Err(NOT_HTTPS.to_owned());
        }
        let note = match property(object, "note") {
            None => String::new(),
            Some(_) => text_field(
                object,
                "note",
                None,
                (300, "설명은 300자까지 쓸 수 있어요."),
            )?,
        };
        Contribution::Source { url, note }
    } else {
        let situation = text_field(
            object,
            "situation",
            Some("어떤 상황에서 썼는지 적어 주세요."),
            (120, "상황은 120자까지 쓸 수 있어요."),
        )?;
        let text = text_field(
            object,
            "text",
            Some("실제로 쓴 문장을 적어 주세요."),
            (500, "예문은 500자까지 쓸 수 있어요."),
        )?;
        Contribution::Example { situation, text }
    };
    let credit_public = match property(object, "creditPublic") {
        None => false,
        Some(Json::Bool(value)) => *value,
        other => return Err(expected("boolean", other)),
    };
    Ok(Input {
        meme_id,
        contribution,
        credit_public,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "00000000-0000-4000-8000-000000000001";

    fn parsed(text: &str) -> Result<Input, String> {
        parse(&Json::parse(text).expect("json"))
    }

    fn message(text: &str) -> String {
        parsed(text).expect_err("invalid")
    }

    #[test]
    fn a_source_is_trimmed_checked_and_its_note_optional() {
        let input = parsed(&format!(
            r#"{{"memeId":"{ID}","kind":"source","sourceUrl":"  https://news.example.org/a  ","creditPublic":true}}"#
        ))
        .expect("valid");
        assert_eq!(
            input,
            Input {
                meme_id: ID.to_owned(),
                contribution: Contribution::Source {
                    url: "https://news.example.org/a".to_owned(),
                    note: String::new()
                },
                credit_public: true,
            }
        );
        let source =
            |url: &str| format!(r#"{{"memeId":"{ID}","kind":"source","sourceUrl":{url}}}"#);
        assert_eq!(message(&source(r#""http://x.org""#)), NOT_HTTPS);
        assert_eq!(message(&source(r#""https://localhost""#)), NOT_HTTPS);
        assert_eq!(message(&source(r#""https://a b.org""#)), NOT_HTTPS);
        assert_eq!(
            message(&source(&format!("\"https://a.org/{}\"", "x".repeat(490)))),
            "링크는 500자까지 넣을 수 있어요."
        );
        assert_eq!(
            message(&source("5")),
            "Invalid input: expected string, received number"
        );
        assert!(parsed(&source(r#""https://a.b""#)).is_ok());
    }

    #[test]
    fn an_example_needs_both_fields_and_the_other_messages_are_zods() {
        let example = |situation: &str, text: &str| {
            format!(r#"{{"memeId":"{ID}","kind":"example","situation":{situation},"text":{text}}}"#)
        };
        assert_eq!(
            message(&example(r#"" ""#, r#""a""#)),
            "어떤 상황에서 썼는지 적어 주세요."
        );
        assert_eq!(
            message(&example(r#""a""#, r#""""#)),
            "실제로 쓴 문장을 적어 주세요."
        );
        assert_eq!(
            message(&example(&format!("\"{}\"", "가".repeat(121)), r#""a""#)),
            "상황은 120자까지 쓸 수 있어요."
        );
        // Measured on zod 4 of the repository root.
        assert_eq!(
            message(r#"{"memeId":"x","kind":"zzz"}"#),
            "Invalid discriminator value. Expected 'source' | 'example'"
        );
        assert_eq!(
            message(r#"{"kind":"source"}"#),
            "Invalid input: expected string, received undefined"
        );
        assert_eq!(message(r#"{"memeId":"x","kind":"source"}"#), "Invalid UUID");
        assert_eq!(
            message("null"),
            "Invalid input: expected object, received null"
        );
        assert_eq!(
            message(&format!(
                r#"{{"memeId":"{ID}","kind":"example","situation":"a","text":"b","creditPublic":"yes"}}"#
            )),
            "Invalid input: expected boolean, received string"
        );
        assert!(is_zod_uuid("00000000-0000-0000-0000-000000000000"));
        assert!(!is_zod_uuid("00000000-0000-0000-0000-000000000001"));
        // zod 4's pattern has no `i` flag: the max UUID only in lower case,
        // the versioned forms in any case.
        assert!(is_zod_uuid("ffffffff-ffff-ffff-ffff-ffffffffffff"));
        assert!(!is_zod_uuid("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"));
        assert!(!is_zod_uuid("FfFfFfFf-ffff-ffff-ffff-ffffffffffff"));
        assert!(is_zod_uuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11"));
        assert_eq!(
            message(
                r#"{"memeId":"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF","kind":"example","situation":"a","text":"b"}"#
            ),
            "Invalid UUID"
        );
    }

    #[test]
    fn the_functions_refusals_read_as_the_action_reads_them() {
        assert_eq!(refusal(Some("42501"), "login_required").0, "login_required");
        assert_eq!(
            refusal(Some("P0429"), "too_many_pending").0,
            "too_many_pending"
        );
        assert_eq!(refusal(Some("P0429"), "rate_limited").0, "rate_limited");
        assert_eq!(
            refusal(Some("23505"), "already_linked").1,
            "이미 이 문서에 연결된 링크예요."
        );
        assert_eq!(
            refusal(Some("23505"), "already_pending").1,
            "같은 링크가 이미 검토를 기다리고 있어요."
        );
        assert_eq!(refusal(Some("22023"), "invalid_url").0, "invalid");
        assert_eq!(refusal(Some("22023"), "meme_not_found").0, "failed");
        assert_eq!(refusal(None, "").0, "failed");
    }
}
