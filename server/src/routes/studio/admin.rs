//! `POST /api/admin/meme-studio`: `app/api/admin/meme-studio/route.ts` and
//! `generateAdminMemeConcepts`. Route id `admin-meme-studio`.
//!
//! An operator's three concepts from Bedrock. Before the call the most it
//! can cost is reserved against the lifetime budget
//! (`reserve_bedrock_meme_studio_budget`, as `service_role`); nothing is
//! settled afterwards, as in the TypeScript. Every failure is one 503.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::response::Response;
use serde::Serialize;

use super::bedrock::{self, Failure, Input, MODEL_ID};
use super::converse::{self, Bedrock};
use super::{Concept, FORMATS, TONES, meme_country};
use crate::auth::is_operator;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::request::{self, Json, SiteOrigin};
use crate::{AppState, fallback};

/// `request.json()` reads any length; this reads at most 1 MiB and takes a
/// longer body for malformed JSON (PLAN.md, differences).
const MAX_BODY_BYTES: usize = 1024 * 1024;
const BAD_INPUT: &str = "topic(2~120자), tone, format, country를 올바르게 보내 주세요.";
// What lib/db/execute.ts sends, with the cast Postgres inferred for node-pg.
const RESERVE_SQL: &str = r#"WITH __q AS (SELECT public."reserve_bedrock_meme_studio_budget"("p_model_profile" => $1, "p_estimated_cost_nano_usd" => $2::bigint) AS result) SELECT row_to_json(__q)::text FROM __q"#;

#[derive(Serialize)]
struct Error<'a> {
    error: &'a str,
}

fn error(status: StatusCode, error: &str) -> Response {
    let body = serde_json::to_string(&Error { error }).expect("a string serializes");
    request::json(status, body)
}

fn no_store(mut response: Response) -> Response {
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
    response
}

#[derive(Serialize)]
struct Generated {
    mode: &'static str,
    provider: &'static str,
    concepts: Vec<Concept>,
}

/// `bodySchema.safeParse(...)`: the input with its topic trimmed.
fn parsed(payload: Option<&Json>) -> Option<Input> {
    let entries = payload?.as_object()?;
    let text = |key| request::property(entries, key).and_then(Json::as_str);
    let topic = js::trim(text("topic")?);
    let tone = TONES.into_iter().find(|tone| Some(*tone) == text("tone"))?;
    let format = FORMATS
        .into_iter()
        .find(|format| Some(*format) == text("format"))?;
    let country = meme_country(text("country")?)?;
    (2..=120).contains(&js::utf16_len(topic)).then(|| Input {
        topic: topic.to_owned(),
        tone,
        format,
        country,
    })
}

/// `reserveCost(reservedNanoUsd)`: the reservation, refused or failed alike.
async fn reserve(state: &AppState, nano_usd: u64) -> Result<(), Failure> {
    let reserved: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(RESERVE_SQL)
                        .persistent(false)
                        .bind(MODEL_ID)
                        .bind(nano_usd.to_string())
                        .fetch_all(tx)
                        .await
                })
            },
        )
        .await;
    reserved.map(drop).map_err(|_| Failure::BudgetRejected)
}

/// `generateBedrockMemeConcepts` then `generateAdminMemeConcepts`.
async fn generate(
    state: &AppState,
    bedrock: &Bedrock,
    input: Input,
) -> Result<Vec<Concept>, Failure> {
    let config = &state.config.bedrock_studio;
    if !config.enabled {
        return Err(Failure::Disabled);
    }
    let input = Input {
        topic: bedrock::normalized_topic(&input.topic)?,
        ..input
    };
    let body = bedrock::request_body(&input);
    let nano_usd =
        bedrock::reserved_nano_usd(config.input_rate.as_deref(), config.output_rate.as_deref())?;
    reserve(state, nano_usd).await?;
    let answer = bedrock.converse(config, &body).await?;
    converse::concepts(&answer, &input.country)
}

pub async fn studio(
    State(state): State<AppState>,
    site: SiteOrigin,
    bedrock: Arc<Bedrock>,
    request: Request,
) -> Response {
    let trusted = request::trusted_origin(request.headers(), &site);
    let (true, Some(trusted)) = (request::has_ascii_target(request.uri()), trusted) else {
        return fallback::answer(State(state), request).await;
    };
    if !trusted {
        return error(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (mut parts, body) = request.into_parts();
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return error(StatusCode::UNAUTHORIZED, "signed_out");
    };
    if !is_operator(&state, &user).await.unwrap_or(false) {
        return error(StatusCode::FORBIDDEN, "operator_required");
    }
    // `request.json().catch(() => null)`.
    let text = request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await;
    let payload = text.ok().and_then(|text| Json::parse(&text));
    let Some(input) = parsed(payload.as_ref()) else {
        return error(StatusCode::BAD_REQUEST, BAD_INPUT);
    };
    match generate(&state, &bedrock, input).await {
        Ok(concepts) => {
            let body = Generated {
                mode: "ai",
                provider: "bedrock",
                concepts,
            };
            let body = serde_json::to_string(&body).expect("strings serialize");
            no_store(request::json(StatusCode::OK, body))
        }
        Err(failure) => {
            tracing::error!(?failure, "meme_studio_bedrock_unavailable");
            no_store(error(
                StatusCode::SERVICE_UNAVAILABLE,
                "bedrock_unavailable",
            ))
        }
    }
}
