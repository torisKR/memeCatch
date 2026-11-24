//! The actions of `/admin/memes/{id}` in `lib/actions/admin.ts`:
//! `transitionMemeStatus`, `setMemeOriginCountry`, `updateMeme` and
//! `generateKoreanReviewDraft` (GPT). The translation panel calls
//! `translations.rs`. A change a public page shows expires Next's pages
//! and announces the meme to IndexNow, as the TypeScript does.

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;

use super::memes::{HOUSE_ORIGINAL, SCRATCH_ERROR, looks_like_scratch, publish_error};
use super::{Call, as_operator, call, db_message, fail, log_audit, ok, openai};
use crate::AppState;
use crate::auth::SessionUser;
use crate::routes::js_json;
use crate::routes::public::js;
use crate::routes::request::Json;
use crate::routes::studio::meme_country;

type Args = Vec<Option<String>>;

async fn rows(
    state: &AppState,
    actor: &SessionUser,
    sql: &'static str,
    args: Args,
) -> Result<Vec<sqlx::postgres::PgRow>, sqlx::Error> {
    as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sql);
                for arg in args {
                    query = query.bind(arg);
                }
                query.fetch_all(tx).await
            })
        }),
    )
    .await
}

/// `loadMemeRevalidationIdentity`: its origin kind and status, `None` for no
/// row or a failed read.
async fn identity(
    state: &AppState,
    actor: &SessionUser,
    meme_id: &str,
) -> Result<Option<(Option<String>, Option<String>)>, sqlx::Error> {
    let found = rows(
        state,
        actor,
        "select origin_kind, moderation_status::text from public.memes where id = $1::uuid",
        vec![Some(meme_id.to_owned())],
    )
    .await?;
    Ok(found.first().map(|row| {
        (
            row.try_get(0).unwrap_or_default(),
            row.try_get(1).unwrap_or_default(),
        )
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionInput {
    meme_id: String,
    to: Value,
    #[serde(default)]
    attested: Value,
}

/// `transitionMemeStatus({ memeId, to, attested })`: a house original is
/// published only through `publish_house_original` with the attestation;
/// every other move is the status update the trigger checks.
pub async fn transition(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<TransitionInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let origin_kind = match identity(&state, &actor, &input.meme_id).await {
        Ok(found) => found.and_then(|(kind, _)| kind),
        Err(error) => return fail(&db_message(&error)),
    };
    let to = super::memes::bound(&input.to);
    let publishing = origin_kind.as_deref() == Some(HOUSE_ORIGINAL)
        && matches!(to.as_deref(), Some("approved" | "limited"));
    if publishing {
        if input.attested != Value::Bool(true) {
            return fail(&publish_error("house_rights_attestation_required"));
        }
        if let Err(error) = rows(
            &state,
            &actor,
            "select public.publish_house_original(p_meme_id => $1::uuid, p_to => $2::public.moderation_status, p_attested => true)::text",
            vec![Some(input.meme_id.clone()), to.clone()],
        )
        .await
        {
            return fail(&publish_error(&db_message(&error)));
        }
    } else if let Err(error) = rows(
        &state,
        &actor,
        "update public.memes set moderation_status = $1::public.moderation_status where id = $2::uuid",
        vec![to.clone(), Some(input.meme_id.clone())],
    )
    .await
    {
        let message = db_message(&error);
        return fail(&if message.contains("invalid moderation transition") {
            "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요.".to_owned()
        } else {
            publish_error(&message)
        });
    }
    let mut detail = json!({ "to": input.to });
    if publishing {
        detail["attested"] = Value::Bool(true);
    }
    detail["origin_kind"] = origin_kind.map_or(Value::Null, Value::from);
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "meme.transition",
        "meme",
        Some(&input.meme_id),
        Some(detail),
    )
    .await
    {
        return fail(message);
    }
    super::indexnow::schedule(&state, &actor, &input.meme_id);
    ok()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginCountryInput {
    meme_id: String,
    country: Value,
    local_title: String,
}

const COUNTRY_GENERIC: &str = "출처 국가를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/// `setMemeOriginCountry({ memeId, country, localTitle })`.
pub async fn origin_country(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<OriginCountryInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let id = &input.meme_id;
    let hex =
        |part: &str, len: usize| part.len() == len && part.chars().all(|c| c.is_ascii_hexdigit());
    let parts: Vec<&str> = id.split('-').collect();
    if !(parts.len() == 5
        && [8, 4, 4, 4, 12]
            .iter()
            .zip(&parts)
            .all(|(len, part)| hex(part, *len)))
    {
        return fail("밈 식별자를 확인해 주세요.");
    }
    let Some(country) = input.country.as_str().and_then(meme_country) else {
        return fail("밈 국가를 확인해 주세요.");
    };
    let local_title = js::trim(&input.local_title);
    if local_title.is_empty() || js::utf16_len(local_title) > 300 {
        return fail("현지 제목은 1~300자로 입력해 주세요.");
    }
    if !matches!(identity(&state, &actor, id).await, Ok(Some(_))) {
        return fail("밈을 찾을 수 없어요.");
    }
    let saved = rows(
        &state,
        &actor,
        "select public.set_meme_origin_country(p_meme_id => $1::uuid, p_market_code => $2, p_local_title => $3)::text",
        vec![Some(id.clone()), Some(country.code.to_owned()), Some(local_title.to_owned())],
    )
    .await;
    if let Err(error) = saved {
        let code = db_message(&error);
        let message = [
            ("operator_required", "운영자 권한이 없어요."),
            ("meme_not_found", "밈을 찾을 수 없어요."),
            ("invalid_market_code", "밈 국가를 확인해 주세요."),
            (
                "invalid_local_title",
                "현지 제목은 1~300자로 입력해 주세요.",
            ),
        ]
        .iter()
        .find(|(marker, _)| code.contains(marker))
        .map_or(COUNTRY_GENERIC, |(_, message)| message);
        return fail(message);
    }
    ok()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInput {
    meme_id: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    usage_note: String,
    caution: String,
    aliases: Vec<String>,
    safety_level: Value,
    lifecycle_status: Value,
    category: Value,
    difficulty: Value,
    sentiment: Value,
    #[serde(default)]
    origin_year: Value,
    #[serde(default)]
    usage_context: Value,
}

/// `updateMeme(input)`: `update_meme_with_safety_review` saves the text and
/// queues a safety review when the level changes; a published house
/// original whose copy changed goes back to rights checking.
pub async fn update(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<UpdateInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if js::trim(&input.title).is_empty() {
        return fail("제목을 입력해 주세요.");
    }
    let before = identity(&state, &actor, &input.meme_id)
        .await
        .ok()
        .flatten();
    let house = before
        .as_ref()
        .is_some_and(|(kind, _)| kind.as_deref() == Some(HOUSE_ORIGINAL));
    if house && (looks_like_scratch(&input.origin) || looks_like_scratch(&input.description)) {
        return fail(SCRATCH_ERROR);
    }
    let optional = |value: &str| Some(js::trim(value).to_owned()).filter(|v| !v.is_empty());
    let content = json!({
        "title": js::trim(&input.title),
        "summary": js::trim(&input.summary),
        "description": js::trim(&input.description),
        "origin": js::trim(&input.origin),
        "usage_note": optional(&input.usage_note),
        "caution": optional(&input.caution),
        "aliases": input.aliases.iter().map(|alias| js::trim(alias)).filter(|alias| !alias.is_empty()).collect::<Vec<_>>(),
        "lifecycle_status": input.lifecycle_status,
        "category": input.category,
        "difficulty": input.difficulty,
        "sentiment": input.sentiment,
        "origin_year": input.origin_year,
        "usage_context": input.usage_context,
    });
    let saved = rows(
        &state,
        &actor,
        "select public.update_meme_with_safety_review(p_meme_id => $1::uuid, p_proposed_level => $2::public.safety_level, p_content => $3::jsonb)",
        vec![Some(input.meme_id.clone()), super::memes::bound(&input.safety_level), Some(content.to_string())],
    )
    .await;
    let queued = match saved {
        Err(error) => return fail(&db_message(&error)),
        Ok(found) => {
            found
                .first()
                .and_then(|row| row.try_get::<Option<bool>, _>(0).ok().flatten())
                == Some(true)
        }
    };
    let mut reverted = false;
    if let Some((Some(kind), Some(status))) = &before
        && kind == HOUSE_ORIGINAL
        && matches!(status.as_str(), "approved" | "limited")
    {
        let after = identity(&state, &actor, &input.meme_id)
            .await
            .ok()
            .flatten()
            .and_then(|(_, status)| status);
        reverted = after.as_deref() == Some("rights_checking");
    }
    super::indexnow::schedule(&state, &actor, &input.meme_id);
    super::ok_with(json!({ "safetyReviewQueued": queued, "revertedToRightsChecking": reverted }))
}

/// `KOREAN_REVIEW_SCHEMA`, as `JSON.stringify` writes the constant.
const KOREAN_SCHEMA: &str = r#"{"type":"object","additionalProperties":false,"required":["title","summary","description","origin","usage_note","caution"],"properties":{"title":{"type":"string","description":"한국어 표기 제목. 고유명사는 원문을 보존"},"summary":{"type":"string","description":"80자 이내의 자연스러운 한국어 한 줄 요약"},"description":{"type":"string","description":"뜻과 쓰임새를 설명하는 한국어 본문"},"origin":{"type":"string","description":"확인된 범위만 반영한 한국어 유래 설명"},"usage_note":{"type":"string","description":"한국어 사용 팁. 원문이 비어 있으면 빈 문자열"},"caution":{"type":"string","description":"한국어 주의 문구. 원문이 비어 있으면 빈 문자열"}}}"#;
const KOREAN_INSTRUCTIONS: &str = "당신은 한국 밈 사전 서비스 '밈캐치'의 한국어 편집자입니다. 영어 또는 혼합 언어 항목을 자연스러운 한국어 해요체 검수 초안으로 정리합니다. 고유명사, 작품명, 인물명, 서비스명은 널리 쓰이는 한국어 표기가 확실할 때만 바꾸고 그렇지 않으면 원문을 보존합니다. 입력에 없는 사실, 연도, 원출처를 만들지 않습니다. 불확실한 내용은 단정하지 말고 확인이 필요하다고 표시합니다. 자동 게시나 자동 저장을 하지 않으며 운영자가 사실관계와 고유명사를 최종 확인합니다.";

/// `generateKoreanReviewDraft(memeId)`: GPT's Korean draft of the meme's
/// text, audited; nothing is saved.
pub async fn korean_draft(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<String>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let found = rows(
        &state,
        &actor,
        "select row_to_json(t)::text from (select title, summary, description, origin, usage_note, caution from public.memes where id = $1::uuid) t",
        vec![Some(input.clone())],
    )
    .await;
    let meme = match found {
        Ok(found) => found
            .first()
            .and_then(|row| row.try_get::<String, _>(0).ok())
            .and_then(|text| Json::parse(&text)),
        Err(_) => None,
    };
    let Some(meme) = meme else {
        return fail("밈을 찾을 수 없어요.");
    };
    let prompt = format!(
        "다음 밈 항목을 한국어 검수 초안으로 정리해 주세요.\n\n{}",
        js_json::stringify_parsed_pretty(&meme)
    );
    let draft = match openai::structured(
        &state,
        &openai::Structured {
            name: "korean_review_draft",
            schema: KOREAN_SCHEMA,
            instructions: KOREAN_INSTRUCTIONS,
            input: &prompt,
        },
    )
    .await
    {
        Ok(draft) => draft,
        Err(message) => return fail(&message),
    };
    let detail = json!({ "model": openai::MODEL, "reasoning_effort": openai::REASONING_EFFORT, "auto_saved": false });
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "ai.generate_korean_review",
        "meme",
        Some(&input),
        Some(detail),
    )
    .await
    {
        return fail(message);
    }
    // `{ ...draft, review_basis: "ai_translation" }`: a key it has keeps its place.
    let mut entries = match draft {
        Json::Object(entries) => entries,
        _ => Vec::new(),
    };
    match entries.iter_mut().find(|(key, _)| key == "review_basis") {
        Some(entry) => entry.1 = Json::String("ai_translation".to_owned()),
        None => entries.push((
            "review_basis".to_owned(),
            Json::String("ai_translation".to_owned()),
        )),
    }
    openai::ok_with_parsed(&openai::stringify(&Json::Object(entries)))
}
