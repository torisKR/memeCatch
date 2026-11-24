//! `answerInquiry` and `setInquiryStatus` of `lib/actions/admin-inquiries.ts`.
//! Their audit rows are written without checking the answer, as the
//! TypeScript's `logAudit` does. `revalidatePath("/admin/inquiries")` and
//! `("/support")` name pages rendered on every request: nothing to expire.

use axum::extract::{Request, State};
use axum::response::Response;
use serde_json::{Value, json};

use super::{as_operator, call, fail, log_audit, ok};
use crate::AppState;
use crate::pages::admin::growth::is_uuid;
use crate::routes::public::js;

const ENTITY: &str = "support_inquiry";

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

/// `answerSchema`: the id and the trimmed reply, or zod's first message.
fn answer_input(input: &Value) -> Result<(String, String), String> {
    let Some(object) = input.as_object() else {
        return Err(format!(
            "Invalid input: expected object, received {}",
            received(Some(input))
        ));
    };
    let id = match object.get("inquiryId") {
        Some(Value::String(id)) if is_uuid(id) => id.clone(),
        Some(Value::String(_)) => return Err("Invalid UUID".to_owned()),
        other => {
            return Err(format!(
                "Invalid input: expected string, received {}",
                received(other)
            ));
        }
    };
    let reply = match object.get("reply") {
        Some(Value::String(reply)) => js::trim(reply).to_owned(),
        other => {
            return Err(format!(
                "Invalid input: expected string, received {}",
                received(other)
            ));
        }
    };
    if reply.is_empty() {
        return Err("답변 내용을 입력해 주세요.".to_owned());
    }
    if js::utf16_len(&reply) > 4000 {
        return Err("답변은 4,000자까지 쓸 수 있어요.".to_owned());
    }
    Ok((id, reply))
}

/// `answerInquiry({ inquiryId, reply })`.
pub async fn answer(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (id, reply) = match answer_input(&call.input) {
        Ok(input) => input,
        Err(message) => return fail(&message),
    };
    let length = js::utf16_len(&reply);
    let target = id.clone();
    let updated = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"UPDATE "public"."support_inquiries" SET "admin_reply" = $1, "status" = 'answered', "replied_at" = now(), "updated_at" = now() WHERE "id" = $2::uuid"#,
                )
                .bind(reply)
                .bind(target)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if updated.is_err() {
        return fail("답변 저장에 실패했어요.");
    }
    let _ = log_audit(
        &state,
        &call.actor.id,
        "inquiry_answer",
        ENTITY,
        Some(&id),
        Some(json!({ "reply_length": length })),
    )
    .await;
    ok()
}

/// `setInquiryStatus({ inquiryId, status })`.
pub async fn set_status(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<Value>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let object = call.input.as_object();
    let id = object
        .and_then(|object| object.get("inquiryId"))
        .and_then(Value::as_str)
        .filter(|id| is_uuid(id));
    let status = object
        .and_then(|object| object.get("status"))
        .and_then(Value::as_str)
        .filter(|status| matches!(*status, "open" | "closed"));
    let (Some(id), Some(status)) = (id.map(str::to_owned), status.map(str::to_owned)) else {
        return fail("입력값을 확인해 주세요.");
    };
    let (target, value) = (id.clone(), status.clone());
    let updated = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(r#"UPDATE "public"."support_inquiries" SET "status" = $1, "updated_at" = now() WHERE "id" = $2::uuid"#)
                    .bind(value)
                    .bind(target)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        }),
    )
    .await;
    if updated.is_err() {
        return fail("상태 변경에 실패했어요.");
    }
    let _ = log_audit(
        &state,
        &call.actor.id,
        &format!("inquiry_{status}"),
        ENTITY,
        Some(&id),
        None,
    )
    .await;
    ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_answer_schema_reports_zods_first_message() {
        let id = "00000000-0000-4000-8b71-000000000201";
        assert_eq!(
            answer_input(&json!({ "inquiryId": id, "reply": "  네  " })),
            Ok((id.to_owned(), "네".to_owned()))
        );
        assert_eq!(
            answer_input(&json!({ "inquiryId": "x", "reply": "" }))
                .err()
                .as_deref(),
            Some("Invalid UUID")
        );
        assert_eq!(
            answer_input(&json!({ "reply": "a" })).err().as_deref(),
            Some("Invalid input: expected string, received undefined")
        );
        assert_eq!(
            answer_input(&json!({ "inquiryId": id, "reply": " " }))
                .err()
                .as_deref(),
            Some("답변 내용을 입력해 주세요.")
        );
        assert_eq!(
            answer_input(&json!({ "inquiryId": id, "reply": "가".repeat(4001) }))
                .err()
                .as_deref(),
            Some("답변은 4,000자까지 쓸 수 있어요.")
        );
    }
}
