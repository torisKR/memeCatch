//! `memecatch-server embedder`: the model in its own process, for the compose
//! service `embedder` (docker-compose.axum.yml). The Axum container has 256
//! MB; the FP32 model alone is 470 MB.
//!
//! One route, `POST /embed` with `{"input": "<prefixed text>"}`, reached
//! only on the compose network. It answers `{"embedding": [...],
//! "rss_bytes": n, "peak_rss_bytes": n}`, or 503 `{"error":
//! "embedding_unavailable"}` when the model cannot run. Validation, the
//! query cache and the one-inference rule of the TypeScript live in Axum
//! (`routes/embeddings/runtime.rs`); this side keeps what `getPipeline`
//! keeps: the model loads on first use, and after a failed load it is not
//! tried again for 30 seconds.

use std::net::{Ipv4Addr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::Mutex;

use super::model::{Model, REVISION};
use super::vector::DIMENSIONS;

/// `retryAfter = Date.now() + 30_000` after a failed load.
const RETRY_AFTER: Duration = Duration::from_secs(30);
/// The longest prefixed input Axum sends: a 6,900-character passage.
const MAX_INPUT_CHARS: usize = 7_000;
const DEFAULT_PORT: u16 = 8780;

#[derive(Clone)]
struct Embedder {
    root: Arc<PathBuf>,
    state: Arc<Mutex<Loaded>>,
}

enum Loaded {
    No { retry_at: Option<Instant> },
    Yes(Arc<Model>),
}

#[derive(Deserialize)]
struct EmbedRequest {
    input: String,
}

/// Serves until SIGTERM or SIGINT. `MEME_EMBEDDING_MODEL_ROOT` is the
/// directory the TypeScript calls `.local/embedding-models`;
/// `ORT_DYLIB_PATH` names the ONNX Runtime library.
pub async fn serve(
    shutdown: impl std::future::Future<Output = ()> + Send + 'static,
) -> Result<(), String> {
    let root = std::env::var("MEME_EMBEDDING_MODEL_ROOT")
        .map_err(|_| "MEME_EMBEDDING_MODEL_ROOT is required".to_owned())?;
    let port = match std::env::var("PORT") {
        Ok(port) => port
            .parse()
            .map_err(|_| format!("PORT {port:?} is not a port"))?,
        Err(_) => DEFAULT_PORT,
    };
    let embedder = Embedder {
        root: Arc::new(PathBuf::from(root)),
        state: Arc::new(Mutex::new(Loaded::No { retry_at: None })),
    };
    let app = router(embedder);
    let listener = tokio::net::TcpListener::bind((Ipv4Addr::UNSPECIFIED, port))
        .await
        .map_err(|error| format!("cannot listen on port {port}: {error}"))?;
    tracing::info!(port, "starting the embedder");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown)
    .await
    .map_err(|error| format!("embedder stopped: {error}"))
}

fn router(embedder: Embedder) -> Router {
    Router::new()
        .route("/embed", post(embed))
        .with_state(embedder)
}

async fn embed(State(embedder): State<Embedder>, body: Json<EmbedRequest>) -> Response {
    let input = body.0.input;
    if input.chars().count() > MAX_INPUT_CHARS {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid_request"})),
        )
            .into_response();
    }
    // Held through the inference: one at a time, like the single
    // `pipelinePromise` of the TypeScript on one CPU.
    let mut state = embedder.state.lock().await;
    let Some(model) = loaded(&mut state, &embedder.root).await else {
        return unavailable();
    };
    let vector = tokio::task::spawn_blocking(move || model.embed(&input)).await;
    drop(state);
    match vector {
        Ok(Ok(embedding)) => {
            let (rss_bytes, peak_rss_bytes) = memory();
            Json(json!({
                "embedding": embedding,
                "rss_bytes": rss_bytes,
                "peak_rss_bytes": peak_rss_bytes,
            }))
            .into_response()
        }
        Ok(Err(error)) => {
            tracing::warn!(%error, "embedding failed");
            unavailable()
        }
        Err(error) => {
            tracing::warn!(%error, "embedding panicked");
            unavailable()
        }
    }
}

/// `getPipeline`: the loaded model, loading it if no failure is recent.
async fn loaded(state: &mut Loaded, root: &Arc<PathBuf>) -> Option<Arc<Model>> {
    match state {
        Loaded::Yes(model) => return Some(model.clone()),
        Loaded::No { retry_at: Some(at) } if Instant::now() < *at => return None,
        Loaded::No { .. } => {}
    }
    let started = Instant::now();
    let root = root.clone();
    // A missing ONNX Runtime library panics inside `ort`; the task boundary
    // turns that into a failed load.
    let error = match tokio::task::spawn_blocking(move || Model::load(&root)).await {
        Ok(Ok(model)) => {
            let (rss_bytes, peak_rss_bytes) = memory();
            tracing::info!(
                revision = REVISION,
                dtype = "fp32",
                dimensions = DIMENSIONS,
                elapsed_ms = started.elapsed().as_millis() as u64,
                rss_bytes,
                peak_rss_bytes,
                "meme_embedding_ready"
            );
            let model = Arc::new(model);
            *state = Loaded::Yes(model.clone());
            return Some(model);
        }
        Ok(Err(error)) => error,
        Err(panicked) => format!("the load panicked: {panicked}"),
    };
    tracing::warn!(%error, "embedding model did not load");
    *state = Loaded::No {
        retry_at: Some(Instant::now() + RETRY_AFTER),
    };
    None
}

fn unavailable() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({"error": "embedding_unavailable"})),
    )
        .into_response()
}

/// The resident and peak resident set of this process in bytes
/// (`VmRSS`, `VmHWM`); zero where `/proc` does not exist.
fn memory() -> (u64, u64) {
    let status = std::fs::read_to_string("/proc/self/status").unwrap_or_default();
    let kib = |name: &str| {
        status
            .lines()
            .find_map(|line| line.strip_prefix(name))
            .and_then(|rest| {
                rest.trim()
                    .trim_end_matches("kB")
                    .trim()
                    .parse::<u64>()
                    .ok()
            })
            .map_or(0, |value| value * 1024)
    };
    (kib("VmRSS:"), kib("VmHWM:"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn a_failed_load_is_not_tried_again_for_30_seconds() {
        let empty = tempfile::tempdir().expect("temp dir");
        let root = Arc::new(empty.path().to_path_buf());
        let mut state = Loaded::No { retry_at: None };
        assert!(loaded(&mut state, &root).await.is_none());
        let Loaded::No {
            retry_at: Some(retry_at),
        } = state
        else {
            panic!("the failure is remembered");
        };
        assert!(retry_at > Instant::now() + Duration::from_secs(29));
        // Within the 30 seconds nothing is loaded, even a good model.
        assert!(loaded(&mut state, &root).await.is_none());
    }
}
