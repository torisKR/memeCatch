//! `getLocalizedFeaturedMemes` of `lib/meme-translations.ts`: the reviewed,
//! current translations of indexable Korean-origin memes that the localized
//! llms exports list. Read as the anonymous visitor (`createStaticClient`).
//!
//! Two things in the TypeScript are kept as they are:
//!
//! - Its `ORDER BY trend_score` lands on the embedded `memes` row, which is a
//!   single row, so the translations come back in whatever order Postgres
//!   reads them. The statement here is the one `lib/db/execute.ts` compiles,
//!   sent unprepared as node-pg sends it, so both servers get the same plan.
//! - A limited meme is listed when its translation is reviewed.
//!
//! One thing differs. Next keeps the set of indexable meme ids
//! (`loadDiscoveryIndex`) in its data cache for an hour and drops it when the
//! catalog is edited. This reads the set on every request. Every listed meme
//! is also checked against its current row, so the only visible difference is
//! that a meme which became indexable within the last hour is listed here
//! before Next lists it.

use std::collections::HashSet;

use serde::Deserialize;
use serde::de::IgnoredAny;
use serde_json::Value;

use super::content_depth::{self, ContentRef, DepthInput, SourceRef};
use super::publication_export::{PUBLIC_STATUSES, depth_embeds, parse_rows};
use super::{js, js_date};
use crate::db::{Db, DbIdentity, IdentityOptions};

const DISCOVERY_PAGE: i32 = 1_000;
const DISCOVERY_MAX_ROWS: i32 = 50_000;
/// `MEME_COUNTRIES` in lib/meme-country.ts.
const MEME_COUNTRIES: [&str; 10] = ["KR", "US", "JP", "GB", "BR", "MX", "CN", "TW", "DE", "FR"];

/// `FEATURED_SELECT` filtered by locale, status and the meme's status, as
/// `lib/db/execute.ts` compiles it. No top-level `ORDER BY`: see the module
/// comment.
const FEATURED_SQL: &str = r#"WITH __q AS (SELECT r1."meme_id", r1."locale", r1."status", r1."localized_slug", r1."title", r1."summary", r1."description", r1."origin", r1."usage_note", r1."caution", r1."aliases", r1."usage_examples", r1."source_updated_at", r1."provider", r1."model", r1."prompt_version", r1."translated_at", r1."reviewed_at", r1."reviewed_by", r1."created_at", r1."updated_at", (SELECT row_to_json(e) FROM (SELECT r2.*, (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3.* FROM public."meme_contents" r3 WHERE r3."meme_id" = r2."id" AND TRUE) e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r4.* FROM public."meme_sources" r4 WHERE r4."meme_id" = r2."id" AND TRUE) e) AS "meme_sources", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r5."tag_id", (SELECT row_to_json(e) FROM (SELECT r6."name" FROM public."tags" r6 WHERE r6."id" = r5."tag_id" AND TRUE) e) AS "tags" FROM public."meme_tags_map" r5 WHERE r5."meme_id" = r2."id" AND TRUE) e) AS "meme_tags_map", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r7."market_code", r7."role", r7."review_state" FROM public."meme_market_profiles" r7 WHERE r7."meme_id" = r2."id" AND TRUE) e) AS "meme_market_profiles" FROM public."memes" r2 WHERE r2."id" = r1."meme_id" AND r2."moderation_status"::text = ANY($1::text[]) ORDER BY r2."trend_score" DESC) e) AS "memes" FROM public."meme_translations" r1 WHERE r1."locale" = $2 AND r1."status" = $3 AND EXISTS (SELECT 1 FROM public."memes" r8 WHERE r8."id" = r1."meme_id" AND r8."moderation_status"::text = ANY($4::text[])) LIMIT $5::int) SELECT row_to_json(__q)::text FROM __q"#;

/// The page of `loadCachedDiscoveryIds` in lib/index-gate.server.ts.
const DISCOVERY_SQL: &str = concat!(
    r#"WITH __q AS (SELECT r1."id", r1."category", r1."origin_year", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", "#,
    depth_embeds!(),
    r#" FROM public."memes" r1 WHERE r1."moderation_status"::text = ANY($1::text[]) ORDER BY r1."id" ASC LIMIT $2::int OFFSET $3::int) SELECT row_to_json(__q)::text FROM __q"#
);

#[derive(Deserialize)]
struct MarketProfile {
    market_code: String,
    role: String,
    review_state: String,
}

/// The Korean meme a translation belongs to, with its relations.
#[derive(Deserialize)]
struct SourceMeme {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: Option<Value>,
    updated_at: String,
    meme_sources: Vec<SourceRef>,
    meme_contents: Vec<ContentRef>,
    meme_tags_map: Vec<IgnoredAny>,
    meme_market_profiles: Vec<MarketProfile>,
}

impl SourceMeme {
    fn depth(&self) -> DepthInput<'_> {
        DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: self.usage_note.as_deref(),
            caution: self.caution.as_deref(),
            usage_examples: self.usage_examples.as_ref(),
            sources: &self.meme_sources,
            contents: &self.meme_contents,
            tag_count: self.meme_tags_map.len(),
        }
    }

    /// `originCountryCode(profiles) === "KR"`: the first reviewed origin
    /// profile whose code is a known country decides.
    fn is_korean_origin(&self) -> bool {
        self.meme_market_profiles
            .iter()
            .filter(|profile| profile.role == "origin" && profile.review_state == "reviewed")
            .map(|profile| js::trim(&profile.market_code).to_uppercase())
            .find(|code| MEME_COUNTRIES.contains(&code.as_str()))
            .is_some_and(|code| code == "KR")
    }
}

/// One `meme_translations` row with its meme. A translation whose meme is
/// missing fails the read, as the `TypeError` does in the TypeScript.
#[derive(Deserialize)]
struct TranslationRow {
    meme_id: String,
    locale: String,
    status: String,
    localized_slug: Option<String>,
    title: String,
    summary: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    source_updated_at: String,
    updated_at: String,
    memes: SourceMeme,
}

/// `LocalizedMemeListItem`, with the fields the two exports print.
#[derive(Debug)]
pub struct LocalizedMeme {
    pub short_id: String,
    /// The localized slug, or the Korean one when that is blank.
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub description: String,
    pub origin: String,
    pub usage_note: Option<String>,
    pub caution: Option<String>,
    pub original_title: String,
    pub sources: Vec<SourceRef>,
    /// `translation.updatedAt`: the text Postgres wrote, printed as it is.
    pub translation_updated_at: String,
}

/// `isSameStoredRevision`: the same instant at JavaScript's millisecond
/// precision.
fn is_same_revision(left: &str, right: &str) -> bool {
    js_date::parse_ms(left).is_some_and(|ms| js_date::parse_ms(right) == Some(ms))
}

impl TranslationRow {
    /// `overlayMemeTranslation` when the row passes the checks of the loop in
    /// `getLocalizedFeaturedMemes`, the discovery index aside.
    fn into_listed(self, locale: &str) -> Option<LocalizedMeme> {
        let meme = &self.memes;
        let overlays = self.meme_id == meme.id && self.locale == locale;
        // `isIndexableLocalizedMeme`.
        let indexable = self.status == "reviewed"
            && is_same_revision(&self.source_updated_at, &meme.updated_at)
            && [&self.title, &self.summary, &self.description, &self.origin]
                .iter()
                .all(|text| !js::trim(text).is_empty())
            && content_depth::is_indexable(&meme.depth());
        if !(meme.is_korean_origin() && overlays && indexable) {
            return None;
        }
        let localized_slug = self
            .localized_slug
            .as_deref()
            .map(js::trim)
            .unwrap_or_default();
        Some(LocalizedMeme {
            slug: if localized_slug.is_empty() {
                self.memes.slug
            } else {
                localized_slug.to_owned()
            },
            short_id: self.memes.short_id,
            title: self.title,
            summary: self.summary,
            description: self.description,
            origin: self.origin,
            usage_note: self.usage_note,
            caution: self.caution,
            original_title: self.memes.title,
            sources: self.memes.meme_sources,
            translation_updated_at: self.updated_at,
        })
    }
}

async fn load_translations(
    db: &Db,
    locale: &'static str,
    limit: i32,
) -> Result<Vec<String>, sqlx::Error> {
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            let statuses = PUBLIC_STATUSES.map(str::to_owned).to_vec();
            sqlx::query_scalar(FEATURED_SQL)
                .persistent(false)
                .bind(statuses.clone())
                .bind(locale)
                .bind("reviewed")
                .bind(statuses)
                .bind(limit)
                .fetch_all(tx)
                .await
        })
    })
    .await
}

#[derive(Deserialize)]
struct DiscoveryRow {
    id: String,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: Option<Value>,
    meme_sources: Vec<SourceRef>,
    meme_contents: Vec<ContentRef>,
    meme_tags_map: Vec<IgnoredAny>,
}

impl DiscoveryRow {
    fn is_indexable(&self) -> bool {
        !self.id.is_empty()
            && content_depth::is_indexable(&DepthInput {
                description: &self.description,
                origin: &self.origin,
                usage_note: self.usage_note.as_deref(),
                caution: self.caution.as_deref(),
                usage_examples: self.usage_examples.as_ref(),
                sources: &self.meme_sources,
                contents: &self.meme_contents,
                tag_count: self.meme_tags_map.len(),
            })
    }
}

/// `loadCachedDiscoveryIds` without the cache: the ids of the public memes
/// that pass `isIndexableMeme`. It stops after 50,000 rows without an error,
/// as the TypeScript does.
async fn load_discovery_ids(db: &Db) -> Result<HashSet<String>, sqlx::Error> {
    let mut ids = HashSet::new();
    let mut offset = 0;
    while offset < DISCOVERY_MAX_ROWS {
        let page: Vec<DiscoveryRow> = db
            .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
                Box::pin(async move {
                    let rows = sqlx::query_scalar(DISCOVERY_SQL)
                        .persistent(false)
                        .bind(PUBLIC_STATUSES.map(str::to_owned).to_vec())
                        .bind(DISCOVERY_PAGE)
                        .bind(offset)
                        .fetch_all(tx)
                        .await?;
                    parse_rows(rows)
                })
            })
            .await?;
        let page_len = page.len();
        ids.extend(
            page.into_iter()
                .filter(DiscoveryRow::is_indexable)
                .map(|row| row.id),
        );
        if page_len < DISCOVERY_PAGE as usize {
            break;
        }
        offset += DISCOVERY_PAGE;
    }
    Ok(ids)
}

async fn featured(
    db: &Db,
    locale: &'static str,
    limit: usize,
) -> Result<Vec<LocalizedMeme>, sqlx::Error> {
    // `Math.min(Math.max(safeLimit * 8, 96), 1_200)`.
    let candidate_limit = (limit * 8).clamp(96, 1_200);
    let rows = load_translations(db, locale, candidate_limit as i32).await?;
    if rows.is_empty() {
        // The discovery index can only remove rows, and a failed read of it
        // answers with the same empty list.
        return Ok(Vec::new());
    }
    let discovery = load_discovery_ids(db).await?;
    let mut listed = Vec::new();
    // One row at a time: a candidate row carries every column of its meme.
    for row in rows {
        let row: TranslationRow =
            serde_json::from_str(&row).map_err(|error| sqlx::Error::Decode(Box::new(error)))?;
        if !discovery.contains(&row.memes.id) {
            continue;
        }
        if let Some(meme) = row.into_listed(locale) {
            listed.push(meme);
            if listed.len() == limit {
                break;
            }
        }
    }
    Ok(listed)
}

/// `getLocalizedFeaturedMemes(locale, limit)` for a translated locale and a
/// limit of at most 400. A failed read is an empty list, as in the
/// TypeScript.
pub async fn featured_memes(db: &Db, locale: &'static str, limit: usize) -> Vec<LocalizedMeme> {
    featured(db, locale, limit).await.unwrap_or_else(|error| {
        tracing::warn!(%error, locale, "localized featured memes not read");
        Vec::new()
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn row(change: impl FnOnce(&mut Value)) -> TranslationRow {
        let mut row = json!({
            "meme_id": "m1", "locale": "en", "status": "reviewed",
            "localized_slug": " en-slug ", "title": "Title", "summary": "Summary",
            "description": "Meaning", "origin": "Origin", "usage_note": null, "caution": null,
            "source_updated_at": "2026-03-04T05:06:07.654321+00:00",
            "updated_at": "2026-05-03T04:05:06.789012+00:00",
            "memes": {
                "id": "m1", "short_id": "r1aaaa01", "slug": "ko-slug", "title": "제목",
                "description": "가".repeat(400), "origin": "나".repeat(60),
                "usage_note": null, "caution": null, "usage_examples": null,
                "updated_at": "2026-03-04T05:06:07.654999+00:00",
                "meme_sources": [], "meme_contents": [], "meme_tags_map": [],
                "meme_market_profiles": [
                    { "market_code": "US", "role": "adopted", "review_state": "reviewed" },
                    { "market_code": " kr ", "role": "origin", "review_state": "reviewed" },
                ],
            },
        });
        change(&mut row);
        serde_json::from_value(row).unwrap()
    }

    #[test]
    fn a_current_reviewed_translation_of_a_korean_meme_is_listed() {
        let listed = row(|_| {}).into_listed("en").unwrap();

        // The stored revisions differ below the millisecond, which JavaScript
        // cannot see.
        assert_eq!(listed.slug, "en-slug");
        assert_eq!(listed.short_id, "r1aaaa01");
        assert_eq!(listed.original_title, "제목");
        assert_eq!(
            listed.translation_updated_at,
            "2026-05-03T04:05:06.789012+00:00"
        );
    }

    #[test]
    fn a_blank_localized_slug_falls_back_to_the_korean_slug() {
        let listed = row(|row| row["localized_slug"] = json!("  ")).into_listed("en");

        assert_eq!(listed.unwrap().slug, "ko-slug");
    }

    #[test]
    fn each_failed_check_leaves_the_translation_out() {
        type Change = fn(&mut Value);
        let cases: [(&str, Change); 8] = [
            ("another locale", |row| row["locale"] = json!("ja")),
            ("another meme", |row| row["meme_id"] = json!("m2")),
            ("not reviewed", |row| row["status"] = json!("machine")),
            ("stale by a millisecond", |row| {
                row["source_updated_at"] = json!("2026-03-04T05:06:07.653999+00:00");
            }),
            ("blank meaning", |row| row["description"] = json!(" \n ")),
            ("thin Korean source", |row| {
                row["memes"]["description"] = json!("짧음")
            }),
            ("origin elsewhere", |row| {
                row["memes"]["meme_market_profiles"][1]["market_code"] = json!("US");
            }),
            ("origin not reviewed", |row| {
                row["memes"]["meme_market_profiles"][1]["review_state"] = json!("pending");
            }),
        ];
        for (name, change) in cases {
            assert!(row(change).into_listed("en").is_none(), "{name}");
        }
    }

    #[test]
    fn an_unknown_origin_code_is_skipped_and_the_next_origin_decides() {
        let listed = row(|row| {
            row["memes"]["meme_market_profiles"] = json!([
                { "market_code": "XX", "role": "origin", "review_state": "reviewed" },
                { "market_code": "KR", "role": "origin", "review_state": "reviewed" },
            ]);
        });

        assert!(listed.into_listed("en").is_some());
    }

    #[test]
    fn a_translation_without_its_meme_fails_the_read() {
        let orphan = r#"{"meme_id":"m1","locale":"en","status":"reviewed","localized_slug":"s",
            "title":"t","summary":"s","description":"d","origin":"o","usage_note":null,
            "caution":null,"source_updated_at":"x","updated_at":"y","memes":null}"#;

        assert!(serde_json::from_str::<TranslationRow>(orphan).is_err());
    }
}
