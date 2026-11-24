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
    if demotes_self(&user_id, &call.actor.id, &role) {
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

/// Whether `setUserRole` would take the operator role from the operator who
/// asks. The ids are compared as Postgres reads them for `$2::uuid` (any
/// case, with or without hyphens or braces), not as strings: the upper-case
/// form of one's own id got past the TypeScript's `===` (B7 review L1, D2-6).
fn demotes_self(user_id: &str, actor_id: &str, role: &str) -> bool {
    role != "operator" && uuid_key(user_id).is_some_and(|id| Some(id) == uuid_key(actor_id))
}

/// `uuid_in`: 32 hexadecimal digits, a hyphen allowed after any group of
/// four, the whole optionally in braces. The digits in lower case.
fn uuid_key(value: &str) -> Option<String> {
    let inner = match value.strip_prefix('{') {
        Some(rest) => rest.strip_suffix('}')?,
        None => value,
    };
    let mut digits = String::with_capacity(32);
    let mut chars = inner.chars().peekable();
    while let Some(c) = chars.next() {
        if !c.is_ascii_hexdigit() {
            return None;
        }
        digits.push(c.to_ascii_lowercase());
        let group_ends = digits.len().is_multiple_of(4) && digits.len() < 32;
        if group_ends && chars.peek() == Some(&'-') {
            chars.next();
        }
    }
    (digits.len() == 32).then_some(digits)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OWN: &str = "3e3c0d1a-7a52-4c1e-9d5b-12e0f0a0b12a";

    #[test]
    fn the_own_id_in_any_form_postgres_reads_cannot_be_demoted() {
        for form in [
            OWN,
            "3E3C0D1A-7A52-4C1E-9D5B-12E0F0A0B12A",
            "{3e3c0d1a-7a52-4c1e-9d5b-12e0f0a0b12a}",
            "3e3c0d1a7a524c1e9d5b12e0f0a0b12a",
            "3e3c-0d1a-7a52-4c1e-9d5b-12e0-f0a0-b12a",
        ] {
            assert!(demotes_self(form, OWN, "user"), "{form}");
            assert!(!demotes_self(form, OWN, "operator"), "{form}");
        }
    }

    #[test]
    fn another_or_unreadable_id_is_not_the_own_one() {
        assert!(!demotes_self(
            "3e3c0d1a-7a52-4c1e-9d5b-12e0f0a0b12b",
            OWN,
            "user"
        ));
        for unreadable in [
            "",
            "{3e3c0d1a-7a52-4c1e-9d5b-12e0f0a0b12a",
            "3e3c0d1a--7a52-4c1e-9d5b-12e0f0a0b12a",
            "x",
        ] {
            assert!(!demotes_self(unreadable, OWN, "user"), "{unreadable}");
        }
    }
}
