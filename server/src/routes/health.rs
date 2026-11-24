//! `GET /api/health`: `{"ok":true}` when this server reaches the database,
//! as `app/api/health/route.ts` answered. The compose healthcheck of the
//! `app` container and the deploy gate both ask it.

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
// healthcheck allows, so each check gets its own shorter limit. They run
// side by side, so the answer still comes within this limit.
const HEALTH_TIMEOUT: Duration = Duration::from_secs(3);

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("health", "/api/health", get(health))
        .build()
}

async fn health(State(state): State<AppState>) -> Response {
    if database_is_up(&state).await {
        json(StatusCode::OK, r#"{"ok":true}"#)
    } else {
        json(StatusCode::SERVICE_UNAVAILABLE, r#"{"ok":false}"#)
    }
}

async fn database_is_up(state: &AppState) -> bool {
    let probe = sqlx::query("select 1 as ok").execute(state.db.pool());
    match tokio::time::timeout(HEALTH_TIMEOUT, probe).await {
        Ok(Ok(_)) => true,
        Ok(Err(error)) => {
            tracing::warn!(%error, "health check query failed");
            false
        }
        Err(_) => {
            tracing::warn!("health check query timed out");
            false
        }
    }
}

// `Response.json` in Next sends exactly this content type.
fn json(status: StatusCode, body: &'static str) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body).into_response()
}
