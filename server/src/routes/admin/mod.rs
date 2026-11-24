//! The server actions of the operator screens as JSON endpoints, one route
//! id each (`admin-action-*`), off until `AXUM_PILOT_ROUTES` names them, like
//! the screens that call them (`pages/admin`, `ui/admin.js`).
//!
//! `POST /_axum/admin/<action>` takes the action's argument as the JSON body
//! and answers its return value as JSON, the `ActionResult` of the
//! TypeScript. Each action checks what the TypeScript checks, in its order;
//! before that every one makes the checks a Next server action under
//! `/admin` gets:
//!
//! - the same-origin check of the native routes that change state
//!   (`hasTrustedOrigin`): 403 otherwise. Next's own check is that the
//!   `Origin` matches the `Host`.
//! - `proxy.ts` sends a POST to `/admin/*` without a session to `/login` and
//!   a non-operator's to `/` before the action runs. Here those are 401
//!   `로그인이 필요해요.` and 403 `운영자 권한이 없어요.`, the messages of
//!   `requireOperator`, and the script goes where the proxy would have sent
//!   the browser.
//!
//! A body that is not the argument's shape is 400 `invalid_input`: only a
//! hand-made request sends one, and the TypeScript would fail on it in its
//! own way (PLAN B7).

pub mod growth;
pub mod indexnow;
pub mod inquiries;
pub mod openai;
pub mod radar_safety;
pub mod reports;
pub mod sources;
pub mod submissions;
pub mod translation_drafts;
pub mod translations;
pub mod users;

use axum::Router;
use axum::extract::{FromRequest, Request};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use axum::routing::post;
use futures_util::future::BoxFuture;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};

use super::Routes;
use super::origin;
use crate::AppState;
use crate::auth::{self, SessionUser};
use crate::db::{DbIdentity, IdentityOptions};

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add(
            "admin-action-user-password",
            "/_axum/admin/user-password",
            post(users::set_password),
        )
        .add(
            "admin-action-user-reset",
            "/_axum/admin/user-reset",
            post(users::send_reset),
        )
        .add(
            "admin-action-user-role",
            "/_axum/admin/user-role",
            post(users::set_role),
        )
        .add(
            "admin-action-growth-slot",
            "/_axum/admin/growth-slot",
            post(growth::save_slot),
        )
        .add(
            "admin-action-growth-interview",
            "/_axum/admin/growth-interview",
            post(growth::record_interview),
        )
        .add(
            "admin-action-radar-review",
            "/_axum/admin/radar-review",
            post(radar_safety::apply_review),
        )
        .add(
            "admin-action-report-handle",
            "/_axum/admin/report-handle",
            post(reports::handle),
        )
        .add(
            "admin-action-discussion-visibility",
            "/_axum/admin/discussion-visibility",
            post(reports::set_visibility),
        )
        .add(
            "admin-action-inquiry-answer",
            "/_axum/admin/inquiry-answer",
            post(inquiries::answer),
        )
        .add(
            "admin-action-inquiry-status",
            "/_axum/admin/inquiry-status",
            post(inquiries::set_status),
        )
        .add(
            "admin-action-contribution-review",
            "/_axum/admin/contribution-review",
            post(submissions::review_contribution),
        )
        .add(
            "admin-action-submission-claim",
            "/_axum/admin/submission-claim",
            post(submissions::claim),
        )
        .add(
            "admin-action-submission-reject",
            "/_axum/admin/submission-reject",
            post(submissions::reject),
        )
        .add(
            "admin-action-submission-draft",
            "/_axum/admin/submission-draft",
            post(submissions::draft),
        )
        .add(
            "admin-action-submission-approve",
            "/_axum/admin/submission-approve",
            post(submissions::approve),
        )
        .add(
            "admin-action-source-review",
            "/_axum/admin/source-review",
            post(sources::review),
        )
        .add(
            "admin-action-translation-gpt-review",
            "/_axum/admin/translation-gpt-review",
            post(translation_drafts::gpt_review),
        )
        .add(
            "admin-action-translation-preview",
            "/_axum/admin/translation-preview",
            post(translation_drafts::preview),
        )
        .add(
            "admin-action-translation-draft",
            "/_axum/admin/translation-draft",
            post(translation_drafts::save_draft),
        )
        .add(
            "admin-action-translation-save",
            "/_axum/admin/translation-save",
            post(translations::save),
        )
        .add(
            "admin-action-translation-review",
            "/_axum/admin/translation-review",
            post(translations::review),
        )
        .add(
            "admin-action-translation-reject",
            "/_axum/admin/translation-reject",
            post(translations::reject),
        )
        .add(
            "admin-action-translation-delete",
            "/_axum/admin/translation-delete",
            post(translations::delete),
        )
        .add(
            "admin-action-translation-stale",
            "/_axum/admin/translation-stale",
            post(translations::mark_stale),
        )
        .build()
}

/// An action's answer: its return value with status 200, or a refusal made
/// before it ran.
pub fn answer(status: StatusCode, value: &Value) -> Response {
    (
        status,
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, "no-store"),
        ],
        value.to_string(),
    )
        .into_response()
}

/// `{ ok: true }`.
pub fn ok() -> Response {
    answer(StatusCode::OK, &json!({ "ok": true }))
}

/// `{ ok: true, data }`.
pub fn ok_with(data: Value) -> Response {
    answer(StatusCode::OK, &json!({ "ok": true, "data": data }))
}

/// `{ ok: false, error }`.
pub fn fail(error: &str) -> Response {
    answer(StatusCode::OK, &json!({ "ok": false, "error": error }))
}

/// A `303 See Other` to `location`: where a form action's `redirect()`
/// sends the browser.
pub fn see_other(location: &str) -> Response {
    let mut response = StatusCode::SEE_OTHER.into_response();
    if let Ok(value) = axum::http::HeaderValue::from_str(location) {
        response
            .headers_mut()
            .insert(axum::http::header::LOCATION, value);
    }
    response.headers_mut().insert(
        CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-store"),
    );
    response
}

/// A form's fields as `Object.fromEntries(formData)` sees them: the last
/// value of a repeated name wins.
pub struct FormFields(std::collections::HashMap<String, String>);

impl FormFields {
    pub fn from_pairs(pairs: impl Iterator<Item = (String, String)>) -> Self {
        Self(pairs.collect())
    }

    pub fn get(&self, name: &str) -> Option<&str> {
        self.0.get(name).map(String::as_str)
    }
}

/// The checks before a form action, then its fields (an urlencoded body, as
/// the screen's forms send it). The proxy's answers become redirects the
/// browser follows: `/login?next=<screen>` without a session, `/` for a
/// non-operator.
pub async fn form_call(
    state: &AppState,
    request: Request,
    screen: &str,
) -> Result<(SessionUser, FormFields), Response> {
    if !origin::request_is_trusted(state, request.headers()) {
        return Err(refuse(StatusCode::FORBIDDEN, "forbidden"));
    }
    let actor = match auth::resolve_session(state, request.headers()).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Err(see_other(&crate::pages::admin::login_location(
                screen, None,
            )));
        }
        Err(error) => {
            tracing::warn!(%error, "session lookup failed");
            return Err(refuse(StatusCode::SERVICE_UNAVAILABLE, "auth_unavailable"));
        }
    };
    if !matches!(auth::is_operator(state, &actor).await, Ok(true)) {
        return Err(see_other("/"));
    }
    let axum::Form(pairs) = axum::Form::<Vec<(String, String)>>::from_request(request, state)
        .await
        .map_err(|_| refuse(StatusCode::BAD_REQUEST, "invalid_input"))?;
    Ok((actor, FormFields::from_pairs(pairs.into_iter())))
}

fn refuse(status: StatusCode, error: &str) -> Response {
    answer(status, &json!({ "ok": false, "error": error }))
}

/// The checks before any action, then its argument.
pub struct Call<T> {
    pub actor: SessionUser,
    pub input: T,
}

/// Same origin, a session, an operator, then the body as `T`.
pub async fn call<T: DeserializeOwned>(
    state: &AppState,
    request: Request,
) -> Result<Call<T>, Response> {
    if !origin::request_is_trusted(state, request.headers()) {
        return Err(refuse(StatusCode::FORBIDDEN, "forbidden"));
    }
    let actor = match auth::resolve_session(state, request.headers()).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(refuse(StatusCode::UNAUTHORIZED, "로그인이 필요해요.")),
        Err(error) => {
            tracing::warn!(%error, "session lookup failed");
            return Err(refuse(StatusCode::SERVICE_UNAVAILABLE, "auth_unavailable"));
        }
    };
    // `const { data: isOperator } = await db.rpc("is_operator")`: an error
    // leaves `data` empty, which is "not an operator".
    if !matches!(auth::is_operator(state, &actor).await, Ok(true)) {
        return Err(refuse(StatusCode::FORBIDDEN, "운영자 권한이 없어요."));
    }
    let axum::Json(input) = axum::Json::<T>::from_request(request, state)
        .await
        .map_err(|_| refuse(StatusCode::BAD_REQUEST, "invalid_input"))?;
    Ok(Call { actor, input })
}

/// The message of a failed statement as the TypeScript's `error.message`:
/// Postgres' own for a database error.
pub fn db_message(error: &sqlx::Error) -> String {
    match error {
        sqlx::Error::Database(database) => database.message().to_owned(),
        other => other.to_string(),
    }
}

/// One unit of database work, in a transaction of its own as each plan the
/// TypeScript executes is.
pub type Work<T> = Box<
    dyn for<'c> FnOnce(&'c mut sqlx::PgConnection) -> BoxFuture<'c, Result<T, sqlx::Error>> + Send,
>;

/// `work` as `service_role` (`createAdminClient()`).
pub async fn as_service<T: Send + 'static>(
    state: &AppState,
    work: Work<T>,
) -> Result<T, sqlx::Error> {
    state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            work,
        )
        .await
}

/// `work` as the operator's session (`createClient()`).
pub async fn as_operator<T: Send + 'static>(
    state: &AppState,
    actor: &SessionUser,
    work: Work<T>,
) -> Result<T, sqlx::Error> {
    state
        .db
        .with_identity(&actor.db_identity(), IdentityOptions::default(), work)
        .await
}

/// `logAudit`: one `admin_audit_log` row as `service_role` (no operator
/// may insert one). `Err` carries the TypeScript's message.
pub async fn log_audit(
    state: &AppState,
    actor_id: &str,
    action: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    detail: Option<Value>,
) -> Result<(), &'static str> {
    let (actor_id, action, entity_type) = (
        actor_id.to_owned(),
        action.to_owned(),
        entity_type.to_owned(),
    );
    let entity_id = entity_id.map(str::to_owned);
    let detail = detail.map(|detail| detail.to_string());
    as_service(
        state,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    "insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail) values ($1::uuid, $2, $3, $4, $5::jsonb)",
                )
                .bind(actor_id)
                .bind(action)
                .bind(entity_type)
                .bind(entity_id)
                .bind(detail)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await
    .map_err(|error| {
        tracing::warn!(error = %db_message(&error), "audit log insert failed");
        "감사 로그 저장에 실패했어요."
    })
}

/// `revalidateTag`/`revalidatePath` after an action's work, while Next still
/// serves the public pages: Next expires its own cache
/// (`Upstream::expire_cache`). The work is done by then, so a failed expiry
/// is logged and the action still answers as it succeeded; the TypeScript's
/// in-process call cannot fail that way (PLAN B7).
pub async fn expire(state: &AppState, scope: crate::proxy::CacheScope) {
    let Some(secret) = state.config.cron_secret.as_ref() else {
        tracing::error!(
            ?scope,
            "CRON_SECRET is not set: Next's cache was not expired after an operator action"
        );
        return;
    };
    if let Err(error) = state.upstream.expire_cache(scope, secret.expose()).await {
        tracing::error!(%error, ?scope, "cache expiry after an operator action failed");
    }
}

/// What one audit row is about.
#[derive(Clone, Copy)]
pub struct Audit<'a> {
    pub actor_id: &'a str,
    pub action: &'a str,
    pub entity_type: &'a str,
    pub entity_id: Option<&'a str>,
}

impl Audit<'_> {
    /// `logAuditOutcome`: the action with `.intent`, `.completed` or `.failed`.
    pub async fn outcome(
        &self,
        state: &AppState,
        outcome: &str,
        detail: Option<Value>,
    ) -> Result<(), &'static str> {
        let action = format!("{}.{outcome}", self.action);
        log_audit(
            state,
            self.actor_id,
            &action,
            self.entity_type,
            self.entity_id,
            detail,
        )
        .await
    }

    /// `finalizeAudit`: the `.completed` row, whose failure is only logged.
    pub async fn finalize(&self, state: &AppState, detail: Option<Value>) {
        if self.outcome(state, "completed", detail).await.is_err() {
            tracing::error!(action = self.action, "admin_audit_completion_pending");
        }
    }
}
