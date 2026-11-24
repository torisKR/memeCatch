//! The GPT parts of `lib/actions/admin-translations.ts`: the review of a
//! queued translation, the preview of a missing one and the operator's
//! draft of it (`translations.rs` has the shared statements and checks).

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use unicode_normalization::UnicodeNormalization;

use super::translations::{
    ContentInput, RevisionInput, audit, content_args, context, first_text, is_locale, json_row,
    json_text, outcome, parses, run, same_instant, text, too_long,
};
use super::{Call, call, db_message, fail, openai};
use crate::AppState;
use crate::pages::admin::growth::is_uuid;
use crate::routes::js_json;
use crate::routes::public::js;
use crate::routes::request::{Json, property};

const PROMPT_VERSION: i64 = 1;
const SLUG_MAX: usize = 100;

/// `TRANSLATION_AI_REVIEW_SCHEMA`, as `JSON.stringify` writes the constant.
const REVIEW_SCHEMA: &str = r#"{"type":"object","additionalProperties":false,"required":["title","summary","description","origin","usage_note","caution","aliases","recommendation","confidence","review_notes"],"properties":{"title":{"type":"string"},"summary":{"type":"string"},"description":{"type":"string"},"origin":{"type":"string"},"usage_note":{"type":"string"},"caution":{"type":"string"},"aliases":{"type":"array","items":{"type":"string"}},"recommendation":{"type":"string","enum":["approve","edit","reject"]},"confidence":{"type":"string","enum":["high","medium","low"]},"review_notes":{"type":"array","items":{"type":"string"}}}}"#;

/// `missingDraftValidationError`.
fn draft_error(input: &ContentInput) -> Option<&'static str> {
    let blank = |value: &str| js::trim(value).is_empty();
    let expected = &input.expected_translation_updated_at;
    if !is_uuid(&input.meme_id) {
        Some("유효한 밈 ID가 필요해요.")
    } else if !is_locale(&input.locale) {
        Some("지원하지 않는 번역 언어예요.")
    } else if expected.is_empty() || !parses(expected) {
        Some("원문 revision 정보가 올바르지 않아요. 새로고침해 주세요.")
    } else if blank(&input.title) {
        Some("번역 제목을 입력해 주세요.")
    } else if blank(&input.summary) {
        Some("번역 한 줄 요약을 입력해 주세요.")
    } else if blank(&input.description) {
        Some("검수 대기 초안에 설명을 입력해 주세요.")
    } else if blank(&input.origin) {
        Some("검수 대기 초안에 유래를 입력해 주세요.")
    } else if too_long(input) {
        Some("제목 또는 한 줄 요약이 너무 길어요.")
    } else {
        None
    }
}

/// `localizedSlug(title, fallback)`: NFKC, trimmed, lower case, runs of
/// anything but letters and numbers as one `-`, at most 100 UTF-16 units.
pub fn localized_slug(title: &str, fallback: &str) -> String {
    let nfkc: String = title.nfkc().collect();
    let lower = js::trim(&nfkc).to_lowercase();
    let mut dashed = String::new();
    let mut gap = false;
    for c in lower.chars() {
        if crate::routes::unicode_classes::contains(
            &crate::routes::unicode_classes::LETTER_OR_NUMBER,
            c,
        ) {
            if gap && !dashed.is_empty() {
                dashed.push('-');
            }
            gap = false;
            dashed.push(c);
        } else {
            gap = true;
        }
    }
    // `.slice(0, 100)` counts UTF-16 units; half a pair is written as U+FFFD.
    let mut slug = String::new();
    let mut units = 0;
    for c in dashed.chars() {
        let width = c.len_utf16();
        if units + width > SLUG_MAX {
            if units < SLUG_MAX {
                slug.push('\u{fffd}');
            }
            break;
        }
        units += width;
        slug.push(c);
    }
    let slug = slug.trim_end_matches('-');
    if slug.is_empty() {
        fallback.to_owned()
    } else {
        slug.to_owned()
    }
}

/// `reviewMemeTranslationWithGpt`: GPT's review of a translation against its
/// Korean source, audited; nothing is saved.
pub async fn gpt_review(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<RevisionInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let expected = &input.expected_translation_updated_at;
    if input.meme_id.is_empty()
        || !is_locale(&input.locale)
        || expected.is_empty()
        || !parses(expected)
    {
        return fail("유효한 밈과 번역 revision이 필요해요.");
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    if &context.updated_at != expected {
        return fail("번역이 변경되어 GPT 검수를 실행하지 못했어요. 새로고침해 주세요.");
    }
    let source = json_row(
        &state,
        &actor,
        "select row_to_json(t)::text from (select title, summary, description, origin, usage_note, caution, aliases \
         from public.memes where id = $1::uuid) t",
        vec![text(&input.meme_id)],
    )
    .await;
    let localized = json_row(
        &state,
        &actor,
        "select row_to_json(t)::text from (select title, summary, description, origin, usage_note, caution, aliases \
         from public.meme_translations where meme_id = $1::uuid and locale = $2) t",
        vec![text(&input.meme_id), text(&input.locale)],
    )
    .await;
    let Ok(Some(source)) = source else {
        return fail("한국어 원문을 찾을 수 없어요.");
    };
    let Ok(Some(localized)) = localized else {
        return fail("번역 초안을 찾을 수 없어요.");
    };
    let instructions = format!(
        "당신은 한국 밈 사전 서비스의 다국어 편집 검수자입니다. 한국어 원문을 {} 번역 초안과 대조해 의미, 고유명사, 안전 문구, 사실 단정 여부를 검수합니다. \
         입력에 없는 사실과 출처를 만들지 말고, 불확실하면 review_notes에 적습니다. \
         수정이 필요하면 전체 교정본을 반환합니다. recommendation은 approve=그대로 발행 가능, edit=교정본을 운영자가 확인한 뒤 발행, reject=원문 근거 부족·유해성·번역 불가로 발행하지 않는 경우입니다. \
         자동 저장·자동 발행을 하지 않으며 운영자의 최종 승인을 전제로 합니다.",
        input.locale
    );
    let prompt = js_json::stringify_parsed_pretty(&Json::Object(vec![
        ("locale".to_owned(), Json::String(input.locale.clone())),
        ("source_meme".to_owned(), source),
        ("localized_draft".to_owned(), localized),
        (
            "source_updated_at".to_owned(),
            Json::String(context.meme_updated_at.clone()),
        ),
    ]));
    let draft = match openai::structured(
        &state,
        &openai::Structured {
            name: "meme_translation_review",
            schema: REVIEW_SCHEMA,
            instructions: &instructions,
            input: &prompt,
        },
    )
    .await
    {
        Ok(draft) => draft,
        Err(message) => return fail(&message),
    };
    if draft == Json::Null {
        return fail("Cannot read properties of null (reading 'recommendation')");
    }
    let mut detail = json!({
        "model": openai::MODEL,
        "reasoning_effort": openai::REASONING_EFFORT,
    });
    for key in ["recommendation", "confidence"] {
        if let Some(value) = draft.as_object().and_then(|entries| property(entries, key)) {
            let value: Value =
                serde_json::from_str(&js_json::stringify_parsed(value)).unwrap_or(Value::Null);
            detail[key] = value;
        }
    }
    detail["auto_saved"] = Value::Bool(false);
    if let Err(message) = audit(
        &state,
        &actor,
        "ai.meme_translation_review",
        &context.meme_id,
        &input.locale,
        detail,
    )
    .await
    {
        return fail(&message);
    }
    openai::ok_with_parsed(&openai::stringify(&draft))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewInput {
    meme_id: String,
    locale: String,
    expected_source_updated_at: String,
}

const PUBLIC_SOURCE: &str = "select row_to_json(t)::text from (select id, short_id, title, summary, description, origin, usage_note, caution, aliases, updated_at \
     from public.memes where id = $1::uuid and moderation_status in ('approved', 'limited')) t";
const TRANSLATION_ROW: &str =
    "select meme_id::text from public.meme_translations where meme_id = $1::uuid and locale = $2";

/// `previewMissingMemeTranslationWithGpt`: GPT's draft of a translation that
/// does not exist yet, read-only, dropped if the source or the translation
/// changed meanwhile.
pub async fn preview(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<PreviewInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let expected = &input.expected_source_updated_at;
    if !is_uuid(&input.meme_id)
        || !is_locale(&input.locale)
        || expected.is_empty()
        || !parses(expected)
    {
        return fail("유효한 밈과 원문 revision이 필요해요.");
    }
    let id = || text(&input.meme_id);
    let source = json_row(&state, &actor, PUBLIC_SOURCE, vec![id()]).await;
    let existing = first_text(
        &state,
        &actor,
        TRANSLATION_ROW,
        vec![id(), text(&input.locale)],
    )
    .await;
    let Ok(Some(source)) = source else {
        return fail("공개 가능한 원문 밈을 찾을 수 없어요.");
    };
    let source_updated_at = json_text(&source, "updated_at")
        .unwrap_or_default()
        .to_owned();
    if !same_instant(&source_updated_at, expected) {
        return fail("원문이 변경되어 번역 미리보기를 만들지 못했어요. 새로고침해 주세요.");
    }
    match existing {
        Err(error) => return fail(&db_message(&error)),
        Ok(Some(_)) => return fail("이미 해당 언어의 번역 행이 있어요."),
        Ok(None) => {}
    }
    let instructions = format!(
        "이 작업은 한국 밈 사전 원문을 {}로 옮기는 번역 초안 미리보기입니다. \
         반드시 제공된 원문만 사용하고, 원문에 없는 사실이나 출처를 만들지 마세요. \
         원문의 불확실성, 추정, 단서를 그대로 보존하고 필요한 주의는 review_notes에 남기세요. \
         자동 저장이나 자동 발행을 전제로 하지 마세요. 인간 운영자가 결과를 검토한 뒤 별도로 저장하고 발행해야 합니다. \
         recommendation은 운영자 검토 관점에서 approve, edit, reject 중 하나로 반환하세요.",
        input.locale
    );
    let prompt = js_json::stringify_parsed_pretty(&Json::Object(vec![
        ("locale".to_owned(), Json::String(input.locale.clone())),
        ("source_meme".to_owned(), source),
        (
            "source_updated_at".to_owned(),
            Json::String(source_updated_at.clone()),
        ),
        ("preview_only".to_owned(), Json::Bool(true)),
    ]));
    let draft = match openai::structured(
        &state,
        &openai::Structured {
            name: "missing_meme_translation_preview",
            schema: REVIEW_SCHEMA,
            instructions: &instructions,
            input: &prompt,
        },
    )
    .await
    {
        Ok(draft) => draft,
        Err(message) => return fail(&message),
    };
    let latest = first_text(
        &state,
        &actor,
        "select to_json(updated_at) #>> '{}' from public.memes where id = $1::uuid and moderation_status in ('approved', 'limited')",
        vec![id()],
    )
    .await;
    let translated = first_text(
        &state,
        &actor,
        TRANSLATION_ROW,
        vec![id(), text(&input.locale)],
    )
    .await;
    let (Ok(latest), Ok(translated)) = (latest, translated) else {
        return fail("번역 미리보기 상태를 다시 확인하지 못했어요. 새로고침해 주세요.");
    };
    if !latest.is_some_and(|latest| same_instant(&latest, &source_updated_at))
        || translated.is_some()
    {
        return fail("원문 또는 번역 상태가 변경되어 초안을 폐기했어요. 새로고침해 주세요.");
    }
    openai::ok_with_parsed(&format!(
        r#"{{"sourceUpdatedAt":{},"draft":{}}}"#,
        Value::from(source_updated_at),
        openai::stringify(&draft)
    ))
}

/// `saveMissingMemeTranslationDraft`: the operator's edit of a preview as a
/// `machine` translation, for the review queue; nothing is published.
pub async fn save_draft(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<ContentInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if let Some(message) = draft_error(&input) {
        return fail(message);
    }
    let source = run(
        &state,
        &actor,
        "select slug, to_json(updated_at) #>> '{}' from public.memes where id = $1::uuid and moderation_status in ('approved', 'limited')",
        vec![text(&input.meme_id)],
    )
    .await;
    let Some(source) = source.ok().and_then(|rows| rows.into_iter().next()) else {
        return fail("공개 가능한 원문 밈을 찾을 수 없어요.");
    };
    let slug: String = source.try_get(0).unwrap_or_default();
    let updated_at: String = source.try_get(1).unwrap_or_default();
    if !same_instant(&updated_at, &input.expected_translation_updated_at) {
        return fail("원문이 변경되어 저장하지 못했어요. 새로고침해 주세요.");
    }
    match first_text(
        &state,
        &actor,
        TRANSLATION_ROW,
        vec![text(&input.meme_id), text(&input.locale)],
    )
    .await
    {
        Err(error) => return fail(&db_message(&error)),
        Ok(Some(_)) => {
            return fail("이미 해당 언어의 번역 행이 있어요. 검수 큐를 새로고침해 주세요.");
        }
        Ok(None) => {}
    }
    let mut args = vec![
        text(&input.meme_id),
        text(&input.locale),
        text(&localized_slug(js::trim(&input.title), &slug)),
    ];
    args.extend(content_args(&input));
    args.extend([text(&updated_at), text(openai::MODEL)]);
    let inserted = run(
        &state,
        &actor,
        "insert into public.meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, aliases, \
         status, source_updated_at, provider, model, prompt_version, reviewed_at, reviewed_by) \
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], 'machine', $11::timestamptz, 'openai', $12, 1, null, null)",
        args,
    )
    .await;
    if let Err(error) = inserted {
        if let sqlx::Error::Database(database) = &error
            && database.code().as_deref() == Some("23505")
        {
            return fail("다른 운영자가 먼저 저장했어요. 검수 큐를 새로고침해 주세요.");
        }
        return fail(&db_message(&error));
    }
    let detail = json!({
        "status": "machine",
        "source_updated_at": updated_at,
        "model": openai::MODEL,
        "reasoning_effort": openai::REASONING_EFFORT,
        "prompt_version": PROMPT_VERSION,
        "auto_published": false,
    });
    outcome(
        audit(
            &state,
            &actor,
            "meme_translation.draft_create",
            &input.meme_id,
            &input.locale,
            detail,
        )
        .await,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_localized_slug_is_letters_and_numbers_joined_by_dashes() {
        assert_eq!(localized_slug("  Hello, World! 2 ", "f"), "hello-world-2");
        assert_eq!(localized_slug("ＡＢＣ　ｄｅｆ", "f"), "abc-def");
        assert_eq!(localized_slug("!!!", "fallback"), "fallback");
        assert_eq!(localized_slug("中文 標題", "f"), "中文-標題");
        let long = "a".repeat(99) + "-b";
        assert_eq!(localized_slug(&long, "f"), "a".repeat(99));
        assert_eq!(
            localized_slug(&("a".repeat(99) + "\u{20000}"), "f"),
            "a".repeat(99) + "\u{fffd}"
        );
    }
}
