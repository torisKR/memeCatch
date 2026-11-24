//! The account actions of `lib/actions/admin-users.ts` that `UserControls`
//! calls: `setUserPassword`, `sendPasswordReset` and `setUserRole`.
//! `listUsers` and `getUserDetail` only feed the screens (`pages/admin/users.rs`).
//!
//! Their `revalidatePath` calls name the operator screens, which are
//! rendered on every request: there is nothing to expire.

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;

use super::{Audit, as_service, call, db_message, fail, ok};
use crate::AppState;
use crate::routes::better_auth;
use crate::routes::public::js;

/// `setUserPassword`'s check.
const MIN_PASSWORD: usize = 8;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordInput {
    user_id: String,
    password: String,
}

/// `setUserPassword({ userId, password })`.
pub async fn set_password(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<PasswordInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let PasswordInput { user_id, password } = call.input;
    if js::utf16_len(&password) < MIN_PASSWORD {
        return fail("비밀번호는 8자 이상으로 정해 주세요.");
    }
    let audit = Audit {
        actor_id: &call.actor.id,
        action: "user.password_set",
        entity_type: "user",
        entity_id: Some(&user_id),
    };
    if let Err(message) = audit.outcome(&state, "intent", None).await {
        return fail(message);
    }
    // `admin.auth.admin.updateUserById` (lib/db/admin.ts): a new scrypt hash
    // on the credential account; its failures come back as `error`.
    let updated = match better_auth::hash_password(&password).await {
        Ok(hash) => {
            let id = user_id.clone();
            as_service(
                &state,
                Box::new(move |tx| {
                    Box::pin(async move {
                        sqlx::query(
                            r#"UPDATE account SET password = $1, "updatedAt" = now()
                WHERE "userId" = $2::uuid AND "providerId" = 'credential'"#,
                        )
                        .bind(hash)
                        .bind(id)
                        .execute(tx)
                        .await
                        .map(|_| ())
                    })
                }),
            )
            .await
            .map_err(|error| db_message(&error))
        }
        Err(_) => Err("password update failed".to_owned()),
    };
    if let Err(message) = updated {
        if let Err(audit_message) = audit.outcome(&state, "failed", None).await {
            return fail(audit_message);
        }
        return fail(&message);
    }
    audit.finalize(&state, None).await;
    ok()
}

/// `sendPasswordReset(email)`: the body is the address as a JSON string.
pub async fn send_reset(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<String>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let email = call.input;
    let audit = Audit {
        actor_id: &call.actor.id,
        action: "user.password_reset_sent",
        entity_type: "user",
        entity_id: None,
    };
    if let Err(message) = audit
        .outcome(&state, "intent", Some(json!({ "email": email })))
        .await
    {
        return fail(message);
    }
    // `db.auth.resetPasswordForEmail` reports no error whatever happens.
    better_auth::reset_password_for_email(&state, &email).await;
    audit
        .finalize(&state, Some(json!({ "email": email })))
        .await;
    ok()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleInput {
    user_id: String,
    role: String,
}

/// `setUserRole({ userId, role })`. The role is not checked against the two
/// the type names: the database refuses anything else, and its message is
/// the answer.
pub async fn set_role(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<RoleInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let RoleInput { user_id, role } = call.input;
    if user_id == call.actor.id && role != "operator" {
        return fail("자기 자신의 운영자 권한은 해제할 수 없어요(잠금 방지).");
    }
    let audit = Audit {
        actor_id: &call.actor.id,
        action: "user.role_set",
        entity_type: "user",
        entity_id: Some(&user_id),
    };
    let detail = json!({ "role": role });
    if let Err(message) = audit.outcome(&state, "intent", Some(detail.clone())).await {
        return fail(message);
    }
    // `admin.from("profiles").update({ role }).eq("id", userId)`.
    let (id, value) = (user_id.clone(), role.clone());
    let updated = as_service(
        &state,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(r#"UPDATE "public"."profiles" SET "role" = $1::public.user_role WHERE "id" = $2::uuid"#)
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
