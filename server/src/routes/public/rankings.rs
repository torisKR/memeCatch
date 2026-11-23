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

#[derive(Deserialize)]
struct RankedMeme {
    trend_score: Option<f64>,
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

/// The indexable rows of one ranking read (`omitThinMemes`).
async fn load_indexable(db: &Db, sql: &'static str) -> Result<Vec<RankedMeme>, sqlx::Error> {
    let rows: Vec<RankedMeme> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let rows = sqlx::query_scalar(sql)
                    .persistent(false)
                    .bind("approved")
                    .bind(SCAN_LIMIT)
                    .fetch_all(tx)
                    .await?;
                parse_rows(rows)
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

/// Whether the page renders a list, and whether Next would keep that answer
/// (it does not keep an outage: the published read failed too).
async fn read_visibility(db: &Db) -> (bool, bool) {
    match load_indexable(db, TREND_SQL).await {
        Ok(trend) if trend_is_usable(&trend) => return (true, true),
        Ok(_) => {}
        Err(error) => log_failure("live query failed", &error),
    }
    match load_indexable(db, PUBLISHED_SQL).await {
        Ok(published) => (
            published.len().min(PUBLISHED_ROWS) >= MIN_LISTING_CARDS,
            true,
        ),
        Err(error) => {
            log_failure("published fallback failed", &error);
            (false, false)
        }
    }
}

/// The answer and when it was read. One per server, as the module variable
/// in the TypeScript is.
#[derive(Default)]
pub struct RankingsVisibility(Mutex<Option<(i64, bool)>>);

impl RankingsVisibility {
    /// `koreanRankingsVisible()`. `now_ms` is `Date.now()`.
    pub async fn visible(&self, db: &Db, now_ms: i64) -> bool {
        if let Some((at, visible)) = *self.lock()
            && now_ms - at < CACHE_MS
        {
            return visible;
        }
        let (visible, keep) = read_visibility(db).await;
        if keep {
            *self.lock() = Some((now_ms, visible));
        }
        visible
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Option<(i64, bool)>> {
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
        RankedMeme {
            trend_score,
            description: String::new(),
            origin: String::new(),
            usage_note: None,
            caution: None,
            usage_examples: None,
            meme_sources: Vec::new(),
            meme_contents: Vec::new(),
            meme_tags_map: Vec::new(),
        }
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
