//! `GET /api/cron/trend-pulse`: `app/api/cron/trend-pulse/route.ts` and
//! `runTrendPulse` of `lib/trend/pulse.server.ts`, as `service_role`.
//!
//! 1. `compute_trend_scores()`. A failure is recorded in `job_runs` and ends
//!    the run (502).
//! 2. The radar, when a connector is configured (`radar.rs`). Its failure
//!    makes the run `partial`, nothing more.
//! 3. `fan_out_trend_alerts()`, then `fan_out_saved_context_alerts()`. A
//!    failure ends the run (502).
//!
//! The TypeScript calls `revalidateTag(PUBLIC_CATALOG_CACHE_TAG)` right after
//! the scores. In a route handler that only records the tag; Next expires it
//! when the handler has returned (`executeRevalidates` in
//! `next/dist/server/route-modules/app-route/module.js`), after every write
//! of the run, and the answer does not depend on it. So this expires the
//! catalog through Next (`Upstream::expire_cache`) at the end of every run
//! that got past step 1, and a failed expiry is logged.

use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, HeaderValue};
use axum::response::Response;
use serde::Serialize;

use super::radar::{self, RadarResult, RadarStatus};
use super::radar_connectors::{Platform, RadarClient};
use super::radar_text;
use crate::AppState;
use crate::auth::CronAuthorized;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::request;

/// What the route needs beside the state: the configured connectors.
#[derive(Clone)]
pub struct TrendPulse {
    client: RadarClient,
    platforms: Vec<Platform>,
}

impl TrendPulse {
    pub fn new(state: &AppState) -> Result<Self, String> {
        let radar = &state.config.radar;
        Ok(Self {
            client: RadarClient::new(radar.test_origin.as_deref())?,
            platforms: super::radar_connectors::configured(radar),
        })
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum Status {
    Ok,
    Partial,
    Failed,
}

/// `{ ok: result.status !== "failed", ...result }`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Outcome {
    ok: bool,
    status: Status,
    alerts: i64,
    saved_context_alerts: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    radar: Option<RadarResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl Outcome {
    fn failed(alerts: i64, radar: Option<RadarResult>, error: String) -> Self {
        Self {
            ok: false,
            status: Status::Failed,
            alerts,
            saved_context_alerts: 0,
            radar,
            error: Some(error),
        }
    }
}

pub async fn run(_: CronAuthorized, State(state): State<AppState>, pulse: TrendPulse) -> Response {
    let outcome = pulse_run(&state, &pulse).await;
    let status = if outcome.status == Status::Failed {
        StatusCode::BAD_GATEWAY
    } else {
        StatusCode::OK
    };
    let body = serde_json::to_string(&outcome).expect("the outcome serializes");
    let mut response = request::json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// `runTrendPulse`.
async fn pulse_run(state: &AppState, pulse: &TrendPulse) -> Outcome {
    if let Err(message) = call(state, "compute_trend_scores").await {
        record_compute_failure(state, &message).await;
        return Outcome::failed(0, None, format!("compute:{message}"));
    }
    let radar = match pulse.platforms.is_empty() {
        true => None,
        false => Some(radar::run(state, &pulse.client, &pulse.platforms).await),
    };
    let alerts = match call(state, "fan_out_trend_alerts").await {
        Ok(alerts) => alerts.unwrap_or(0),
        Err(message) => return Outcome::failed(0, radar, format!("fanout:{message}")),
    };
    let saved = match call(state, "fan_out_saved_context_alerts").await {
        Ok(saved) => saved.unwrap_or(0),
        Err(message) => {
            let error = format!("saved_context:{message}");
            return Outcome::failed(alerts, radar, error);
        }
    };
    let degraded = radar
        .as_ref()
        .is_some_and(|radar| radar.status != RadarStatus::Ok);
    Outcome {
        ok: true,
        status: if degraded {
            Status::Partial
        } else {
            Status::Ok
        },
        alerts,
        saved_context_alerts: saved,
        radar,
        error: None,
    }
}

const FUNCTION_EXISTS: &str = "select exists (select 1 from pg_catalog.pg_proc p \
                               join pg_catalog.pg_namespace n on n.oid = p.pronamespace \
                               where n.nspname = 'public' and p.proname = $1)";

/// `admin.rpc(name)` for a function without arguments: the plan executor
/// first looks the function up by name (`function not found` when there is
/// none), then selects it. The value is an integer, or `None` for `null` and
/// for a function that returns nothing.
async fn call(state: &AppState, name: &'static str) -> Result<Option<i64>, String> {
    let identity = DbIdentity::service_role();
    let exists: bool = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(FUNCTION_EXISTS)
                    .bind(name)
                    .fetch_one(tx)
                    .await
            })
        })
        .await
        .map_err(message)?;
    if !exists {
        return Err("function not found".to_owned());
    }
    let sql = match name {
        "compute_trend_scores" => "select public.compute_trend_scores()::text",
        "fan_out_trend_alerts" => "select public.fan_out_trend_alerts()::text",
        _ => "select public.fan_out_saved_context_alerts()::text",
    };
    let value: Option<String> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query_scalar(sql).fetch_one(tx).await })
        })
        .await
        .map_err(message)?;
    Ok(value.and_then(|value| value.parse().ok()))
}

/// The `message` the plan executor returns: the server's message for a
/// database error. Others (no connection) are worded by node-pg there and
/// by sqlx here (PLAN.md section 15).
fn message(error: sqlx::Error) -> String {
    match error.as_database_error() {
        Some(database) => database.message().to_owned(),
        None => error.to_string(),
    }
}

const RECORD_FAILURE: &str = "insert into public.job_runs (job_name, finished_at, ok, detail) \
                              values ($1, $2::timestamptz, $3::boolean, $4::jsonb)";

/// The `job_runs` row of a failed `compute_trend_scores`. Its own failure
/// is not looked at, as in the TypeScript.
async fn record_compute_failure(state: &AppState, message: &str) {
    let detail =
        serde_json::json!({ "algorithm": "content_views_v3", "error": message }).to_string();
    let finished_at = radar_text::now_iso();
    let recorded = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query(RECORD_FAILURE)
                        .bind("compute_trend_scores")
                        .bind(finished_at)
                        .bind(false)
                        .bind(detail)
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    if let Err::<(), sqlx::Error>(error) = recorded {
        tracing::warn!(%error, "job_runs insert failed");
    }
}
