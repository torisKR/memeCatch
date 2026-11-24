//! `GET /api/cron/growth-baseline`: `app/api/cron/growth-baseline/route.ts`
//! and `captureGrowthFunnelBaseline` of `lib/growth/events.server.ts`. One
//! database function, as `service_role`, records the day's funnel baseline.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

use crate::AppState;
use crate::auth::{AuthRejection, CronAuthorized};
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::request;

const CAPTURE: &str = "select public.capture_growth_funnel_baseline()";

pub async fn capture(
    guard: Result<CronAuthorized, AuthRejection>,
    State(state): State<AppState>,
) -> Response {
    // This route's own 401 body: lowercase, unlike the other cron routes.
    if guard.is_err() {
        return request::json(
            StatusCode::UNAUTHORIZED,
            r#"{"ok":false,"error":"unauthorized"}"#,
        );
    }
    let captured = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query(CAPTURE).execute(tx).await.map(|_| ()) }),
        )
        .await;
    match captured {
        Ok(()) => request::json(StatusCode::OK, r#"{"ok":true}"#),
        // The TypeScript throws the error object: a bare 500.
        Err::<(), sqlx::Error>(error) => {
            tracing::error!(%error, "capture_growth_funnel_baseline failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}
