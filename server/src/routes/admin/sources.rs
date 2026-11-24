//! `reviewMemeSource` of `lib/actions/admin-sources.ts`: a pending candidate
//! of the media ledger is rejected with a note, or approved as a public
//! source link (and an official embed unless it is link-only). An approval
//! expires the public pages (`revalidateTag` of the catalog and count tags,
//! `revalidatePath("/global")`).

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::json;

use super::submissions::trimmed;
use super::{as_operator, call, db_message, fail, log_audit, ok};
use crate::AppState;

const SOURCE_ROLES: [&str; 5] = [
    "original",
    "official_reupload",
    "earliest_known",
    "secondary_reference",
    "usage_example",
];
const RIGHTS_BASIS: [&str; 7] = [
    "official_embed",
    "creator_permission",
    "creative_commons",
    "public_data",
    "link_only",
    "unknown",
    "blocked",
];

/// `DISPLAY_PLATFORM_LABELS[platform] ?? "web"`.
fn display_platform(platform: &str) -> &'static str {
    match platform {
        "youtube" => "YouTube",
        "youtube_shorts" => "YouTube Shorts",
        "tiktok" => "TikTok",
        "instagram" => "Instagram",
        "broadcast_archive" => "방송 아카이브",
        "public_archive" => "공공 아카이브",
        _ => "web",
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewInput {
    meme_id: String,
    source_id: String,
    decision: String,
    source_role: Option<String>,
    rights_basis: Option<String>,
    note: Option<String>,
}

type Candidate = (
    String,
    Option<String>,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<bool>,
    Option<String>,
    bool,
    Option<String>,
);

/// `reviewMemeSource(input)`.
pub async fn review(State(state): State<AppState>, request: Request) -> Response {
    let call = match call::<ReviewInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let (actor, input) = (call.actor, call.input);
    let note = trimmed(input.note.clone());
    let (meme, source) = (input.meme_id.clone(), input.source_id.clone());
    let row: Option<Candidate> = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select mm.review_state, s.id::text, s.platform, s.canonical_url, s.external_id, s.title, s.embeddable, s.channel_name, s.removed_at is not null, s.thumbnail_url \
                     from public.meme_media mm left join public.media_sources s on s.id = mm.source_id \
                     where mm.meme_id = $1::uuid and mm.source_id = $2::uuid",
                )
                .bind(meme)
                .bind(source)
                .fetch_optional(tx)
                .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    let Some((
        review_state,
        source_id,
        platform,
        canonical_url,
        external_id,
        title,
        embeddable,
        channel_name,
        removed,
        thumbnail,
    )) = row
    else {
        return fail("검수 대상을 찾을 수 없어요.");
    };
    if review_state != "pending" {
        return fail("이미 처리된 후보예요.");
    }
    if source_id.is_none() {
        return fail("출처 정보를 찾을 수 없어요.");
    }
    let entity = format!("{}:{}", input.meme_id, input.source_id);
    let ledger = |state_value: &'static str, role: Option<String>, basis: Option<String>| {
        let (meme, source, note) = (input.meme_id.clone(), input.source_id.clone(), note.clone());
        as_operator(
            &state,
            &actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    let sql = if role.is_some() {
                        r#"UPDATE "public"."meme_media" SET "review_state" = $1, "source_role" = $4, "rights_basis" = $5, "reviewer_note" = $2, "reviewed_at" = now() WHERE "meme_id" = $3::uuid AND "source_id" = $6::uuid"#
                    } else {
                        r#"UPDATE "public"."meme_media" SET "review_state" = $1, "reviewer_note" = $2, "reviewed_at" = now() WHERE "meme_id" = $3::uuid AND "source_id" = $6::uuid AND ($4::text IS NULL) AND ($5::text IS NULL)"#
                    };
                    sqlx::query(sql)
                        .bind(state_value)
                        .bind(note)
                        .bind(meme)
                        .bind(role)
                        .bind(basis)
                        .bind(source)
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            }),
        )
    };
    if input.decision == "reject" {
        if note.is_none() {
            return fail("반려 사유를 입력해 주세요.");
        }
        if let Err(error) = ledger("rejected", None, None).await {
            return fail(&db_message(&error));
        }
        let _ = log_audit(
            &state,
            &actor.id,
            "source.reject",
            "meme_media",
            Some(&entity),
            Some(json!({ "note": note })),
        )
        .await;
        return ok();
    }
    let Some(role) = input
        .source_role
        .clone()
        .filter(|role| SOURCE_ROLES.contains(&role.as_str()))
    else {
        return fail("출처 역할을 선택해 주세요.");
    };
    let Some(basis) = input
        .rights_basis
        .clone()
        .filter(|basis| RIGHTS_BASIS.contains(&basis.as_str()))
    else {
        return fail("권리 근거를 선택해 주세요.");
    };
    if basis == "blocked" || basis == "unknown" {
        return fail(
            "권리가 확인되지 않은 출처는 승인할 수 없어요. 링크만 허용하거나 반려해 주세요.",
        );
    }
    if role == "original" && basis == "link_only" {
        return fail(
            "링크만 허용된 출처를 원본으로 표시할 수 없어요. 최초 확인 출처로 승인해 주세요.",
        );
    }
    if removed {
        return fail("삭제된 출처예요. 대체 출처를 등록해 주세요.");
    }
    let link_only = basis == "link_only";
    if !link_only && embeddable == Some(false) {
        return fail("임베드가 불가한 출처예요. 링크만 허용으로 승인해 주세요.");
    }
    if let Err(error) = ledger("approved", Some(role.clone()), Some(basis.clone())).await {
        return fail(&db_message(&error));
    }
    let shown = display_platform(&platform);
    // The source link, unless the meme already has it.
    let (meme, url) = (input.meme_id.clone(), canonical_url.clone());
    let existing: Option<String> = as_operator(
        &state,
        &actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar(r#"SELECT "id"::text FROM "public"."meme_sources" WHERE "meme_id" = $1::uuid AND "source_url" = $2"#)
                    .bind(meme)
                    .bind(url)
                    .fetch_optional(tx)
                    .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    if existing.is_none() {
        let values = (
            input.meme_id.clone(),
            shown,
            canonical_url.clone(),
            title.clone(),
            channel_name,
            link_only,
            role.clone(),
            basis.clone(),
        );
        let inserted = as_operator(
            &state,
            &actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query(
                        r#"INSERT INTO "public"."meme_sources" ("meme_id", "platform", "source_url", "title", "creator_name", "copyright_status", "source_role", "rights_basis")
                           VALUES ($1::uuid, $2, $3, $4, $5, CASE WHEN $6 THEN 'unknown' ELSE 'embeddable' END::public.copyright_status, $7, $8)"#,
                    )
                    .bind(values.0)
                    .bind(values.1)
                    .bind(values.2)
                    .bind(values.3)
                    .bind(values.4)
                    .bind(values.5)
                    .bind(values.6)
                    .bind(values.7)
                    .execute(tx)
                    .await
                    .map(|_| ())
                })
            }),
        )
        .await;
        if let Err(error) = inserted {
            return fail(&format!("출처 링크 게시 실패: {}", db_message(&error)));
        }
    }
    if let (false, Some(external_id)) = (link_only, external_id)
        && let Err(message) = embed(
            &state,
            &actor,
            &input.meme_id,
            shown,
            &external_id,
            &canonical_url,
            title,
            thumbnail,
        )
        .await
    {
        return fail(&message);
    }
    let detail = json!({ "source_role": role, "rights_basis": basis, "link_only": link_only });
    let _ = log_audit(
        &state,
        &actor.id,
        "source.approve",
        "meme_media",
        Some(&entity),
        Some(detail),
    )
    .await;
    crate::pages::expire_public(&state);
    ok()
}

/// The official embed: made live again if the meme has it, inserted if not.
#[allow(clippy::too_many_arguments)]
async fn embed(
    state: &AppState,
    actor: &crate::auth::SessionUser,
    meme_id: &str,
    platform: &'static str,
    external_id: &str,
    url: &str,
    title: Option<String>,
    thumbnail: Option<String>,
) -> Result<(), String> {
    let (meme, content) = (meme_id.to_owned(), external_id.to_owned());
    let existing: Option<String> = as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query_scalar(
                    r#"SELECT "id"::text FROM "public"."meme_contents" WHERE "meme_id" = $1::uuid AND "type" = 'embed' AND "platform" = $2 AND "content_id" = $3"#,
                )
                .bind(meme)
                .bind(platform)
                .bind(content)
                .fetch_optional(tx)
                .await
            })
        }),
    )
    .await
    .ok()
    .flatten();
    if let Some(id) = existing {
        let _ = as_operator(
            state,
            actor,
            Box::new(move |tx| {
                Box::pin(async move {
                    sqlx::query(r#"UPDATE "public"."meme_contents" SET "availability" = 'live', "moderation_status" = 'approved' WHERE "id" = $1::uuid"#)
                        .bind(id)
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            }),
        )
        .await;
        return Ok(());
    }
    let values = (
        meme_id.to_owned(),
        platform,
        external_id.to_owned(),
        url.to_owned(),
        title,
        thumbnail,
    );
    as_operator(
        state,
        actor,
        Box::new(move |tx| {
            Box::pin(async move {
                sqlx::query(
                    r#"INSERT INTO "public"."meme_contents" ("meme_id", "type", "platform", "content_id", "url", "thumbnail_url", "caption", "is_representative", "availability", "moderation_status")
                       VALUES ($1::uuid, 'embed', $2, $3, $4, $6, $5, false, 'live', 'approved')"#,
                )
                .bind(values.0)
                .bind(values.1)
                .bind(values.2)
                .bind(values.3)
                .bind(values.4)
                .bind(values.5)
                .execute(tx)
                .await
                .map(|_| ())
            })
        }),
    )
    .await
    .map_err(|error| format!("임베드 게시 실패: {}", db_message(&error)))
}
