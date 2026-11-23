//! `POST /api/mpe/uploads`: `app/api/mpe/uploads/route.ts`,
//! `lib/mpe/media.ts` and `lib/mpe/storage.server.ts`. Route id
//! `mpe-uploads`.
//!
//! Stores a signed-in user's media as `mpe-temporary/<user>/<uuid>` for a
//! day and creates the ingestion and its first jobs through
//! `create_metered_media_ingestion`, as the user, with the arguments the
//! TypeScript sends: the `mpe-worker` service picks those jobs up.
//!
//! Registered only when objects are kept in R2 (see `routes/upload.rs`).

use std::sync::Arc;

use axum::body::Bytes;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::Value as JsonValue;
use time::{Duration, OffsetDateTime};

use super::{failure, no_store};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::media_type::{self, Media, UPLOAD_LIMIT};
use crate::routes::multipart::{self, Form, TooLarge, Value};
use crate::routes::public::rate_limit::RateLimiter;
use crate::routes::request::{self, Json, SiteOrigin};
use crate::routes::tracking::growth::random_uuid;
use crate::routes::tracking::iso_timestamp;
use crate::routes::upload::{Admission, Admitted, admit, names};

/// `VIDEO_UPLOAD_LIMIT + 128 * 1024`.
const MAX_BODY_BYTES: usize = UPLOAD_LIMIT + 128 * 1024;
const RATE_LIMIT: usize = 5;
/// `MPE_STORAGE_BUCKET`.
const BUCKET: &str = "mpe-temporary";
const KEEP_FOR: Duration = Duration::hours(24);

// What lib/db/execute.ts sends: the function returns a set, so it is
// selected from. The casts say what Postgres inferred for node-pg's untyped
// arguments.
const INGESTION_SQL: &str = r#"WITH __q AS (SELECT * FROM public."create_metered_media_ingestion"("p_source_id" => $1::uuid, "p_ingest_mode" => $2, "p_mime_type" => $3, "p_media_kind" => $4, "p_byte_size" => $5::bigint, "p_sha256" => $6, "p_temporary_storage_key" => $7, "p_expires_at" => $8::timestamptz, "p_rights_accepted" => $9::boolean, "p_width" => $10::integer, "p_height" => $11::integer, "p_duration_ms" => $12::integer)) SELECT row_to_json(__q)::text FROM __q"#;
// `recordTemporaryCleanupFailure`, as `service_role`.
const CLEANUP_FAILURE_SQL: &str = r#"INSERT INTO public."admin_audit_log" ("actor_id", "action", "entity_type", "entity_id", "detail") VALUES ($1::uuid, 'mpe_upload_orphan_cleanup_failed', 'storage_object', $2, '{"bucket":"mpe-temporary"}'::jsonb)"#;

/// `parseRights`: a text field whose JSON is an object with
/// `accepted: true` (other keys allowed).
fn rights_accepted(value: Option<&Value>) -> bool {
    let Some(Value::Text(text)) = value else {
        return false;
    };
    Json::parse(text)
        .as_ref()
        .and_then(Json::as_object)
        .and_then(|entries| request::property(entries, "accepted"))
        .is_some_and(|accepted| *accepted == Json::Bool(true))
}

/// The checks on the form, in the TypeScript's order: the file and its
/// validated media, or the status and code of the refusal.
fn checked_file(form: Option<&Form>) -> Result<(Bytes, Media), (StatusCode, &'static str)> {
    let Some(Value::File {
        content_type,
        bytes,
    }) = form.and_then(|form| form.get("file"))
    else {
        return Err((StatusCode::BAD_REQUEST, "file_required"));
    };
    if !rights_accepted(form.and_then(|form| form.get("rightsDeclaration"))) {
        return Err((StatusCode::BAD_REQUEST, "rights_required"));
    }
    if bytes.len() > UPLOAD_LIMIT {
        return Err((StatusCode::PAYLOAD_TOO_LARGE, "file_too_large"));
    }
    if form.is_some_and(|form| form.has("sourceId")) {
        return Err((StatusCode::BAD_REQUEST, "source_not_allowed"));
    }
    match media_type::validate(bytes, content_type) {
        Ok(media) => Ok((bytes.clone(), media)),
        Err(code) if code == "file_too_large" => Err((StatusCode::PAYLOAD_TOO_LARGE, code)),
        Err(code) => Err((StatusCode::BAD_REQUEST, code)),
    }
}

pub async fn upload(
    State(state): State<AppState>,
    site: SiteOrigin,
    limiter: Arc<RateLimiter>,
    request: Request,
) -> Response {
    let rules = Admission {
        signed_out: "signed_out",
        limit_key: "mpe-upload",
        limit: RATE_LIMIT,
        action: "mpe_upload_storage",
    };
    let (user, parts, body) = match admit(&state, &site, &limiter, request, rules).await {
        Admitted::Yes(user, parts, body) => (user, parts, body),
        Admitted::No(response) => return response,
    };
    let form = match multipart::read_bounded_form(&parts.headers, body, MAX_BODY_BYTES).await {
        Ok(form) => form,
        Err(TooLarge) => return failure(StatusCode::PAYLOAD_TOO_LARGE, "file_too_large"),
    };
    let (bytes, media) = match checked_file(form.as_ref()) {
        Ok(file) => file,
        Err((status, code)) => return failure(status, code),
    };
    drop(form);
    let storage_key = format!("{}/{}", user.id, random_uuid());
    let expires_at = iso_timestamp(OffsetDateTime::now_utc() + KEEP_FOR);
    if let Err(error) = state
        .storage
        .put(BUCKET, &storage_key, bytes, Some(media.mime_type))
        .await
    {
        tracing::warn!(%error, "MPE upload could not be stored");
        return failure(StatusCode::BAD_GATEWAY, "upload_failed");
    }
    let created = create_ingestion(&state.db, &user, &media, &storage_key, expires_at).await;
    match created {
        Ok(Some((ingestion_id, job_ids))) => no_store(
            StatusCode::CREATED,
            format!(
                r#"{{"ok":true,"data":{{"ingestionId":{ingestion_id},"jobIds":{job_ids},"status":"queued"}}}}"#
            ),
        ),
        Ok(None) => cleaned_up(&state, &user, &storage_key, None).await,
        Err(error) => cleaned_up(&state, &user, &storage_key, Some(error)).await,
    }
}

/// The first row of `create_metered_media_ingestion`: its `ingestion_id`
/// and `job_ids` as JSON.
async fn create_ingestion(
    db: &Db,
    user: &SessionUser,
    media: &Media,
    storage_key: &str,
    expires_at: String,
) -> Result<Option<(String, String)>, sqlx::Error> {
    let kind = if media.mime_type.starts_with("image/") {
        "image"
    } else {
        "video"
    };
    let args: [Option<String>; 9] = [
        None,
        Some("USER_UPLOADED".to_owned()),
        Some(media.mime_type.to_owned()),
        Some(kind.to_owned()),
        Some(media.size.to_string()),
        Some(media.sha256.clone()),
        Some(storage_key.to_owned()),
        Some(expires_at),
        Some("true".to_owned()),
    ];
    let rows: Vec<String> = db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut query = sqlx::query_scalar(INGESTION_SQL).persistent(false);
                for arg in args {
                    query = query.bind(arg);
                }
                let no_number: Option<i32> = None;
                query
                    .bind(no_number)
                    .bind(no_number)
                    .bind(no_number)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    let first = rows
        .first()
        .and_then(|row| serde_json::from_str::<JsonValue>(row).ok());
    Ok(first.map(|row| (row["ingestion_id"].to_string(), row["job_ids"].to_string())))
}

/// After a failed ingestion: removes the stored object, or records that it
/// could not be removed, and answers.
async fn cleaned_up(
    state: &AppState,
    user: &SessionUser,
    storage_key: &str,
    error: Option<sqlx::Error>,
) -> Response {
    if state.storage.delete(BUCKET, storage_key).await.is_err() {
        record_cleanup_failure(&state.db, user, storage_key).await;
        return failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "ingestion_failed_cleanup_failed",
        );
    }
    if error.is_some_and(|error| names(&error, "api_rate_limited")) {
        return failure(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
    }
    failure(StatusCode::INTERNAL_SERVER_ERROR, "ingestion_failed")
}

/// `recordTemporaryCleanupFailure(...).catch(() => undefined)`.
async fn record_cleanup_failure(db: &Db, user: &SessionUser, storage_key: &str) {
    let (actor, key) = (user.id.clone(), storage_key.to_owned());
    let recorded: Result<_, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query(CLEANUP_FAILURE_SQL)
                        .persistent(false)
                        .bind(actor)
                        .bind(key)
                        .execute(tx)
                        .await
                })
            },
        )
        .await;
    if let Err(error) = recorded {
        tracing::warn!(%error, storage_key, "an orphaned MPE upload could not be recorded");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(value: &str) -> Value {
        Value::Text(value.to_owned())
    }

    #[test]
    fn the_rights_are_an_object_with_accepted_true() {
        assert!(rights_accepted(Some(&text(r#"{"accepted":true}"#))));
        assert!(rights_accepted(Some(&text(r#" {"accepted":true,"x":1} "#))));
        assert!(rights_accepted(Some(&text(
            r#"{"accepted":false,"accepted":true}"#
        ))));
        for refused in [
            r#"{"accepted":"true"}"#,
            r#"{"accepted":1}"#,
            r#"[{"accepted":true}]"#,
            r#"{"Accepted":true}"#,
            "true",
            "",
            "{",
        ] {
            assert!(!rights_accepted(Some(&text(refused))), "{refused}");
        }
        let file = Value::File {
            content_type: "application/json".to_owned(),
            bytes: Bytes::from_static(br#"{"accepted":true}"#),
        };
        assert!(!rights_accepted(Some(&file)));
        assert!(!rights_accepted(None));
    }
}
