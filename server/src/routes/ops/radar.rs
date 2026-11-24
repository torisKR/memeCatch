//! `runRadarPulse` of `lib/trend/radar-pulse.server.ts` with
//! `runRadarConnectors` (`radar-connectors.server.ts`) and the repository of
//! `radar-repository.server.ts`, as `service_role`, one transaction per
//! statement as the admin client runs them: store the collected signals,
//! write the connector health, read the memes, match each new signal to a
//! meme (`radar_score.rs`), keep the match (automatic at 0.9 and above,
//! otherwise pending for an operator), queue a safety review for a risky
//! automatic match, and record one observation per matched meme.
//!
//! The signal insert names `raw_expires_at` with the signal's
//! `rawExpiresAt`, which no connector set, so the TypeScript wrote `NULL`
//! into a `NOT NULL` column and never stored a signal (PLAN.md R8-1). The
//! raw fields are kept 30 days from collection: the column's default and the
//! `external_signals_runtime_raw_retention_max_30d` check (D3-1).

use futures_util::future::join_all;
use serde::Serialize;
use serde_json::{Map, Value};

use super::radar_connectors::{self, Collected, Platform, RadarClient, RawSignal};
use super::radar_score::{self, Entity, Observation, State};
use super::radar_text;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::js_json;

const CONNECTOR_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(30);
/// `AUTOMATIC_MATCH_CONFIDENCE`.
const AUTOMATIC_MATCH_CONFIDENCE: f64 = 0.9;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RadarStatus {
    Ok,
    Partial,
    Failed,
}

/// The counts of `RadarPulseResult`.
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct Counts {
    persisted_signals: u32,
    automatic_matches: u32,
    pending_matches: u32,
    observations: u32,
    safety_reviews: u32,
}

/// `RadarPulseResult`, and `failedRadar` (all counts zero) with its `error`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RadarResult {
    pub status: RadarStatus,
    #[serde(flatten)]
    counts: Counts,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
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
        Ok((status, counts)) => RadarResult {
            status,
            counts,
            error: None,
        },
        Err(message) => RadarResult {
            status: RadarStatus::Failed,
            counts: Counts::default(),
            error: Some(message.to_owned()),
        },
    }
}

async fn pulse(
    state: &AppState,
    client: &RadarClient,
    platforms: &[Platform],
) -> Result<(RadarStatus, Counts), &'static str> {
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
    let signals: Vec<&RawSignal> = results
        .iter()
        .filter_map(|(signals, _)| signals.as_ref().ok())
        .flatten()
        .collect();
    let stored = persist_signals(state, &signals, &attempted_at)
        .await
        .map_err(|error| {
            tracing::warn!(%error, "radar signal insert failed");
            "RADAR_SIGNAL_WRITE_FAILED"
        })?;
    let health: Vec<&Value> = results.iter().map(|(_, health)| health).collect();
    persist_health(state, &health)
        .await
        .map_err(|_| "RADAR_CONNECTOR_HEALTH_WRITE_FAILED")?;
    let memes = load_memes(state).await?;
    let counts = review(state, &stored, &memes).await?;
    Ok((status, counts))
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

/// One statement as `service_role`, in its own transaction.
async fn service<T, F>(state: &AppState, run: F) -> Result<T, sqlx::Error>
where
    T: Send,
    F: for<'t> FnOnce(
            &'t mut sqlx::PgConnection,
        ) -> futures_util::future::BoxFuture<'t, Result<T, sqlx::Error>>
        + Send,
{
    state
        .db
        .with_identity(&DbIdentity::service_role(), IdentityOptions::default(), run)
        .await
}

const LOAD_STATE: &str = "select connector_key, to_json(last_success_at) #>> '{}', \
                          consecutive_failures::bigint, cursor_state::text \
                          from public.connector_health";

/// `loadConnectorState`. `last_success_at` as the plan executor returns a
/// timestamp (`row_to_json`), since it is written back as text.
async fn load_state(state: &AppState) -> Result<Vec<(String, Previous)>, sqlx::Error> {
    let rows: Vec<(String, Option<String>, i64, String)> = service(state, |tx| {
        Box::pin(async move { sqlx::query_as(LOAD_STATE).fetch_all(tx).await })
    })
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
async fn persist_health(state: &AppState, rows: &[&Value]) -> Result<(), sqlx::Error> {
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
    service(state, |tx| {
        Box::pin(async move {
            let mut query = sqlx::query(UPSERT_HEALTH);
            for values in columns {
                query = query.bind(values);
            }
            query.execute(tx).await.map(|_| ())
        })
    })
    .await
}

/// The columns of `signalInsert`, in its order. `collected_at` is the run's
/// time (every connector sets `collectedAt: attemptedAt`) and the raw
/// fields expire 30 days after it. `on conflict do nothing` returns only the
/// new rows, as `ignoreDuplicates` with `.select(...)` does: a signal seen
/// by an earlier run is not matched again.
const INSERT_SIGNALS: &str = "insert into public.external_signals \
    (platform, connector_key, platform_content_id, signal_kind, canonical_url, query_seed, text, \
     hashtags, published_at, observed_at, collected_at, first_seen_at, last_seen_at, metrics_json, \
     language, language_confidence, korean_relevance, normalized_text_hash, ingestion_version, \
     rights_mode, payload, raw_expires_at) \
    select s.platform, s.platform, s.content_id, s.kind, s.url, s.seed, s.text, \
           string_to_array(s.tags, chr(31)), s.published::timestamptz, s.observed::timestamptz, \
           $11::timestamptz, s.observed::timestamptz, s.observed::timestamptz, s.metrics::jsonb, \
           s.language, null::numeric, null::numeric, s.hash, 1::bigint, s.rights, s.payload::jsonb, \
           $11::timestamptz + interval '30 days' \
    from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], \
                $7::text[], $8::text[], $9::text[], $10::text[], $12::text[], $13::text[], \
                $14::text[], $15::text[]) with ordinality \
         as s(platform, content_id, kind, url, seed, text, tags, published, observed, metrics, \
              language, hash, rights, payload, n) \
    order by s.n \
    on conflict (platform, platform_content_id) do nothing \
    returning id::text, platform, text, hashtags, to_json(observed_at) #>> '{}', \
              (extract(epoch from observed_at) * 1000)::float8, metrics_json::text";

/// A row `persistSignals` returns, with what the matching reads.
pub struct Stored {
    pub id: String,
    pub platform: String,
    text: Option<String>,
    hashtags: Vec<String>,
    /// As the plan executor returns it (`row_to_json`), for the RPC.
    observed_at: String,
    observed_ms: f64,
    metrics: Value,
}

type StoredRow = (
    String,
    String,
    Option<String>,
    Vec<String>,
    String,
    f64,
    String,
);

/// `persistSignals`: the signals, one per platform and content id (the
/// first one's place, the last one's values, as the TypeScript's `Map`).
async fn persist_signals(
    state: &AppState,
    signals: &[&RawSignal],
    collected_at: &str,
) -> Result<Vec<Stored>, sqlx::Error> {
    if signals.is_empty() {
        return Ok(Vec::new());
    }
    let mut unique: Vec<&RawSignal> = Vec::new();
    for signal in signals {
        let same = |kept: &&RawSignal| {
            kept.platform == signal.platform && kept.content_id == signal.content_id
        };
        match unique.iter().position(same) {
            Some(index) => unique[index] = signal,
            None => unique.push(signal),
        }
    }
    let columns = signal_columns(&unique);
    let collected_at = collected_at.to_owned();
    let rows: Vec<StoredRow> = service(state, |tx| {
        Box::pin(async move {
            let mut query = sqlx::query_as(INSERT_SIGNALS);
            for (index, values) in columns.into_iter().enumerate() {
                if index == 10 {
                    query = query.bind(collected_at.clone());
                }
                query = query.bind(values);
            }
            query.fetch_all(tx).await
        })
    })
    .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, platform, text, hashtags, observed_at, observed_ms, metrics)| Stored {
                id,
                platform,
                text,
                hashtags,
                observed_at,
                observed_ms,
                metrics: serde_json::from_str(&metrics).unwrap_or(Value::Null),
            },
        )
        .collect())
}

/// `signalInsert` over `normalizeRadarSignal`, as text columns.
fn signal_columns(signals: &[&RawSignal]) -> Vec<Vec<Option<String>>> {
    let row = |signal: &&RawSignal| -> [Option<String>; 14] {
        let (kind, rights) = signal.kind_and_rights();
        let time = |value: &Value| radar_text::timestamp(value).ok().flatten();
        let tags: Vec<String> = signal
            .hashtags
            .iter()
            .map(|tag| radar_text::normalize_hashtag(tag))
            .filter(|tag| !tag.is_empty())
            .collect();
        [
            Some(signal.platform.key().to_owned()),
            Some(signal.content_id.clone()),
            Some(kind.to_owned()),
            Some(signal.canonical_url.clone()),
            signal.query_seed.clone(),
            signal.text.clone(),
            // `string_to_array('', …)` is `{}`.
            Some(tags.join("\u{1f}")),
            signal.published_at.as_ref().and_then(time),
            time(&signal.observed_at),
            Some(js_json::stringify(&signal.metrics)),
            signal.language.clone(),
            Some(radar_text::text_hash(&radar_connectors::normalized_text(
                signal,
            ))),
            Some(rights.to_owned()),
            Some(js_json::stringify(&signal.payload)),
        ]
    };
    let rows: Vec<[Option<String>; 14]> = signals.iter().map(row).collect();
    (0..14)
        .map(|column| rows.iter().map(|row| row[column].clone()).collect())
        .collect()
}

const LOAD_MEMES: &str = "select m.id::text, m.title, m.aliases, m.lifecycle_status::text \
                          from public.memes m where m.moderation_status::text = any($1::text[])";
const LOAD_STATES: &str = "select r.meme_id::text, r.current_state from public.radar_meme_state r";

/// `loadMemes`: approved and limited memes, each in its radar state or, if
/// it has none yet, the one its lifecycle implies.
async fn load_memes(state: &AppState) -> Result<Vec<Entity>, &'static str> {
    let statuses = vec!["approved".to_owned(), "limited".to_owned()];
    let memes: Vec<(String, String, Vec<String>, String)> = service(state, |tx| {
        Box::pin(async move {
            sqlx::query_as(LOAD_MEMES)
                .bind(statuses)
                .fetch_all(tx)
                .await
        })
    })
    .await
    .map_err(|_| "RADAR_MEME_READ_FAILED")?;
    let states: Vec<(String, String)> = service(state, |tx| {
        Box::pin(async move { sqlx::query_as(LOAD_STATES).fetch_all(tx).await })
    })
    .await
    .map_err(|_| "RADAR_STATE_READ_FAILED")?;
    Ok(memes
        .into_iter()
        .map(|(id, title, aliases, lifecycle)| {
            let state = states
                .iter()
                .find(|(meme, _)| *meme == id)
                .and_then(|(_, state)| State::parse(state))
                .unwrap_or_else(|| State::from_lifecycle(&lifecycle));
            Entity {
                id,
                canonical_name: title,
                aliases,
                state,
            }
        })
        .collect())
}

/// `metric`: a finite number, else 0.
fn metric(signal: &Stored, name: &str) -> f64 {
    signal
        .metrics
        .get(name)
        .and_then(Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(0.0)
}

/// `isSafetyReviewSignal`.
fn needs_safety_review(signal: &Stored) -> bool {
    metric(signal, "risk") >= 0.7 || metric(signal, "reports") >= 20.0
}

/// The matching and scoring of `runRadarPulse`, over the new signals.
async fn review(
    state: &AppState,
    stored: &[Stored],
    memes: &[Entity],
) -> Result<Counts, &'static str> {
    let mut counts = Counts {
        persisted_signals: u32::try_from(stored.len()).unwrap_or(u32::MAX),
        ..Counts::default()
    };
    let mut matched: Vec<(&str, Vec<(&Stored, f64)>)> = Vec::new();
    for signal in stored {
        let mut text = vec![signal.text.clone().unwrap_or_default()];
        text.extend(signal.hashtags.iter().map(|tag| format!("#{tag}")));
        let Some(found) = radar_score::match_entity(&text.join(" "), memes) else {
            continue;
        };
        let automatic = found.confidence >= AUTOMATIC_MATCH_CONFIDENCE;
        persist_match(
            state,
            found.entity_id,
            signal,
            found.method,
            found.confidence,
            automatic,
        )
        .await
        .map_err(|_| "RADAR_MATCH_WRITE_FAILED")?;
        if !automatic {
            counts.pending_matches += 1;
            continue;
        }
        counts.automatic_matches += 1;
        match matched
            .iter_mut()
            .find(|(meme, _)| *meme == found.entity_id)
        {
            Some((_, signals)) => signals.push((signal, found.confidence)),
            None => matched.push((found.entity_id, vec![(signal, found.confidence)])),
        }
        if needs_safety_review(signal) {
            enqueue_safety_review(state, found.entity_id, signal)
                .await
                .map_err(|_| "RADAR_SAFETY_REVIEW_WRITE_FAILED")?;
            counts.safety_reviews += 1;
        }
    }
    for meme in memes {
        let Some((_, signals)) = matched.iter().find(|(id, _)| *id == meme.id) else {
            continue;
        };
        let observations: Vec<Observation<'_>> = signals
            .iter()
            .map(|(signal, confidence)| Observation {
                platform: &signal.platform,
                observed_ms: signal.observed_ms.floor(),
                volume: metric(signal, "volume"),
                velocity: metric(signal, "velocity"),
                engagement: metric(signal, "engagement"),
                reliability: *confidence,
            })
            .collect();
        let now = crate::routes::public::csp_report::now_ms() as f64;
        let score = radar_score::score(&observations, now);
        if score.aggregated_platforms.is_empty() {
            continue;
        }
        let recommended = radar_score::recommend(meme.state, score.heat, score.confidence);
        // The newest signal of a counted platform; the first of equals.
        let latest = signals
            .iter()
            .filter(|(signal, _)| radar_score::is_aggregation_platform(&signal.platform))
            .fold(None::<&Stored>, |newest, (signal, _)| match newest {
                Some(newest) if newest.observed_ms >= signal.observed_ms => Some(newest),
                _ => Some(signal),
            })
            .expect("a counted platform has a signal");
        record_observation(state, &meme.id, latest, &score, recommended)
            .await
            .map_err(|_| "RADAR_OBSERVATION_WRITE_FAILED")?;
        counts.observations += 1;
    }
    Ok(counts)
}

const UPSERT_MATCH: &str = "insert into public.meme_signal_links \
    (meme_id, signal_id, match_confidence, match_method, review_state, reviewed_at) \
    values ($1::uuid, $2::uuid, $3::numeric, $4, $5, $6::timestamptz) \
    on conflict (meme_id, signal_id) do update set \
      match_confidence = excluded.match_confidence, match_method = excluded.match_method, \
      review_state = excluded.review_state, reviewed_at = excluded.reviewed_at";

/// `persistMatch`: an automatic match is reviewed now, by no one; any other
/// waits for an operator (`pending`).
async fn persist_match(
    state: &AppState,
    meme_id: &str,
    signal: &Stored,
    method: &'static str,
    confidence: f64,
    automatic: bool,
) -> Result<(), sqlx::Error> {
    let (meme_id, signal_id) = (meme_id.to_owned(), signal.id.clone());
    let review_state = if automatic { "auto_matched" } else { "pending" };
    let reviewed_at = automatic.then(radar_text::now_iso);
    service(state, |tx| {
        Box::pin(async move {
            sqlx::query(UPSERT_MATCH)
                .bind(meme_id)
                .bind(signal_id)
                .bind(js_json::number(confidence))
                .bind(method)
                .bind(review_state)
                .bind(reviewed_at)
                .execute(tx)
                .await
                .map(|_| ())
        })
    })
    .await
}

const ENQUEUE_SAFETY_REVIEW: &str = "select public.enqueue_safety_review(\
    p_meme_id => $1::uuid, p_proposed_level => 'gray', p_reason => 'external_context_risk', \
    p_evidence => $2::jsonb, p_source_signal_id => $3::uuid)::text";

/// `enqueueSafetyReview`: a proposal to mark the meme gray, which an
/// operator decides on `/admin/radar-safety`.
async fn enqueue_safety_review(
    state: &AppState,
    meme_id: &str,
    signal: &Stored,
) -> Result<(), sqlx::Error> {
    let evidence = serde_json::json!({ "platform": signal.platform, "metrics": signal.metrics });
    let (meme_id, signal_id) = (meme_id.to_owned(), signal.id.clone());
    service(state, |tx| {
        Box::pin(async move {
            sqlx::query(ENQUEUE_SAFETY_REVIEW)
                .bind(meme_id)
                .bind(js_json::stringify(&evidence))
                .bind(signal_id)
                .execute(tx)
                .await
                .map(|_| ())
        })
    })
    .await
}

const RECORD_OBSERVATION: &str = "select public.record_radar_trend_observation(\
    p_meme_id => $1::uuid, p_signal_id => $2::uuid, p_observed_at => $3::timestamptz, \
    p_heat_score => $4::numeric, p_confidence => $5::numeric, p_recommended_state => $6, \
    p_model_version => 'radar_v1', p_factors => $7::jsonb, p_required_observations => 2)::text";

/// `recordObservation`: the function keeps the observation and moves the
/// meme's state after two in a row point the same way.
async fn record_observation(
    state: &AppState,
    meme_id: &str,
    latest: &Stored,
    score: &radar_score::Score,
    recommended: State,
) -> Result<(), sqlx::Error> {
    let factors = serde_json::json!({
        "platforms": score.aggregated_platforms,
        "excluded_platforms": score.excluded_platforms,
    });
    let values = (
        meme_id.to_owned(),
        latest.id.clone(),
        latest.observed_at.clone(),
        js_json::number(score.heat),
        js_json::number(score.confidence),
        js_json::stringify(&factors),
    );
    service(state, |tx| {
        Box::pin(async move {
            sqlx::query(RECORD_OBSERVATION)
                .bind(values.0)
                .bind(values.1)
                .bind(values.2)
                .bind(values.3)
                .bind(values.4)
                .bind(recommended.as_str())
                .bind(values.5)
                .execute(tx)
                .await
                .map(|_| ())
        })
    })
    .await
}
