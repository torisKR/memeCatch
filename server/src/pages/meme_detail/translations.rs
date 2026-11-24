//! `listIndexableLocalizedMemes(meme)` of lib/meme-translations.ts, as the
//! Korean meme page's metadata reads it: the reviewed translations that are
//! current (written from this revision of the meme) and complete. The page
//! links those of the four SEO languages with hreflang and Open Graph.
//!
//! The rows are read for each document (`PLAN.md` B3).

use sqlx::Row;

use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js_date;
use crate::routes::public::{js, labels::meme_path};

/// `fetchReviewedTranslationRows`, the columns the pages use.
const REVIEWED: &str = "\
select meme_id::text as meme_id, locale, status, localized_slug, title, summary, description, origin, \
       usage_note, caution, usage_examples::text as usage_examples, \
       to_json(source_updated_at) #>> '{}' as source_updated_at, \
       to_json(updated_at) #>> '{}' as updated_at \
  from public.meme_translations where meme_id = $1::uuid and status = 'reviewed'";

/// `SEO_LOCALE_CONFIG` of lib/i18n-routing.ts for the four languages a
/// meme document is translated into: hreflang and Open Graph locale.
const SEO_LOCALES: [(&str, &str, &str); 4] = [
    ("en", "en", "en_US"),
    ("ja", "ja", "ja_JP"),
    ("zh", "zh-Hans", "zh_CN"),
    ("zh-tw", "zh-Hant", "zh_TW"),
];

/// A translation the page links.
#[derive(Debug, PartialEq, Eq)]
pub struct Version {
    /// The edition: `en`, `ja`, `zh`, `zh-tw`.
    pub code: &'static str,
    pub hreflang: &'static str,
    pub open_graph: &'static str,
    /// `localizedMemePath(locale, short_id, slug)`.
    pub path: String,
}

/// The Korean row a translation must have been written from.
pub struct Original<'a> {
    pub id: &'a str,
    pub short_id: &'a str,
    pub slug: &'a str,
    pub updated_at: Option<&'a str>,
    /// The Korean document passes the index test.
    pub indexable: bool,
}

/// One reviewed `meme_translations` row.
pub struct Stored {
    pub meme_id: String,
    pub locale: String,
    pub status: String,
    pub localized_slug: String,
    /// Title, summary, description and origin.
    pub texts: [String; 4],
    pub usage_note: Option<String>,
    pub caution: Option<String>,
    pub usage_examples: serde_json::Value,
    pub source_updated_at: Option<String>,
    /// As Postgres writes a `timestamptz` into JSON.
    pub updated_at: Option<String>,
}

impl Stored {
    /// The localized slug, or the Korean one when it is blank.
    pub fn slug<'a>(&'a self, korean: &'a str) -> &'a str {
        match js::trim(&self.localized_slug) {
            "" => korean,
            slug => slug,
        }
    }
}

/// `isSameStoredRevision`: the same instant at JavaScript's millisecond precision.
fn same_revision(left: Option<&str>, right: Option<&str>) -> bool {
    let ms = |value: Option<&str>| value.and_then(js_date::parse_ms);
    ms(left).is_some() && ms(left) == ms(right)
}

/// `overlayMemeTranslation` then `isIndexableLocalizedMeme`, for one row.
pub fn version(original: &Original<'_>, row: &Stored) -> Option<Version> {
    let (code, hreflang, open_graph) = SEO_LOCALES
        .iter()
        .find(|(code, _, _)| *code == row.locale)?;
    let current = row.meme_id == original.id
        && row.status == "reviewed"
        && same_revision(row.source_updated_at.as_deref(), original.updated_at)
        && row.texts.iter().all(|text| !js::trim(text).is_empty())
        && original.indexable;
    if !current {
        return None;
    }
    Some(Version {
        code,
        hreflang,
        open_graph,
        path: format!(
            "/{}{}",
            row.locale,
            meme_path(original.short_id, row.slug(original.slug))
        ),
    })
}

/// The linked translations, in the order Postgres returns the rows. Empty
/// when the read fails (`MemeCatalogUnavailableError` is an empty list) or
/// the Korean document is not indexable (no alternates then).
pub async fn versions(db: &Db, original: &Original<'_>) -> Vec<Version> {
    if !original.indexable {
        return Vec::new();
    }
    let Ok(rows) = reviewed(db, original.id).await else {
        return Vec::new();
    };
    rows.iter()
        .filter_map(|row| version(original, row))
        .collect()
}

/// `fetchReviewedTranslationRows(memeId)`: every reviewed translation of the
/// meme, in the order Postgres returns them.
pub async fn reviewed(db: &Db, meme_id: &str) -> Result<Vec<Stored>, sqlx::Error> {
    let id = meme_id.to_owned();
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(REVIEWED).bind(id).fetch_all(tx).await })
        })
        .await?;
    rows.iter()
        .map(|row| {
            let text = |name: &str| -> Result<String, sqlx::Error> {
                Ok(row.try_get::<Option<String>, _>(name)?.unwrap_or_default())
            };
            Ok(Stored {
                meme_id: text("meme_id")?,
                locale: text("locale")?,
                status: text("status")?,
                localized_slug: text("localized_slug")?,
                texts: [
                    text("title")?,
                    text("summary")?,
                    text("description")?,
                    text("origin")?,
                ],
                usage_note: row.try_get("usage_note")?,
                caution: row.try_get("caution")?,
                usage_examples: row
                    .try_get::<Option<String>, _>("usage_examples")?
                    .and_then(|text| serde_json::from_str(&text).ok())
                    .unwrap_or(serde_json::Value::Null),
                source_updated_at: row.try_get("source_updated_at")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(locale: &str, source: &str, origin: &str) -> Stored {
        Stored {
            meme_id: "m".to_owned(),
            locale: locale.to_owned(),
            status: "reviewed".to_owned(),
            localized_slug: " passport ".to_owned(),
            texts: [
                "t".to_owned(),
                "s".to_owned(),
                "d".to_owned(),
                origin.to_owned(),
            ],
            usage_note: None,
            caution: None,
            usage_examples: serde_json::Value::Null,
            source_updated_at: Some(source.to_owned()),
            updated_at: None,
        }
    }

    #[test]
    fn only_a_current_complete_translation_of_an_indexable_document_is_linked() {
        let original = Original {
            id: "m",
            short_id: "pgpas006",
            slug: "parity-passport",
            updated_at: Some("2026-07-02T00:00:00+00:00"),
            indexable: true,
        };
        assert_eq!(
            version(
                &original,
                &row("zh-tw", "2026-07-02T00:00:00.000123+00:00", "o")
            ),
            Some(Version {
                code: "zh-tw",
                hreflang: "zh-Hant",
                open_graph: "zh_TW",
                path: "/zh-tw/memes/pgpas006-passport".to_owned()
            })
        );
        assert_eq!(
            version(&original, &row("en", "2026-06-01T00:00:00+00:00", "o")),
            None
        );
        assert_eq!(
            version(&original, &row("en", "2026-07-02T00:00:00+00:00", " ")),
            None
        );
        assert_eq!(
            version(&original, &row("ar", "2026-07-02T00:00:00+00:00", "o")),
            None
        );
        let thin = Original {
            indexable: false,
            ..original
        };
        assert_eq!(
            version(&thin, &row("en", "2026-07-02T00:00:00+00:00", "o")),
            None
        );
    }
}
