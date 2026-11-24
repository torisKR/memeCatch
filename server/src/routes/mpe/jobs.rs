//! `GET /api/mpe/jobs/{id}`: `app/api/mpe/jobs/[id]/route.ts`.
//!
//! The job is read as the signed-in user, so row-level security decides
//! whether it is theirs (or they are an operator). For a finished render the
//! ingestion is read with `service_role` and a download URL is signed for 60
//! seconds; `/api/media/signed` serves it.

use axum::extract::rejection::PathRejection;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::Value;

use super::{failure, no_store};
use crate::auth::{AuthRejection, SignedInUser};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::js_json;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::js_date;
use crate::AppState;

const SIGNED_URL_SECONDS: u64 = 60;
/// `MPE_STORAGE_BUCKET` in lib/mpe/storage.server.ts.
const MPE_STORAGE_BUCKET: &str = "mpe-temporary";

// What lib/db/execute.ts compiles for the two reads.
const JOB_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."ingestion_id", r1."job_type", r1."status", r1."attempts", r1."output_json", r1."error_code", r1."started_at", r1."completed_at", r1."created_at" FROM public."processing_jobs" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const INGESTION_SQL: &str = r#"WITH __q AS (SELECT r1."expires_at", r1."deleted_at" FROM public."media_ingestions" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;

/// The one row `sql` finds for `id`, as `identity`. `None` for no row, a
/// failed read (an id that is not a UUID fails the cast), or more than one.
async fn read_row(db: &Db, identity: &DbIdentity, sql: &'static str, id: String) -> Option<Value> {
    let rows: Result<Vec<String>, sqlx::Error> = db
        .with_identity(identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(sql)
                    .persistent(false)
                    .bind(id)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    match rows.as_deref() {
        Ok([row]) => serde_json::from_str(row).ok(),
        _ => None,
    }
}

/// `/^[0-9a-f-]{36}/[0-9a-f-]{36}/renders/[0-9a-f]{64}\.mp4$/`.
fn is_artifact_key(key: &str) -> bool {
    let id = |part: &str| {
        part.len() == 36
            && part
                .bytes()
                .all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f' | b'-'))
    };
    let mut parts = key.split('/');
    let (Some(user), Some(ingestion), Some("renders"), Some(file), None) = (
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
        parts.next(),
    ) else {
        return false;
    };
    let hash = file.strip_suffix(".mp4").unwrap_or_default();
    id(user)
        && id(ingestion)
        && hash.len() == 64
        && hash.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// `safeOutput`: the stored output without its storage key; `{}` for
/// anything that is not an object.
fn safe_output(output: &Value) -> String {
    match output {
        Value::Object(map) => {
            let mut map = map.clone();
            map.remove("artifactKey");
            js_json::stringify(&Value::Object(map))
        }
        _ => "{}".to_owned(),
    }
}

/// Why a finished render has no download URL.
enum NoDownload {
    /// 410: the ingestion is gone, deleted or past its expiry.
    Expired,
    /// 502: the job names no artifact, or the URL could not be signed.
    NotReady,
}

/// The download URL of a finished render job.
async fn download_url(state: &AppState, job: &Value) -> Result<String, NoDownload> {
    let ingestion_id = job["ingestion_id"].as_str().unwrap_or_default().to_owned();
    let ingestion = read_row(
        &state.db,
        &DbIdentity::service_role(),
        INGESTION_SQL,
        ingestion_id,
    )
    .await
    .ok_or(NoDownload::Expired)?;
    // `ingestion.deleted_at ||` and `new Date(expires_at).getTime() <= Date.now()`.
    let deleted = ingestion["deleted_at"]
        .as_str()
        .is_some_and(|at| !at.is_empty());
    let expired = ingestion["expires_at"]
        .as_str()
        .and_then(js_date::parse_ms)
        .is_some_and(|expires| expires <= now_ms());
    if deleted || expired {
        return Err(NoDownload::Expired);
    }
    let artifact_key = job["output_json"]["artifactKey"]
        .as_str()
        .filter(|key| is_artifact_key(key))
        .ok_or(NoDownload::NotReady)?;
    state
        .storage
        .signed_object_url(MPE_STORAGE_BUCKET, artifact_key, SIGNED_URL_SECONDS)
        .map_err(|_| NoDownload::NotReady)
}

/// The body of a found job: the keys and their order are the TypeScript's.
fn job_body(job: &Value, download_url: Option<&str>) -> String {
    let field = |name: &str| js_json::stringify(&job[name]);
    let (url, expires_in) = match download_url {
        Some(url) => (
            serde_json::to_string(url).expect("a string serializes"),
            SIGNED_URL_SECONDS.to_string(),
        ),
        None => ("null".to_owned(), "null".to_owned()),
    };
    format!(
        r#"{{"ok":true,"data":{{"id":{},"ingestionId":{},"jobType":{},"status":{},"attempts":{},"output":{},"downloadUrl":{url},"downloadExpiresIn":{expires_in},"errorCode":{},"startedAt":{},"completedAt":{},"createdAt":{}}}}}"#,
        field("id"),
        field("ingestion_id"),
        field("job_type"),
        field("status"),
        field("attempts"),
        safe_output(&job["output_json"]),
        field("error_code"),
        field("started_at"),
        field("completed_at"),
        field("created_at"),
    )
}

pub async fn job(
    State(state): State<AppState>,
    user: Result<SignedInUser, AuthRejection>,
    id: Result<Path<String>, PathRejection>,
) -> Response {
    // `createClient()` treats a failed session lookup as signed out.
    let Ok(SignedInUser(user)) = user else {
        return failure(StatusCode::UNAUTHORIZED, "signed_out");
    };
    // A segment that does not decode names no job.
    let Ok(Path(id)) = id else {
        return failure(StatusCode::NOT_FOUND, "job_not_found");
    };
    let Some(job) = read_row(&state.db, &user.db_identity(), JOB_SQL, id).await else {
        return failure(StatusCode::NOT_FOUND, "job_not_found");
    };
    let finished_render = job["job_type"] == "render" && job["status"] == "completed";
    let url = if finished_render {
        match download_url(&state, &job).await {
            Ok(url) => Some(url),
            Err(NoDownload::Expired) => return failure(StatusCode::GONE, "artifact_expired"),
            Err(NoDownload::NotReady) => {
                return failure(StatusCode::BAD_GATEWAY, "artifact_not_ready");
            }
        }
    } else {
        None
    };
    no_store(StatusCode::OK, job_body(&job, url.as_deref()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn an_artifact_key_is_two_ids_renders_and_a_sha256_mp4() {
        let id = "a1000000-0000-4000-8000-000000000001";
        let hash = "0123456789abcdef".repeat(4);

        assert!(is_artifact_key(&format!("{id}/{id}/renders/{hash}.mp4")));
        // The pattern takes any 36 characters of hex digits and hyphens.
        assert!(is_artifact_key(&format!(
            "{}/{id}/renders/{hash}.mp4",
            "-".repeat(36)
        )));
        for refused in [
            format!("{id}/{id}/renders/{hash}.webm"),
            format!("{id}/{id}/renders/{}.mp4", &hash[1..]),
            format!("{id}/{id}/renders/{}.mp4", hash.to_uppercase()),
            format!("{id}/{id}/other/{hash}.mp4"),
            format!("{id}/renders/{hash}.mp4"),
            format!("{id}/{id}/renders/{hash}.mp4/x"),
            format!("../{id}/{id}/renders/{hash}.mp4"),
            format!("{}/{id}/renders/{hash}.mp4", id.to_uppercase()),
        ] {
            assert!(!is_artifact_key(&refused), "{refused}");
        }
    }

    #[test]
    fn the_output_loses_its_storage_key_and_is_an_object_whatever_was_stored() {
        assert_eq!(
            safe_output(
                &json!({ "durationMs": 1500.0, "artifactKey": "k", "nested": { "artifactKey": "kept" } })
            ),
            r#"{"nested":{"artifactKey":"kept"},"durationMs":1500}"#
        );
        for not_an_object in [json!([1]), json!("x"), json!(null), json!(3)] {
            assert_eq!(safe_output(&not_an_object), "{}");
        }
    }

    #[test]
    fn the_body_has_the_keys_of_the_typescript_in_its_order() {
        let job = json!({
            "id": "j", "ingestion_id": "i", "job_type": "render", "status": "queued",
            "attempts": 0, "output_json": {}, "error_code": null,
            "started_at": null, "completed_at": null,
            "created_at": "2026-11-23T12:00:00.123456+00:00",
        });

        assert_eq!(
            job_body(&job, None),
            r#"{"ok":true,"data":{"id":"j","ingestionId":"i","jobType":"render","status":"queued","attempts":0,"output":{},"downloadUrl":null,"downloadExpiresIn":null,"errorCode":null,"startedAt":null,"completedAt":null,"createdAt":"2026-11-23T12:00:00.123456+00:00"}}"#
        );
        assert!(
            job_body(&job, Some("https://x/y?a=1&b=2")).contains(
                r#""downloadUrl":"https://x/y?a=1&b=2","downloadExpiresIn":60,"errorCode""#
            )
        );
    }
}
