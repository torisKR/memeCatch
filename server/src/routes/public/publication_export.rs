//! Port of `lib/publication-export.ts`: the Korean discovery corpus the feeds
//! and the llms exports list. Approved and limited memes are the candidates,
//! read a thousand at a time as the anonymous visitor (`createStaticClient`);
//! the approved ones that pass `isIndexableMeme` are exported.
//!
//! The SQL is what `lib/db/execute.ts` compiles for these queries, and it is
//! sent unprepared, as node-pg sends it, so Postgres plans it the same way.
//! One statement selects the columns of all four callers: the order is total
//! (`id` breaks ties), so the extra columns change no result.

use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, RETRY_AFTER};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde::de::{DeserializeOwned, IgnoredAny};
use serde_json::Value;

use super::content_depth::{self, ContentRef, DepthInput, SourceRef};
use crate::db::{Db, DbIdentity, IdentityOptions};

const PAGE_SIZE: i32 = 1_000;
const MAX_CANDIDATES: i32 = 50_000;
/// The statuses a public reader may see (`["approved", "limited"]`).
pub const PUBLIC_STATUSES: [&str; 2] = ["approved", "limited"];

/// The three embedded relations the indexability gate reads, as the planner
/// writes them for a `memes` row aliased `r1`.
macro_rules! depth_embeds {
    () => {
        concat!(
            r#"(SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."source_url", r2."hidden_from_public" FROM public."meme_sources" r2 WHERE r2."meme_id" = r1."id" AND TRUE) e) AS "meme_sources", "#,
            r#"(SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3."availability", r3."moderation_status" FROM public."meme_contents" r3 WHERE r3."meme_id" = r1."id" AND TRUE) e) AS "meme_contents", "#,
            r#"(SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r4."tag_id" FROM public."meme_tags_map" r4 WHERE r4."meme_id" = r1."id" AND TRUE) e) AS "meme_tags_map""#
        )
    };
}
pub(super) use depth_embeds;

macro_rules! export_sql {
    ($order:literal) => {
        concat!(
            r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."category", r1."origin_year", r1."published_at", r1."updated_at", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", r1."aliases", r1."safety_level", r1."moderation_status", "#,
            depth_embeds!(),
            r#" FROM public."memes" r1 WHERE r1."moderation_status"::text = ANY($1::text[]) ORDER BY "#,
            $order,
            r#", r1."id" DESC LIMIT $2::int OFFSET $3::int) SELECT row_to_json(__q)::text FROM __q"#
        )
    };
}

/// `primaryOrder`. `trend_score` is ordered without a nulls clause and the
/// two dates with `nullsFirst: false`, as in the TypeScript.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PrimaryOrder {
    PublishedAt,
    UpdatedAt,
    TrendScore,
}

impl PrimaryOrder {
    fn sql(self) -> &'static str {
        match self {
            Self::PublishedAt => export_sql!(r#"r1."published_at" DESC NULLS LAST"#),
            Self::UpdatedAt => export_sql!(r#"r1."updated_at" DESC NULLS LAST"#),
            Self::TrendScore => export_sql!(r#"r1."trend_score" DESC"#),
        }
    }
}

/// One candidate row. Timestamps are the text Postgres writes into JSON.
#[derive(Debug, Deserialize)]
pub struct ExportRow {
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub category: String,
    pub origin_year: Option<i64>,
    pub published_at: Option<String>,
    pub updated_at: String,
    pub description: String,
    pub origin: String,
    pub usage_note: Option<String>,
    pub caution: Option<String>,
    pub usage_examples: Option<Value>,
    pub aliases: Vec<Option<String>>,
    pub safety_level: String,
    moderation_status: String,
    meme_sources: Vec<SourceRef>,
    meme_contents: Vec<ContentRef>,
    meme_tags_map: Vec<IgnoredAny>,
}

impl ExportRow {
    fn is_exported(&self) -> bool {
        self.moderation_status == "approved"
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

/// `PublicationExportError`.
#[derive(Debug)]
pub enum ExportError {
    Query { offset: i32, error: sqlx::Error },
    ScanBound,
}

impl std::fmt::Display for ExportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Query { offset, error } => {
                write!(
                    f,
                    "Publication export query failed at offset {offset}: {error}"
                )
            }
            Self::ScanBound => f.write_str("Publication export exceeded the 50,000-row scan bound"),
        }
    }
}

/// Each JSON text a query returned, as a row. A row that does not have the
/// expected shape fails the query, as an error from Postgres would.
pub fn parse_rows<T: DeserializeOwned>(rows: Vec<String>) -> Result<Vec<T>, sqlx::Error> {
    rows.iter()
        .map(|row| serde_json::from_str(row).map_err(|error| sqlx::Error::Decode(Box::new(error))))
        .collect()
}

async fn load_page(
    db: &Db,
    order: PrimaryOrder,
    offset: i32,
) -> Result<Vec<ExportRow>, sqlx::Error> {
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            let rows = sqlx::query_scalar(order.sql())
                .persistent(false)
                .bind(PUBLIC_STATUSES.map(str::to_owned).to_vec())
                .bind(PAGE_SIZE)
                .bind(offset)
                .fetch_all(tx)
                .await?;
            parse_rows(rows)
        })
    })
    .await
}

/// `loadApprovedIndexableMemes`: the first `limit` exported rows in `order`,
/// and how many rows were exportable among those scanned. With `count_all`
/// the scan runs to the end of the corpus, so the count is the whole of it.
pub async fn load_approved_indexable(
    db: &Db,
    order: PrimaryOrder,
    limit: usize,
    count_all: bool,
) -> Result<(Vec<ExportRow>, usize), ExportError> {
    let mut rows = Vec::new();
    let mut eligible_count = 0;
    let mut offset = 0;
    while offset < MAX_CANDIDATES {
        let page = load_page(db, order, offset)
            .await
            .map_err(|error| ExportError::Query { offset, error })?;
        let page_len = page.len();
        for meme in page.into_iter().filter(ExportRow::is_exported) {
            eligible_count += 1;
            if rows.len() < limit {
                rows.push(meme);
            }
        }
        if (!count_all && rows.len() >= limit) || page_len < PAGE_SIZE as usize {
            return Ok((rows, eligible_count));
        }
        offset += PAGE_SIZE;
    }
    Err(ExportError::ScanBound)
}

/// `publicationExportUnavailableResponse`.
pub fn unavailable_response() -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        [
            (CONTENT_TYPE, "text/plain; charset=utf-8"),
            (CACHE_CONTROL, "no-store"),
            (RETRY_AFTER, "300"),
        ],
        "Publication export temporarily unavailable.\n",
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_statements_are_the_ones_the_typescript_planner_compiles() {
        // The statement lib/db/execute.ts sent for the /llms-full.txt query
        // (captured with pg's query logged), with the three columns that
        // route does not select added and `::text` on the outer row.
        assert_eq!(
            PrimaryOrder::TrendScore.sql(),
            r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."category", r1."origin_year", r1."published_at", r1."updated_at", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", r1."aliases", r1."safety_level", r1."moderation_status", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."source_url", r2."hidden_from_public" FROM public."meme_sources" r2 WHERE r2."meme_id" = r1."id" AND TRUE) e) AS "meme_sources", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3."availability", r3."moderation_status" FROM public."meme_contents" r3 WHERE r3."meme_id" = r1."id" AND TRUE) e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r4."tag_id" FROM public."meme_tags_map" r4 WHERE r4."meme_id" = r1."id" AND TRUE) e) AS "meme_tags_map" FROM public."memes" r1 WHERE r1."moderation_status"::text = ANY($1::text[]) ORDER BY r1."trend_score" DESC, r1."id" DESC LIMIT $2::int OFFSET $3::int) SELECT row_to_json(__q)::text FROM __q"#
        );
        assert!(
            PrimaryOrder::PublishedAt
                .sql()
                .contains(r#"ORDER BY r1."published_at" DESC NULLS LAST, r1."id" DESC LIMIT"#)
        );
        assert!(
            PrimaryOrder::UpdatedAt
                .sql()
                .contains(r#"ORDER BY r1."updated_at" DESC NULLS LAST, r1."id" DESC LIMIT"#)
        );
    }

    #[test]
    fn a_row_of_the_wrong_shape_fails_the_whole_query() {
        let rows = vec![r#"{"short_id": 3}"#.to_owned()];

        assert!(parse_rows::<ExportRow>(rows).is_err());
    }
}
