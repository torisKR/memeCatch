//! `handleReport` and `setDiscussionVisibility` of `lib/actions/admin.ts`,
//! the two buttons of `ReportActions`. Their `revalidatePath` calls name
//! operator screens: nothing to expire.

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;

use super::{Audit, as_operator, as_service, call, db_message, fail, log_audit, ok};
use crate::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HandleInput {
    report_id: String,
    action: String,
}

/// `handleReport({ reportId, action })`: an open report becomes resolved or
/// dismissed (the enum refuses anything else), then the audit row.
pub async fn handle(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<HandleInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let HandleInput { report_id, action } = call.input;
    let (id, status, actor) = (report_id.clone(), action.clone(), call.actor.id.clone());
    let updated = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"UPDATE "public"."reports" SET "status" = $1::public.report_status, "handled_by" = $2::uuid WHERE "id" = $3::uuid AND "status" = 'open'"#,
                )
                .bind(status)
                .bind(actor)
                .bind(id)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = updated {
        return fail(&db_message(&error));
    }
    if let Err(message) = log_audit(
        &state,
        &call.actor.id,
        &format!("report.{action}"),
        "report",
        Some(&report_id),
        None,
    )
    .await
    {
        return fail(message);
    }
    ok()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisibilityInput {
    discussion_id: String,
    status: String,
}

/// `setDiscussionVisibility({ discussionId, status })` as `service_role`
/// (no operator may update `discussions`), audited before and after.
pub async fn set_visibility(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<VisibilityInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let VisibilityInput {
        discussion_id,
        status,
    } = call.input;
    let audit = Audit {
        actor_id: &call.actor.id,
        action: "discussion.set_status",
        entity_type: "discussion",
        entity_id: Some(&discussion_id),
    };
    let detail = json!({ "status": status });
    if let Err(message) = audit.outcome(&state, "intent", Some(detail.clone())).await {
        return fail(message);
    }
    let (id, value) = (discussion_id.clone(), status.clone());
    let updated = as_service(
        &state,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(r#"UPDATE "public"."discussions" SET "status" = $1::public.discussion_status WHERE "id" = $2::uuid"#)
                    .bind(value)
                    .bind(id)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = updated {
        if let Err(message) = audit.outcome(&state, "failed", Some(detail)).await {
            return fail(message);
        }
        return fail(&db_message(&error));
    }
    audit.finalize(&state, Some(detail)).await;
    ok()
}
