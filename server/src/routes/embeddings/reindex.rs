//! `runMemeEmbeddingReindex` of lib/meme-embedding-reindex.server.ts: one
//! bounded pass over the public memes without a vector, through the
//! service-only functions of db/migrations/20261004002846 (as `service_role`,
//! the admin client): take the lease, read the backlog, list up to 25 jobs,
//! embed and store each, read the backlog again, finish the run.
//!
//! Each call has the TypeScript's deadline: at most 10 seconds and never past
//! the 90-second work budget (`finish` gets its own 10 seconds). A call that
//! runs out is abandoned, which rolls its transaction back.

use std::sync::Arc;
use std::time::{Duration, Instant};

use futures_util::future::BoxFuture;
use sqlx::PgConnection;

use super::runtime::Runtime;
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::js_json;
use crate::routes::tracking::growth::random_uuid;

const MAX_DOCUMENTS: i32 = 25;
const WORK_BUDGET: Duration = Duration::from_millis(90_000);
const LEASE_TTL_SECONDS: i32 = 180;
const RPC_TIMEOUT: Duration = Duration::from_millis(10_000);
const MAX_PENDING: i64 = 10_000_000;
const MAX_DOCUMENT_CHARS: usize = 6_900;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Succeeded,
    Partial,
    Failed,
    Deferred,
}

impl Status {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Succeeded => "succeeded",
            Self::Partial => "partial",
            Self::Failed => "failed",
            Self::Deferred => "deferred",
        }
    }
}

/// `MemeEmbeddingReindexResult`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RunResult {
    pub status: Status,
    pub indexed: i32,
    pub stale: i32,
    pub remaining: i64,
    pub error_code: Option<&'static str>,
}

impl RunResult {
    fn failed(error_code: &'static str) -> Self {
        Self {
            status: Status::Failed,
            indexed: 0,
            stale: 0,
            remaining: 0,
            error_code: Some(error_code),
        }
    }
}

struct Job {
    meme_id: String,
    source_hash: String,
    document: String,
}

struct Run<'a> {
    state: &'a AppState,
    runtime: &'a Arc<Runtime>,
    started: Instant,
}

pub async fn run(state: &AppState, runtime: &Arc<Runtime>) -> RunResult {
    let run = Run {
        state,
        runtime,
        started: Instant::now(),
    };
    let owner = random_uuid();
    match run.acquire(&owner).await {
        Err(()) => RunResult::failed("rpc_unavailable"),
        Ok(false) => RunResult {
            status: Status::Deferred,
            indexed: 0,
            stale: 0,
            remaining: run.backlog().await.unwrap_or(0),
            error_code: None,
        },
        Ok(true) => {
            let result = run.work().await;
            if run.finish(&owner, &result).await {
                result
            } else {
                RunResult {
                    status: Status::Failed,
                    error_code: Some("rpc_unavailable"),
                    ..result
                }
            }
        }
    }
}

impl Run<'_> {
    fn remaining_work(&self) -> Duration {
        WORK_BUDGET.saturating_sub(self.started.elapsed())
    }

    /// The loop of the TypeScript between the lease and `finishRun`.
    async fn work(&self) -> RunResult {
        let (mut indexed, mut stale) = (0, 0);
        let (mut status, mut error_code) = (Status::Succeeded, None);
        let initial = self.backlog().await;
        if initial.is_none() {
            (status, error_code) = (Status::Failed, Some("rpc_unavailable"));
        }
        let initial_pending = initial.unwrap_or(0);
        if error_code.is_none() && initial_pending > 0 {
            match self.jobs().await {
                None => (status, error_code) = (Status::Failed, Some("rpc_unavailable")),
                Some(jobs) => {
                    let outcome = self.embed_all(&jobs, &mut indexed, &mut stale).await;
                    if let Some((outcome_status, code)) = outcome {
                        (status, error_code) = (outcome_status, Some(code));
                    }
                }
            }
        }
        let observed = if self.remaining_work().is_zero() {
            None
        } else {
            self.backlog().await
        };
        let remaining = observed.unwrap_or((initial_pending - i64::from(indexed)).max(0));
        if status == Status::Succeeded && remaining > 0 {
            status = Status::Partial;
        }
        if status == Status::Succeeded && self.remaining_work().is_zero() {
            (status, error_code) = (Status::Partial, Some("deadline_exceeded"));
        }
        RunResult {
            status,
            indexed,
            stale,
            remaining,
            error_code,
        }
    }

    /// Embeds and stores each job; the status and code that stopped it early.
    async fn embed_all(
        &self,
        jobs: &[Job],
        indexed: &mut i32,
        stale: &mut i32,
    ) -> Option<(Status, &'static str)> {
        for job in jobs {
            if self.started.elapsed() >= WORK_BUDGET {
                return Some((Status::Partial, "deadline_exceeded"));
            }
            let Some(embedding) = self.runtime.embed_passage(&job.document).await else {
                return Some((Status::Failed, "model_unavailable"));
            };
            if self.remaining_work().is_zero() {
                return Some((Status::Partial, "deadline_exceeded"));
            }
            match self.store(job, embedding.vector).await {
                Some(true) => *indexed += 1,
                Some(false) => *stale += 1,
                None => return Some((Status::Failed, "store_failed")),
            }
        }
        None
    }

    async fn acquire(&self, owner: &str) -> Result<bool, ()> {
        let owner = owner.to_owned();
        let found: Option<bool> = self
            .work_rpc(move |tx| {
                Box::pin(async move {
                    sqlx::query_scalar("select public.acquire_meme_embedding_run($1::uuid, $2)")
                        .bind(owner)
                        .bind(LEASE_TTL_SECONDS)
                        .fetch_one(tx)
                        .await
                })
            })
            .await?;
        Ok(found == Some(true))
    }

    /// `loadBacklog`: `pending` of the first row, when it is 0 to 10,000,000.
    async fn backlog(&self) -> Option<i64> {
        let pending: Option<Option<i64>> = self
            .work_rpc(|tx| {
                Box::pin(async move {
                    sqlx::query_scalar("select pending from public.meme_embedding_backlog()")
                        .fetch_optional(tx)
                        .await
                })
            })
            .await
            .ok()?;
        pending
            .flatten()
            .filter(|pending| (0..=MAX_PENDING).contains(pending))
    }

    /// `embeddingJobs`: the whole list, or `None` when any row is malformed.
    async fn jobs(&self) -> Option<Vec<Job>> {
        type Row = (Option<String>, Option<String>, Option<String>);
        let rows: Vec<Row> = self
            .work_rpc(|tx| {
                Box::pin(async move {
                    sqlx::query_as(
                        "select meme_id::text, document, source_hash \
                           from public.list_meme_embedding_jobs(p_limit => $1)",
                    )
                    .bind(MAX_DOCUMENTS)
                    .fetch_all(tx)
                    .await
                })
            })
            .await
            .ok()?;
        if rows.len() > MAX_DOCUMENTS as usize {
            return None;
        }
        rows.into_iter().map(job).collect()
    }

    /// `store_meme_embedding`: `Some(stored)`, `None` for an error.
    ///
    /// Sent as lib/db sends it, which always fails (PLAN.md, R12-3):
    /// `loadFunctions` reads the argument types as an unparsed `name[]`
    /// string, so `castFor` sees one character of it and casts the vector
    /// to `text[]`; no `store_meme_embedding` takes that, and every store
    /// is an error, `store_failed`.
    async fn store(&self, job: &Job, vector: Vec<f64>) -> Option<bool> {
        let (meme_id, source_hash) = (job.meme_id.clone(), job.source_hash.clone());
        // `bindValue` hands node-pg the numbers, which it writes as `String(n)`.
        let vector: Vec<String> = vector.into_iter().map(js_json::number).collect();
        self.work_rpc(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar(
                    r#"SELECT public."store_meme_embedding"("p_meme_id" => $1::uuid, "p_source_hash" => $2, "p_embedding" => $3::text[]) AS result"#,
                )
                .bind(meme_id)
                .bind(source_hash)
                .bind(vector)
                .fetch_one(tx)
                .await
            })
        })
        .await
        .ok()
        .flatten()
    }

    /// `finishRun`: true only when the function answers `true`.
    async fn finish(&self, owner: &str, result: &RunResult) -> bool {
        let owner = owner.to_owned();
        let result = result.clone();
        let identity = DbIdentity::service_role();
        let call = self
            .state
            .db
            .with_identity(&identity, IdentityOptions::default(), move |tx| {
                Box::pin(async move {
                    sqlx::query_scalar::<_, Option<bool>>(
                        "select public.finish_meme_embedding_run($1::uuid, $2, $3, $4, $5, $6)",
                    )
                    .bind(owner)
                    .bind(result.status.as_str())
                    .bind(result.indexed)
                    .bind(result.stale)
                    .bind(i32::try_from(result.remaining).unwrap_or(i32::MAX))
                    .bind(result.error_code)
                    .fetch_one(tx)
                    .await
                })
            });
        matches!(
            tokio::time::timeout(RPC_TIMEOUT, call).await,
            Ok(Ok(Some(true)))
        )
    }

    /// `workRpc`: as `service_role`, within `min(10 s, what is left of the
    /// budget)`; an empty budget fails without calling.
    async fn work_rpc<T, F>(&self, query: F) -> Result<T, ()>
    where
        T: Send + 'static,
        F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, sqlx::Error>> + Send,
    {
        let timeout = RPC_TIMEOUT.min(self.remaining_work());
        if timeout.is_zero() {
            return Err(());
        }
        let identity = DbIdentity::service_role();
        let call = self
            .state
            .db
            .with_identity(&identity, IdentityOptions::default(), query);
        match tokio::time::timeout(timeout, call).await {
            Ok(Ok(value)) => Ok(value),
            _ => Err(()),
        }
    }
}

/// One row of `embeddingJobs`: a UUID, a 32-digit lowercase hex hash, and a
/// non-blank document of at most 6,900 characters.
fn job(
    (meme_id, document, source_hash): (Option<String>, Option<String>, Option<String>),
) -> Option<Job> {
    let (meme_id, document, source_hash) = (meme_id?, document?, source_hash?);
    let hash_ok = source_hash.len() == 32
        && source_hash
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
    let document_ok = !document
        .trim_matches(crate::embedder::tokenizer::is_js_space)
        .is_empty()
        && document.chars().count() <= MAX_DOCUMENT_CHARS;
    (is_uuid(&meme_id) && hash_ok && document_ok).then_some(Job {
        meme_id,
        source_hash,
        document,
    })
}

/// `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`.
fn is_uuid(text: &str) -> bool {
    let bytes = text.as_bytes();
    bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(
        id: &str,
        document: &str,
        hash: &str,
    ) -> (Option<String>, Option<String>, Option<String>) {
        (Some(id.into()), Some(document.into()), Some(hash.into()))
    }

    #[test]
    fn a_job_row_is_checked_as_embedding_jobs_checks_it() {
        let id = "0b2a5f0e-8c1d-4c55-9d7e-1a2b3c4d5e6f";
        let hash = "0123456789abcdef0123456789abcdef";
        assert!(job(row(id, "문서", hash)).is_some());
        assert!(job(row(&id.to_uppercase(), "문서", hash)).is_some());
        assert!(job(row("not-a-uuid", "문서", hash)).is_none());
        assert!(job(row(id, "  \n", hash)).is_none());
        assert!(job(row(id, &"가".repeat(6_901), hash)).is_none());
        assert!(job(row(id, &"가".repeat(6_900), hash)).is_some());
        assert!(job(row(id, "문서", &hash.to_uppercase())).is_none());
        assert!(job((Some(id.into()), None, Some(hash.into()))).is_none());
    }
}
