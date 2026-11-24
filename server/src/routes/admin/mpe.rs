//! `lib/actions/admin-mpe.ts`: the MPE review console's actions
//! (`/admin/mpe/{id}`), each an RPC as the operator followed by an audit row
//! whose failure is ignored, as the TypeScript does.

use axum::extract::{Request, State};
use axum::response::Response;
use serde_json::{Value, json};

use super::catalog_input::{RIGHTS, ROLES};
use super::submissions::expire_public;
use super::{Call, as_operator, call, db_message, fail, log_audit, ok};
use crate::AppState;
use crate::auth::SessionUser;
use crate::pages::admin::growth::is_uuid;
use crate::routes::js_json;
use crate::routes::public::js;
use crate::routes::request::Json;

const DRAFT_LIMIT: usize = 100_000;
const REASON_MAX: usize = 2_000;

/// `errorMessage`: the RPCs' codes in Korean, any other message as it is.
fn message(error: &sqlx::Error) -> String {
    let raw = db_message(error);
    let known = match raw.as_str() {
        "review_stage_out_of_order" => "현재 단계와 요청 단계가 달라요. 새로고침해 주세요.",
        "approved_evidence_required" => "승인된 근거가 없는 주장은 다음 단계로 진행할 수 없어요.",
        "source_and_rights_required" => "출처와 권리 근거를 확인한 뒤 진행해 주세요.",
        "candidate_not_found" => "검수 후보를 찾을 수 없어요.",
        "claim_not_found" => "검수할 근거를 찾을 수 없어요.",
        "claim_review_stage_closed" => "사실 검수 단계에서만 주장 근거를 변경할 수 있어요.",
        "job_not_found" => "처리 작업을 찾을 수 없어요.",
        "job_not_terminal" => "완료·실패·건너뜀 작업만 재처리할 수 있어요.",
        "operator_required" => "운영자 권한이 없어요.",
        _ => return raw,
    };
    known.to_owned()
}

async fn rpc(
    state: &AppState,
    actor: &SessionUser,
    sql: &'static str,
    args: Vec<Option<String>>,
) -> Result<(), sqlx::Error> {
    as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sql);
                for arg in args {
                    query = query.bind(arg);
                }
                query.execute(tx).await.map(|_| ())
            })
        }),
    )
    .await
}

async fn audit(
    state: &AppState,
    actor: &SessionUser,
    action: &str,
    entity: &str,
    detail: Option<Value>,
) {
    // The TypeScript awaits the insert and does not look at its error.
    let _ = log_audit(
        state,
        &actor.id,
        action,
        "mpe_candidate",
        Some(entity),
        detail,
    )
    .await;
}

fn text<'a>(input: &'a Value, key: &str) -> Option<&'a str> {
    input.get(key).and_then(Value::as_str)
}

fn uuid_at(input: &Value, key: &str) -> Option<String> {
    text(input, key)
        .filter(|value| is_uuid(value))
        .map(str::to_owned)
}

fn one_of(input: &Value, key: &str, options: &[&str]) -> Option<String> {
    text(input, key)
        .filter(|value| options.contains(value))
        .map(str::to_owned)
}

/// `reviewMpeCandidate({ candidateId, stage, decision, reason })`.
pub async fn review(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let reason = match input.get("reason") {
        None => Some(None),
        Some(Value::String(reason)) => {
            let reason = js::trim(reason);
            (js::utf16_len(reason) <= REASON_MAX).then(|| Some(reason.to_owned()))
        }
        Some(_) => None,
    };
    let parsed = (
        input.is_object().then_some(()),
        uuid_at(&input, "candidateId"),
        one_of(
            &input,
            "stage",
            &["FACT_CHECKING", "RIGHTS_CHECKING", "PUBLISH"],
        ),
        one_of(
            &input,
            "decision",
            &[
                "APPROVED",
                "PUBLISHED",
                "LIMITED",
                "REJECTED",
                "CHANGES_REQUESTED",
            ],
        ),
        reason,
    );
    let (Some(()), Some(candidate), Some(stage), Some(decision), Some(reason)) = parsed else {
        return fail("검수 요청 형식이 올바르지 않아요.");
    };
    let publishing = matches!(decision.as_str(), "PUBLISHED" | "LIMITED");
    if stage == "PUBLISH" && decision == "APPROVED" {
        return fail("공개 단계에서는 공개 또는 제한 공개를 선택해 주세요.");
    }
    if stage != "PUBLISH" && publishing {
        return fail("앞 단계를 건너뛰어 공개할 수 없어요.");
    }
    // `reason || undefined`: a blank reason is not passed, so the default applies.
    let reason = reason.filter(|reason| !reason.is_empty());
    let result = match &reason {
        Some(_) => rpc(&state, &actor, "select 1 from public.review_mpe_candidate(p_candidate_id => $1::uuid, p_stage => $2, p_decision => $3, p_reason => $4)",
            vec![Some(candidate.clone()), Some(stage.clone()), Some(decision.clone()), reason.clone()]).await,
        None => rpc(&state, &actor, "select 1 from public.review_mpe_candidate(p_candidate_id => $1::uuid, p_stage => $2, p_decision => $3)",
            vec![Some(candidate.clone()), Some(stage.clone()), Some(decision.clone())]).await,
    };
    if let Err(error) = result {
        return fail(&message(&error));
    }
    audit(
        &state,
        &actor,
        "mpe.review",
        &candidate,
        Some(json!({ "stage": stage, "decision": decision })),
    )
    .await;
    if stage == "PUBLISH" && publishing {
        expire_public(&state).await;
    }
    ok()
}

/// `saveMpeCandidateRevision({ candidateId, draft })`: the draft, an object,
/// of at most 100,000 characters of JSON.
pub async fn save_revision(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Json>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let entries = input.as_object().unwrap_or_default();
    let candidate = crate::routes::request::property(entries, "candidateId")
        .and_then(Json::as_str)
        .filter(|id| is_uuid(id));
    let draft = crate::routes::request::property(entries, "draft")
        .filter(|draft| draft.as_object().is_some());
    let (Some(candidate), Some(draft)) = (candidate, draft) else {
        return fail("초안 형식이 올바르지 않아요.");
    };
    let serialized = js_json::stringify_parsed(draft);
    if js::utf16_len(&serialized) > DRAFT_LIMIT {
        return fail("초안이 너무 커요.");
    }
    if let Err(error) = rpc(
        &state,
        &actor,
        "select 1 from public.save_mpe_candidate_revision(p_candidate_id => $1::uuid, p_draft_json => $2::jsonb)",
        vec![Some(candidate.to_owned()), Some(serialized)],
    )
    .await
    {
        return fail(&message(&error));
    }
    audit(&state, &actor, "mpe.revision.save", candidate, None).await;
    ok()
}

/// `setMpeIngestionSourceRights({ ingestionId, sourceRole, rightsBasis })`.
pub async fn source_rights(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (Some(ingestion), Some(role), Some(basis)) = (
        uuid_at(&input, "ingestionId"),
        one_of(&input, "sourceRole", &ROLES),
        one_of(&input, "rightsBasis", &RIGHTS),
    ) else {
        return fail("출처 역할과 권리 근거를 확인해 주세요.");
    };
    if let Err(error) = rpc(
        &state,
        &actor,
        "select 1 from public.set_mpe_ingestion_source_rights(p_ingestion_id => $1::uuid, p_source_role => $2, p_rights_basis => $3)",
        vec![Some(ingestion.clone()), Some(role.clone()), Some(basis.clone())],
    )
    .await
    {
        return fail(&message(&error));
    }
    audit(
        &state,
        &actor,
        "mpe.source_rights.set",
        &ingestion,
        Some(json!({ "source_role": role, "rights_basis": basis })),
    )
    .await;
    ok()
}

/// `reviewMpeClaim({ candidateId, claimId, decision })`.
pub async fn review_claim(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (Some(candidate), Some(claim), Some(decision)) = (
        uuid_at(&input, "candidateId"),
        uuid_at(&input, "claimId"),
        one_of(&input, "decision", &["APPROVED", "REJECTED"]),
    ) else {
        return fail("근거 검수 요청 형식이 올바르지 않아요.");
    };
    if let Err(error) = rpc(
        &state,
        &actor,
        "select 1 from public.review_mpe_claim(p_candidate_id => $1::uuid, p_claim_id => $2::uuid, p_decision => $3)",
        vec![Some(candidate.clone()), Some(claim.clone()), Some(decision.clone())],
    )
    .await
    {
        return fail(&message(&error));
    }
    audit(
        &state,
        &actor,
        "mpe.claim.review",
        &claim,
        Some(json!({ "candidate_id": candidate, "decision": decision })),
    )
    .await;
    ok()
}

/// `reprocessMpeJob({ jobId })`.
pub async fn reprocess(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let Some(job) = uuid_at(&input, "jobId") else {
        return fail("작업 ID가 올바르지 않아요.");
    };
    if let Err(error) = rpc(
        &state,
        &actor,
        "select 1 from public.reprocess_mpe_job(p_job_id => $1::uuid)",
        vec![Some(job.clone())],
    )
    .await
    {
        return fail(&message(&error));
    }
    audit(&state, &actor, "mpe.job.reprocess", &job, None).await;
    ok()
}
