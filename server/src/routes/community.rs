//! The community writes of lib/actions/community.ts for the native pages of
//! batch B6 (PLAN.md section B6), each under its own route id.
//!
//! | Route id | Path | Action |
//! | --- | --- | --- |
//! | `community-comment` | `POST /api/community/comment` | `postComment` (the meme page's comments) |
//! | `community-report` | `POST /api/community/report` | `reportContent` |
//! | `community-post-comment` | `POST /api/community/post-comment` | `createCommunityComment` (app/(default)/community/actions.ts) |
//!
//! Like a server action: another origin is refused, the body is the action's
//! input as JSON, the answer is its result as JSON with 200 and the cookies
//! its `getSession` set. The writes are security-definer functions called
//! as the signed-in caller (`authenticated`), as `createClient()` calls them.
//!
//! Without a session the answer is `login_required`, what the functions
//! raise for a caller without an id. Next calls them as `anon`, which may not
//! execute them (`42501`), so its actions answer `server_error` instead and
//! the form's sign-in link never shows: an intended difference (PLAN.md
//! B6-20).

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::SET_COOKIE;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::post;
use serde_json::{Value, json};

use super::Routes;
use super::better_auth::action_user;
use super::contribution::is_zod_uuid;
use super::origin::request_is_trusted;
use super::public::js;
use super::request::{self, Json, property};
use crate::AppState;
use crate::auth::now_ms;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::community::post as post_page;

/// A comment of 2,000 or a reason of 500 UTF-16 units, with room for escapes.
const MAX_BODY_BYTES: usize = 64 * 1024;

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("community-comment", "/api/community/comment", post(comment))
        .add("community-report", "/api/community/report", post(report))
        .add(
            "community-post-comment",
            "/api/community/post-comment",
            post(post_comment),
        )
        .build()
}

fn failure(error: &str, message: &str) -> Value {
    json!({ "ok": false, "error": error, "message": message })
}

fn answer(body: Value, cookies: Vec<String>) -> Response {
    let mut response = request::json(StatusCode::OK, body.to_string());
    for line in cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            response.headers_mut().append(SET_COOKIE, value);
        }
    }
    response
}

/// `mapRpcError` of lib/actions/community.ts.
pub fn rpc_failure(code: Option<&str>, message: &str) -> Value {
    if message.contains("login_required") {
        failure(
            "login_required",
            "로그인이 필요해요. 쓰던 내용은 저장해 둘게요.",
        )
    } else if message.contains("rate_limited") || code == Some("P0429") {
        failure(
            "rate_limited",
            "잠깐만요 — 짧은 시간에 너무 많이 작성했어요. 잠시 후 다시 시도해 주세요.",
        )
    } else {
        failure(
            "server_error",
            "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        )
    }
}

/// `mapRpcError` of app/(default)/community/actions.ts: the one above, and
/// two refusals of the post functions.
pub fn post_rpc_failure(code: Option<&str>, message: &str) -> Value {
    let mapped = rpc_failure(code, message);
    if mapped["error"] != "server_error" {
        mapped
    } else if message.contains("community_disabled") {
        failure("community_disabled", "커뮤니티 기능이 잠시 중단됐어요.")
    } else if message.contains("post_not_found") {
        failure("not_found", "글을 찾을 수 없어요. 삭제됐을 수 있어요.")
    } else {
        mapped
    }
}

/// zod's message for a value of the wrong type.
fn expected(kind: &str, value: Option<&Json>) -> String {
    let received = match value {
        None => "undefined",
        Some(Json::Null) => "null",
        Some(Json::Bool(_)) => "boolean",
        Some(Json::Number(_)) => "number",
        Some(Json::String(_)) => "string",
        Some(Json::Array(_)) => "array",
        Some(Json::Object(_)) => "object",
    };
    format!("Invalid input: expected {kind}, received {received}")
}

/// `z.uuid()`.
fn uuid(entries: &[(String, Json)], key: &str) -> Result<String, String> {
    match property(entries, key) {
        Some(Json::String(value)) if is_zod_uuid(value) => Ok(value.clone()),
        Some(Json::String(_)) => Err("Invalid UUID".to_owned()),
        other => Err(expected("string", other)),
    }
}

/// `z.string().trim().min(min, short).max(max, long)`.
fn text(
    entries: &[(String, Json)],
    key: &str,
    (min, short): (usize, &str),
    (max, long): (usize, &str),
) -> Result<String, String> {
    let value = property(entries, key);
    let Some(Json::String(raw)) = value else {
        return Err(expected("string", value));
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
}

/// `postCommentSchema`: `memeId`, `parentId` (a UUID, `null` or absent), `body`.
pub fn parse_comment(
    entries: &[(String, Json)],
) -> Result<(String, Option<String>, String), String> {
    let meme_id = uuid(entries, "memeId")?;
    let parent_id = match property(entries, "parentId") {
        None | Some(Json::Null) => None,
        Some(_) => Some(uuid(entries, "parentId")?),
    };
    let body = text(
        entries,
        "body",
        (1, "내용을 입력해 주세요."),
        (2000, "2,000자까지 쓸 수 있어요."),
    )?;
    Ok((meme_id, parent_id, body))
}

/// `fileReportSchema`: `targetType`, `targetId`, `reason`.
pub fn parse_report(entries: &[(String, Json)]) -> Result<(String, String, String), String> {
    const TARGETS: [&str; 3] = ["meme", "discussion", "submission"];
    let target = match property(entries, "targetType") {
        Some(Json::String(value)) if TARGETS.contains(&value.as_str()) => value.clone(),
        _ => {
            return Err(
                r#"Invalid option: expected one of "meme"|"discussion"|"submission""#.to_owned(),
            );
        }
    };
    let target_id = uuid(entries, "targetId")?;
    let reason = text(
        entries,
        "reason",
        (1, "신고 사유를 입력해 주세요."),
        (500, "500자까지 쓸 수 있어요."),
    )?;
    Ok((target, target_id, reason))
}

/// `createCommentSchema`: `postId`, `body`.
pub fn parse_post_comment(entries: &[(String, Json)]) -> Result<(String, String), String> {
    let post_id = uuid(entries, "postId")?;
    let body = text(
        entries,
        "body",
        (1, "내용을 입력해 주세요."),
        (1000, "1,000자까지 쓸 수 있어요."),
    )?;
    Ok((post_id, body))
}

async fn read_entries(request: Request) -> (axum::http::request::Parts, Vec<(String, Json)>) {
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_BODY_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    (parts, entries)
}

fn database_error(error: &sqlx::Error) -> (Option<String>, String) {
    let code = error
        .as_database_error()
        .and_then(|e| e.code())
        .map(|code| code.into_owned());
    let message = error
        .as_database_error()
        .map(|e| e.message().to_owned())
        .unwrap_or_default();
    (code, message)
}

/// The database's refusal as the action reads it.
fn refused(error: &sqlx::Error) -> Value {
    let (code, message) = database_error(error);
    let mapped = rpc_failure(code.as_deref(), &message);
    if mapped["error"] == "server_error" {
        tracing::warn!(?code, "community write failed");
    }
    mapped
}

/// `postComment`.
async fn comment(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return untrusted();
    }
    if !state.config.community_enabled {
        return answer(
            failure("community_disabled", "커뮤니티 기능은 아직 준비 중이에요."),
            Vec::new(),
        );
    }
    let (parts, entries) = read_entries(request).await;
    let (meme_id, parent_id, body) = match parse_comment(&entries) {
        Ok(input) => input,
        Err(message) => return answer(failure("invalid_input", &message), Vec::new()),
    };
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return answer(rpc_failure(None, "login_required"), cookies);
    };
    let identity = DbIdentity::authenticated(user.id.as_str());
    let written: Result<String, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar("select public.post_comment($1::uuid, $2::uuid, $3)::text")
                    .bind(meme_id)
                    .bind(parent_id)
                    .bind(body)
                    .fetch_one(tx)
                    .await
            })
        })
        .await;
    match written {
        Ok(id) => answer(json!({ "ok": true, "data": { "commentId": id } }), cookies),
        Err(error) => answer(refused(&error), cookies),
    }
}

/// `reportContent`.
async fn report(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return untrusted();
    }
    let (parts, entries) = read_entries(request).await;
    let (target, target_id, reason) = match parse_report(&entries) {
        Ok(input) => input,
        Err(message) => return answer(failure("invalid_input", &message), Vec::new()),
    };
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return answer(rpc_failure(None, "login_required"), cookies);
    };
    let identity = DbIdentity::authenticated(user.id.as_str());
    let written: Result<Option<String>, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(
                    "select public.file_report($1::report_target, $2::uuid, $3)::text",
                )
                .bind(target)
                .bind(target_id)
                .bind(reason)
                .fetch_one(tx)
                .await
            })
        })
        .await;
    match written {
        Ok(_) => answer(json!({ "ok": true, "data": null }), cookies),
        Err(error) => answer(refused(&error), cookies),
    }
}

fn untrusted() -> Response {
    request::json(
        StatusCode::FORBIDDEN,
        failure(
            "server_error",
            "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.",
        )
        .to_string(),
    )
}

/// `createCommunityComment`. Next's action then refreshes the page; the
/// answer carries the comments rendered again (`list`, `count`).
async fn post_comment(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return untrusted();
    }
    let (parts, entries) = read_entries(request).await;
    let (post_id, body) = match parse_post_comment(&entries) {
        Ok(input) => input,
        Err(message) => return answer(failure("invalid_input", &message), Vec::new()),
    };
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return answer(rpc_failure(None, "login_required"), cookies);
    };
    let identity = DbIdentity::authenticated(user.id.as_str());
    let target = post_id.clone();
    let written: Result<String, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar("select public.create_community_comment($1::uuid, $2)::text")
                    .bind(target)
                    .bind(body)
                    .fetch_one(tx)
                    .await
            })
        })
        .await;
    match written {
        Ok(id) => {
            let comments = post_page::read_comments(&state, &post_id).await;
            let list = post_page::comments_list(&comments, now_ms()).into_string();
            answer(
                json!({ "ok": true, "data": { "commentId": id }, "list": list, "count": comments.len() }),
                cookies,
            )
        }
        Err(error) => {
            let (code, message) = database_error(&error);
            let mapped = post_rpc_failure(code.as_deref(), &message);
            if mapped["error"] == "server_error" {
                tracing::warn!(?code, "community post comment failed");
            }
            answer(mapped, cookies)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    fn entries(text: &str) -> Vec<(String, Json)> {
        Json::parse(text)
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap()
    }

    // Expected values: postCommentSchema and fileReportSchema under zod 4.4.
    #[test]
    fn inputs_are_read_as_the_schemas_read_them() {
        assert_eq!(
            parse_comment(&entries(&format!(
                r#"{{"memeId":"{ID}","body":"  좋아요 "}}"#
            ))),
            Ok((ID.to_owned(), None, "좋아요".to_owned()))
        );
        assert_eq!(
            parse_comment(&entries(&format!(
                r#"{{"memeId":"{ID}","parentId":null,"body":" "}}"#
            )))
            .unwrap_err(),
            "내용을 입력해 주세요."
        );
        assert_eq!(
            parse_comment(&entries(r#"{"memeId":"x","body":"a"}"#)).unwrap_err(),
            "Invalid UUID"
        );
        assert_eq!(
            parse_comment(&entries(&format!(
                r#"{{"memeId":"{ID}","parentId":"x","body":"a"}}"#
            )))
            .unwrap_err(),
            "Invalid UUID"
        );
        assert_eq!(
            parse_report(&entries(&format!(
                r#"{{"targetType":"meme","targetId":"{ID}","reason":" 스팸 "}}"#
            ))),
            Ok(("meme".to_owned(), ID.to_owned(), "스팸".to_owned()))
        );
        assert_eq!(
            parse_report(&entries(&format!(
                r#"{{"targetType":"post","targetId":"{ID}","reason":"a"}}"#
            )))
            .unwrap_err(),
            r#"Invalid option: expected one of "meme"|"discussion"|"submission""#
        );
        assert_eq!(
            parse_report(&entries(&format!(
                r#"{{"targetType":"meme","targetId":"{ID}","reason":1}}"#
            )))
            .unwrap_err(),
            "Invalid input: expected string, received number"
        );
        assert_eq!(
            parse_post_comment(&entries(&format!(r#"{{"postId":"{ID}","body":" 댓글 "}}"#))),
            Ok((ID.to_owned(), "댓글".to_owned()))
        );
        assert_eq!(
            parse_post_comment(&entries(&format!(
                r#"{{"postId":"{ID}","body":"{}"}}"#,
                "가".repeat(1001)
            )))
            .unwrap_err(),
            "1,000자까지 쓸 수 있어요."
        );
        assert_eq!(
            post_rpc_failure(None, "post_not_found")["error"],
            "not_found"
        );
        assert_eq!(
            post_rpc_failure(None, "community_disabled")["message"],
            "커뮤니티 기능이 잠시 중단됐어요."
        );
        assert_eq!(
            post_rpc_failure(None, "login_required")["error"],
            "login_required"
        );
        assert_eq!(rpc_failure(Some("P0429"), "")["error"], "rate_limited");
        assert_eq!(
            rpc_failure(None, "login_required")["error"],
            "login_required"
        );
        assert_eq!(rpc_failure(None, "boom")["error"], "server_error");
    }
}
