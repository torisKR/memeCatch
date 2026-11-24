//! What a share card says, read as the TypeScript reads it:
//!
//! - Korean (`loadKoreanShareCard`, `resolveKoreanMemeDocument`): the public
//!   row of the short id behind an alias, its media from a fresh snapshot
//!   (`getKoreanMediaSnapshot`, as the anonymous visitor, each row checked);
//!   else the curated card of that id, else (only when the catalog could not
//!   be read) the curated card of the key's id or slug.
//! - Translated (`getLocalizedMemeByShortId`): the row of the short id (no
//!   alias), its reviewed translation in that locale, kept only when it is
//!   current, complete and of an indexable Korean source.
//! - The photo (`getReviewedMemeMediaSources`, as `service_role`, then
//!   `representativeImageUrl`).
//!
//! The meme row and the translations are read on every request.

use serde::Deserialize;
use serde_json::Value;

use super::photo_ref::{SiteHosts, representative_image_url};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::og::share_card::{Locale, ShareCard};
use crate::routes::public::content_depth::{self, ContentRef, DepthInput, SourceRef};
use crate::routes::public::meme_delivery::{PreviewContent, ReviewedMediaSource};
use crate::routes::public::{js, js_date};

const PUBLIC_STATUSES: [&str; 2] = ["approved", "limited"];
// CANONICAL_MEME_ALIAS_MAP in lib/canonical-meme-path.ts.
const ALIASES: [(&str, &str); 2] = [("cssqxwmb", "gnact78h"), ("9ajbp6w6", "gnact78h")];

const MEME_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."title", r1."summary", r1."origin_year", r1."category", r1."updated_at", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2.* FROM public."meme_contents" r2 WHERE r2."meme_id" = r1."id") e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3.* FROM public."meme_sources" r3 WHERE r3."meme_id" = r1."id") e) AS "meme_sources", (SELECT count(*) FROM public."meme_tags_map" r4 WHERE r4."meme_id" = r1."id") AS "tag_count" FROM public."memes" r1 WHERE r1."short_id" = $1 AND r1."moderation_status"::text = ANY($2::text[]) LIMIT 1) SELECT row_to_json(__q)::text FROM __q"#;
const SNAPSHOT_SQL: &str = r#"WITH __q AS (SELECT r1."id", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2.* FROM public."meme_contents" r2 WHERE r2."meme_id" = r1."id") e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3.* FROM public."meme_sources" r3 WHERE r3."meme_id" = r1."id") e) AS "meme_sources" FROM public."memes" r1 WHERE r1."id" = $1::uuid AND r1."moderation_status"::text = ANY($2::text[]) LIMIT 1) SELECT row_to_json(__q)::text FROM __q"#;
const LEDGER_SQL: &str = r#"WITH __q AS (SELECT r1."review_state", r1."rights_basis", (SELECT row_to_json(e) FROM (SELECT r2."platform", r2."external_id", r2."canonical_url", r2."embeddable", r2."public_status", r2."removed_at", r2."last_checked_at" FROM public."media_sources" r2 WHERE r2."id" = r1."source_id") e) AS "media_sources" FROM public."meme_media" r1 WHERE r1."meme_id" = $1::uuid AND EXISTS (SELECT 1 FROM public."media_sources" r3 WHERE r3."id" = r1."source_id")) SELECT row_to_json(__q)::text FROM __q"#;
const TRANSLATIONS_SQL: &str = r#"WITH __q AS (SELECT r1."meme_id", r1."locale", r1."status", r1."title", r1."summary", r1."description", r1."origin", r1."source_updated_at" FROM public."meme_translations" r1 WHERE r1."meme_id" = $1::uuid AND r1."status" = $2) SELECT row_to_json(__q)::text FROM __q"#;

/// A card and the still it would show.
#[derive(Debug, Clone, PartialEq)]
pub struct ShareContent {
    pub card: ShareCard,
    pub photo: Option<String>,
}

#[derive(Deserialize)]
struct MemeRow {
    id: String,
    title: String,
    summary: Option<String>,
    origin_year: Option<i64>,
    category: Option<String>,
    updated_at: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: Option<Value>,
    meme_contents: Vec<Value>,
    meme_sources: Vec<SourceRef>,
    tag_count: i64,
}

/// `categoryOrNull`.
fn category(value: Option<&str>) -> Option<String> {
    const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
    value.filter(|c| CATEGORIES.contains(c)).map(str::to_owned)
}

/// `blankToNull`.
fn blank_to_none(value: Option<&str>) -> Option<String> {
    value
        .map(js::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

/// `cardFromFields`.
pub fn card_from_fields(
    locale: Locale,
    title: &str,
    summary: Option<&str>,
    year: Option<i64>,
    kind: Option<&str>,
) -> Option<ShareCard> {
    Some(ShareCard {
        locale,
        title: blank_to_none(Some(title))?,
        summary: blank_to_none(summary),
        year,
        category: category(kind),
    })
}

/// A bind parameter: text, or the public moderation statuses.
enum Bind {
    Text(String),
    Statuses,
}

async fn rows(
    db: &Db,
    identity: DbIdentity,
    sql: &'static str,
    binds: Vec<Bind>,
) -> Result<Vec<String>, sqlx::Error> {
    db.with_identity(&identity, IdentityOptions::default(), move |tx| {
        Box::pin(async move {
            let mut query = sqlx::query_scalar::<_, String>(sql).persistent(false);
            for bind in binds {
                query = match bind {
                    Bind::Text(text) => query.bind(text),
                    Bind::Statuses => query.bind(PUBLIC_STATUSES.map(str::to_owned).to_vec()),
                };
            }
            query.fetch_all(tx).await
        })
    })
    .await
}

fn decode<T: for<'de> Deserialize<'de>>(text: &str) -> Result<T, sqlx::Error> {
    serde_json::from_str(text).map_err(|error| sqlx::Error::Decode(Box::new(error)))
}

/// `getMemeByShortId`: the public row, `Ok(None)` for none or an empty id.
async fn meme(db: &Db, short_id: &str) -> Result<Option<MemeRow>, sqlx::Error> {
    if short_id.is_empty() {
        return Ok(None);
    }
    let found = rows(
        db,
        DbIdentity::anon(),
        MEME_SQL,
        vec![Bind::Text(short_id.to_owned()), Bind::Statuses],
    )
    .await?;
    found.first().map(|text| decode(text)).transpose()
}

/// `getKoreanMediaSnapshot`.
enum Snapshot {
    Contents(Vec<Value>),
    NotPublic,
    Unavailable,
}

fn nullable_string(row: &Value, key: &str) -> bool {
    matches!(row.get(key), Some(Value::Null | Value::String(_)))
}

/// `validContent(row, memeId)`.
fn valid_content(row: &Value, meme_id: &str) -> bool {
    let text = |key: &str| row.get(key).and_then(Value::as_str);
    row.is_object()
        && text("id").is_some()
        && text("meme_id") == Some(meme_id)
        && text("type").is_some_and(|t| ["image", "video", "audio", "text", "embed"].contains(&t))
        && text("availability")
            .is_some_and(|a| ["live", "dead", "region_blocked", "unchecked"].contains(&a))
        && text("moderation_status") == Some("approved")
        && row.get("is_representative").is_some_and(Value::is_boolean)
        && row
            .get("manual_video_verified")
            .is_some_and(Value::is_boolean)
        && ["platform", "content_id", "url", "thumbnail_url", "caption"]
            .iter()
            .all(|k| nullable_string(row, k))
}

async fn snapshot(db: &Db, meme_id: &str) -> Snapshot {
    let found = rows(
        db,
        DbIdentity::anon(),
        SNAPSHOT_SQL,
        vec![Bind::Text(meme_id.to_owned()), Bind::Statuses],
    )
    .await;
    let Ok(found) = found else {
        return Snapshot::Unavailable;
    };
    let Some(text) = found.first() else {
        return Snapshot::NotPublic;
    };
    let Ok(row) = serde_json::from_str::<Value>(text) else {
        return Snapshot::Unavailable;
    };
    let contents = row["meme_contents"].as_array().cloned().unwrap_or_default();
    let sources_ok = row["meme_sources"].as_array().is_some_and(|sources| {
        sources.iter().all(|s| {
            s.get("meme_id").and_then(Value::as_str) == Some(meme_id)
                && nullable_string(s, "source_url")
        })
    });
    let valid = row["id"].as_str() == Some(meme_id)
        && row["meme_contents"].is_array()
        && contents.iter().all(|c| valid_content(c, meme_id))
        && sources_ok;
    if valid {
        Snapshot::Contents(contents)
    } else {
        Snapshot::Unavailable
    }
}

#[derive(Deserialize)]
struct LedgerRow {
    review_state: String,
    rights_basis: String,
    media_sources: Option<LedgerSource>,
}

#[derive(Deserialize)]
struct LedgerSource {
    platform: String,
    external_id: Option<String>,
    canonical_url: String,
    embeddable: Option<bool>,
    public_status: Option<String>,
    removed_at: Option<String>,
    last_checked_at: Option<String>,
}

/// `getReviewedMemeMediaSources`: `None` when it answers `ok: false`.
async fn reviewed_sources(db: &Db, meme_id: &str) -> Option<Vec<ReviewedMediaSource>> {
    let found = rows(
        db,
        DbIdentity::service_role(),
        LEDGER_SQL,
        vec![Bind::Text(meme_id.to_owned())],
    )
    .await
    .ok()?;
    found
        .iter()
        .map(|text| {
            let row: LedgerRow = serde_json::from_str(text).ok()?;
            let source = row.media_sources?;
            Some(ReviewedMediaSource {
                review_state: row.review_state,
                rights_basis: row.rights_basis,
                platform: source.platform,
                external_id: source.external_id,
                canonical_url: source.canonical_url,
                embeddable: source.embeddable,
                public_status: source.public_status,
                removed_at: source.removed_at,
                last_checked_at: source.last_checked_at,
            })
            .filter(ReviewedMediaSource::is_valid)
        })
        .collect()
}

/// `withRepresentativePhoto` / the photo of the translated card.
async fn photo_of(
    db: &Db,
    meme_id: &str,
    contents: &[Value],
    hosts: &SiteHosts,
    now_ms: i64,
) -> Option<String> {
    let sources = reviewed_sources(db, meme_id).await?;
    let contents: Vec<PreviewContent> = contents
        .iter()
        .map(|c| serde_json::from_value(c.clone()))
        .collect::<Result<_, _>>()
        .ok()?;
    representative_image_url(&contents, &sources, now_ms, hosts)
}

/// `CURATED_CORE_MEMES`: `(short id, slug, title, summary, year)`; all are
/// phrases.
const CURATED: [(&str, &str, &str, &str, i64); 8] = [
    (
        "jkm2022k",
        "jung-kkuk-ma",
        "중요한 건 꺾이지 않는 마음 (중꺾마)",
        "어떤 역경과 실패에도 끝까지 포기하지 않고 도전하는 굳은 의지를 격려할 때 쓰는 대표적인 긍정 밈.",
        2022,
    ),
    (
        "fmc2022k",
        "form-crazy",
        "폼 미쳤다",
        "특정인의 뛰어난 역량, 센스 넘치는 퍼포먼스, 혹은 음식·작품의 대단한 퀄리티를 극찬할 때 쓰는 감탄 표현.",
        2022,
    ),
    (
        "oyj2021k",
        "ohiryeo-joha",
        "오히려 좋아",
        "예상치 못한 불운이나 계획의 어긋남을 긍정적인 반전 기회로 유쾌하게 받아들이는 마인드셋 밈.",
        2021,
    ),
    (
        "nmd2022k",
        "ne-mwo-dwae",
        "너 뭐 돼?",
        "분수에 넘치게 거들먹거리거나 잘난 척하는 상대를 향해 날리는 날카로운 조롱 및 반박 표현.",
        2022,
    ),
    (
        "mng2022k",
        "mal-noon-gwang",
        "맑은 눈의 광인 (맑눈광)",
        "겉으로는 순진하고 맑은 눈빛을 띠고 있으나, 속으로는 예측 불가능한 집착과 광기를 품은 인물을 지칭하는 밈.",
        2022,
    ),
    (
        "bjk2021k",
        "bun-jo-ka",
        "분좋카 (분위기 좋은 카페)",
        "감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.",
        2021,
    ),
    (
        "gnact78h",
        "hidink-hungry",
        "히딩크 '나는 아직 배가 고프다'",
        "큰 성과나 목표를 달성한 뒤에도 결코 자만하지 않고 더 큰 성취를 향해 나아가겠다는 프로페셔널한 명언 밈.",
        2002,
    ),
    (
        "okk2020k",
        "eok-kka",
        "억까 (억지 까기)",
        "정당한 이유 없이 억지로 트집을 잡아 비난하거나, 불합리할 정도로 지독한 불운이 겹칠 때 쓰는 밈.",
        2020,
    ),
];

/// `cardFromCurated`.
fn curated_card(short_id: &str) -> Option<ShareContent> {
    let (_, _, title, summary, year) = CURATED.iter().find(|entry| entry.0 == short_id)?;
    let card = card_from_fields(
        Locale::Ko,
        title,
        Some(summary),
        Some(*year),
        Some("phrase"),
    )?;
    Some(ShareContent { card, photo: None })
}

/// `findCuratedByShareKey(key)` for a key already decoded once: its id, else
/// its slug after the first `-`.
fn curated_by_share_key(key: &str) -> Option<ShareContent> {
    let decoded =
        crate::routes::request::decode_uri_component(key).unwrap_or_else(|| key.to_owned());
    let (short_id, slug) = decoded.split_once('-').unwrap_or((&decoded, ""));
    curated_card(short_id).or_else(|| {
        let by_slug = CURATED
            .iter()
            .find(|entry| !slug.is_empty() && entry.1 == slug)?;
        curated_card(by_slug.0)
    })
}

/// `shortIdFromParam`.
pub fn short_id_from_param(key: &str) -> String {
    let decoded = crate::routes::request::decode_uri_component(key);
    decoded
        .as_deref()
        .unwrap_or(key)
        .split('-')
        .next()
        .unwrap_or_default()
        .to_owned()
}

/// `loadKoreanShareCard(key)`.
pub async fn korean(db: &Db, key: &str, hosts: &SiteHosts, now_ms: i64) -> Option<ShareContent> {
    let requested = short_id_from_param(key);
    let target = ALIASES
        .iter()
        .find(|(alias, _)| *alias == requested)
        .map_or(requested.as_str(), |(_, to)| to);
    match meme(db, target).await {
        Ok(Some(row)) => {
            let contents = match snapshot(db, &row.id).await {
                Snapshot::NotPublic => return None,
                Snapshot::Unavailable => Vec::new(),
                Snapshot::Contents(contents) => contents,
            };
            let card = card_from_fields(
                Locale::Ko,
                &row.title,
                row.summary.as_deref(),
                row.origin_year,
                row.category.as_deref(),
            )?;
            let photo = photo_of(db, &row.id, &contents, hosts, now_ms).await;
            Some(ShareContent { card, photo })
        }
        Ok(None) => curated_card(target),
        Err(_) => curated_card(target).or_else(|| curated_by_share_key(key)),
    }
}

#[derive(Deserialize)]
struct TranslationRow {
    meme_id: String,
    locale: String,
    status: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
    source_updated_at: String,
}

impl MemeRow {
    /// `isIndexableMeme` of the Korean original.
    fn indexable(&self) -> bool {
        let contents: Vec<ContentRef> = self
            .meme_contents
            .iter()
            .filter_map(|c| serde_json::from_value(c.clone()).ok())
            .collect();
        content_depth::is_indexable(&DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: self.usage_note.as_deref(),
            caution: self.caution.as_deref(),
            usage_examples: self.usage_examples.as_ref(),
            sources: &self.meme_sources,
            contents: &contents,
            tag_count: usize::try_from(self.tag_count).unwrap_or_default(),
        })
    }
}

/// `overlayMemeTranslation` then `isIndexableLocalizedMeme`.
fn localized(meme: &MemeRow, row: &TranslationRow, locale: &str) -> bool {
    let same =
        |a: &str, b: &str| js_date::parse_ms(a).is_some_and(|ms| js_date::parse_ms(b) == Some(ms));
    row.meme_id == meme.id
        && row.locale == locale
        && row.status == "reviewed"
        && same(&row.source_updated_at, &meme.updated_at)
        && [&row.title, &row.summary, &row.description, &row.origin]
            .iter()
            .all(|t| !js::trim(t).is_empty())
        && meme.indexable()
}

/// `getLocalizedMemeByShortId` and the card of the locale route. `Err`
/// where the TypeScript throws (a failed read): the route's own fallback.
pub async fn translated(
    db: &Db,
    key: &str,
    locale: Locale,
    hosts: &SiteHosts,
    now_ms: i64,
) -> Result<Option<ShareContent>, sqlx::Error> {
    let Some(meme) = meme(db, &short_id_from_param(key)).await? else {
        return Ok(None);
    };
    let found = rows(
        db,
        DbIdentity::anon(),
        TRANSLATIONS_SQL,
        vec![
            Bind::Text(meme.id.clone()),
            Bind::Text("reviewed".to_owned()),
        ],
    )
    .await?;
    let translations: Vec<TranslationRow> =
        found.iter().map(|t| decode(t)).collect::<Result<_, _>>()?;
    let Some(row) = translations.iter().find(|row| row.locale == locale.code()) else {
        return Ok(None);
    };
    if !localized(&meme, row, locale.code()) {
        return Ok(None);
    }
    let card = card_from_fields(
        locale,
        &row.title,
        Some(&row.summary),
        meme.origin_year,
        meme.category.as_deref(),
    );
    let photo = photo_of(db, &meme.id, &meme.meme_contents, hosts, now_ms).await;
    Ok(card.map(|card| ShareContent { card, photo }))
}
