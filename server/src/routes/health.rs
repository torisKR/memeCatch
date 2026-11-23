//! `GET /api/health`: the bodies, headers and statuses of
//! `app/api/health/route.ts`, for a server that has Next behind it.
//!
//! Next answers `{"ok":true}` when it reaches the database. Here that takes
//! two checks: this server reaches the database, and Next's own
//! `/api/health` answers 2xx. The compose healthcheck of the `app` container
//! and the deploy gate both ask this route; without the second check they
//! would pass while Next is down and every page is a 502.
//!
//! The upstream check goes away when Next does (PLAN.md, stage 7).

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
    let (database, upstream) = tokio::join!(database_is_up(&state), upstream_is_up(&state));
    if database && upstream {
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

async fn upstream_is_up(state: &AppState) -> bool {
    match tokio::time::timeout(HEALTH_TIMEOUT, state.upstream.health()).await {
        Ok(Ok(status)) if status.is_success() => true,
        Ok(Ok(status)) => {
            tracing::warn!(%status, "the upstream's health check did not pass");
            false
        }
        Ok(Err(cause)) => {
            tracing::warn!(cause, "the upstream's health check could not be asked");
            false
        }
        Err(_) => {
            tracing::warn!("the upstream's health check timed out");
            false
        }
    }
}

// `Response.json` in Next sends exactly this content type.
fn json(status: StatusCode, body: &'static str) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body).into_response()
}
