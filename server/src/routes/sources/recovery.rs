//! `lib/sources/recovery.server.ts`: the source acquisition recovery ledger,
//! through its four database functions.

use serde_json::Value;

use super::db::{self, Bind, bind};
use super::url::Platform;
use crate::AppState;

/// `SOURCE_INGESTION_ERROR_CODES`.
pub const ERROR_CODES: [&str; 6] = [
    "invalid_url",
    "missing_meme",
    "provider_transient",
    "provider_uncertain",
    "metadata_mismatch",
    "db_failure",
];

/// `sourceIngestionFailure(code).retryable`.
pub fn retryable(code: &str) -> bool {
    matches!(code, "provider_transient" | "db_failure")
}

/// `SourceAcquisitionRecoveryDto`, with the fields the callers read.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Recovery {
    pub source_key: String,
    pub source_id: Option<String>,
    pub platform: Platform,
    pub external_id: Option<String>,
    pub next_retry_at: Option<String>,
    pub last_error_code: String,
}

/// `sourceAcquisitionKey(platform, externalId)`.
pub fn source_key(platform: Platform, external_id: &str) -> String {
    format!("{}:{external_id}", platform.as_str())
}

/// `SourceAcquisitionFailureInput`; `attempt` is always 1 in the callers.
pub struct FailureInput<'a> {
    pub source_key: &'a str,
    pub idempotency_key: &'a str,
    pub platform: Platform,
    pub source_id: Option<&'a str>,
    pub external_id: Option<&'a str>,
    pub canonical_url: Option<&'a str>,
    pub code: &'static str,
    /// `occurredAt.toISOString()`.
    pub occurred_at: &'a str,
}

const RECORD: &str = "WITH __q AS (SELECT * FROM public.record_source_acquisition_failure(\
    p_source_key => $1, p_source_id => $2::uuid, p_idempotency_key => $3, p_platform => $4, \
    p_external_id => $5, p_canonical_url => $6, p_error_code => $7, p_retryable => $8::boolean, \
    p_attempted_at => $9::timestamptz, p_next_retry_at => $10::timestamptz)) \
    SELECT row_to_json(__q)::text FROM __q";

/// `recordSourceAcquisitionFailure(input)`: the next retry time it set.
pub async fn record_failure(
    state: &AppState,
    input: &FailureInput<'_>,
) -> Result<Option<String>, String> {
    let binds: Vec<Bind> = vec![
        bind(input.source_key),
        input.source_id.map(str::to_owned),
        bind(input.idempotency_key),
        bind(input.platform.as_str()),
        input.external_id.map(str::to_owned),
        input.canonical_url.map(str::to_owned),
        bind(input.code),
        bind(if retryable(input.code) {
            "true"
        } else {
            "false"
        }),
        bind(input.occurred_at),
        None,
    ];
    let rows = db::rows(state, RECORD, binds, None)
        .await
        .map_err(|_| "source_recovery_record_failed".to_owned())?;
    let record = rows
        .first()
        .filter(|row| row.is_object())
        .ok_or_else(|| "source_recovery_record_missing".to_owned())?;
    if !record.get("attempt_count").is_some_and(Value::is_number) {
        return Err("source_recovery_record_invalid".to_owned());
    }
    Ok(db::text(record, "next_retry_at").map(str::to_owned))
}

const RESOLVE: &str = "WITH __q AS (SELECT * FROM public.resolve_source_acquisition_failure(\
    p_source_key => $1, p_attempt_idempotency_key => $2, p_attempt_started_at => $3::timestamptz, \
    p_resolved_at => $4::timestamptz)) SELECT row_to_json(__q)::text FROM __q";

/// `resolveSourceAcquisitionFailure(...)`; the times are ISO strings.
pub async fn resolve(
    state: &AppState,
    source_key: &str,
    attempt_key: &str,
    attempt_started_at: &str,
    resolved_at: &str,
) -> Result<(), String> {
    if attempt_key.is_empty() {
        return Err("source_recovery_resolution_context_required".to_owned());
    }
    let binds = vec![
        bind(source_key),
        bind(attempt_key),
        bind(attempt_started_at),
        bind(resolved_at),
    ];
    let rows = db::rows(state, RESOLVE, binds, None).await;
    let resolved = rows
        .ok()
        .and_then(|rows| rows.into_iter().next())
        .is_some_and(|row| row.get("resolved").is_some_and(Value::is_boolean));
    if resolved {
        Ok(())
    } else {
        Err("source_recovery_resolution_failed".to_owned())
    }
}

const LIST_DUE: &str = "WITH __q AS (SELECT * FROM public.list_due_source_acquisition_recovery(\
    p_now => $1::timestamptz, p_limit => $2::integer)) SELECT row_to_json(__q)::text FROM __q";
const LIST_ACTIVE: &str = "WITH __q AS (SELECT * FROM public.list_active_source_acquisition_recovery()) \
    SELECT row_to_json(__q)::text FROM __q";

/// `listDueSourceAcquisitionRecovery(now, 500)`.
pub async fn list_due(state: &AppState, now: &str) -> Result<Vec<Recovery>, String> {
    db::rows(state, LIST_DUE, vec![bind(now), bind("500")], None)
        .await
        .map(|rows| dtos(&rows))
        .map_err(|_| "source_recovery_query_failed".to_owned())
}

/// `listActiveSourceAcquisitionRecovery()`.
pub async fn list_active(state: &AppState) -> Result<Vec<Recovery>, String> {
    db::rows(state, LIST_ACTIVE, Vec::new(), None)
        .await
        .map(|rows| dtos(&rows))
        .map_err(|_| "source_recovery_query_failed".to_owned())
}

/// `recoveryDtos(data)`: rows of the wrong shape are dropped.
fn dtos(rows: &[Value]) -> Vec<Recovery> {
    rows.iter().filter_map(dto).collect()
}

fn dto(row: &Value) -> Option<Recovery> {
    let typed = row.get("attempt_count").is_some_and(Value::is_number)
        && row
            .get("last_error_retryable")
            .is_some_and(Value::is_boolean)
        && db::text(row, "last_attempted_at").is_some();
    let code = db::text(row, "last_error_code").filter(|code| ERROR_CODES.contains(code))?;
    let platform = db::text(row, "platform").and_then(Platform::parse)?;
    let owned = |key| db::text(row, key).map(str::to_owned);
    typed
        .then(|| Recovery {
            source_key: owned("source_key").unwrap_or_default(),
            source_id: owned("source_id"),
            platform,
            external_id: owned("external_id"),
            next_retry_at: owned("next_retry_at"),
            last_error_code: code.to_owned(),
        })
        .filter(|_| db::text(row, "source_key").is_some())
}
