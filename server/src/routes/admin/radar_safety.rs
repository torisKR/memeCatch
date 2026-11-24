//! `applyRadarSafetyReview` of `lib/actions/radar-safety.ts`: an operator
//! approves or rejects one pending safety level proposal
//! (`apply_safety_review`). An approval expires the public catalog
//! (`revalidateTag(PUBLIC_CATALOG_CACHE_TAG)`); `revalidatePath` of the
//! screen itself has nothing to expire.
//!
//! And `decide_match`, which the TypeScript did not have (its radar never
//! stored a signal): an operator approves or rejects one match the radar
//! left `pending` (`review_meme_signal_link`, PLAN.md D4-1).

use axum::extract::{Request, State};
use axum::response::Response;
use serde_json::Value;

use super::{as_operator, call, fail, ok};
use crate::AppState;
use crate::pages::admin::growth::is_uuid;
use crate::routes::public::js;

const FAILED: &str = "안전 등급 검수 처리에 실패했어요.";

/// zod's name for a value's type in "expected …, received …".
fn received(value: Option<&Value>) -> &'static str {
    match value {
        None => "undefined",
        Some(Value::Null) => "null",
        Some(Value::Bool(_)) => "boolean",
        Some(Value::Number(_)) => "number",
        Some(Value::String(_)) => "string",
        Some(Value::Array(_)) => "array",
        Some(Value::Object(_)) => "object",
    }
}

/// `reviewSchema`: the review id, the decision and the trimmed note, or the
/// first issue's message.
fn parse(input: &Value) -> Result<(String, String, String), String> {
    let Some(object) = input.as_object() else {
        return Err(format!(
            "Invalid input: expected object, received {}",
            received(Some(input))
        ));
    };
    let review_id = match object.get("reviewId").and_then(Value::as_str) {
        Some(id) if is_uuid(id) => id.to_owned(),
        _ => return Err("올바른 검수 ID가 아니에요.".to_owned()),
    };
    let decision = match object.get("decision").and_then(Value::as_str) {
        Some(decision @ ("approved" | "rejected")) => decision.to_owned(),
        _ => return Err("승인 또는 반려를 선택해 주세요.".to_owned()),
    };
    let note = match object.get("reviewNote") {
        Some(Value::String(note)) => js::trim(note).to_owned(),
        other => {
            return Err(format!(
                "Invalid input: expected string, received {}",
                received(other)
            ));
        }
    };
    if note.is_empty() {
        return Err("검수 메모를 입력해 주세요.".to_owned());
    }
    if js::utf16_len(&note) > 2000 {
        return Err("검수 메모는 2,000자까지 쓸 수 있어요.".to_owned());
    }
    Ok((review_id, decision, note))
}

/// `applyRadarSafetyReview({ reviewId, decision, reviewNote })`.
pub async fn apply_review(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (review_id, decision, note) = match parse(&call.input) {
        Ok(parsed) => parsed,
        Err(message) => return fail(&message),
    };
    let applied = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<bool>>(
                    "select public.apply_safety_review(p_review_id => $1::uuid, p_decision => $2, p_review_note => $3)",
                )
                .bind(review_id)
                .bind(decision)
                .bind(note)
                .fetch_one(tx)
                .await
            })
        }),
    )
    .await;
    match applied {
        Err(error) => {
            tracing::warn!(%error, "apply_safety_review failed");
            fail(FAILED)
        }
        Ok(Some(true)) => ok(),
        Ok(_) => fail("이미 처리된 검수 요청이에요."),
    }
}

const MATCH_FAILED: &str = "신호 매칭 처리에 실패했어요.";

/// The meme and signal of a pending match and the decision.
fn parse_match(input: &Value) -> Result<(String, String, String), &'static str> {
    let id = |name: &str| {
        input
            .get(name)
            .and_then(Value::as_str)
            .filter(|id| is_uuid(id))
            .map(str::to_owned)
            .ok_or("올바른 신호 매칭이 아니에요.")
    };
    let (meme_id, signal_id) = (id("memeId")?, id("signalId")?);
    match input.get("decision").and_then(Value::as_str) {
        Some(decision @ ("approved" | "rejected")) => Ok((meme_id, signal_id, decision.to_owned())),
        _ => Err("승인 또는 거절을 선택해 주세요."),
    }
}

/// `{ memeId, signalId, decision }`: the match becomes `reviewed` or
/// `rejected` with the operator and time. Nothing public reads a match, so
/// no cache expires.
pub async fn decide_match(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (meme_id, signal_id, decision) = match parse_match(&call.input) {
        Ok(parsed) => parsed,
        Err(message) => return fail(message),
    };
    let decided = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<bool>>(
                    "select public.review_meme_signal_link(p_meme_id => $1::uuid, p_signal_id => $2::uuid, p_decision => $3)",
                )
                .bind(meme_id)
                .bind(signal_id)
                .bind(decision)
                .fetch_one(tx)
                .await
            })
        }),
    )
    .await;
    match decided {
        Err(error) => {
            tracing::warn!(%error, "review_meme_signal_link failed");
            fail(MATCH_FAILED)
        }
        Ok(Some(true)) => ok(),
        Ok(_) => fail("이미 처리된 신호 매칭이에요."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_schema_reports_its_own_messages_first() {
        let id = "00000000-0000-4000-8b70-000000000001";
        let ok = |note: &str| json!({ "reviewId": id, "decision": "approved", "reviewNote": note });
        assert_eq!(
            parse(&ok("  봤어요 ")).map(|(.., note)| note),
            Ok("봤어요".to_owned())
        );
        assert_eq!(
            parse(&json!({ "reviewId": "x" })).err().as_deref(),
            Some("올바른 검수 ID가 아니에요.")
        );
        assert_eq!(
            parse(&json!({ "reviewId": id, "decision": "maybe" }))
                .err()
                .as_deref(),
            Some("승인 또는 반려를 선택해 주세요.")
        );
        assert_eq!(
            parse(&json!({ "reviewId": id, "decision": "rejected" }))
                .err()
                .as_deref(),
            Some("Invalid input: expected string, received undefined")
        );
        assert_eq!(
            parse(&ok("   ")).err().as_deref(),
            Some("검수 메모를 입력해 주세요.")
        );
        assert_eq!(
            parse(&ok(&"가".repeat(2001))).err().as_deref(),
            Some("검수 메모는 2,000자까지 쓸 수 있어요.")
        );
        assert_eq!(
            parse(&json!("x")).err().as_deref(),
            Some("Invalid input: expected object, received string")
        );
    }

    #[test]
    fn a_match_decision_names_a_match_and_a_decision() {
        let id = "00000000-0000-4000-8b70-000000000001";
        assert_eq!(
            parse_match(&json!({ "memeId": id, "signalId": id, "decision": "rejected" })),
            Ok((id.to_owned(), id.to_owned(), "rejected".to_owned()))
        );
        for input in [
            json!({ "memeId": "x", "signalId": id, "decision": "approved" }),
            json!({ "memeId": id, "decision": "approved" }),
            json!("x"),
        ] {
            assert_eq!(parse_match(&input), Err("올바른 신호 매칭이 아니에요."));
        }
        assert_eq!(
            parse_match(&json!({ "memeId": id, "signalId": id, "decision": "reviewed" })),
            Err("승인 또는 거절을 선택해 주세요.")
        );
    }
}
