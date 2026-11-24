//! `GET /api/admin/mpe-candidates?candidateId=`: the `GET` of
//! `app/api/admin/mpe-candidates/route.ts` with `listCandidateMatches` of
//! `lib/mpe/candidates.server.ts`. Route id `admin-mpe-candidates`.
//!
//! An operator reads the stored matches of one candidate, as themselves, so
//! row-level security applies. `POST` is `candidate_post.rs`.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;

use super::renders::is_zod_uuid;
use super::{failure, no_store};
use crate::auth::{SessionUser, is_operator};
use crate::db::IdentityOptions;
use crate::routes::js_json;
use crate::routes::request::{self, Json};
use crate::AppState;

// What lib/db/execute.ts compiles for the read.
const MATCHES_SQL: &str = r#"WITH __q AS (SELECT r1.* FROM public."candidate_matches" r1 WHERE r1."candidate_id" = $1::uuid ORDER BY r1."rank" ASC) SELECT row_to_json(__q)::text FROM __q"#;

/// Why the caller may not read: `operatorClient()` and `requireOperator`.
pub(super) async fn refused(
    state: &AppState,
    request: &mut axum::http::request::Parts,
) -> Result<SessionUser, Response> {
    let Some(user) = request::session_user(state, request).await else {
        return Err(failure(StatusCode::UNAUTHORIZED, "signed_out"));
    };
    // `const { data: isOperator } = await client.rpc("is_operator")`: an
    // error leaves it null, which is a refusal.
    if !is_operator(state, &user).await.unwrap_or(false) {
        return Err(failure(StatusCode::FORBIDDEN, "operator_required"));
    }
    Ok(user)
}

/// The rows, each as `JSON.stringify` writes the object node-pg parsed.
async fn matches(
    state: &AppState,
    user: &SessionUser,
    candidate: String,
) -> Result<Vec<String>, String> {
    let rows: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(MATCHES_SQL)
                    .persistent(false)
                    .bind(candidate)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    let rows = rows.map_err(|error| match error.as_database_error() {
        Some(database) => database.message().to_owned(),
        None => error.to_string(),
    })?;
    Ok(rows
        .iter()
        .map(|row| {
            Json::parse(row)
                .map_or_else(|| "null".to_owned(), |row| js_json::stringify_parsed(&row))
        })
        .collect())
}

pub async fn list(State(state): State<AppState>, request: Request) -> Response {
    let (mut parts, _) = request.into_parts();
    let user = match refused(&state, &mut parts).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let pairs = request::query_pairs(&parts.uri);
    let Some(candidate) = request::first_param(&pairs, "candidateId").filter(|id| is_zod_uuid(id))
    else {
        return failure(StatusCode::BAD_REQUEST, "invalid_input");
    };
    let candidate = candidate.to_owned();
    // `listCandidateMatches` asks again (`requireOperator`); the session was
    // read once, as the client keeps the user it found.
    if !is_operator(&state, &user).await.unwrap_or(false) {
        return failure(StatusCode::FORBIDDEN, "operator_required");
    }
    match matches(&state, &user, candidate).await {
        Ok(rows) => no_store(
            StatusCode::OK,
            format!(r#"{{"ok":true,"data":[{}]}}"#, rows.join(",")),
        ),
        Err(message) => {
            let error = format!("candidate_match_list_failed: {message}");
            let body = serde_json::to_string(&error).expect("a string serializes");
            super::json(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!(r#"{{"ok":false,"error":{body}}}"#),
            )
        }
    }
}
