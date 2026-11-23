//! `GET /api/health`, same contract as `app/api/health/route.ts`.

use std::time::Duration;

use axum::Router;
use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::CONTENT_TYPE;
use axum::response::{IntoResponse, Response};
use axum::routing::get;

use super::Routes;
use crate::AppState;

// node-pg fails at once when Postgres refuses the connection. sqlx retries
// until the pool's acquire timeout (5 s, `db.rs`), which is all the compose
// healthcheck allows, so the probe gets its own shorter limit.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(3);

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("health", "/api/health", get(health))
        .build()
}

async fn health(State(state): State<AppState>) -> Response {
    let probe = sqlx::query("select 1 as ok").execute(state.db.pool());
    match tokio::time::timeout(HEALTH_TIMEOUT, probe).await {
        Ok(Ok(_)) => json(StatusCode::OK, r#"{"ok":true}"#),
        Ok(Err(error)) => {
            tracing::warn!(%error, "health check query failed");
            json(StatusCode::SERVICE_UNAVAILABLE, r#"{"ok":false}"#)
        }
        Err(_) => {
            tracing::warn!("health check query timed out");
            json(StatusCode::SERVICE_UNAVAILABLE, r#"{"ok":false}"#)
        }
    }
}

// `Response.json` in Next sends exactly this content type.
fn json(status: StatusCode, body: &'static str) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body).into_response()
}
