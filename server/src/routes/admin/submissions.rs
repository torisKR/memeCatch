//! The submission queue's actions of `lib/actions/admin.ts`:
//! `reviewMemeContribution` here; the new-submission actions follow.

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;

use super::{as_operator, call, expire, fail, ok};
use crate::AppState;
use crate::proxy::CacheScope;
use crate::routes::public::js;

/// `CONTRIBUTION_REVIEW_ERRORS`, in the order `Object.keys` tries them.
const CONTRIBUTION_ERRORS: [(&str, &str); 7] = [
    ("operator_required", "운영자 권한이 없어요."),
    ("contribution_not_found", "제보를 찾을 수 없어요."),
    ("already_reviewed", "이미 처리된 제보예요."),
    ("reject_reason_required", "반려 사유를 입력해 주세요."),
    (
        "examples_full",
        "이 밈에는 예문이 이미 3개 있어요. 밈 관리에서 기존 예문을 정리한 뒤 승인해 주세요.",
    ),
    ("invalid_example", "예문은 상황 120자, 문장 500자까지예요."),
    ("invalid_source_title", "자료 제목은 300자까지예요."),
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributionInput {
    contribution_id: String,
    decision: String,
    source_title: Option<String>,
    situation: Option<String>,
    text: Option<String>,
    reject_reason: Option<String>,
}

/// `value?.trim() || null`.
pub fn trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| js::trim(&value).to_owned())
        .filter(|value| !value.is_empty())
}

/// The public pages a published meme appears on (`revalidateCanonicalMemePaths`):
/// Next's catalog tag and every page, the scope Next can expire.
pub async fn expire_public(state: &AppState) {
    expire(state, CacheScope::InstagramVideoVerification).await;
}

/// `reviewMemeContribution(input)`: `review_meme_contribution` applies the
/// source or the example and writes the audit row in one transaction.
pub async fn review_contribution(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<ContributionInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let input = call.input;
    let reject_reason = trimmed(input.reject_reason);
    if input.decision == "reject" && reject_reason.is_none() {
        return fail("반려 사유를 입력해 주세요.");
    }
    let approve = input.decision == "approve";
    let params = (
        input.contribution_id,
        input.decision,
        trimmed(input.source_title),
        trimmed(input.situation),
        trimmed(input.text),
        reject_reason,
    );
    let reviewed = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<String>>(
                    "select public.review_meme_contribution(p_id => $1::uuid, p_decision => $2, p_source_title => $3, p_situation => $4, p_text => $5, p_reject_reason => $6)::text",
                )
                .bind(params.0)
                .bind(params.1)
                .bind(params.2)
                .bind(params.3)
                .bind(params.4)
                .bind(params.5)
                .fetch_one(tx)
                .await
            })
        }),
    )
    .await;
    let data = match reviewed {
        Ok(data) => data,
        Err(error) => {
            let message = super::db_message(&error);
            let known = CONTRIBUTION_ERRORS
                .iter()
                .find(|(key, _)| message.contains(key));
            return fail(known.map_or(message.as_str(), |(_, text)| text));
        }
    };
    let meme_id = data
        .as_deref()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(text).ok())
        .and_then(|value| {
            value
                .get("memeId")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
        });
    if approve && meme_id.is_some() {
        expire_public(&state).await;
    }
    ok()
}
