//! `GET /api/cron/source-refresh` (`app/api/cron/source-refresh/route.ts`)
//! and `runSourceRefresh` of `lib/sources/refresh.server.ts`: the oldest
//! sources and due retries are checked with their provider, YouTube through
//! `videos.list` and TikTok and Instagram through the shared oEmbed client,
//! the three side by side; then the run is recorded in `job_runs`.
//!
//! Every run that gets as far as recording itself expires the public pages'
//! caches (`pages::expire_catalog`). An exception that ends the run early is
//! a plain 500.

use axum::extract::State;
use axum::http::header::CACHE_CONTROL;
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use time::OffsetDateTime;

use super::db::{self, bind};
use super::refresh_select::{self, Selection};
use super::url::Platform;
use super::{recovery, refresh_social, refresh_youtube};
use crate::AppState;
use crate::auth::CronAuthorized;
use crate::routes::js_string::JsString;
use crate::routes::request;
use crate::routes::tracking::iso_timestamp;

/// Time from the start after which a provider starts no new source.
const PROVIDER_BUDGET_MS: i64 = 40_000;

/// A `media_sources` row as the run selects it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SourceRow {
    pub id: String,
    /// `None` for a platform the run does not know.
    pub platform: Option<Platform>,
    pub external_id: Option<String>,
    pub canonical_url: String,
}

/// `PlatformObservation`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Counts {
    pub selected: u32,
    pub provider_submitted: u32,
    pub confirmed: u32,
    pub inconclusive: u32,
    pub invalid_identity: u32,
}

/// `RefreshObservations`. Each provider counts its own platforms, so each
/// keeps its own and they are added up at the end.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Observations([Counts; 4]);

impl Observations {
    pub fn get(&mut self, platform: Platform) -> &mut Counts {
        let at = Platform::ALL
            .iter()
            .position(|known| *known == platform)
            .unwrap_or(0);
        &mut self.0[at]
    }

    fn add(&mut self, other: &Self) {
        for (mine, theirs) in self.0.iter_mut().zip(other.0) {
            mine.selected += theirs.selected;
            mine.provider_submitted += theirs.provider_submitted;
            mine.confirmed += theirs.confirmed;
            mine.inconclusive += theirs.inconclusive;
            mine.invalid_identity += theirs.invalid_identity;
        }
    }

    fn json(mut self) -> String {
        let mut counts = |platform| {
            let c = *self.get(platform);
            object(&[
                ("selected", c.selected.to_string()),
                ("provider_submitted", c.provider_submitted.to_string()),
                ("confirmed", c.confirmed.to_string()),
                ("inconclusive", c.inconclusive.to_string()),
                ("invalid_identity", c.invalid_identity.to_string()),
            ])
        };
        object(&[
            ("youtube", counts(Platform::Youtube)),
            ("youtube_shorts", counts(Platform::YoutubeShorts)),
            ("instagram", counts(Platform::Instagram)),
            ("tiktok", counts(Platform::Tiktok)),
        ])
    }
}

/// The YouTube part of the result.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct YoutubeOutcome {
    pub checked: usize,
    pub removed: usize,
    pub hidden: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

/// The oEmbed part of the result, summed over TikTok and Instagram.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct SocialOutcome {
    pub checked: usize,
    pub removed: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub deferred_by_deadline: usize,
}

pub fn now_ms() -> i64 {
    crate::auth::now_ms()
}

/// `new Date(ms).toISOString()`.
pub fn iso_at(ms: i64) -> String {
    let at = OffsetDateTime::from_unix_timestamp_nanos(i128::from(ms) * 1_000_000)
        .unwrap_or(OffsetDateTime::UNIX_EPOCH);
    iso_timestamp(at)
}

/// The handler. `CronAuthorized` answers the 401.
pub async fn run(_: CronAuthorized, State(state): State<AppState>) -> Response {
    match run_source_refresh(&state).await {
        Ok((body, ok)) => {
            let status = if ok {
                StatusCode::OK
            } else {
                StatusCode::BAD_GATEWAY
            };
            let mut response = request::json(status, body);
            response
                .headers_mut()
                .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Err(error) => {
            tracing::error!(%error, "source refresh failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

/// `runSourceRefresh()`: the body the route answers with, and whether the
/// status is `ok`. `Err` is an exception that ends the run.
async fn run_source_refresh(state: &AppState) -> Result<(String, bool), String> {
    let started_ms = now_ms();
    let started_at = iso_at(started_ms);
    let due = recovery::list_due(state, &iso_at(now_ms())).await?;
    let active = recovery::list_active(state).await?;
    let active = refresh_select::repair_identities(state, active).await?;
    let selection = refresh_select::select(state, due, active, started_ms).await;
    let deadline = started_ms + PROVIDER_BUDGET_MS;
    let (youtube, social, observations, first_error) =
        run_providers(state, &selection, deadline).await;
    let partial = first_error.is_some()
        || youtube.failed > 0
        || social.failed > 0
        || social.checked < selection.oembed_rows.len();
    let mut result = RunResult {
        status: if partial { "partial" } else { "ok" },
        youtube,
        social,
        observations,
        selection: &selection,
        error: first_error,
    };
    if let Err(message) = record_job(state, &started_at, !partial, &result.json()).await {
        result.status = "partial";
        result.error = Some(message);
    }
    crate::pages::expire_catalog(state);
    let ok = result.status == "ok";
    Ok((format!(r#"{{"ok":{ok},{}"#, &result.json()[1..]), ok))
}

/// The three providers side by side, so a slow one holds no other back;
/// their outcomes, the observations and the run's first error.
async fn run_providers(
    state: &AppState,
    selection: &Selection,
    deadline: i64,
) -> (YoutubeOutcome, SocialOutcome, Observations, Option<String>) {
    let mut observations = Observations::default();
    refresh_select::count_selected(&mut observations, selection);
    let rows_of = |platform| -> Vec<_> {
        selection
            .oembed_rows
            .iter()
            .filter(|row| row.platform == Some(platform))
            .cloned()
            .collect()
    };
    let active = &selection.active;
    let (youtube, tiktok, instagram) = tokio::join!(
        refresh_youtube::refresh(state, &selection.youtube_rows, active),
        refresh_social::refresh(state, rows_of(Platform::Tiktok), active, deadline),
        refresh_social::refresh(state, rows_of(Platform::Instagram), active, deadline),
    );
    let mut first_error = selection.first_error.clone();
    let youtube = match youtube {
        Ok((outcome, seen)) => {
            observations.add(&seen);
            outcome
        }
        Err((message, seen)) => {
            observations.add(&seen);
            first_error.get_or_insert(message);
            YoutubeOutcome::default()
        }
    };
    let mut social = SocialOutcome::default();
    for (outcome, seen) in [tiktok, instagram] {
        observations.add(&seen);
        social.checked += outcome.checked;
        social.removed += outcome.removed;
        social.failed += outcome.failed;
        social.deferred_by_deadline += outcome.deferred_by_deadline;
        social.errors.extend(outcome.errors);
    }
    (youtube, social, observations, first_error)
}

/// `SourceRefreshResult`, written in its key order.
struct RunResult<'a> {
    status: &'static str,
    youtube: YoutubeOutcome,
    social: SocialOutcome,
    observations: Observations,
    selection: &'a Selection,
    error: Option<String>,
}

/// `{"k":v,...}` from values already written as JSON.
fn object(pairs: &[(&str, String)]) -> String {
    let fields: Vec<String> = pairs
        .iter()
        .map(|(key, value)| format!(r#""{key}":{value}"#))
        .collect();
    format!("{{{}}}", fields.join(","))
}

fn text(value: &str) -> String {
    JsString::from(value).json()
}

fn texts(values: &[String]) -> String {
    let items: Vec<String> = values.iter().map(|value| text(value)).collect();
    format!("[{}]", items.join(","))
}

impl RunResult<'_> {
    fn json(&self) -> String {
        let (youtube, social) = (&self.youtube, &self.social);
        let mut pairs = vec![
            ("status", text(self.status)),
            (
                "youtube",
                object(&[
                    ("checked", youtube.checked.to_string()),
                    ("removed", youtube.removed.to_string()),
                    ("hidden", youtube.hidden.to_string()),
                    ("failed", youtube.failed.to_string()),
                    ("errors", texts(&youtube.errors)),
                ]),
            ),
            (
                "oembed",
                object(&[
                    ("checked", social.checked.to_string()),
                    ("removed", social.removed.to_string()),
                    ("failed", social.failed.to_string()),
                    ("errors", texts(&social.errors)),
                    (
                        "deferred_by_deadline",
                        social.deferred_by_deadline.to_string(),
                    ),
                ]),
            ),
            ("observations", self.observations.json()),
            (
                "recovery_unmatched_due_keys",
                self.selection.unmatched_due_keys.to_string(),
            ),
            (
                "recovery_conflicting_stale_sources",
                self.selection.conflicting_stale.to_string(),
            ),
            (
                "recovery_unowned_keys",
                self.selection.unowned_keys.to_string(),
            ),
        ];
        if let Some(error) = &self.error {
            pairs.push(("error", text(error)));
        }
        object(&pairs)
    }
}

const INSERT_JOB: &str = "INSERT INTO public.job_runs (job_name, started_at, finished_at, ok, detail) \
    VALUES ('refresh_media_sources', $1::timestamptz, $2::timestamptz, $3::boolean, $4::jsonb)";

/// The `job_runs` row of the run; `Err` is the database's message.
async fn record_job(
    state: &AppState,
    started_at: &str,
    ok: bool,
    result: &str,
) -> Result<(), String> {
    let binds = vec![
        bind(started_at),
        bind(&iso_at(now_ms())),
        bind(if ok { "true" } else { "false" }),
        bind(result),
    ];
    db::execute(state, INSERT_JOB, binds).await
}
