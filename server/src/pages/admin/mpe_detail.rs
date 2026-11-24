//! `GET /admin/mpe/{id}` (`app/(default)/admin/mpe/[id]/page.tsx`): one
//! candidate with its jobs, ASR/OCR timeline, frames, matches, claims and
//! revisions, rendered by `mpe_console.rs`; `ui/admin-mpe.js` runs the
//! console's actions (`routes/admin/mpe.rs`).

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::html;
use serde_json::Value;
use sqlx::Row;
use sqlx::postgres::PgRow;

use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::js_json;
use crate::routes::request::Json;

const TITLE: &str = "MPE 후보 검수";
const BUCKET: &str = "mpe-temporary";
const SIGNED_SECONDS: u64 = 60;
const UNSIGNED: &str = "프레임 서명 URL을 만들지 못했어요.";

async fn rows(
    state: &AppState,
    user: &SessionUser,
    sql: &'static str,
    id: &str,
) -> Result<Vec<PgRow>, sqlx::Error> {
    let id = id.to_owned();
    state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(sql).bind(id).fetch_all(tx).await })
        })
        .await
}

/// `objectJson`: the stored object as parsed, `{}` for anything else.
fn object(text: Option<String>) -> Json {
    match text.and_then(|text| Json::parse(&text)) {
        Some(json @ Json::Object(_)) => json,
        _ => Json::Object(Vec::new()),
    }
}

pub struct Candidate {
    pub id: String,
    pub title: String,
    pub meme_type: String,
    pub status: String,
    pub confidence: Option<f64>,
    pub draft: Json,
    pub model: String,
    pub prompt: String,
    pub ingestion: String,
    pub user_id: String,
    pub mode: String,
    pub mime: String,
    pub dimensions: Option<String>,
    pub attested: bool,
    pub source_role: Option<String>,
    pub rights_basis: Option<String>,
    pub source_url: Option<String>,
    pub source_title: Option<String>,
    pub author: Option<String>,
    pub availability: Option<String>,
}

const CANDIDATE: &str = "select c.id::text, c.title, c.meme_type, c.review_status, c.overall_confidence::float8, c.draft_json::text, c.model_version, c.prompt_version,
    i.id::text, i.user_id::text, i.ingest_mode, i.mime_type, i.width, i.height, i.rights_attested_at is not null, i.source_role, i.rights_basis,
    s.canonical_url, s.title, s.channel_name, s.public_status
    from public.meme_candidates c join public.media_ingestions i on i.id = c.ingestion_id left join public.media_sources s on s.id = i.source_id
    where c.id = $1::uuid";

fn candidate_from(row: &PgRow) -> Result<Candidate, sqlx::Error> {
    let (width, height): (Option<i32>, Option<i32>) = (row.try_get(12)?, row.try_get(13)?);
    Ok(Candidate {
        id: row.try_get(0)?,
        title: row.try_get(1)?,
        meme_type: row.try_get(2)?,
        status: row.try_get(3)?,
        confidence: row.try_get(4)?,
        draft: object(row.try_get(5)?),
        model: row.try_get(6)?,
        prompt: row.try_get(7)?,
        ingestion: row.try_get(8)?,
        user_id: row.try_get(9)?,
        mode: row.try_get(10)?,
        mime: row.try_get(11)?,
        // `width && height`: a zero is no dimension.
        dimensions: match (width, height) {
            (Some(w), Some(h)) if w != 0 && h != 0 => Some(format!("{w}×{h}")),
            _ => None,
        },
        attested: row.try_get(14)?,
        source_role: row.try_get(15)?,
        rights_basis: row.try_get(16)?,
        source_url: row.try_get(17)?,
        source_title: row.try_get(18)?,
        author: row.try_get(19)?,
        availability: row.try_get(20)?,
    })
}

pub struct Job {
    pub id: String,
    pub kind: String,
    pub status: String,
    pub attempts: i32,
    pub processor: Option<String>,
    pub error: Option<String>,
    output: Option<String>,
}

pub struct Segment {
    pub origin: String,
    pub start: Option<f64>,
    pub text: String,
    pub confidence: Option<f64>,
}

pub struct Artifact {
    pub kind: String,
    pub frame_ms: Option<f64>,
    pub reference: String,
    pub representative: bool,
    pub signed: Option<String>,
    pub mime: Option<String>,
}

pub struct Match {
    pub title: String,
    pub relation: String,
    pub score: f64,
}

pub struct Claim {
    pub id: String,
    pub field: String,
    pub text: String,
    pub confidence: f64,
    pub status: String,
    pub evidence: Vec<String>,
}

pub struct Revision {
    pub number: i32,
    pub draft: Json,
    pub model: String,
    pub prompt: String,
}

pub struct Data {
    pub jobs: Vec<Job>,
    pub timeline: Vec<Segment>,
    pub artifacts: Vec<Artifact>,
    pub matches: Vec<Match>,
    pub claims: Vec<Claim>,
    pub revisions: Vec<Revision>,
}

/// `/^\d{3}\.jpg$/` after the ingestion's frame prefix.
fn is_frame_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    bytes.len() == 7 && bytes[..3].iter().all(u8::is_ascii_digit) && &bytes[3..] == b".jpg"
}

/// The completed jobs' frames (`artifactsFromJobs`), signed for a minute
/// when the key is one of this ingestion's frames (`signFrameArtifacts`).
fn job_artifacts(state: &AppState, jobs: &[Job], user_id: &str, ingestion: &str) -> Vec<Artifact> {
    let prefix = format!("{user_id}/{ingestion}/frames/");
    let mut artifacts = Vec::new();
    for job in jobs.iter().filter(|job| job.status == "completed") {
        let output: Value = job
            .output
            .as_deref()
            .and_then(|text| serde_json::from_str(text).ok())
            .unwrap_or(Value::Null);
        for value in output
            .get("artifacts")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if !value.is_object() {
                continue;
            }
            let kind = value
                .get("kind")
                .and_then(Value::as_str)
                .unwrap_or(&job.kind);
            let Some(key) = value.get("storageKey").and_then(Value::as_str) else {
                continue;
            };
            if !matches!(kind, "representative_frame" | "scene_frame") {
                continue;
            }
            let own_frame = key.strip_prefix(&prefix).is_some_and(is_frame_name);
            artifacts.push(Artifact {
                kind: kind.to_owned(),
                frame_ms: value.get("frameMs").and_then(Value::as_f64),
                reference: UNSIGNED.to_owned(),
                representative: kind == "representative_frame"
                    || value.get("representative") == Some(&Value::Bool(true)),
                signed: own_frame
                    .then(|| {
                        state
                            .storage
                            .signed_object_url(BUCKET, key, SIGNED_SECONDS)
                            .ok()
                    })
                    .flatten(),
                mime: value
                    .get("mimeType")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
            });
        }
    }
    artifacts
}

fn job_from(row: &PgRow) -> Result<Job, sqlx::Error> {
    let name: String = row.try_get(4)?;
    let version: String = row.try_get(5)?;
    let processor = [name, version]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(":");
    Ok(Job {
        id: row.try_get(0)?,
        kind: row.try_get(1)?,
        status: row.try_get(2)?,
        attempts: row.try_get(3)?,
        processor: (!processor.is_empty()).then_some(processor),
        output: row.try_get(6)?,
        error: row.try_get(7)?,
    })
}

fn claim_from(row: &PgRow) -> Result<Claim, sqlx::Error> {
    let origin: Option<String> = row.try_get(5)?;
    let segment = match origin {
        Some(origin) => {
            let start: Option<f64> = row.try_get(6)?;
            let raw: String = row.try_get(7)?;
            Some(format!(
                "{origin} {}ms: {raw}",
                js_json::number(start.unwrap_or(0.0))
            ))
        }
        None => None,
    };
    let url: Option<String> = row.try_get(8)?;
    Ok(Claim {
        id: row.try_get(0)?,
        field: row.try_get(1)?,
        text: row.try_get(2)?,
        confidence: row.try_get(3)?,
        status: row.try_get(4)?,
        evidence: [segment, url]
            .into_iter()
            .flatten()
            .filter(|value| !value.is_empty())
            .collect(),
    })
}

fn each<T>(
    rows: Vec<PgRow>,
    from: impl Fn(&PgRow) -> Result<T, sqlx::Error>,
) -> Result<Vec<T>, sqlx::Error> {
    rows.iter().map(from).collect()
}

async fn load(
    state: &AppState,
    user: &SessionUser,
    candidate: &Candidate,
) -> Result<Data, sqlx::Error> {
    let (ingestion, id) = (candidate.ingestion.as_str(), candidate.id.as_str());
    let jobs = each(
        rows(state, user, "select id::text, job_type, status, attempts, processor_name, processor_version, output_json::text, error_code
            from public.processing_jobs where ingestion_id = $1::uuid order by created_at", ingestion).await?,
        job_from,
    )?;
    let timeline = each(
        rows(state, user, "select origin, start_ms::float8, coalesce(nullif(normalized_text, ''), raw_text), confidence::float8
            from public.text_segments where ingestion_id = $1::uuid order by start_ms asc nulls first, id", ingestion).await?,
        |row| Ok(Segment { origin: row.try_get(0)?, start: row.try_get(1)?, text: row.try_get(2)?, confidence: row.try_get(3)? }),
    )?;
    let mut artifacts = job_artifacts(state, &jobs, &candidate.user_id, ingestion);
    let fingerprints = rows(
        state,
        user,
        "select fingerprint_type, hash_value, frame_ms::float8 from public.media_fingerprints
        where ingestion_id = $1::uuid and frame_ms is not null order by frame_ms asc",
        ingestion,
    )
    .await?;
    artifacts.extend(each(fingerprints, |row| {
        let hash: String = row.try_get(1)?;
        Ok(Artifact {
            kind: row.try_get(0)?,
            frame_ms: row.try_get(2)?,
            reference: format!("fingerprint:{}", hash.chars().take(16).collect::<String>()),
            representative: false,
            signed: None,
            mime: None,
        })
    })?);
    let matches = each(
        rows(state, user, "select coalesce(m.title, '삭제된 밈'), cm.classification, cm.overall_score::float8 from public.candidate_matches cm
            left join public.memes m on m.id = cm.meme_id where cm.candidate_id = $1::uuid and cm.classification <> 'SEPARATE' order by cm.rank limit 5", id).await?,
        |row| Ok(Match { title: row.try_get(0)?, relation: row.try_get(1)?, score: row.try_get(2)? }),
    )?;
    let claims = each(
        rows(state, user, "select ce.id::text, ce.claim_field, ce.claim_text, coalesce(ce.confidence, 0)::float8, ce.review_status,
            ts.origin, ts.start_ms::float8, ts.raw_text, s.canonical_url
            from public.claim_evidence ce left join public.media_sources s on s.id = ce.source_id left join public.text_segments ts on ts.id = ce.text_segment_id
            where ce.candidate_id = $1::uuid order by ce.created_at", id).await?,
        claim_from,
    )?;
    let revisions = each(
        rows(state, user, "select revision_number, draft_json::text, model_version, prompt_version from public.candidate_revisions
            where candidate_id = $1::uuid order by revision_number desc limit 5", id).await?,
        |row| Ok(Revision { number: row.try_get(0)?, draft: object(row.try_get(1)?), model: row.try_get(2)?, prompt: row.try_get(3)? }),
    )?;
    Ok(Data {
        jobs,
        timeline,
        artifacts,
        matches,
        claims,
        revisions,
    })
}

pub async fn page(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Response {
    let user = match super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    // `.single()` fails for an id that is not a uuid, as for a missing row.
    let found = rows(&state, &user, CANDIDATE, &id)
        .await
        .ok()
        .and_then(|rows| rows.first().map(candidate_from));
    let Some(Ok(candidate)) = found else {
        return super::super::html(
            StatusCode::NOT_FOUND,
            shell::not_found(&state.pages.site, TITLE),
        );
    };
    let main = match load(&state, &user, &candidate).await {
        Ok(data) => html! {
            div class="space-y-6" {
                a href="/admin/mpe" class="inline-flex min-h-11 items-center text-sm text-muted hover:text-foreground" { "← MPE 검수 큐로" }
                (super::mpe_console::console(&candidate, &data))
            }
        },
        Err(error) => {
            tracing::warn!(%error, "admin mpe detail failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, TITLE, &format!("/admin/mpe/{id}"), main)
}

#[cfg(test)]
mod tests {
    use super::is_frame_name;

    #[test]
    fn frame_names_are_three_ascii_digits_and_jpg() {
        assert!(is_frame_name("001.jpg"));
        assert!(!is_frame_name("01.jpg"));
        assert!(!is_frame_name("0001.jpg"));
        assert!(!is_frame_name("001.jpeg"));
        assert!(!is_frame_name("٠٠١.jpg"));
        assert!(!is_frame_name("001.jpg\n"));
    }
}
