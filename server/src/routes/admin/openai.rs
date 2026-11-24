//! `requestOpenAiStructured` of `lib/openai-review.server.ts`: one Responses
//! API call with a strict JSON schema, for the operator's drafts. The same
//! body (key order included), headers, model, reasoning effort, 90-second
//! limit and error messages as the TypeScript; no retries.
//!
//! The address is `OPENAI_REVIEW_BASE_URL` (default
//! `https://api.openai.com/v1`) plus `/responses`, as in the TypeScript; the
//! parity run points both servers at one loopback HTTPS stub with it. The
//! client is HTTPS only: an `http:` base address fails as `fetch failed`.

use std::time::Duration;

use axum::http::HeaderValue;
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;

use crate::AppState;
use crate::routes::js_json;
use crate::routes::public::js;
use crate::routes::request::Json;

/// `OPENAI_REVIEW_MODEL` and `OPENAI_REVIEW_REASONING_EFFORT`.
pub const MODEL: &str = "gpt-5.6-sol";
pub const REASONING_EFFORT: &str = "high";
const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const TIMEOUT: Duration = Duration::from_secs(90);
const BODY_LIMIT: usize = 16 * 1024 * 1024;
const MAX_OUTPUT_TOKENS: u32 = 8_192;

/// `isOpenAiReviewConfigured()`.
pub fn configured(state: &AppState) -> bool {
    state.config.openai_api_key.is_some()
}

/// A structured request: `schema` is the schema's JSON text in the key
/// order of the TypeScript constant.
pub struct Structured<'a> {
    pub name: &'a str,
    pub schema: &'a str,
    pub instructions: &'a str,
    pub input: &'a str,
}

/// The `JSON.stringify` body of the TypeScript, keys in its order.
fn body(request: &Structured) -> String {
    let text = |value: &str| Value::from(value).to_string();
    format!(
        r#"{{"model":"{MODEL}","reasoning":{{"effort":"{REASONING_EFFORT}"}},"instructions":{},"input":{},"max_output_tokens":{MAX_OUTPUT_TOKENS},"store":false,"text":{{"format":{{"type":"json_schema","name":{},"strict":true,"schema":{}}}}}}}"#,
        text(request.instructions),
        text(request.input),
        text(request.name),
        request.schema
    )
}

/// `responseText`: `output_text`, else the first `output_text` block.
fn response_text(payload: &Value) -> Option<String> {
    let record = payload.as_object()?;
    if let Some(text) = record
        .get("output_text")
        .and_then(Value::as_str)
        .map(js::trim)
        .filter(|text| !text.is_empty())
    {
        return Some(text.to_owned());
    }
    record
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("content").and_then(Value::as_array))
        .flatten()
        .find_map(|block| {
            (block.get("type").and_then(Value::as_str) == Some("output_text"))
                .then(|| {
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .map(js::trim)
                        .filter(|text| !text.is_empty())
                })
                .flatten()
                .map(str::to_owned)
        })
}

/// The first `count` UTF-16 units of `text` (`String.prototype.slice`).
fn utf16_prefix(text: &str, count: usize) -> String {
    let mut used = 0;
    let mut out = String::new();
    for c in text.chars() {
        used += c.len_utf16();
        if used > count {
            break;
        }
        out.push(c);
    }
    out
}

/// The structured answer, parsed with its keys in order, or the message of
/// the error the TypeScript throws.
pub async fn structured(state: &AppState, request: &Structured<'_>) -> Result<Json, String> {
    let Some(key) = state.config.openai_api_key.as_ref() else {
        return Err("OPENAI_API_KEY 설정 필요".to_owned());
    };
    let base = state
        .config
        .openai_review_base_url
        .as_deref()
        .unwrap_or(DEFAULT_BASE_URL)
        .trim_end_matches('/');
    let url = url::Url::parse(&format!("{base}/responses"))
        .map_err(|_| "Failed to parse URL".to_owned())?;
    let authorization = HeaderValue::from_str(&format!("Bearer {}", key.expose()))
        .map_err(|_| "fetch failed".to_owned())?;
    let (status, bytes) = state
        .outbound
        .post_read(
            &url,
            &[
                (AUTHORIZATION, authorization),
                (CONTENT_TYPE, HeaderValue::from_static("application/json")),
            ],
            body(request),
            TIMEOUT,
            BODY_LIMIT,
        )
        .await
        .map_err(|error| error.message().to_owned())?;
    let payload: Option<Value> = serde_json::from_slice(&bytes).ok();
    if !status.is_success() {
        let detail = payload
            .as_ref()
            .and_then(|payload| payload.get("error"))
            .and_then(|error| error.get("message"))
            .and_then(Value::as_str)
            .map(|message| format!(" {}", utf16_prefix(message, 240)))
            .unwrap_or_default();
        return Err(format!(
            "GPT 검수 호출에 실패했어요 ({}).{detail}",
            status.as_u16()
        ));
    }
    let text = payload
        .as_ref()
        .and_then(response_text)
        .ok_or_else(|| "GPT 검수 응답이 비어 있어요. 다시 시도해 주세요.".to_owned())?;
    Json::parse(&text)
        .ok_or_else(|| "GPT 검수 응답을 해석하지 못했어요. 다시 시도해 주세요.".to_owned())
}

/// `{ ok: true, data }` with `data` written as `JSON.stringify` writes the
/// parsed answer.
pub fn ok_with_parsed(data: &str) -> axum::response::Response {
    let body = format!(r#"{{"ok":true,"data":{data}}}"#);
    (
        axum::http::StatusCode::OK,
        [
            (CONTENT_TYPE, "application/json"),
            (axum::http::header::CACHE_CONTROL, "no-store"),
        ],
        body,
    )
        .into_response()
}

use axum::response::IntoResponse;

/// `JSON.stringify(JSON.parse(text))` of an answer.
pub fn stringify(value: &Json) -> String {
    js_json::stringify_parsed(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_body_is_the_typescripts_json_in_its_order() {
        let body = body(&Structured {
            name: "n",
            schema: r#"{"type":"object"}"#,
            instructions: "지시 \"a\"",
            input: "입력\n",
        });
        assert_eq!(
            body,
            r#"{"model":"gpt-5.6-sol","reasoning":{"effort":"high"},"instructions":"지시 \"a\"","input":"입력\n","max_output_tokens":8192,"store":false,"text":{"format":{"type":"json_schema","name":"n","strict":true,"schema":{"type":"object"}}}}"#
        );
    }

    #[test]
    fn the_answer_text_is_found_where_the_typescript_looks() {
        assert_eq!(
            response_text(&json!({ "output_text": "  {} " })).as_deref(),
            Some("{}")
        );
        let blocks = json!({ "output": [{ "content": [{ "type": "reasoning", "text": "x" }, { "type": "output_text", "text": " [1] " }] }] });
        assert_eq!(response_text(&blocks).as_deref(), Some("[1]"));
        assert_eq!(
            response_text(&json!({ "output_text": "  ", "output": [] })),
            None
        );
        assert_eq!(utf16_prefix("가😀나", 3), "가😀");
        assert_eq!(utf16_prefix("가😀나", 2), "가");
    }
}
