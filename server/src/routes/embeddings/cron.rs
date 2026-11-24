//! `/api/cron/meme-embeddings` (app/api/cron/meme-embeddings/route.ts).
//!
//! `GET`, from the scheduler with the `CRON_SECRET` bearer, runs the reindex
//! when `MEME_EMBEDDING_REINDEX_ENABLED=true` and otherwise answers 202
//! `disabled`. `POST`, with the `MEMECATCH_SIGNING_SECRET` bearer, runs the
//! reindex whatever that flag says (empty body), or with the body
//! `{"validate_model":true}` embeds a fixed 6,900-character document and
//! reports the time and memory it took.

use std::sync::LazyLock;
use std::time::Instant;

use axum::extract::Request;
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::response::Response;

use super::reindex::{self, RunResult, Status};
use super::{Embeddings, PROFILE, error};
use crate::AppState;
use crate::auth::cron_authorized;
use crate::embedder::vector::DIMENSIONS;
use crate::routes::js_json;
use crate::routes::mpe::no_store;
use crate::routes::request::{Json, read_bounded_text};

const MODEL_PROBE_MAX_BYTES: usize = 128;
const PROBE_SEED: &str = "운영 배포의 동일 모델 메모리와 긴 문서 절단 경계를 확인합니다. ";
const PROBE_CHARS: usize = 6_900;

/// `probeSeed.repeat(Math.ceil(6_900 / probeSeed.length)).slice(0, 6_900)`;
/// the seed has no character outside the BMP, so UTF-16 units are chars.
static PROBE_DOCUMENT: LazyLock<String> =
    LazyLock::new(|| PROBE_SEED.chars().cycle().take(PROBE_CHARS).collect());

pub async fn get(state: AppState, embeddings: Embeddings, request: Request) -> Response {
    let (parts, _body) = request.into_parts();
    let secret = state.config.cron_secret.as_ref();
    if !cron_authorized(&parts.headers, secret.map(|secret| secret.expose().trim())) {
        return unauthorized();
    }
    // `request.body !== null` never holds for a GET in Next: its request
    // carries no body for GET and HEAD.
    if !has_no_query(&parts) {
        return invalid_request();
    }
    if !state.config.embedding_reindex_enabled {
        return no_store(
            StatusCode::ACCEPTED,
            r#"{"ok":true,"status":"disabled"}"#.to_owned(),
        );
    }
    respond(reindex::run(&state, &embeddings.runtime).await)
}

pub async fn post(state: AppState, embeddings: Embeddings, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let secret = state.config.signing_secret.as_ref();
    if !cron_authorized(&parts.headers, secret.map(|secret| secret.expose())) {
        return unauthorized();
    }
    if !has_no_query(&parts) {
        return invalid_request();
    }
    let Ok(text) = read_bounded_text(&parts.headers, body, MODEL_PROBE_MAX_BYTES).await else {
        return invalid_request();
    };
    if text.is_empty() {
        return respond(reindex::run(&state, &embeddings.runtime).await);
    }
    if !is_probe_body(&text) {
        return invalid_request();
    }
    probe(&embeddings).await
}

/// `{ validate_model: true }` and nothing else.
fn is_probe_body(text: &str) -> bool {
    let Some(value) = Json::parse(text) else {
        return false;
    };
    matches!(value.as_object(), Some([(key, Json::Bool(true))]) if key == "validate_model")
}

/// `probeModel`.
async fn probe(embeddings: &Embeddings) -> Response {
    let started = Instant::now();
    let Some(embedding) = embeddings.runtime.embed_passage(&PROBE_DOCUMENT).await else {
        return error(StatusCode::SERVICE_UNAVAILABLE, "model_unavailable");
    };
    let elapsed_ms = (started.elapsed().as_secs_f64() * 1000.0).round() as u64;
    no_store(
        StatusCode::OK,
        format!(
            r#"{{"profile":"{PROFILE}","dimensions":{DIMENSIONS},"elapsed_ms":{elapsed_ms},"rss_bytes":{},"peak_rss_bytes":{},"heap_used_bytes":0,"platform":"{}"}}"#,
            embedding.rss_bytes,
            embedding.peak_rss_bytes,
            platform(),
        ),
    )
}

/// `process.platform`.
fn platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    }
}

/// `responseFor`: 503 for failed, 202 for deferred, else 200.
fn respond(result: RunResult) -> Response {
    let status = match result.status {
        Status::Failed => StatusCode::SERVICE_UNAVAILABLE,
        Status::Deferred => StatusCode::ACCEPTED,
        Status::Succeeded | Status::Partial => StatusCode::OK,
    };
    let error_code = result
        .error_code
        .map_or("null".to_owned(), |code| format!("\"{code}\""));
    no_store(
        status,
        format!(
            r#"{{"ok":{},"status":"{}","indexed":{},"stale":{},"remaining":{},"errorCode":{error_code}}}"#,
            result.status != Status::Failed,
            result.status.as_str(),
            result.indexed,
            result.stale,
            js_json::number(result.remaining as f64),
        ),
    )
}

/// `new URL(request.url).search === ""`: no query, or a bare `?`.
fn has_no_query(parts: &Parts) -> bool {
    parts.uri.query().is_none_or(str::is_empty)
}

fn unauthorized() -> Response {
    no_store(
        StatusCode::UNAUTHORIZED,
        r#"{"ok":false,"error":"UNAUTHORIZED"}"#.to_owned(),
    )
}

fn invalid_request() -> Response {
    no_store(
        StatusCode::BAD_REQUEST,
        r#"{"ok":false,"error":"INVALID_REQUEST"}"#.to_owned(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_probe_document_is_6900_characters_of_the_seed() {
        assert_eq!(PROBE_DOCUMENT.chars().count(), 6_900);
        assert!(PROBE_DOCUMENT.starts_with(PROBE_SEED));
    }

    #[test]
    fn only_validate_model_true_asks_for_the_probe() {
        assert!(is_probe_body(r#"{"validate_model":true}"#));
        assert!(is_probe_body(r#" {"validate_model" : true} "#));
        for other in [
            r#"{"validate_model":1}"#,
            r#"{"validate_model":true,"x":1}"#,
            r#"[true]"#,
            "true",
            "{",
        ] {
            assert!(!is_probe_body(other), "{other}");
        }
    }
}
