//! `koreanRankingsVisible` of `lib/korean-rankings.server.ts`: whether the
//! rankings page will render a list. `/llms.txt` links the page only then.
//!
//! The TypeScript builds the whole page model and asks whether it is a list.
//! Only that answer is needed here, and it reduces to: the trend read is
//! usable, or the published fallback holds at least three indexable memes.
//! The "comeback" side list the page also loads cannot change the answer, so
//! it is not read.
//!
//! Next keeps the model for 60 seconds in a module variable that the rankings
//! page and the sitemap share. This keeps the answer for 60 seconds on its
//! own, so within a minute of a change the two servers can disagree.

use std::sync::Mutex;

use serde::Deserialize;
use serde::de::IgnoredAny;
use serde_json::Value;

use super::content_depth::{self, ContentRef, DepthInput, SourceRef};
use super::publication_export::{depth_embeds, parse_rows};
use crate::db::{Db, DbIdentity, IdentityOptions};

/// `NAV_TTL_MS`.
const CACHE_MS: i64 = 60_000;
/// `indexableScanLimit(30)` and `indexableScanLimit(20)`: both 400.
const SCAN_LIMIT: i32 = 400;
/// `trendIsUsable`: at least this many indexable rows, one with a score.
const MIN_TREND_ROWS: usize = 10;
/// The published fallback keeps this many indexable rows (`.slice(0, 20)`).
const PUBLISHED_ROWS: usize = 20;
/// `MIN_PUBLIC_LISTING_CARDS` in lib/thin-meme.ts.
const MIN_LISTING_CARDS: usize = 3;

// What lib/db/execute.ts compiles for `loadTrendMemes` and
// `loadPublishedMemes`, except `$1::moderation_status`: node-pg sends the
// status untyped and Postgres takes it for the enum; sqlx sends it as text.
macro_rules! ranking_sql {
    ($filter_and_order:literal) => {
        concat!(
            r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."safety_level", r1."lifecycle_status", r1."trend_score", r1."published_at", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", "#,
            depth_embeds!(),
            r#" FROM public."memes" r1 WHERE r1."moderation_status" = $1::moderation_status"#,
            $filter_and_order,
            r#" LIMIT $2::int) SELECT row_to_json(__q)::text FROM __q"#
        )
    };
}
const TREND_SQL: &str = ranking_sql!(r#" ORDER BY r1."trend_score" DESC"#);
const PUBLISHED_SQL: &str = ranking_sql!(
    r#" AND r1."published_at" IS NOT NULL ORDER BY r1."published_at" DESC NULLS LAST"#
);

const COMEBACK_SQL: &str = ranking_sql!(
    r#" AND r1."published_at" < $3::timestamptz AND r1."trend_score" > 0 ORDER BY r1."trend_score" DESC"#
);
/// `loadComeback`: memes published more than this long ago.
const COMEBACK_AGE_DAYS: i64 = 90;
/// `rankToday` and the comeback list keep this many.
const LIST_ROWS: usize = 20;
/// The fallback of a live board with too little trend: `published.slice(0, 12)`.
const FALLBACK_ROWS: usize = 12;

/// `PublicRankingMeme` with what `isThinMeme` reads.
#[derive(Clone, Deserialize)]
pub struct RankedMeme {
    pub id: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: Option<String>,
    pub safety_level: String,
    pub lifecycle_status: String,
    pub trend_score: Option<f64>,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: Option<Value>,
    meme_sources: Vec<SourceRef>,
    meme_contents: Vec<ContentRef>,
    meme_tags_map: Vec<IgnoredAny>,
}

impl RankedMeme {
    /// `!isThinMeme(meme)`.
    fn is_indexable(&self) -> bool {
        content_depth::is_indexable(&DepthInput {
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

/// `KoreanRankings`.
#[derive(Clone)]
pub enum Rankings {
    /// The live board: a fallback list while trend is too thin, or the
    /// today and comeback tabs (the weekly tab is always empty).
    Live {
        fallback: Option<Vec<RankedMeme>>,
        today: Vec<RankedMeme>,
        comeback: Vec<RankedMeme>,
    },
    Published(Vec<RankedMeme>),
    Unavailable,
    Outage,
}

impl Rankings {
    /// `koreanRankingsRenderList`.
    pub fn renders_list(&self) -> bool {
        matches!(self, Self::Live { .. } | Self::Published(_))
    }
}

/// The indexable rows of one ranking read (`omitThinMemes`).
async fn load_indexable(
    db: &Db,
    sql: &'static str,
    cutoff: Option<String>,
) -> Result<Vec<RankedMeme>, sqlx::Error> {
    let rows: Vec<RankedMeme> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut query = sqlx::query_scalar(sql)
                    .persistent(false)
                    .bind("approved")
                    .bind(SCAN_LIMIT);
                if let Some(cutoff) = cutoff {
                    query = query.bind(cutoff);
                }
                parse_rows(query.fetch_all(tx).await?)
            })
        })
        .await?;
    Ok(rows.into_iter().filter(RankedMeme::is_indexable).collect())
}

/// `logRankingsFailure`: never the connection string.
fn log_failure(scope: &str, error: &sqlx::Error) {
    let message = error.to_string();
    let lower = message.to_lowercase();
    let safe = if lower.contains("postgres://")
        || lower.contains("postgresql://")
        || lower.contains("password")
    {
        "database unavailable".to_owned()
    } else {
        message.chars().take(180).collect()
    };
    tracing::error!("[rankings] {scope}: {safe}");
}

/// `trendIsUsable`.
fn trend_is_usable(memes: &[RankedMeme]) -> bool {
    memes.len() >= MIN_TREND_ROWS
        && memes
            .iter()
            .any(|meme| meme.trend_score.unwrap_or(0.0) > 0.0)
}

/// The first `count`.
fn first(memes: Vec<RankedMeme>, count: usize) -> Vec<RankedMeme> {
    memes.into_iter().take(count).collect()
}

/// `rankToday`: rising first, then by trend; a stable sort keeps the rest.
fn rank_today(mut memes: Vec<RankedMeme>) -> Vec<RankedMeme> {
    memes.sort_by(|a, b| {
        let rising = |meme: &RankedMeme| u8::from(meme.lifecycle_status != "rising");
        rising(a).cmp(&rising(b)).then(
            b.trend_score
                .unwrap_or(0.0)
                .total_cmp(&a.trend_score.unwrap_or(0.0)),
        )
    });
    first(memes, LIST_ROWS)
}

/// `loadComeback`: an error is an empty side list.
async fn comeback(db: &Db, now_ms: i64) -> Vec<RankedMeme> {
    let cutoff_ms = now_ms - COMEBACK_AGE_DAYS * 86_400_000;
    let cutoff = time::OffsetDateTime::from_unix_timestamp_nanos(i128::from(cutoff_ms) * 1_000_000)
        .ok()
        .and_then(|at| {
            at.format(&time::format_description::well_known::Rfc3339)
                .ok()
        })
        .unwrap_or_default();
    match load_indexable(db, COMEBACK_SQL, Some(cutoff)).await {
        Ok(memes) => {
            let memes = first(memes, LIST_ROWS);
            if memes.len() >= MIN_LISTING_CARDS {
                memes
            } else {
                Vec::new()
            }
        }
        Err(error) => {
            log_failure("comeback query failed", &error);
            Vec::new()
        }
    }
}

/// `loadKoreanRankings` without its cache.
async fn read(db: &Db, now_ms: i64) -> Rankings {
    let trend = match load_indexable(db, TREND_SQL, None).await {
        Ok(trend) => Some(trend),
        Err(error) => {
            log_failure("live query failed", &error);
            None
        }
    };
    if let Some(trend) = &trend
        && trend_is_usable(trend)
    {
        return Rankings::Live {
            fallback: None,
            today: rank_today(trend.clone()),
            comeback: comeback(db, now_ms).await,
        };
    }
    let published = match load_indexable(db, PUBLISHED_SQL, None).await {
        Ok(published) => Some(first(published, PUBLISHED_ROWS)),
        Err(error) => {
            log_failure("published fallback failed", &error);
            None
        }
    };
    let listing = |memes: &Vec<RankedMeme>| memes.len() >= MIN_LISTING_CARDS;
    // Trend was read but is too thin: the newest memes as the live fallback.
    if trend.is_some()
        && let Some(published) = published.as_ref().filter(|memes| listing(memes))
    {
        return Rankings::Live {
            fallback: Some(first(published.clone(), FALLBACK_ROWS)),
            today: Vec::new(),
            comeback: Vec::new(),
        };
    }
    match published {
        Some(published) if listing(&published) => Rankings::Published(published),
        None if trend.is_none() => Rankings::Outage,
        _ => Rankings::Unavailable,
    }
}

/// The board and when it was read. One per server, as the module variable
/// of the TypeScript is: the page, `/llms.txt` and the sitemap share it.
#[derive(Default)]
pub struct RankingsVisibility(Mutex<Option<(i64, Rankings)>>);

impl RankingsVisibility {
    /// `loadKoreanRankings()`. An outage is not kept. `now_ms` is `Date.now()`.
    pub async fn rankings(&self, db: &Db, now_ms: i64) -> Rankings {
        if let Some((at, rankings)) = self.lock().as_ref()
            && now_ms - at < CACHE_MS
        {
            return rankings.clone();
        }
        let rankings = read(db, now_ms).await;
        if !matches!(rankings, Rankings::Outage) {
            *self.lock() = Some((now_ms, rankings.clone()));
        }
        rankings
    }

    /// `koreanRankingsVisible()`.
    pub async fn visible(&self, db: &Db, now_ms: i64) -> bool {
        self.rankings(db, now_ms).await.renders_list()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Option<(i64, Rankings)>> {
        // The value is replaced whole, so a poisoned lock still holds one.
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meme(trend_score: Option<f64>) -> RankedMeme {
        serde_json::from_value(serde_json::json!({
            "id": "1", "short_id": "s", "slug": "s", "title": "t", "summary": null,
            "safety_level": "green", "lifecycle_status": "active", "trend_score": trend_score,
            "description": "", "origin": "", "usage_note": null, "caution": null,
            "usage_examples": null, "meme_sources": [], "meme_contents": [], "meme_tags_map": [],
        }))
        .unwrap()
    }

    #[test]
    fn trend_needs_ten_rows_and_one_positive_score() {
        let mut memes: Vec<RankedMeme> = (0..9).map(|_| meme(Some(1.0))).collect();
        assert!(!trend_is_usable(&memes));

        memes.push(meme(None));
        assert!(trend_is_usable(&memes));

        let scoreless: Vec<RankedMeme> =
            (0..10).map(|n| meme((n % 2 == 0).then_some(0.0))).collect();
        assert!(!trend_is_usable(&scoreless));
    }

    #[test]
    fn statements_are_the_ones_the_typescript_planner_compiles() {
        assert!(TREND_SQL.ends_with(
            r#" FROM public."memes" r1 WHERE r1."moderation_status" = $1::moderation_status ORDER BY r1."trend_score" DESC LIMIT $2::int) SELECT row_to_json(__q)::text FROM __q"#
        ));
        assert!(PUBLISHED_SQL.ends_with(
            r#" WHERE r1."moderation_status" = $1::moderation_status AND r1."published_at" IS NOT NULL ORDER BY r1."published_at" DESC NULLS LAST LIMIT $2::int) SELECT row_to_json(__q)::text FROM __q"#
        ));
    }
}
