//! `createCandidateFromIngestion` and `discardCreatedCandidate` of
//! lib/mpe/candidates.server.ts: a candidate for an ingestion whose
//! processing has finished (an existing one is returned as is), and its
//! removal when the rest of the `create` action fails.

use serde::Deserialize;

use super::candidate_post::{Refusal, require_operator};
use super::matching::{self, Job};
use super::rows::{self, Bind};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::DbIdentity;

// What lib/db/execute.ts compiles (Postgres statement log of the real Next).
const INGESTION_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."media_kind" FROM public."media_ingestions" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const JOBS_SQL: &str = r#"WITH __q AS (SELECT r1."job_type", r1."status", r1."processor_version", r1."error_code", r1."output_json" FROM public."processing_jobs" r1 WHERE r1."ingestion_id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const EXISTING_SQL: &str = r#"WITH __q AS (SELECT r1.* FROM public."meme_candidates" r1 WHERE r1."ingestion_id" = $1::uuid ORDER BY r1."created_at" ASC LIMIT $2::int) SELECT row_to_json(__q)::text FROM __q"#;
const INSERT_SQL: &str = r#"WITH __q AS (INSERT INTO public."meme_candidates" ("ingestion_id", "title", "meme_type", "review_status", "draft_json", "created_by", "model_version", "prompt_version") VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6::uuid, $7, $8) RETURNING *) SELECT row_to_json(__q)::text FROM __q"#;
const DELETE_SQL: &str = r#"DELETE FROM public."meme_candidates" r1 WHERE r1."id" = $1::uuid"#;

#[derive(Deserialize)]
struct Ingestion {
    id: String,
    media_kind: String,
}

#[derive(Deserialize)]
struct Id {
    id: String,
}

/// `{ candidate, created }`, with the candidate as the row read.
pub struct Created {
    pub id: String,
    pub row: String,
    pub created: bool,
}

fn db(fallback: &'static str) -> impl Fn(String) -> Refusal {
    move |message| Refusal::coded(500, format!("{fallback}: {message}"))
}

fn id_of(row: &str) -> Result<String, Refusal> {
    serde_json::from_str::<Id>(row)
        .map(|row| row.id)
        .map_err(|_| Refusal::Plain)
}

/// The ingestion, if the operator can read it and its processing is done.
async fn processed(
    state: &AppState,
    identity: &DbIdentity,
    ingestion_id: &str,
) -> Result<Ingestion, Refusal> {
    let bound = vec![Bind::Text(ingestion_id.to_owned())];
    let ingestion = rows::single(state, identity, INGESTION_SQL, bound)
        .await
        .ok()
        .and_then(|row| serde_json::from_str::<Ingestion>(&row).ok())
        .ok_or_else(|| Refusal::coded(404, "ingestion_not_found".to_owned()))?;
    let jobs = rows::rows(
        state,
        identity,
        JOBS_SQL,
        vec![Bind::Text(ingestion.id.clone())],
    )
    .await
    .map_err(db("processing_jobs_load_failed"))?;
    let jobs: Vec<Job> = jobs
        .iter()
        .map(|row| serde_json::from_str(row))
        .collect::<Result<_, _>>()
        .map_err(|_| Refusal::Plain)?;
    matching::validate_candidate_jobs(&ingestion.media_kind, &jobs)
        .map_err(|(status, code)| Refusal::coded(status, code.to_owned()))?;
    Ok(ingestion)
}

/// `createCandidateFromIngestion({ ingestionId, title, memeType }, client)`.
pub async fn create(
    state: &AppState,
    user: &SessionUser,
    ingestion_id: &str,
    title: &str,
    meme_type: &str,
) -> Result<Created, Refusal> {
    require_operator(state, user).await?;
    let identity = user.db_identity();
    let ingestion = processed(state, &identity, ingestion_id).await?;
    let lookup = vec![Bind::Text(ingestion.id.clone()), Bind::Int(1)];
    let existing = rows::rows(state, &identity, EXISTING_SQL, lookup)
        .await
        .map_err(db("candidate_lookup_failed"))?;
    if let Some(row) = existing.into_iter().next() {
        return Ok(Created {
            id: id_of(&row)?,
            row,
            created: false,
        });
    }
    let values = vec![
        Bind::Text(ingestion.id),
        Bind::Text(title.to_owned()),
        Bind::Text(meme_type.to_owned()),
        Bind::Text("FACT_CHECKING".to_owned()),
        Bind::Text("{}".to_owned()),
        Bind::Text(user.id.clone()),
        Bind::Text("mpe-candidate-v1".to_owned()),
        Bind::Text("mpe-evidence-v1".to_owned()),
    ];
    let row = rows::single(state, &DbIdentity::service_role(), INSERT_SQL, values)
        .await
        .map_err(db("candidate_create_failed"))?;
    Ok(Created {
        id: id_of(&row)?,
        row,
        created: true,
    })
}

/// `discardCreatedCandidate(candidateId, client)`.
pub async fn discard(
    state: &AppState,
    user: &SessionUser,
    candidate_id: &str,
) -> Result<(), Refusal> {
    require_operator(state, user).await?;
    rows::execute(
        state,
        &DbIdentity::service_role(),
        DELETE_SQL,
        vec![Bind::Text(candidate_id.to_owned())],
    )
    .await
    .map_err(db("candidate_cleanup_failed"))
}
