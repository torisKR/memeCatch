//! `POST /v1/embeddings` (app/v1/embeddings/route.ts): one signed query in,
//! its vector out, in the shape of an OpenAI embeddings answer.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request};
use axum::http::StatusCode;
use axum::http::header::RETRY_AFTER;
use axum::response::Response;

use super::runtime::{Runtime, is_plain_query};
use super::{Embeddings, PROFILE, error, vector_json};
use crate::AppState;
use crate::embedder::tokenizer::is_js_space;
use crate::embedder::vector::is_meme_vector;
use crate::routes::mpe::no_store;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::rate_limit::{RateLimit, client_ip};
use crate::routes::request::{Json, property, read_bounded_text};

const MAX_BODY_BYTES: usize = 2048;
const RATE_LIMIT: usize = 30;
const RATE_WINDOW_MS: i64 = 60_000;
/// `"query: ".length + 120`, in UTF-16 units.
const MAX_INPUT_UNITS: usize = 127;

pub async fn post(state: AppState, embeddings: Embeddings, request: Request) -> Response {
    let config = &state.config;
    let secret = config.cron_secret.as_ref().map(|secret| secret.expose());
    let secret_set = secret.is_some_and(|secret| !secret.trim_matches(is_js_space).is_empty());
    if !config.embedding_runtime_bundled || !secret_set {
        return error(StatusCode::SERVICE_UNAVAILABLE, "embedding_unavailable");
    }
    let (parts, body) = request.into_parts();
    let text = read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await;
    let Some(input) = text
        .ok()
        .as_deref()
        .and_then(Json::parse)
        .and_then(valid_input)
    else {
        return error(StatusCode::BAD_REQUEST, "invalid_request");
    };
    if !super::auth::verify(&parts.headers, &input, secret, now_ms()) {
        return error(StatusCode::UNAUTHORIZED, "unauthorized");
    }
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let key = [
        b"meme-embedding:",
        client_ip(&parts.headers, peer).as_slice(),
    ]
    .concat();
    let limit = embeddings
        .limiter
        .check(key, RATE_LIMIT, RATE_WINDOW_MS, now_ms());
    if let RateLimit::Limited { retry_after_sec } = limit {
        let mut response = error(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
        response
            .headers_mut()
            .insert(RETRY_AFTER, retry_after_sec.into());
        return response;
    }
    answer(&embeddings.runtime, &input).await
}

async fn answer(runtime: &Arc<Runtime>, input: &str) -> Response {
    match runtime.embed_query(input).await {
        Some(embedding) if is_meme_vector(&embedding.vector) => no_store(
            StatusCode::OK,
            format!(
                r#"{{"model":"{PROFILE}","data":[{{"embedding":{},"index":0}}]}}"#,
                vector_json(&embedding.vector)
            ),
        ),
        _ => error(StatusCode::SERVICE_UNAVAILABLE, "embedding_unavailable"),
    }
}

/// The zod schema: exactly `model` (the profile) and `input` (at most 127
/// UTF-16 units, `query: ` and a plain query); the input when it passes.
fn valid_input(body: Json) -> Option<String> {
    let entries = body.as_object()?;
    let model = property(entries, "model")?.as_str()?;
    let input = property(entries, "input")?.as_str()?;
    let fits = input.encode_utf16().count() <= MAX_INPUT_UNITS;
    let plain = input.strip_prefix("query: ").is_some_and(is_plain_query);
    (entries.len() == 2 && model == PROFILE && fits && plain).then(|| input.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input_of(text: &str) -> Option<String> {
        Json::parse(text).and_then(valid_input)
    }

    #[test]
    fn the_body_is_the_strict_schema() {
        let good = r#"{"model":"multilingual-e5-small-v1","input":"query: 무야호"}"#;
        assert_eq!(input_of(good).as_deref(), Some("query: 무야호"));
        for bad in [
            r#"{"model":"multilingual-e5-small-v1","input":"query: 무야호","x":1}"#,
            r#"{"model":"other","input":"query: 무야호"}"#,
            r#"{"model":"multilingual-e5-small-v1","input":"무야호"}"#,
            r#"{"model":"multilingual-e5-small-v1","input":"query:  무야호"}"#,
            r#"{"model":"multilingual-e5-small-v1","input":["query: 무야호"]}"#,
            r#"{"model":"multilingual-e5-small-v1"}"#,
            r#"["query: 무야호"]"#,
            "null",
        ] {
            assert_eq!(input_of(bad), None, "{bad}");
        }
        // A repeated key keeps its last value, as JSON.parse does.
        let repeated = r#"{"model":"x","model":"multilingual-e5-small-v1","input":"query: ab"}"#;
        assert_eq!(input_of(repeated).as_deref(), Some("query: ab"));
    }
}
