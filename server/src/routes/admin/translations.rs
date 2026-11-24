//! The actions of `lib/actions/admin-translations.ts` the operator screens
//! call: the review queue of `/admin/translations` (GPT review, approve,
//! reject, delete), the missing-translation preview and its draft, and the
//! save and stale marks of `/admin/memes/{id}`; the GPT review, the preview
//! and its draft are `translation_drafts.rs`.
//!
//! Each runs as the operator's session (`createClient()`), the audit rows
//! too, with the CAS on `updated_at` of the TypeScript. A change that can
//! reach a public page expires Next's catalog and pages
//! (`revalidateTranslationPaths`); the review queue's own paths need nothing.
//! `reviewMemeTranslation` then announces the meme's URLs (`indexnow.rs`).

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::Row;
use sqlx::postgres::PgRow;
use time::OffsetDateTime;

use super::{Call, as_operator, call, db_message, fail, ok};
use crate::AppState;
use crate::auth::SessionUser;
use crate::pages::admin::format;
use crate::routes::public::js;
use crate::routes::request::{Json, property};

/// `SEO_CONTENT_LOCALES`.
pub const LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
const TITLE_MAX: usize = 300;
const SUMMARY_MAX: usize = 1000;

pub fn is_locale(value: &str) -> bool {
    LOCALES.contains(&value)
}

/// `Number.isFinite(Date.parse(value))` for the timestamps the screens send.
pub(super) fn parses(value: &str) -> bool {
    format::parse_timestamp_or_date(value).is_some()
}

/// `sameInstant`: both parse and name the same millisecond.
pub fn same_instant(left: &str, right: &str) -> bool {
    let millis = |value: &str| {
        format::parse_timestamp_or_date(value).map(|at| at.unix_timestamp_nanos() / 1_000_000)
    };
    matches!((millis(left), millis(right)), (Some(a), Some(b)) if a == b)
}

/// A statement's parameter: text (cast in the SQL) or a text array.
pub(super) enum Arg {
    Text(Option<String>),
    List(Vec<String>),
}

pub(super) fn text(value: &str) -> Arg {
    Arg::Text(Some(value.to_owned()))
}

/// One statement as the operator, in a transaction of its own.
pub(super) async fn run(
    state: &AppState,
    actor: &SessionUser,
    sql: &'static str,
    args: Vec<Arg>,
) -> Result<Vec<PgRow>, sqlx::Error> {
    as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sql);
                for arg in args {
                    query = match arg {
                        Arg::Text(value) => query.bind(value),
                        Arg::List(values) => query.bind(values),
                    };
                }
                query.fetch_all(tx).await
            })
        }),
    )
    .await
}

/// The first column of the first row as text; `None` for no row.
pub(super) async fn first_text(
    state: &AppState,
    actor: &SessionUser,
    sql: &'static str,
    args: Vec<Arg>,
) -> Result<Option<String>, sqlx::Error> {
    let rows = run(state, actor, sql, args).await?;
    rows.first()
        .map(|row| row.try_get::<String, _>(0))
        .transpose()
}

/// A row written by `row_to_json`, its keys in column order.
pub(super) async fn json_row(
    state: &AppState,
    actor: &SessionUser,
    sql: &'static str,
    args: Vec<Arg>,
) -> Result<Option<Json>, sqlx::Error> {
    Ok(first_text(state, actor, sql, args)
        .await?
        .and_then(|text| Json::parse(&text)))
}

pub(super) fn json_text<'a>(value: &'a Json, key: &str) -> Option<&'a str> {
    value
        .as_object()
        .and_then(|entries| property(entries, key))
        .and_then(Json::as_str)
}

pub(super) struct Context {
    pub(super) meme_id: String,
    pub(super) meme_updated_at: String,
    pub(super) source_updated_at: String,
    pub(super) updated_at: String,
    pub(super) status: String,
}

/// `loadTranslationContext`: the meme and its translation, or the message
/// thrown for either missing.
pub(super) async fn context(
    state: &AppState,
    actor: &SessionUser,
    meme_id: &str,
    locale: &str,
) -> Result<Context, String> {
    let meme = run(
        state,
        actor,
        "select id::text, to_json(updated_at) #>> '{}' from public.memes where id = $1::uuid",
        vec![text(meme_id)],
    )
    .await;
    let translation = run(
        state,
        actor,
        "select to_json(source_updated_at) #>> '{}', to_json(updated_at) #>> '{}', status \
         from public.meme_translations where meme_id = $1::uuid and locale = $2",
        vec![text(meme_id), text(locale)],
    )
    .await;
    let Some(meme) = meme.ok().and_then(|rows| rows.into_iter().next()) else {
        return Err("원문 밈을 찾을 수 없어요.".to_owned());
    };
    let Some(translation) = translation.ok().and_then(|rows| rows.into_iter().next()) else {
        return Err("번역 초안을 찾을 수 없어요.".to_owned());
    };
    let get = |row: &PgRow, index: usize| row.try_get::<String, _>(index).unwrap_or_default();
    Ok(Context {
        meme_id: get(&meme, 0),
        meme_updated_at: get(&meme, 1),
        source_updated_at: get(&translation, 0),
        updated_at: get(&translation, 1),
        status: get(&translation, 2),
    })
}

/// `logAudit`: an `admin_audit_log` row as the operator, `{ locale, ...detail }`.
pub(super) async fn audit(
    state: &AppState,
    actor: &SessionUser,
    action: &str,
    meme_id: &str,
    locale: &str,
    detail: Value,
) -> Result<(), String> {
    let mut entries = Map::new();
    entries.insert("locale".to_owned(), Value::from(locale));
    if let Value::Object(more) = detail {
        entries.extend(more);
    }
    run(
        state,
        actor,
        "insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail) \
         values ($1::uuid, $2, 'meme_translation', $3, $4::jsonb)",
        vec![
            text(&actor.id),
            text(action),
            text(meme_id),
            text(&Value::Object(entries).to_string()),
        ],
    )
    .await
    .map(|_| ())
    .map_err(|error| format!("감사 로그를 기록하지 못했어요: {}", db_message(&error)))
}

/// `auditAndRevalidate`: the audit row (the pages' caches expire by their
/// time limit, `pages/cache.rs`).
async fn audit_action(
    state: &AppState,
    actor: &SessionUser,
    action: &str,
    context: &Context,
    locale: &str,
    detail: Value,
) -> Result<(), String> {
    audit(state, actor, action, &context.meme_id, locale, detail).await
}

pub(super) fn outcome(result: Result<(), String>) -> Response {
    match result {
        Ok(()) => ok(),
        Err(message) => fail(&message),
    }
}

/// `TranslationReviewInput`, and `MissingMemeTranslationDraftInput` with
/// `expectedSourceUpdatedAt` in place of the translation's revision.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentInput {
    pub(super) meme_id: String,
    pub(super) locale: String,
    #[serde(alias = "expectedSourceUpdatedAt")]
    pub(super) expected_translation_updated_at: String,
    pub(super) title: String,
    pub(super) summary: String,
    pub(super) description: String,
    pub(super) origin: String,
    pub(super) usage_note: String,
    pub(super) caution: String,
    pub(super) aliases: Vec<String>,
}

/// `normalizedContent` / `missingDraftContent`, in the order of the update.
pub(super) fn content_args(input: &ContentInput) -> Vec<Arg> {
    let optional =
        |value: &str| Arg::Text(Some(js::trim(value).to_owned()).filter(|v| !v.is_empty()));
    let mut aliases: Vec<String> = Vec::new();
    for alias in &input.aliases {
        let alias = js::trim(alias);
        if !alias.is_empty() && !aliases.iter().any(|kept| kept == alias) {
            aliases.push(alias.to_owned());
        }
    }
    vec![
        text(js::trim(&input.title)),
        text(js::trim(&input.summary)),
        text(js::trim(&input.description)),
        text(js::trim(&input.origin)),
        optional(&input.usage_note),
        optional(&input.caution),
        Arg::List(aliases),
    ]
}

pub(super) fn too_long(input: &ContentInput) -> bool {
    js::utf16_len(&input.title) > TITLE_MAX || js::utf16_len(&input.summary) > SUMMARY_MAX
}

/// `validateInput(input, requireComplete)`.
fn review_error(input: &ContentInput, complete: bool) -> Option<&'static str> {
    let blank = |value: &str| js::trim(value).is_empty();
    let expected = &input.expected_translation_updated_at;
    if input.meme_id.is_empty() {
        Some("밈 ID가 필요해요.")
    } else if !is_locale(&input.locale) {
        Some("지원하지 않는 번역 언어예요.")
    } else if expected.is_empty() || !parses(expected) {
        Some("번역 revision 정보가 올바르지 않아요. 새로고침해 주세요.")
    } else if blank(&input.title) {
        Some("번역 제목을 입력해 주세요.")
    } else if blank(&input.summary) {
        Some("번역 한 줄 요약을 입력해 주세요.")
    } else if complete && blank(&input.description) {
        Some("검수 발행 전 설명을 입력해 주세요.")
    } else if complete && blank(&input.origin) {
        Some("검수 발행 전 유래를 입력해 주세요.")
    } else if too_long(input) {
        Some("제목 또는 한 줄 요약이 너무 길어요.")
    } else {
        None
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionInput {
    pub(super) meme_id: String,
    pub(super) locale: String,
    pub(super) expected_translation_updated_at: String,
}

/// `saveMemeTranslation`: an edit goes back to review, `machine` while the
/// source is the one translated and `stale` once it changed.
pub async fn save(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<ContentInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if let Some(message) = review_error(&input, false) {
        return fail(message);
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    let status = if same_instant(&context.meme_updated_at, &context.source_updated_at) {
        "machine"
    } else {
        "stale"
    };
    let mut args = content_args(&input);
    args.extend([
        text(status),
        text(&input.meme_id),
        text(&input.locale),
        text(&input.expected_translation_updated_at),
        text(&context.source_updated_at),
    ]);
    let updated = run(
        &state,
        &actor,
        "update public.meme_translations set title = $1, summary = $2, description = $3, origin = $4, usage_note = $5, caution = $6, aliases = $7::text[], \
         status = $8, reviewed_at = null, reviewed_by = null \
         where meme_id = $9::uuid and locale = $10 and updated_at = $11::timestamptz and source_updated_at = $12::timestamptz returning meme_id::text",
        args,
    )
    .await;
    match updated {
        Err(error) => return fail(&db_message(&error)),
        Ok(rows) if rows.is_empty() => {
            return fail("번역이 변경되어 저장하지 못했어요. 새로고침해 주세요.");
        }
        Ok(_) => {}
    }
    let detail =
        json!({ "status": status, "previous_updated_at": input.expected_translation_updated_at });
    outcome(
        audit_action(
            &state,
            &actor,
            "meme_translation.save",
            &context,
            &input.locale,
            detail,
        )
        .await,
    )
}

/// `reviewMemeTranslation`: publishes a translation of the current source
/// revision, and puts it back to `stale` if the source changed meanwhile.
pub async fn review(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<ContentInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if let Some(message) = review_error(&input, true) {
        return fail(message);
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    if !same_instant(&context.meme_updated_at, &context.source_updated_at) {
        return fail(
            "한국어 원문이 번역 후 변경됐어요. 번역을 다시 생성하거나 갱신한 뒤 검수해 주세요.",
        );
    }
    let reviewed_at = format::iso(OffsetDateTime::now_utc());
    let mut args = content_args(&input);
    args.extend([
        text(&reviewed_at),
        text(&actor.id),
        text(&input.meme_id),
        text(&input.locale),
        text(&input.expected_translation_updated_at),
        text(&context.meme_updated_at),
    ]);
    let updated = run(
        &state,
        &actor,
        "update public.meme_translations set title = $1, summary = $2, description = $3, origin = $4, usage_note = $5, caution = $6, aliases = $7::text[], \
         status = 'reviewed', reviewed_at = $8::timestamptz, reviewed_by = $9::uuid \
         where meme_id = $10::uuid and locale = $11 and updated_at = $12::timestamptz and source_updated_at = $13::timestamptz \
         returning to_json(updated_at) #>> '{}'",
        args,
    )
    .await;
    let new_updated_at: String = match updated {
        Err(error) => return fail(&db_message(&error)),
        Ok(rows) => match rows.first() {
            Some(row) => row.try_get(0).unwrap_or_default(),
            None => return fail("원문 또는 번역이 변경되어 검수하지 못했어요. 새로고침해 주세요."),
        },
    };
    let latest = first_text(
        &state,
        &actor,
        "select to_json(updated_at) #>> '{}' from public.memes where id = $1::uuid",
        vec![text(&input.meme_id)],
    )
    .await;
    let unchanged = matches!(&latest, Ok(Some(at)) if same_instant(at, &context.source_updated_at));
    if unchanged {
        let detail = json!({
            "source_updated_at": context.source_updated_at,
            "reviewed_at": reviewed_at,
            "previous_updated_at": input.expected_translation_updated_at,
        });
        let audited = audit_action(
            &state,
            &actor,
            "meme_translation.review",
            &context,
            &input.locale,
            detail,
        )
        .await;
        // The translation URL the review opened, after the answer (a failed
        // audit returns before it, as the TypeScript throws).
        if audited.is_ok() {
            super::indexnow::schedule(&state, &actor, &input.meme_id);
        }
        return outcome(audited);
    }
    source_changed(
        &state,
        &actor,
        &input,
        &context,
        &reviewed_at,
        &new_updated_at,
        latest.err(),
    )
    .await
}

/// The branch of `reviewMemeTranslation` where the source changed during the
/// review: back to `stale`, audited either way.
async fn source_changed(
    state: &AppState,
    actor: &SessionUser,
    input: &ContentInput,
    context: &Context,
    reviewed_at: &str,
    updated_at: &str,
    source_error: Option<sqlx::Error>,
) -> Response {
    let stale = run(
        state,
        actor,
        "update public.meme_translations set status = 'stale', reviewed_at = null, reviewed_by = null \
         where meme_id = $1::uuid and locale = $2 and updated_at = $3::timestamptz returning meme_id::text",
        vec![text(&input.meme_id), text(&input.locale), text(updated_at)],
    )
    .await;
    let recovered = matches!(&stale, Ok(rows) if !rows.is_empty());
    let recovery_error = match &stale {
        Err(error) => Some(format!("stale 복구에 실패했어요: {}", db_message(error))),
        Ok(_) if !recovered => Some(
            "번역이 동시에 변경되어 stale 복구를 적용하지 못했어요. 새로고침해 주세요.".to_owned(),
        ),
        Ok(_) => None,
    };
    let mut detail = json!({
        "source_updated_at": context.source_updated_at,
        "reviewed_at": reviewed_at,
        "stale_recovered": recovered,
    });
    if let Some(error) = &source_error {
        detail["source_check_error"] = Value::from(db_message(error));
    }
    if let Some(error) = &recovery_error {
        detail["recovery_error"] = Value::from(error.as_str());
    }
    if let Err(message) = audit_action(
        state,
        actor,
        "meme_translation.review_source_changed",
        context,
        &input.locale,
        detail,
    )
    .await
    {
        return fail(&message);
    }
    fail(
        recovery_error
            .as_deref()
            .unwrap_or("검수 도중 한국어 원문이 변경되어 번역을 stale 상태로 되돌렸어요."),
    )
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectInput {
    meme_id: String,
    locale: String,
    expected_translation_updated_at: String,
    reason: String,
}

/// `rejectMemeTranslationDraft`: the reason in the audit log; the
/// translation stays as it is.
pub async fn reject(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<RejectInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if input.meme_id.is_empty() || !is_locale(&input.locale) {
        return fail("유효한 밈과 번역 언어가 필요해요.");
    }
    let reason = js::trim(&input.reason);
    if reason.is_empty() {
        return fail("반려 사유를 입력해 주세요.");
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    if context.updated_at != input.expected_translation_updated_at {
        return fail("번역이 변경되어 반려하지 못했어요. 새로고침해 주세요.");
    }
    let detail = json!({ "reason": reason, "status": context.status });
    outcome(
        audit(
            &state,
            &actor,
            "meme_translation.reject",
            &context.meme_id,
            &input.locale,
            detail,
        )
        .await,
    )
}

/// `deleteMemeTranslation`: the row itself, if unchanged.
pub async fn delete(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<RevisionInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if input.meme_id.is_empty() || !is_locale(&input.locale) {
        return fail("유효한 밈과 번역 언어가 필요해요.");
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    let removed = run(
        &state,
        &actor,
        "delete from public.meme_translations where meme_id = $1::uuid and locale = $2 and updated_at = $3::timestamptz returning meme_id::text",
        vec![
            text(&input.meme_id),
            text(&input.locale),
            text(&input.expected_translation_updated_at),
        ],
    )
    .await;
    match removed {
        Err(error) => return fail(&db_message(&error)),
        Ok(rows) if rows.is_empty() => {
            return fail("번역이 변경되어 삭제하지 못했어요. 새로고침해 주세요.");
        }
        Ok(_) => {}
    }
    let detail = json!({ "previous_status": context.status });
    outcome(
        audit_action(
            &state,
            &actor,
            "meme_translation.delete",
            &context,
            &input.locale,
            detail,
        )
        .await,
    )
}

/// `markMemeTranslationStale`.
pub async fn mark_stale(State(state): State<AppState>, request: Request) -> Response {
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
        return fail("유효한 밈과 번역 언어가 필요해요.");
    }
    let context = match context(&state, &actor, &input.meme_id, &input.locale).await {
        Ok(context) => context,
        Err(message) => return fail(&message),
    };
    let updated = run(
        &state,
        &actor,
        "update public.meme_translations set status = 'stale' where meme_id = $1::uuid and locale = $2 and updated_at = $3::timestamptz returning meme_id::text",
        vec![text(&input.meme_id), text(&input.locale), text(expected)],
    )
    .await;
    match updated {
        Err(error) => return fail(&db_message(&error)),
        Ok(rows) if rows.is_empty() => {
            return fail("번역이 변경되어 stale로 표시하지 못했어요. 새로고침해 주세요.");
        }
        Ok(_) => {}
    }
    let detail = json!({ "previous_updated_at": expected });
    outcome(
        audit_action(
            &state,
            &actor,
            "meme_translation.mark_stale",
            &context,
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
    fn instants_match_to_the_millisecond() {
        assert!(same_instant(
            "2026-11-12T01:02:03.456789+00:00",
            "2026-11-12T01:02:03.456Z"
        ));
        assert!(!same_instant(
            "2026-11-12T01:02:03.457+00:00",
            "2026-11-12T01:02:03.456Z"
        ));
        assert!(!same_instant("x", "x"));
    }
}
