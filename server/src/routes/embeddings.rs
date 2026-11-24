//! The bundled meme embedding routes (R12).
//!
//! | Route id | Path | Method | TypeScript |
//! | --- | --- | --- | --- |
//! | `v1-embeddings` | `/v1/embeddings` | `POST` | `app/v1/embeddings/route.ts` |
//! | `meme-embeddings-cron` | `/api/cron/meme-embeddings` | `GET` | `app/api/cron/meme-embeddings/route.ts` |
//! | `meme-embeddings-cron-post` | `/api/cron/meme-embeddings` | `POST` | the same file |
//!
//! `proxy.ts` runs for `/v1/embeddings` (its matchers skip only `/api` and
//! `/auth`): it adds `Content-Language: ko`, and the `www` host goes to Next
//! (`www_to_upstream`). A request target with a byte outside ASCII goes to
//! Next on both paths, which answers it 400 before any route.
//!
//! Both are always native. The model runs in the embedder service
//! (`memecatch-server embedder`, compose profile `embedder`) at
//! `MEME_EMBEDDER_URL`; without it Axum answers as Next does when
//! `.local/embedding-models` holds no model, which is production today:
//! `/v1/embeddings` 503 `embedding_unavailable`, the probe 503
//! `model_unavailable`, and a reindex run that fails with
//! `model_unavailable` at its first job (`runtime.rs`).

mod auth;
mod cron;
mod reindex;
mod runtime;
mod v1;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::CONTENT_LANGUAGE;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::{get, post};

use super::Routes;
use super::js_json;
use super::mpe::no_store;
use super::public::csp_report::now_ms;
use super::public::rate_limit::RateLimiter;
use crate::AppState;

/// `MEME_VECTOR_PROFILE` of lib/meme-vectors.ts.
pub const PROFILE: &str = "multilingual-e5-small-v1";

/// What both routes share, as the module state of the TypeScript is shared.
#[derive(Clone)]
pub struct Embeddings {
    runtime: Arc<runtime::Runtime>,
    limiter: Arc<RateLimiter>,
}

pub fn router(state: &AppState) -> Router<AppState> {
    let config = &state.config;
    let embeddings = Embeddings {
        runtime: runtime::Runtime::new(config.embedding_runtime_bundled, config.embedder.clone()),
        limiter: Arc::new(RateLimiter::new(now_ms())),
    };
    if config.embedder.is_none() {
        tracing::info!("MEME_EMBEDDER_URL is not set: the embedding routes answer without a model");
    }
    let (for_v1, for_get, for_post) = (embeddings.clone(), embeddings.clone(), embeddings);
    let v1 = Routes::new(state)
        .add(
            "v1-embeddings",
            "/v1/embeddings",
            post(move |State(state): State<AppState>, request: Request| {
                let embeddings = for_v1.clone();
                async move { korean(v1::post(state, embeddings, request).await) }
            }),
        )
        .build();
    let cron = Routes::new(state)
        .add_each(
            "/api/cron/meme-embeddings",
            vec![
                (
                    "meme-embeddings-cron",
                    get(move |State(state): State<AppState>, request: Request| {
                        cron::get(state, for_get.clone(), request)
                    }),
                ),
                (
                    "meme-embeddings-cron-post",
                    post(move |State(state): State<AppState>, request: Request| {
                        cron::post(state, for_post.clone(), request)
                    }),
                ),
            ],
        )
        .build();
    v1.merge(cron)
}

/// `applyLocale` of `proxy.ts` for a path that names no locale.
fn korean(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    response
}

/// `Response.json({ error }, { status, headers: { "cache-control": "no-store" } })`.
fn error(status: StatusCode, code: &str) -> Response {
    no_store(status, format!(r#"{{"error":"{code}"}}"#))
}

/// The vector as `JSON.stringify` writes an array of numbers.
fn vector_json(values: &[f64]) -> String {
    let numbers: Vec<String> = values.iter().map(|value| js_json::number(*value)).collect();
    format!("[{}]", numbers.join(","))
}
