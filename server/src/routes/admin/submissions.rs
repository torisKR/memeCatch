//! The submission queue's actions of `lib/actions/admin.ts`:
//! `reviewMemeContribution` here; the new-submission actions follow.

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;

use super::{as_operator, call, fail, ok};
use crate::AppState;
use crate::routes::public::js;

/// `CONTRIBUTION_REVIEW_ERRORS`, in the order `Object.keys` tries them.
const CONTRIBUTION_ERRORS: [(&str, &str); 7] = [
    ("operator_required", "운영자 권한이 없어요."),
    ("contribution_not_found", "제보를 찾을 수 없어요."),
    ("already_reviewed", "이미 처리된 제보예요."),
    ("reject_reason_required", "반려 사유를 입력해 주세요."),
    (
        "examples_full",
        "이 밈에는 예문이 이미 3개 있어요. 밈 관리에서 기존 예문을 정리한 뒤 승인해 주세요.",
    ),
    ("invalid_example", "예문은 상황 120자, 문장 500자까지예요."),
    ("invalid_source_title", "자료 제목은 300자까지예요."),
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContributionInput {
    contribution_id: String,
    decision: String,
    source_title: Option<String>,
    situation: Option<String>,
    text: Option<String>,
    reject_reason: Option<String>,
}

/// `value?.trim() || null`.
pub fn trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| js::trim(&value).to_owned())
        .filter(|value| !value.is_empty())
}

/// `reviewMemeContribution(input)`: `review_meme_contribution` applies the
/// source or the example and writes the audit row in one transaction.
pub async fn review_contribution(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<ContributionInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let input = call.input;
    let reject_reason = trimmed(input.reject_reason);
    if input.decision == "reject" && reject_reason.is_none() {
        return fail("반려 사유를 입력해 주세요.");
    }
    let approve = input.decision == "approve";
    let params = (
        input.contribution_id,
        input.decision,
        trimmed(input.source_title),
        trimmed(input.situation),
        trimmed(input.text),
        reject_reason,
    );
    let reviewed = as_operator(
        &state,
        &call.actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<String>>(
                    "select public.review_meme_contribution(p_id => $1::uuid, p_decision => $2, p_source_title => $3, p_situation => $4, p_text => $5, p_reject_reason => $6)::text",
                )
                .bind(params.0)
                .bind(params.1)
                .bind(params.2)
                .bind(params.3)
                .bind(params.4)
                .bind(params.5)
                .fetch_one(tx)
                .await
            })
        }),
    )
    .await;
    if let Err(error) = reviewed {
        let message = super::db_message(&error);
        let known = CONTRIBUTION_ERRORS
            .iter()
            .find(|(key, _)| message.contains(key));
        return fail(known.map_or(message.as_str(), |(_, text)| text));
    }
    if approve {
        crate::pages::expire_public(&state);
    }
    ok()
}

/* ── New submissions ─────────────────────────────────────────── */

use super::{Call, log_audit, openai};
use crate::routes::request::Json as OrderedJson;
use crate::routes::unicode_classes;

/// `claimSubmission(submissionId)`: a pending submission becomes this
/// operator's, then the audit row.
pub async fn claim(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<String>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (id, uid) = (input.clone(), actor.id.clone());
    let updated = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"UPDATE "public"."meme_submissions" SET "claimed_by" = $1::uuid, "status" = 'reviewing', "updated_at" = now() WHERE "id" = $2::uuid AND "status" = 'pending'"#,
                )
                .bind(uid)
                .bind(id)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = updated {
        return fail(&super::db_message(&error));
    }
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "submission.claim",
        "meme_submission",
        Some(&input),
        None,
    )
    .await
    {
        return fail(message);
    }
    ok()
}

/// `REJECT_CATEGORIES`.
const REJECT_CATEGORIES: [&str; 4] = ["중복", "출처 부족", "저작권", "부적절"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectInput {
    submission_id: String,
    category: String,
    reason: String,
}

/// `rejectSubmission({ submissionId, category, reason })`.
pub async fn reject(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<RejectInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    if !REJECT_CATEGORIES.contains(&input.category.as_str()) {
        return fail("반려 사유 카테고리를 선택해 주세요.");
    }
    let reason = js::trim(&input.reason).to_owned();
    if reason.is_empty() {
        return fail("반려 사유를 입력해 주세요.");
    }
    let stored = format!("[{}] {reason}", input.category);
    let id = input.submission_id.clone();
    let updated = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"UPDATE "public"."meme_submissions" SET "status" = 'rejected', "reject_reason" = $1, "updated_at" = now() WHERE "id" = $2::uuid"#,
                )
                .bind(stored)
                .bind(id)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = updated {
        return fail(&super::db_message(&error));
    }
    let detail = serde_json::json!({ "category": input.category, "reason": reason });
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "submission.reject",
        "meme_submission",
        Some(&input.submission_id),
        Some(detail),
    )
    .await
    {
        return fail(message);
    }
    ok()
}

/// `DRAFT_SCHEMA`, as `JSON.stringify` writes the constant.
const DRAFT_SCHEMA: &str = r#"{"type":"object","additionalProperties":false,"required":["summary","description","origin","safety_level","usage_context"],"properties":{"summary":{"type":"string","description":"80자 이내 한 줄 요약 (해요체)"},"description":{"type":"string","description":"뜻과 쓰임새 설명 2~3문단 (해요체)"},"origin":{"type":"string","description":"유래·확산 경로 1~2문단 (해요체)"},"safety_level":{"type":"string","enum":["green","yellow","gray","red"]},"usage_context":{"type":"object","additionalProperties":false,"required":["work","friends","family","sns"],"properties":{"work":{"type":"string","enum":["green","yellow","gray","red"]},"friends":{"type":"string","enum":["green","yellow","gray","red"]},"family":{"type":"string","enum":["green","yellow","gray","red"]},"sns":{"type":"string","enum":["green","yellow","gray","red"]}}}}}"#;
const DRAFT_INSTRUCTIONS: &str = "당신은 한국 밈 사전 서비스 '밈캐치'의 운영 보조입니다. 제보된 밈 정보를 바탕으로 한국어 검수 초안을 작성합니다. 제보가 영어 또는 혼합 언어이면 먼저 의미를 자연스러운 한국어로 해석하고, 불가피한 고유명사를 제외한 출력은 모두 한국어 해요체로 작성합니다. 입력에 없는 사실, 연도, 원출처를 만들지 않고 확실하지 않은 내용은 확인 필요성을 표시합니다. safety_level 기준: green=써도 됨, yellow=맥락 주의, gray=이미 유행이 지남, red=쓰면 위험(차별·혐오·논란). usage_context는 직장(work)·친구(friends)·가족(family)·공개 SNS(sns) 각각에서의 사용 안전도를 같은 기준으로 판단합니다. 자동 게시나 자동 저장을 하지 않으며 운영자가 최종 사실관계와 저작권을 확인합니다.";

type DraftRow = (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<Vec<String>>,
);

/// `generateDraft(submissionId)`: a GPT draft of the meme from the
/// submission, audited; nothing is saved.
pub async fn draft(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<String>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let id = input.clone();
    let row: Option<DraftRow> = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_as("select name, source_url, description, seen_at, guess_reason, tags from public.meme_submissions where id = $1::uuid")
                    .bind(id)
                    .fetch_optional(tx)
                    .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    let Some((name, source_url, description, seen_at, guess_reason, tags)) = row else {
        return fail("제보를 찾을 수 없어요.");
    };
    // `submission.tags.length` of a null column throws.
    let Some(tags) = tags else {
        return fail("Cannot read properties of null (reading 'length')");
    };
    let present = |label: &str, value: &Option<String>| {
        value
            .as_deref()
            .filter(|value| !value.is_empty())
            .map(|value| format!("{label}{value}"))
    };
    let lines: Vec<String> = [
        Some(format!("밈 이름: {name}")),
        present("출처 링크: ", &source_url),
        present("제보자가 본 곳: ", &seen_at),
        present("제보자 설명: ", &description),
        present("유행 이유 추측: ", &guess_reason),
        (!tags.is_empty()).then(|| format!("태그: {}", tags.join(", "))),
        Some(String::new()),
        Some("위 제보를 바탕으로 밈 사전 초안을 JSON으로 작성해 주세요.".to_owned()),
    ]
    .into_iter()
    .flatten()
    .collect();
    let prompt = lines.join("\n");
    let answer = openai::structured(
        &state,
        &openai::Structured {
            name: "meme_submission_review_draft",
            schema: DRAFT_SCHEMA,
            instructions: DRAFT_INSTRUCTIONS,
            input: &prompt,
        },
    )
    .await;
    let draft: OrderedJson = match answer {
        Ok(draft) => draft,
        Err(message) => return fail(&message),
    };
    let detail =
        serde_json::json!({ "model": openai::MODEL, "reasoning_effort": openai::REASONING_EFFORT });
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "ai.generate_draft",
        "meme_submission",
        Some(&input),
        Some(detail),
    )
    .await
    {
        return fail(message);
    }
    openai::ok_with_parsed(&openai::stringify(&draft))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApproveInput {
    submission_id: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    safety_level: String,
    category: String,
    difficulty: String,
    origin_year: Option<f64>,
    tags: Vec<String>,
    usage_context: serde_json::Value,
}

/// `slugify(title)`: spaces to `-`, anything but letters, numbers and `-`
/// dropped, lower case; `밈` when nothing is left.
pub fn slugify(title: &str) -> String {
    let mut out = String::new();
    let mut space = false;
    for c in js::trim(title).chars() {
        if js::is_space(c) {
            space = true;
            continue;
        }
        if space {
            out.push('-');
            space = false;
        }
        if c == '-' || unicode_classes::contains(&unicode_classes::LETTER_OR_NUMBER, c) {
            out.push(c);
        }
    }
    let out = out.to_lowercase();
    if out.is_empty() {
        "밈".to_owned()
    } else {
        out
    }
}

fn base36(mut value: u128) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut out = Vec::new();
    loop {
        out.push(DIGITS[(value % 36) as usize]);
        value /= 36;
        if value == 0 {
            break;
        }
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

fn approval_failed(error: &str, meme_id: &str) -> Response {
    super::answer(
        axum::http::StatusCode::OK,
        &serde_json::json!({ "ok": false, "error": error, "createdMemeId": meme_id }),
    )
}

/// `approveSubmission(input)`: the meme, its source, the moderation steps,
/// the tags, the submission's status and the audit row, each its own
/// statement as in the TypeScript (it is not atomic), and for a supported
/// platform's link its representative embed (`getOEmbed`).
pub async fn approve(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<ApproveInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let title = js::trim(&input.title).to_owned();
    if title.is_empty() {
        return fail("제목을 입력해 주세요.");
    }
    let summary = js::trim(&input.summary).to_owned();
    if summary.is_empty() {
        return fail("한 줄 요약을 입력해 주세요.");
    }
    let id = input.submission_id.clone();
    let submission: Option<(Option<String>, String, Option<String>)> = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_as("select submitter_id::text, status::text, source_url from public.meme_submissions where id = $1::uuid")
                    .bind(id)
                    .fetch_optional(tx)
                    .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    let Some((submitter, status, source_url)) = submission else {
        return fail("제보를 찾을 수 없어요.");
    };
    if status != "pending" && status != "reviewing" {
        return fail("이미 처리된 제보예요. 제보와 밈 관리에서 처리 결과를 확인해 주세요.");
    }
    let base = slugify(&input.title);
    let now = u128::try_from(crate::auth::now_ms()).unwrap_or(0);
    let mut meme_id = None;
    let mut insert_error = None;
    for slug in [base.clone(), format!("{base}-{}", base36(now))] {
        let row = (
            title.clone(),
            summary.clone(),
            js::trim(&input.description).to_owned(),
            js::trim(&input.origin).to_owned(),
            input.safety_level.clone(),
            input.category.clone(),
            input.difficulty.clone(),
            input.origin_year,
            input.usage_context.to_string(),
            submitter.clone(),
            slug,
        );
        let inserted = as_operator(
            &state,
            &actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query_scalar::<_, String>(
                        r#"INSERT INTO "public"."memes" ("moderation_status", "title", "summary", "description", "origin", "safety_level", "category", "difficulty", "origin_year", "usage_context", "submitted_by", "slug")
                           VALUES ('pending', $1, $2, $3, $4, $5::public.safety_level, $6::public.meme_category, $7::public.meme_difficulty, $8::bigint, $9::jsonb, $10::uuid, $11) RETURNING "id"::text"#,
                    )
                    .bind(row.0)
                    .bind(row.1)
                    .bind(row.2)
                    .bind(row.3)
                    .bind(row.4)
                    .bind(row.5)
                    .bind(row.6)
                    // node-pg sends the number as text and the planner types it bigint:
                    // 2025.5 is refused as Next refuses it.
                    .bind(row.7.map(crate::routes::js_json::number))
                    .bind(row.8)
                    .bind(row.9)
                    .bind(row.10)
                    .fetch_one(tx)
                    .await
                })
            }),
        )
        .await;
        match inserted {
            Ok(id) => {
                meme_id = Some(id);
                insert_error = None;
                break;
            }
            Err(error) => {
                let unique = matches!(&error, sqlx::Error::Database(db) if db.code().as_deref() == Some("23505"));
                insert_error = Some(super::db_message(&error));
                if !unique {
                    break;
                }
            }
        }
    }
    let Some(meme_id) = meme_id else {
        return fail(insert_error.as_deref().unwrap_or("밈 생성에 실패했어요."));
    };
    if let Some(url) = source_url.as_deref().filter(|url| !url.is_empty()) {
        let platform = url::Url::parse(url)
            .ok()
            .and_then(|url| {
                url.host_str()
                    .map(|host| host.strip_prefix("www.").unwrap_or(host).to_owned())
            })
            .unwrap_or_else(|| "web".to_owned());
        let (meme, source) = (meme_id.clone(), url.to_owned());
        let stored = as_operator(
            &state,
            &actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query(r#"INSERT INTO "public"."meme_sources" ("meme_id", "platform", "source_url") VALUES ($1::uuid, $2, $3)"#)
                        .bind(meme)
                        .bind(platform)
                        .bind(source)
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            }),
        )
        .await;
        if stored.is_err() {
            return approval_failed(
                &format!(
                    "출처 저장에 실패해 생성된 밈을 대기 상태로 유지했어요. 승인을 다시 실행하지 말고 밈 관리에서 출처를 저장하고 검수를 이어서 처리해 주세요. (밈 ID: {meme_id})"
                ),
                &meme_id,
            );
        }
    }
    for step in ["fact_checking", "rights_checking", "approved"] {
        let meme = meme_id.clone();
        let moved = as_operator(
            &state,
            &actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query(r#"UPDATE "public"."memes" SET "moderation_status" = $1::public.moderation_status, "updated_at" = now() WHERE "id" = $2::uuid"#)
                        .bind(step)
                        .bind(meme)
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            }),
        )
        .await;
        if moved.is_err() {
            return approval_failed(
                &format!(
                    "밈은 생성됐지만 상태 전이({step})에 실패했어요. 다시 승인하지 말고 밈 관리에서 상태를 확인하고 검수를 이어서 처리해 주세요. (밈 ID: {meme_id})"
                ),
                &meme_id,
            );
        }
    }
    if let Some(url) = source_url.as_deref().filter(|url| !url.is_empty()) {
        representative_embed(&state, &actor, &meme_id, url).await;
    }
    for raw in &input.tags {
        let name = js::trim(raw).to_owned();
        if !name.is_empty() {
            tag(&state, &actor, &meme_id, name).await;
        }
    }
    finish_approval(&state, &actor, &input.submission_id, &meme_id, &title).await
}

/// `isSupportedOEmbedUrl`: the hosts `getOEmbed` knows.
fn is_supported_oembed_url(raw: &str) -> bool {
    use crate::oembed::target::is_host;
    let Ok(url) = url::Url::parse(raw) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default().to_lowercase();
    [
        "youtube.com",
        "youtu.be",
        "tiktok.com",
        "instagram.com",
        "facebook.com",
        "threads.net",
        "threads.com",
    ]
    .iter()
    .any(|domain| is_host(&host, domain))
        || host == "fb.watch"
}

/// The representative embed of a supported platform's link (`getOEmbed`,
/// R11's shared client), the platform's own player and no copy of the file.
/// A failure of the platform or of the insert leaves the approval as it is.
async fn representative_embed(
    state: &AppState,
    actor: &crate::auth::SessionUser,
    meme_id: &str,
    url: &str,
) {
    if !is_supported_oembed_url(url) {
        return;
    }
    let Ok(embed) = state.oembed.get(url).await else {
        return;
    };
    let title = embed
        .title
        .as_ref()
        .map(|title| String::from_utf16_lossy(title.units()));
    let args = (
        meme_id.to_owned(),
        embed.provider.as_str().to_owned(),
        embed.content_id.clone(),
        embed.source_url.clone(),
        title,
    );
    let inserted = as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"INSERT INTO "public"."meme_contents" ("meme_id", "platform", "content_id", "type", "url", "caption", "availability", "moderation_status", "is_representative")
                       VALUES ($1::uuid, $2, $3, 'embed', $4, $5, 'live', 'approved', true)"#,
                )
                .bind(args.0)
                .bind(args.1)
                .bind(args.2)
                .bind(args.3)
                .bind(args.4)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
    if let Err(error) = inserted {
        tracing::warn!(error = %super::db_message(&error), "representative embed not stored");
    }
}

/// One tag: found by name or created, then mapped to the meme; every
/// statement on its own and every failure ignored, as in the TypeScript.
async fn tag(state: &AppState, actor: &crate::auth::SessionUser, meme_id: &str, name: String) {
    let lookup = name.clone();
    let existing: Option<String> = as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar(r#"SELECT "id"::text FROM "public"."tags" WHERE "name" = $1"#)
                    .bind(lookup)
                    .fetch_optional(tx)
                    .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    let tag_id = match existing {
        Some(id) => Some(id),
        None => as_operator(
            state,
            actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query_scalar::<_, String>(
                        r#"INSERT INTO "public"."tags" ("name") VALUES ($1) RETURNING "id"::text"#,
                    )
                    .bind(name)
                    .fetch_one(tx)
                    .await
                })
            }),
        )
        .await
        .ok(),
    };
    let Some(tag_id) = tag_id else {
        return;
    };
    let meme = meme_id.to_owned();
    let _ = as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"INSERT INTO "public"."meme_tags_map" ("meme_id", "tag_id") VALUES ($1::uuid, $2::uuid)
                       ON CONFLICT ("meme_id", "tag_id") DO UPDATE SET "meme_id" = excluded."meme_id", "tag_id" = excluded."tag_id""#,
                )
                .bind(meme)
                .bind(tag_id)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await;
}

/// The steps after the meme is public: the submission's status and the
/// audit row (their failures become the warning), the cache, the answer.
async fn finish_approval(
    state: &AppState,
    actor: &crate::auth::SessionUser,
    submission_id: &str,
    meme_id: &str,
    title: &str,
) -> Response {
    let mut reconciliation: Vec<&str> = Vec::new();
    let id = submission_id.to_owned();
    let updated: Result<Option<String>, sqlx::Error> = as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar(
                    r#"UPDATE "public"."meme_submissions" SET "status" = 'approved', "updated_at" = now() WHERE "id" = $1::uuid RETURNING "id"::text"#,
                )
                .bind(id)
                .fetch_optional(tx)
                .await
            })
        }),
    )
    .await;
    let pending = !matches!(updated, Ok(Some(_)));
    if pending {
        reconciliation.push("제보 상태 저장");
        tracing::error!(
            submission_id,
            meme_id,
            step = "submission_status",
            "submission_approval_reconciliation_pending"
        );
    }
    let detail = serde_json::json!({ "meme_id": meme_id, "title": title, "submission_status_update_pending": pending });
    if log_audit(
        state,
        &actor.id,
        "submission.approve",
        "meme_submission",
        Some(submission_id),
        Some(detail),
    )
    .await
    .is_err()
    {
        reconciliation.push("감사 기록 저장");
        tracing::error!(
            submission_id,
            meme_id,
            step = "audit",
            "submission_approval_reconciliation_pending"
        );
    }
    crate::pages::expire_public(state);
    // The newly public meme's URLs, after the answer; never its outcome.
    super::indexnow::schedule(state, actor, meme_id);
    let mut data = serde_json::Map::new();
    data.insert("memeId".to_owned(), serde_json::Value::from(meme_id));
    if !reconciliation.is_empty() {
        data.insert(
            "warning".to_owned(),
            serde_json::Value::from(format!(
                "밈은 이미 게시됐지만 {}에 실패했어요. 다시 승인하지 말고 제보와 밈 관리에서 저장 상태를 확인해 주세요. (제보 ID: {submission_id}, 밈 ID: {meme_id})",
                reconciliation.join(" 및 ")
            )),
        );
    }
    super::ok_with(serde_json::Value::Object(data))
}
