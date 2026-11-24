//! `runRadarPulse` of `lib/trend/radar-pulse.server.ts` with
//! `runRadarConnectors` (`radar-connectors.server.ts`) and the repository of
//! `radar-repository.server.ts`, as `service_role`, one transaction per
//! statement as the admin client runs them.
//!
//! The signal insert names `raw_expires_at` with the signal's
//! `rawExpiresAt`, which no connector sets, so it writes `NULL` into a
//! `NOT NULL` column and fails: every run that collects a signal ends with
//! `RADAR_SIGNAL_WRITE_FAILED`, before the connector health is written. The
//! matching, scoring and review code after it is never reached and is not
//! ported (PLAN.md section 15). `tests/trend_pulse.rs` pins the constraint.

use futures_util::future::join_all;
use serde::Serialize;
use serde_json::{Map, Value};

use super::radar_connectors::{self, Collected, Platform, RadarClient, RawSignal};
use super::radar_text;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::js_json;

const CONNECTOR_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RadarStatus {
    Ok,
    Partial,
    Failed,
}

/// `RadarPulseResult`, and `failedRadar`'s `error`. The counts are those of
/// a run that reaches the end, which collected no signal: all zero.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RadarResult {
    pub status: RadarStatus,
    persisted_signals: u32,
    automatic_matches: u32,
    pending_matches: u32,
    observations: u32,
    safety_reviews: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl RadarResult {
    fn new(status: RadarStatus, error: Option<String>) -> Self {
        Self {
            status,
            persisted_signals: 0,
            automatic_matches: 0,
            pending_matches: 0,
            observations: 0,
            safety_reviews: 0,
            error,
        }
    }
}

/// A connector's row of `connector_health`, from its last run.
#[derive(Default)]
struct Previous {
    cursor: Option<String>,
    last_success_at: Option<String>,
    consecutive_failures: i64,
    quota_remaining: Option<f64>,
    quota_reset_at: Option<String>,
    backoff_until: Option<String>,
}

/// `runRadarPulse` with the configured connectors (at least one), or
/// `failedRadar` with the message it caught.
pub async fn run(state: &AppState, client: &RadarClient, platforms: &[Platform]) -> RadarResult {
    match pulse(state, client, platforms).await {
        Ok(status) => RadarResult::new(status, None),
        Err(message) => RadarResult::new(RadarStatus::Failed, Some(message.to_owned())),
    }
}

async fn pulse(
    state: &AppState,
    client: &RadarClient,
    platforms: &[Platform],
) -> Result<RadarStatus, &'static str> {
    let previous = load_state(state)
        .await
        .map_err(|_| "RADAR_CONNECTOR_STATE_READ_FAILED")?;
    let attempted_at = radar_text::now_iso();
    let runs = platforms.iter().map(|platform| {
        let previous = previous
            .iter()
            .find(|(key, _)| key == platform.key())
            .map(|(_, row)| row);
        connector(state, client, *platform, previous, &attempted_at)
    });
    let results = join_all(runs).await;
    let succeeded = results
        .iter()
        .filter(|(signals, _)| signals.is_ok())
        .count();
    let status = match succeeded {
        n if n == results.len() => RadarStatus::Ok,
        0 => RadarStatus::Failed,
        _ => RadarStatus::Partial,
    };
    let signals: Vec<RawSignal> = results
        .iter()
        .filter_map(|(signals, _)| signals.as_ref().ok())
        .flat_map(|signals| signals.iter().map(clone_signal))
        .collect();
    if !signals.is_empty() {
        persist_signals(state, &signals, &attempted_at).await;
        return Err("RADAR_SIGNAL_WRITE_FAILED");
    }
    let health: Vec<Value> = results.into_iter().map(|(_, health)| health).collect();
    persist_health(state, &health)
        .await
        .map_err(|_| "RADAR_CONNECTOR_HEALTH_WRITE_FAILED")?;
    load_memes(state).await?;
    Ok(status)
}

fn clone_signal(signal: &RawSignal) -> RawSignal {
    RawSignal {
        platform: signal.platform,
        content_id: signal.content_id.clone(),
        canonical_url: signal.canonical_url.clone(),
        query_seed: signal.query_seed.clone(),
        text: signal.text.clone(),
        hashtags: signal.hashtags.clone(),
        published_at: signal.published_at.clone(),
        observed_at: signal.observed_at.clone(),
        language: signal.language.clone(),
    }
}

/// One connector: its signals (or its failure) and its health row.
async fn connector(
    state: &AppState,
    client: &RadarClient,
    platform: Platform,
    previous: Option<&Previous>,
    attempted_at: &str,
) -> (Result<Vec<RawSignal>, ()>, Value) {
    let cursor = previous.and_then(|row| row.cursor.as_deref());
    let collect =
        radar_connectors::collect(client, &state.config.radar, platform, cursor, attempted_at);
    let collected = match tokio::time::timeout(CONNECTOR_TIMEOUT, collect).await {
        Ok(collected) => collected,
        Err(_) => Err(format!("Connector {} timed out", platform.key())),
    };
    match collected.and_then(validate) {
        Ok(collected) => {
            let cursor = collected
                .cursor
                .or_else(|| cursor.map(|c| Value::String(c.to_owned())));
            (
                Ok(collected.signals),
                healthy(platform, cursor, attempted_at),
            )
        }
        Err(message) => (Err(()), down(platform, previous, attempted_at, message)),
    }
}

/// The checks of `normalizeRadarSignal`, in its order: `observedAt`, then
/// `publishedAt` (`collectedAt` is the run's own time).
fn validate(collected: Collected) -> Result<Collected, String> {
    for signal in &collected.signals {
        if radar_text::timestamp(&signal.observed_at)?.is_none() {
            return Err("observedAt must be a valid timestamp".to_owned());
        }
        if let Some(published) = &signal.published_at
            && radar_text::timestamp(published)?.is_none()
        {
            return Err("publishedAt must be a valid timestamp".to_owned());
        }
    }
    Ok(collected)
}

fn text(value: Option<&str>) -> Value {
    value.map_or(Value::Null, |text| Value::String(text.to_owned()))
}

fn number(value: Option<f64>) -> Value {
    value
        .and_then(serde_json::Number::from_f64)
        .map_or(Value::Null, Value::Number)
}

fn health_row(platform: Platform, status: &str, attempted_at: &str) -> Map<String, Value> {
    let mut row = Map::new();
    row.insert("connector_key".into(), platform.key().into());
    row.insert("status".into(), status.into());
    row.insert("last_checked_at".into(), attempted_at.into());
    row
}

fn healthy(platform: Platform, cursor: Option<Value>, attempted_at: &str) -> Value {
    let mut row = health_row(platform, "healthy", attempted_at);
    row.insert("last_success_at".into(), attempted_at.into());
    row.insert("consecutive_failures".into(), 0.into());
    row.insert(
        "cursor_state".into(),
        serde_json::json!({
            "cursor": cursor.unwrap_or(Value::Null),
            "attempted_at": attempted_at,
            "succeeded_at": attempted_at,
            "failed_at": null,
            "quota_remaining": null,
            "quota_reset_at": null,
            "backoff_until": null,
        }),
    );
    row.insert("last_error".into(), Value::Null);
    Value::Object(row)
}

fn down(
    platform: Platform,
    previous: Option<&Previous>,
    attempted_at: &str,
    message: String,
) -> Value {
    let empty = Previous::default();
    let previous = previous.unwrap_or(&empty);
    let mut row = health_row(platform, "down", attempted_at);
    row.insert(
        "last_success_at".into(),
        text(previous.last_success_at.as_deref()),
    );
    row.insert(
        "consecutive_failures".into(),
        (previous.consecutive_failures + 1).into(),
    );
    row.insert(
        "cursor_state".into(),
        serde_json::json!({
            "cursor": text(previous.cursor.as_deref()),
            "attempted_at": attempted_at,
            "succeeded_at": text(previous.last_success_at.as_deref()),
            "failed_at": attempted_at,
            "quota_remaining": number(previous.quota_remaining),
            "quota_reset_at": text(previous.quota_reset_at.as_deref()),
            "backoff_until": text(previous.backoff_until.as_deref()),
        }),
    );
    row.insert("last_error".into(), message.into());
    Value::Object(row)
}

const LOAD_STATE: &str = "select connector_key, to_json(last_success_at) #>> '{}', \
                          consecutive_failures::bigint, cursor_state::text \
                          from public.connector_health";

/// `loadConnectorState`. `last_success_at` as the plan executor returns a
/// timestamp (`row_to_json`), since it is written back as text.
async fn load_state(state: &AppState) -> Result<Vec<(String, Previous)>, sqlx::Error> {
    let rows: Vec<(String, Option<String>, i64, String)> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_as(LOAD_STATE).fetch_all(tx).await }),
        )
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(key, last_success_at, consecutive_failures, cursor_state)| {
                let cursor: Value = serde_json::from_str(&cursor_state).unwrap_or(Value::Null);
                let string = |key: &str| cursor.get(key).and_then(Value::as_str).map(str::to_owned);
                let previous = Previous {
                    cursor: string("cursor"),
                    last_success_at,
                    consecutive_failures,
                    quota_remaining: cursor.get("quota_remaining").and_then(Value::as_f64),
                    quota_reset_at: string("quota_reset_at"),
                    backoff_until: string("backoff_until"),
                };
                (key, previous)
            },
        )
        .collect())
}

const UPSERT_HEALTH: &str = "insert into public.connector_health \
    (connector_key, status, last_checked_at, last_success_at, consecutive_failures, latency_ms, \
     cursor_state, last_error) \
    select r.connector_key, r.status, r.last_checked_at::timestamptz, \
           r.last_success_at::timestamptz, r.consecutive_failures::bigint, null::bigint, \
           r.cursor_state::jsonb, r.last_error \
    from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) \
         with ordinality as r(connector_key, status, last_checked_at, last_success_at, \
                              consecutive_failures, cursor_state, last_error, n) \
    order by r.n \
    on conflict (connector_key) do update set status = excluded.status, \
      last_checked_at = excluded.last_checked_at, last_success_at = excluded.last_success_at, \
      consecutive_failures = excluded.consecutive_failures, latency_ms = excluded.latency_ms, \
      cursor_state = excluded.cursor_state, last_error = excluded.last_error";

/// `persistConnectorHealth`: one upsert of every row, as
/// `.upsert(rows, { onConflict: "connector_key" })` sends it.
async fn persist_health(state: &AppState, rows: &[Value]) -> Result<(), sqlx::Error> {
    let column = |name: &str| -> Vec<Option<String>> {
        rows.iter()
            .map(|row| match &row[name] {
                Value::Null => None,
                Value::String(text) => Some(text.clone()),
                other => Some(js_json::stringify(other)),
            })
            .collect()
    };
    let names = [
        "connector_key",
        "status",
        "last_checked_at",
        "last_success_at",
        "consecutive_failures",
        "cursor_state",
        "last_error",
    ];
    let columns: Vec<Vec<Option<String>>> = names.iter().map(|name| column(name)).collect();
    state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let mut query = sqlx::query(UPSERT_HEALTH);
                    for values in columns {
                        query = query.bind(values);
                    }
                    query.execute(tx).await.map(|_| ())
                })
            },
        )
        .await
}

/// The columns of `signalInsert`, in its order.
const INSERT_SIGNALS: &str = "insert into public.external_signals \
    (platform, connector_key, platform_content_id, signal_kind, canonical_url, query_seed, text, \
     hashtags, published_at, observed_at, collected_at, first_seen_at, last_seen_at, metrics_json, \
     language, language_confidence, korean_relevance, normalized_text_hash, ingestion_version, \
     rights_mode, payload, raw_expires_at) \
    select s.platform, s.platform, s.content_id, s.kind, s.url, s.seed, s.text, \
           string_to_array(s.tags, chr(31)), s.published::timestamptz, s.observed::timestamptz, \
           $11::timestamptz, s.observed::timestamptz, s.observed::timestamptz, s.metrics::jsonb, \
           s.language, null::numeric, null::numeric, s.hash, 1::bigint, s.rights, s.payload::jsonb, \
           null::timestamptz \
    from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], \
                $7::text[], $8::text[], $9::text[], $10::text[], $12::text[], $13::text[], \
                $14::text[], $15::text[]) \
         as s(platform, content_id, kind, url, seed, text, tags, published, observed, metrics, \
              language, hash, rights, payload) \
    on conflict (platform, platform_content_id) do nothing";

/// `persistSignals`. It cannot succeed (module comment); should the schema
/// change so that it would, the insert is rolled back and the run fails as
/// it does today, with an error in the log, until the rest is ported.
async fn persist_signals(state: &AppState, signals: &[RawSignal], collected_at: &str) {
    let columns = signal_columns(signals);
    let collected_at = collected_at.to_owned();
    let inserted = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let mut query = sqlx::query(INSERT_SIGNALS);
                    for (index, values) in columns.into_iter().enumerate() {
                        if index == 10 {
                            query = query.bind(collected_at.clone());
                        }
                        query = query.bind(values);
                    }
                    query.execute(&mut *tx).await?;
                    Err::<(), sqlx::Error>(sqlx::Error::Protocol("rolled back".into()))
                })
            },
        )
        .await;
    if let Err(sqlx::Error::Protocol(_)) = inserted {
        tracing::error!(
            "external_signals accepted a signal without raw_expires_at: \
             the radar matching is not ported, the run is reported as failed"
        );
    }
}

fn signal_columns(signals: &[RawSignal]) -> Vec<Vec<Option<String>>> {
    let row = |signal: &RawSignal| -> [Option<String>; 14] {
        let text_mention = matches!(signal.platform, Platform::X | Platform::Threads);
        let time = |value: &Value| radar_text::timestamp(value).ok().flatten();
        [
            Some(signal.platform.key().to_owned()),
            Some(signal.content_id.clone()),
            Some(
                if text_mention {
                    "text_mention"
                } else {
                    "instagram_media"
                }
                .to_owned(),
            ),
            Some(signal.canonical_url.clone()),
            signal.query_seed.clone(),
            signal.text.clone(),
            Some(signal.hashtags.join("\u{1f}")),
            signal.published_at.as_ref().and_then(time),
            time(&signal.observed_at),
            Some(
                if text_mention {
                    r#"{"volume":1}"#
                } else {
                    "{}"
                }
                .to_owned(),
            ),
            signal.language.clone(),
            Some(radar_text::text_hash(&radar_connectors::normalized_text(
                signal,
            ))),
            Some(
                if text_mention {
                    "link_only"
                } else {
                    "api_metadata"
                }
                .to_owned(),
            ),
            Some("{}".to_owned()),
        ]
    };
    let rows: Vec<[Option<String>; 14]> = signals.iter().map(row).collect();
    (0..14)
        .map(|column| rows.iter().map(|row| row[column].clone()).collect())
        .collect()
}

const LOAD_MEMES: &str = "select m.id, m.title, m.aliases, m.lifecycle_status::text \
                          from public.memes m where m.moderation_status::text = any($1::text[])";
const LOAD_STATES: &str = "select r.meme_id, r.current_state from public.radar_meme_state r";

/// `loadMemes`: its two reads, for their failures. With no signal nothing
/// is matched, so the rows are not used.
async fn load_memes(state: &AppState) -> Result<(), &'static str> {
    let identity = DbIdentity::service_role();
    let statuses = vec!["approved".to_owned(), "limited".to_owned()];
    state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(LOAD_MEMES).bind(statuses).fetch_all(tx).await })
        })
        .await
        .map_err(|_| "RADAR_MEME_READ_FAILED")?;
    state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(LOAD_STATES).fetch_all(tx).await })
        })
        .await
        .map_err(|_| "RADAR_STATE_READ_FAILED")?;
    Ok(())
}
