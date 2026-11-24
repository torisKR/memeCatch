//! `lib/actions/admin-catalog.ts`: the duplicate check and the registration
//! of an external meme (`/admin/memes/catalog/new`), both RPCs as the
//! operator. Their errors are `{ code, message, retryable }` objects; the
//! validation (`catalog_input.rs`) adds `fieldErrors`.

use axum::extract::{Request, State};
use axum::response::Response;
use serde_json::{Value, json};

use super::catalog_input::{Issues, duplicate_check, registration};
use super::{Call, answer, as_operator, call, db_message};
use crate::AppState;
use axum::http::StatusCode;

fn failure(code: &str, message: &str, retryable: bool) -> Response {
    answer(
        StatusCode::OK,
        &json!({ "ok": false, "error": { "code": code, "message": message, "retryable": retryable } }),
    )
}

fn invalid(message: &str, issues: &Issues) -> Response {
    answer(
        StatusCode::OK,
        &json!({ "ok": false, "error": { "code": "invalid_input", "message": message, "retryable": false, "fieldErrors": issues.field_errors() } }),
    )
}

/// `parseMatches`: the well-formed matches the RPC returned.
fn matches(value: Option<&Value>) -> Value {
    let rows = value.and_then(Value::as_array).cloned().unwrap_or_default();
    let text = |row: &Value, key: &str| row.get(key).and_then(Value::as_str).map(str::to_owned);
    Value::Array(
        rows.iter()
            .filter_map(|row| {
                let reason =
                    text(row, "reason").filter(|reason| reason == "title" || reason == "source")?;
                Some(json!({
                    "reason": reason,
                    "memeId": text(row, "memeId")?,
                    "title": text(row, "title")?,
                    "shortId": text(row, "shortId")?,
                    "slug": text(row, "slug")?,
                    "sourceUrl": text(row, "sourceUrl"),
                }))
            })
            .collect(),
    )
}

async fn rpc(
    state: &AppState,
    actor: &crate::auth::SessionUser,
    sql: &'static str,
    args: (Option<String>, Option<Vec<String>>),
) -> Result<Option<String>, sqlx::Error> {
    as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                let mut query = sqlx::query_scalar::<_, Option<String>>(sql).bind(args.0);
                if let Some(list) = args.1 {
                    query = query.bind(list);
                }
                query.fetch_one(tx).await
            })
        }),
    )
    .await
}

/// `checkCatalogMemeDuplicates({ title, sourceUrls })`.
pub async fn check_duplicates(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (title, urls) = match duplicate_check(&input) {
        Ok(parsed) => parsed,
        Err(issues) => return invalid("제목과 출처 URL을 확인해 주세요.", &issues),
    };
    let found = rpc(
        &state,
        &actor,
        "select public.find_catalog_meme_duplicates(p_title => $1, p_source_urls => $2::text[])::text",
        (Some(title), Some(urls)),
    )
    .await;
    match found {
        Err(_) => failure(
            "duplicate_check_failed",
            "중복 검사를 완료하지 못했어요.",
            true,
        ),
        Ok(text) => {
            let data: Option<Value> = text.and_then(|text| serde_json::from_str(&text).ok());
            super::ok_with(json!({ "matches": matches(data.as_ref()) }))
        }
    }
}

/// `registerCatalogMeme(input)`: a pending catalog meme with its sources, or
/// the duplicates the RPC found.
pub async fn register(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let normalized = match registration(&input) {
        Ok(normalized) => normalized,
        Err(issues) => return invalid("등록 내용을 확인해 주세요.", &issues),
    };
    let saved = rpc(
        &state,
        &actor,
        "select public.register_catalog_meme(p_input => $1::jsonb)::text",
        (Some(normalized.to_string()), None),
    )
    .await;
    let text = match saved {
        Err(error) => {
            let message = db_message(&error);
            let auth = message.contains("operator_required") || message.contains("signed_out");
            return if auth {
                failure("operator_required", "운영자 권한이 필요해요.", false)
            } else {
                failure(
                    "save_failed",
                    "등록을 저장하지 못했어요. 같은 요청 ID로 다시 시도해 주세요.",
                    true,
                )
            };
        }
        Ok(text) => text,
    };
    let result: Option<Value> = text.and_then(|text| serde_json::from_str(&text).ok());
    let Some(Value::Object(result)) = result else {
        return failure("invalid_response", "등록 결과를 확인하지 못했어요.", true);
    };
    let status = result.get("status").and_then(Value::as_str);
    if status == Some("duplicate") {
        return super::ok_with(
            json!({ "status": "duplicate", "matches": matches(result.get("matches")) }),
        );
    }
    let text = |key: &str| result.get(key).and_then(Value::as_str);
    match (status, text("memeId"), text("shortId"), text("slug")) {
        (
            Some(status @ ("created" | "duplicate_request")),
            Some(meme_id),
            Some(short_id),
            Some(slug),
        ) => super::ok_with(
            json!({ "status": status, "memeId": meme_id, "shortId": short_id, "slug": slug }),
        ),
        _ => failure("invalid_response", "등록 결과를 확인하지 못했어요.", true),
    }
}
