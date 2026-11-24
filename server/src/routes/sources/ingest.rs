//! `POST /api/admin/source-ingestions` (`app/api/admin/source-ingestions/route.ts`)
//! and `ingestSource` of `lib/sources/ingest.server.ts`: an operator records
//! a source's metadata, fetched through the shared oEmbed client.

use axum::extract::{Request, State};
use axum::http::HeaderValue;
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::response::Response;

use super::db::{self, bind};
use super::recovery::{self, FailureInput, source_key};
use super::refresh::{iso_at, now_ms};
use super::url::{Normalized, normalize_source_url};
use crate::oembed::{Failure, OEmbedResult};
use crate::routes::js_string::JsString;
use crate::routes::mpe::renders::is_zod_uuid;
use crate::routes::origin;
use crate::routes::request::{self, Json};
use crate::{AppState, auth, fallback};

const RIGHTS_MODE: &str = "METADATA_ONLY";
const METADATA_TTL_MS: i64 = 30 * 86_400_000;
/// `request.json()` reads any size; this reads 1 MiB and treats more as no JSON.
const MAX_BODY_BYTES: usize = 1024 * 1024;
const GENERIC: &str = r#"{"ok":false,"error":"수집 기록을 저장하지 못했습니다.","code":"db_failure","retryable":true}"#;

/// `SourceIngestionError`.
struct IngestionError {
    message: String,
    status: u16,
    code: &'static str,
    retryable: bool,
    next_retry_at: Option<String>,
}

/// What `ingestSource` threw: its own error, or another (the route's 503).
enum Thrown {
    Ingestion(IngestionError),
    Other,
}

fn ingestion(message: &str, status: u16, code: &'static str) -> Thrown {
    Thrown::Ingestion(IngestionError {
        message: message.to_owned(),
        status,
        code,
        retryable: recovery::retryable(code),
        next_retry_at: None,
    })
}

fn text(value: &str) -> String {
    JsString::from(value).json()
}

/// `Response.json({ ok: false, error }, { status })`.
fn refused(status: StatusCode, error: &str) -> Response {
    request::json(status, format!(r#"{{"ok":false,"error":"{error}"}}"#))
}

/// `POST(request)`.
pub async fn post(State(state): State<AppState>, request: Request) -> Response {
    if !request::has_ascii_target(request.uri()) {
        return fallback::answer(State(state), request).await;
    }
    if !origin::request_is_trusted(&state, request.headers()) {
        return refused(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (mut parts, body) = request.into_parts();
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return refused(StatusCode::UNAUTHORIZED, "signed_out");
    };
    // `const { data: isOperator } = await db.rpc("is_operator")`: an error is a refusal.
    if !matches!(auth::is_operator(&state, &user).await, Ok(true)) {
        return refused(StatusCode::FORBIDDEN, "operator_required");
    }
    let payload = request::read_at_most(body, MAX_BODY_BYTES)
        .await
        .ok()
        .and_then(|bytes| Json::parse(&request::decode_text(&bytes)));
    let Some((url, target, retry)) = payload.as_ref().and_then(input) else {
        return refused(StatusCode::BAD_REQUEST, "invalid_input");
    };
    if retry == Some(false) {
        return refused(StatusCode::BAD_REQUEST, "invalid_retry");
    }
    respond(ingest_source(&state, &url, target.as_deref(), &user.id).await)
}

/// The route's answer for what `ingestSource` returned or threw.
fn respond(result: Result<String, Thrown>) -> Response {
    match result {
        Ok(data) => {
            let mut response =
                request::json(StatusCode::OK, format!(r#"{{"ok":true,"data":{data}}}"#));
            response
                .headers_mut()
                .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Err(Thrown::Ingestion(error)) => {
            let next = error
                .next_retry_at
                .filter(|at| !at.is_empty())
                .map(|at| format!(r#","nextRetryAt":{}"#, text(&at)))
                .unwrap_or_default();
            let body = format!(
                r#"{{"ok":false,"error":{},"code":"{}","retryable":{}{next}}}"#,
                text(&error.message),
                error.code,
                error.retryable
            );
            request::json(
                StatusCode::from_u16(error.status).unwrap_or(StatusCode::BAD_GATEWAY),
                body,
            )
        }
        Err(Thrown::Other) => request::json(StatusCode::SERVICE_UNAVAILABLE, GENERIC),
    }
}

/// `inputSchema.safeParse(payload)`: the trimmed URL, the target meme and
/// `retry`, or `None` for `invalid_input`.
fn input(payload: &Json) -> Option<(String, Option<String>, Option<bool>)> {
    let entries = payload.as_object()?;
    let url = JsString::from(request::property(entries, "url")?.as_str()?).trim();
    if url.is_empty() || url.len() > 2_048 {
        return None;
    }
    let target = match request::property(entries, "targetMemeId") {
        None => None,
        Some(value) => Some(value.as_str().filter(|id| is_zod_uuid(id))?.to_owned()),
    };
    let retry = match request::property(entries, "retry") {
        None => None,
        Some(Json::Bool(flag)) => Some(*flag),
        Some(_) => return None,
    };
    Some((String::from_utf16_lossy(url.units()), target, retry))
}

const MEME: &str = "WITH __q AS (SELECT id FROM public.memes WHERE id = $1::uuid) \
    SELECT row_to_json(__q)::text FROM __q";
const RECORD: &str = "WITH __q AS (SELECT * FROM public.record_source_ingestion(p_platform => $1, \
    p_external_id => $2, p_canonical_url => $3, p_title => $4, p_channel_name => $5, \
    p_submitted_by => $6::uuid, p_target_meme_id => $7::uuid, p_processing_rights_mode => $8, \
    p_metadata_refreshed_at => $9::timestamptz, p_metadata_expires_at => $10::timestamptz)) \
    SELECT row_to_json(__q)::text FROM __q";

/// `ingestSource({ url, targetMemeId }, submittedBy)`: the result's JSON.
async fn ingest_source(
    state: &AppState,
    url: &str,
    target: Option<&str>,
    submitted_by: &str,
) -> Result<String, Thrown> {
    let normalized = normalize_source_url(url).ok_or_else(|| {
        ingestion(
            "지원하는 플랫폼의 최종 HTTPS 공개 URL이 필요합니다.",
            400,
            "invalid_url",
        )
    })?;
    if let Some(target) = target {
        check_target(state, target).await?;
    }
    let mut attempt = Attempt::new(&normalized);
    let metadata = match state.oembed.get(&normalized.canonical_url).await {
        Ok(metadata) => metadata,
        Err(failure) => return Err(attempt.provider_failure(state, &failure).await),
    };
    if metadata
        .content_id
        .as_ref()
        .is_some_and(|id| !id.is_empty() && *id != normalized.external_id)
    {
        attempt
            .record(state, "mismatch", "metadata_mismatch")
            .await?;
        return Err(ingestion(
            "플랫폼 메타데이터가 URL과 일치하지 않습니다.",
            502,
            "metadata_mismatch",
        ));
    }
    let record = attempt
        .store(state, &metadata, target, submitted_by)
        .await?;
    // `resolveSourceAcquisitionFailure` failing leaves a warning only.
    let resolved = recovery::resolve(
        state,
        &attempt.key,
        &attempt.idempotency_key,
        &attempt.started_at,
        &attempt.refreshed_at,
    )
    .await;
    Ok(result_json(
        &normalized,
        &metadata,
        &record,
        resolved.is_ok(),
    ))
}

/// The target meme must exist.
async fn check_target(state: &AppState, target: &str) -> Result<(), Thrown> {
    let found = db::rows(state, MEME, vec![bind(target)], None)
        .await
        .map_err(|_| ingestion("대상 밈을 확인하지 못했습니다.", 503, "db_failure"))?;
    if found.is_empty() {
        return Err(ingestion("대상 밈을 찾지 못했습니다.", 404, "missing_meme"));
    }
    Ok(())
}

/// `SourceIngestionResult` as JSON, in its key order.
fn result_json(
    normalized: &Normalized,
    metadata: &OEmbedResult,
    record: &serde_json::Value,
    resolved: bool,
) -> String {
    let js = |value: &Option<JsString>| value.as_ref().map_or("null".to_owned(), JsString::json);
    let id = db::text(record, "ingestion_id").map_or("null".to_owned(), text);
    let status = db::text(record, "status").unwrap_or_default();
    let duplicate = record
        .get("duplicate")
        .map_or("null".to_owned(), ToString::to_string);
    let warning = if resolved {
        ""
    } else {
        r#","warning":"recovery_resolution_failed""#
    };
    format!(
        r#"{{"id":{id},"status":{},"platform":"{}","externalId":{},"canonicalUrl":{},"title":{},"author":{},"rightsMode":"{RIGHTS_MODE}","duplicate":{duplicate}{warning}}}"#,
        text(status),
        normalized.platform.as_str(),
        text(&normalized.external_id),
        text(&normalized.canonical_url),
        js(&metadata.title),
        js(&metadata.author_name),
    )
}

/// One ingestion attempt and its ledger key.
struct Attempt<'a> {
    normalized: &'a Normalized,
    key: String,
    started_at: String,
    idempotency_key: String,
    refreshed_at: String,
}

impl<'a> Attempt<'a> {
    fn new(normalized: &'a Normalized) -> Self {
        let key = source_key(normalized.platform, &normalized.external_id);
        let started_at = iso_at(now_ms());
        Self {
            idempotency_key: format!("ingest:{key}:{started_at}"),
            normalized,
            key,
            started_at,
            refreshed_at: String::new(),
        }
    }

    /// `recordSourceAcquisitionFailure` for this attempt; its error is
    /// thrown as is (not an ingestion error).
    async fn record(
        &self,
        state: &AppState,
        suffix: &str,
        code: &'static str,
    ) -> Result<Option<String>, Thrown> {
        let idempotency_key = match suffix {
            "" => self.idempotency_key.clone(),
            suffix => format!("{}:{suffix}", self.idempotency_key),
        };
        recovery::record_failure(
            state,
            &FailureInput {
                source_key: &self.key,
                idempotency_key: &idempotency_key,
                platform: self.normalized.platform,
                source_id: None,
                external_id: Some(&self.normalized.external_id),
                canonical_url: Some(&self.normalized.canonical_url),
                code,
                occurred_at: &self.started_at,
            },
        )
        .await
        .map_err(|_| Thrown::Other)
    }

    /// The `.catch` of `getOEmbed`.
    async fn provider_failure(&self, state: &AppState, failure: &Failure) -> Thrown {
        let (status, code) = match failure {
            Failure::OEmbed(error) if error.status == 502 => (502, "provider_transient"),
            Failure::OEmbed(_) => (404, "provider_uncertain"),
            _ => (502, "provider_transient"),
        };
        // Every exception here is an `Error`, so its message is always used.
        let message = failure.message();
        match self.record(state, "", code).await {
            Ok(next_retry_at) => Thrown::Ingestion(IngestionError {
                message: message.to_owned(),
                status,
                code,
                retryable: recovery::retryable(code),
                next_retry_at,
            }),
            Err(thrown) => thrown,
        }
    }

    /// `record_source_ingestion(...)` and the check of its row.
    async fn store(
        &mut self,
        state: &AppState,
        metadata: &OEmbedResult,
        target: Option<&str>,
        submitted_by: &str,
    ) -> Result<serde_json::Value, Thrown> {
        let refreshed_ms = now_ms();
        self.refreshed_at = iso_at(refreshed_ms);
        let lossy = |value: &Option<JsString>| {
            value
                .as_ref()
                .map(|text| String::from_utf16_lossy(text.units()))
        };
        let binds = vec![
            bind(self.normalized.platform.as_str()),
            bind(&self.normalized.external_id),
            bind(&self.normalized.canonical_url),
            lossy(&metadata.title),
            lossy(&metadata.author_name),
            bind(submitted_by),
            target.map(str::to_owned),
            bind(RIGHTS_MODE),
            bind(&self.refreshed_at),
            bind(&iso_at(refreshed_ms + METADATA_TTL_MS)),
        ];
        // The executor looks the function up first: without it the message is its own.
        let called = match db::function_exists(state, "record_source_ingestion").await {
            Ok(true) => db::rows(state, RECORD, binds, None).await,
            Ok(false) => Err("function not found".to_owned()),
            Err(message) => Err(message),
        };
        let rows = match called {
            Ok(rows) => rows,
            Err(message) => {
                let next_retry_at = self.record(state, "db", "db_failure").await.ok().flatten();
                return Err(Thrown::Ingestion(IngestionError {
                    message,
                    status: 503,
                    code: "db_failure",
                    retryable: true,
                    next_retry_at,
                }));
            }
        };
        rows.into_iter()
            .next()
            .filter(|row| {
                matches!(
                    db::text(row, "status"),
                    Some("metadata_ready" | "linked" | "duplicate")
                )
            })
            .ok_or_else(|| ingestion("수집 기록을 저장하지 못했습니다.", 503, "db_failure"))
    }
}
