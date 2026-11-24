//! The meme editors' actions of `lib/actions/admin.ts`:
//! `createHouseOriginal` (`/admin/memes/new`). Each runs as the operator's
//! session; the audit rows are `service_role`'s (`logAudit`).

use axum::extract::{Request, State};
use axum::response::Response;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use time::OffsetDateTime;

use super::submissions::slugify;
use super::{Call, as_operator, call, db_message, fail, log_audit};
use crate::AppState;
use crate::auth::SessionUser;
use crate::pages::admin::format;
use crate::routes::js_json;
use crate::routes::public::{js, labels};
use crate::routes::studio::meme_country;

pub const HOUSE_ORIGINAL: &str = "house_original";

/// `houseOriginalOriginScratchError()`.
pub const SCRATCH_ERROR: &str = "제작 경위에 검수·게시 과정 메모가 들어가 있어요. 게스트에게 보이는 문장이니, 밈캐치가 어떻게 만들었는지만 적어 주세요.";
const SCRATCH_MARKERS: [&str; 6] = [
    "게시는 하지 않았다",
    "pending으로 저장",
    "사실 확인·권리 확인",
    "권리 확인·게시는",
    "moderation_status",
    "house_rights_attested",
];

/// `houseOriginalOriginLooksLikeOperatorScratch`.
pub fn looks_like_scratch(text: &str) -> bool {
    let t = js::collapse_spaces(text);
    if js::trim(&t).is_empty() {
        return false;
    }
    SCRATCH_MARKERS.iter().any(|marker| t.contains(marker))
        || t.contains("게시는 하지")
        || t.contains("게시는하지")
        || (t.to_lowercase().contains("pending") && t.contains("저장"))
        || (t.contains("사실 확인") && t.contains("권리 확인"))
}

/// `houseOriginalPublishErrorMessage(raw)`.
pub fn publish_error(raw: &str) -> String {
    let known = [
        (
            "house_rights_attestation_required",
            "자체 제작 권리 확인에 동의해 주세요.",
        ),
        (
            "house_original_rights_required",
            "자체 제작 권리 근거(원본·제작 허가 출처)가 없어 게시할 수 없어요.",
        ),
        (
            "house_original_insert_not_pending",
            "자체 제작 밈은 대기 상태로만 만들 수 있어요.",
        ),
        (
            "house_original_origin_kind_immutable",
            "자체 제작 구분은 만든 뒤에 바꿀 수 없어요.",
        ),
        (
            "house_original_required",
            "이 전이는 자체 제작 밈에만 쓸 수 있어요.",
        ),
        (
            "invalid moderation transition",
            "허용되지 않는 상태 전이예요. 현재 상태를 다시 확인해 주세요.",
        ),
    ];
    known
        .iter()
        .find(|(code, _)| raw.contains(code))
        .map_or_else(|| raw.to_owned(), |(_, message)| (*message).to_owned())
}

/// A JSON value as node-pg binds it (`bindValue`): an object or array as its
/// JSON text, a string as itself, `null` as NULL.
pub fn bound(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(js_json::number(number.as_f64().unwrap_or(f64::NAN))),
        Value::Bool(flag) => Some(flag.to_string()),
        other => Some(other.to_string()),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HouseOriginalInput {
    title: String,
    summary: String,
    description: String,
    origin: String,
    safety_level: Value,
    category: Value,
    difficulty: Value,
    #[serde(default)]
    origin_year: Value,
    #[serde(default)]
    usage_context: Value,
    country: Value,
    #[serde(default)]
    local_title: Option<String>,
}

type Args = Vec<Option<String>>;

async fn statement(
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

const INSERT_MEME: &str = "insert into public.memes (title, summary, description, origin, safety_level, category, difficulty, origin_year, usage_context, origin_kind, moderation_status, slug) \
     values ($1, $2, $3, $4, $5::public.safety_level, $6::public.meme_category, $7::public.meme_difficulty, $8::bigint, $9::jsonb, $10, 'pending', $11) returning id::text, short_id, slug";

/// `createHouseOriginal(input)`: a pending house original, its own rights
/// source and its origin-country profile.
pub async fn create_house_original(State(state): State<AppState>, request: Request) -> Response {
    let Call { actor, input } = match call::<HouseOriginalInput>(&state, request).await {
        Ok(call) => call,
        Err(refused) => return refused,
    };
    let title = js::trim(&input.title);
    if title.is_empty() {
        return fail("제목을 입력해 주세요.");
    }
    if js::trim(&input.summary).is_empty() {
        return fail("한 줄 요약을 입력해 주세요.");
    }
    let Some(country) = input.country.as_str().and_then(meme_country) else {
        return fail("밈 국가를 확인해 주세요.");
    };
    if looks_like_scratch(&input.origin) || looks_like_scratch(&input.description) {
        return fail(SCRATCH_ERROR);
    }
    let base: Args = vec![
        Some(title.to_owned()),
        Some(js::trim(&input.summary).to_owned()),
        Some(js::trim(&input.description).to_owned()),
        Some(js::trim(&input.origin).to_owned()),
        bound(&input.safety_level),
        bound(&input.category),
        bound(&input.difficulty),
        bound(&input.origin_year),
        // node-pg writes any value bound to a jsonb column as its JSON text.
        (!input.usage_context.is_null()).then(|| input.usage_context.to_string()),
        Some(HOUSE_ORIGINAL.to_owned()),
    ];
    let first = slugify(&input.title);
    let retry = format!(
        "{first}-{}",
        base36(OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000)
    );
    let mut created: Option<(String, String, String)> = None;
    let mut insert_error = String::from("밈 생성에 실패했어요.");
    for slug in [first, retry] {
        let mut args = base.clone();
        args.push(Some(slug));
        match statement(&state, &actor, INSERT_MEME, args).await {
            Ok(rows) => {
                if let Some(row) = rows.first() {
                    created = Some((
                        row.try_get(0).unwrap_or_default(),
                        row.try_get(1).unwrap_or_default(),
                        row.try_get(2).unwrap_or_default(),
                    ));
                }
                break;
            }
            Err(error) => {
                insert_error = db_message(&error);
                let duplicate = matches!(&error, sqlx::Error::Database(database) if database.code().as_deref() == Some("23505"));
                if !duplicate {
                    break;
                }
            }
        }
    }
    let Some((id, short_id, slug)) = created else {
        return fail(&publish_error(&insert_error));
    };
    let source_url = format!(
        "{}{}",
        labels::site_url(&state.config.site_url),
        labels::meme_path(&short_id, &slug)
    );
    if let Err(error) = statement(
        &state,
        &actor,
        "insert into public.meme_sources (meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis) \
         values ($1::uuid, 'catchmeme', $2, '밈캐치 자체 제작', 'CatchMeme', 'embeddable', 'original', 'creator_permission')",
        vec![Some(id.clone()), Some(source_url)],
    )
    .await
    {
        return fail(&format!(
            "자체 제작 항목은 만들어졌지만 권리 출처 연결에 실패했어요: {} — 밈 관리에서 이어서 처리해 주세요. (id: {id})",
            db_message(&error)
        ));
    }
    let local_title = input
        .local_title
        .as_deref()
        .map(js::trim)
        .filter(|local| !local.is_empty())
        .unwrap_or(title);
    if let Err(error) = statement(
        &state,
        &actor,
        "insert into public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at, reviewed_by) \
         values ($1::uuid, $2, $3, 'origin', $4, 'reviewed', $5::timestamptz, $6::uuid)",
        vec![
            Some(id.clone()),
            Some(country.code.to_owned()),
            Some(country.language_tag.to_owned()),
            Some(local_title.to_owned()),
            Some(format::iso(OffsetDateTime::now_utc())),
            Some(actor.id.clone()),
        ],
    )
    .await
    {
        return fail(&format!(
            "자체 제작 항목과 권리 출처는 만들어졌지만 국가 프로필 연결에 실패했어요: {} — 밈 관리에서 이어서 처리해 주세요. (id: {id})",
            db_message(&error)
        ));
    }
    let detail = json!({ "title": title, "origin_kind": HOUSE_ORIGINAL, "moderation_status": "pending", "country": country.code });
    if let Err(message) = log_audit(
        &state,
        &actor.id,
        "meme.create_house_original",
        "meme",
        Some(&id),
        Some(detail),
    )
    .await
    {
        return fail(message);
    }
    super::ok_with(json!({ "memeId": id }))
}

/// `n.toString(36)` for a non-negative integer.
fn base36(mut value: i128) -> String {
    const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if value <= 0 {
        return "0".to_owned();
    }
    let mut out = Vec::new();
    while value > 0 {
        out.push(DIGITS[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operator_scratch_is_told_from_make_copy() {
        assert!(looks_like_scratch("게시는  하지 않았어요"));
        assert!(looks_like_scratch("PENDING 상태로 저장했어요"));
        assert!(looks_like_scratch("사실 확인과 권리 확인을 했어요"));
        assert!(!looks_like_scratch("밈캐치가 직접 만든 문구예요"));
        assert!(!looks_like_scratch("   "));
        assert_eq!(base36(1_700_000_000_000), "loyw3v28");
    }
}
