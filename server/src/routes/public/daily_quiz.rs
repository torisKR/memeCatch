//! `GET /api/daily-quiz`: `app/api/daily-quiz/route.ts`. The question itself
//! is built in `quiz.rs`.

use std::time::SystemTime;

use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

use super::quiz::{self, PoolMeme};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};

const POOL_SIZE: usize = 120;
// The enum columns are read as text, which is what row_to_json gives the
// TypeScript. $3 and $4 are the year bounds of /api/quiz (`origin_year >= $3`,
// `origin_year <= $4`); a null bound filters nothing, and this route passes
// none.
const POOL_AT_OR_AFTER: &str = "select short_id, slug, title, summary, category::text, origin_year, safety_level::text \
     from public.memes where moderation_status = 'approved' and short_id >= $1 \
     and ($3::int is null or origin_year >= $3) and ($4::int is null or origin_year <= $4) \
     order by short_id asc limit $2";
const POOL_BEFORE: &str = "select short_id, slug, title, summary, category::text, origin_year, safety_level::text \
     from public.memes where moderation_status = 'approved' and short_id < $1 \
     and ($3::int is null or origin_year >= $3) and ($4::int is null or origin_year <= $4) \
     order by short_id asc limit $2";

/// The `origin_year` bounds of a quiz mode, both inclusive. A meme without a
/// year matches no bound.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct YearRange {
    pub from: Option<i32>,
    pub to: Option<i32>,
}
const UNAVAILABLE: &str =
    r#"{"error":"오늘의 퀴즈를 불러오지 못했어요.","code":"DAILY_QUIZ_UNAVAILABLE"}"#;

pub async fn daily_quiz(State(state): State<AppState>) -> Response {
    let day = quiz::kst_day_key(SystemTime::now());
    let body = match pool(&state.db, &quiz::daily_pivot(&day)).await {
        Ok(pool) => quiz::daily_quiz_json(&day, &pool),
        Err(error) => {
            tracing::warn!(%error, "daily quiz pool query failed");
            None
        }
    };
    match body {
        Some(body) => (
            [
                (CONTENT_TYPE, "application/json"),
                (
                    CACHE_CONTROL,
                    "public, s-maxage=300, stale-while-revalidate=60",
                ),
            ],
            body,
        )
            .into_response(),
        // A failed query and a pool too small for a question answer alike.
        None => (
            StatusCode::BAD_GATEWAY,
            [
                (CONTENT_TYPE, "application/json"),
                (CACHE_CONTROL, "no-store"),
            ],
            UNAVAILABLE,
        )
            .into_response(),
    }
}

/// Up to 120 approved memes in short id order starting at the pivot, wrapping
/// around to the smallest ids when fewer than 120 follow it. Public for the
/// tests, which cannot see the pool through the response.
pub async fn pool(db: &Db, pivot: &str) -> Result<Vec<PoolMeme>, sqlx::Error> {
    pool_around(db, pivot, POOL_SIZE, YearRange::default()).await
}

/// `fetchPool` of app/api/quiz/route.ts, and this route's pool with no year
/// bound: up to `size` approved memes of those years in short id order from
/// the pivot, wrapping around.
pub async fn pool_around(
    db: &Db,
    pivot: &str,
    size: usize,
    years: YearRange,
) -> Result<Vec<PoolMeme>, sqlx::Error> {
    let mut pool = pool_page(db, POOL_AT_OR_AFTER, pivot, size, years).await?;
    if pool.len() < size {
        pool.extend(pool_page(db, POOL_BEFORE, pivot, size - pool.len(), years).await?);
    }
    Ok(pool)
}

pub(super) type PoolRow = (String, String, String, String, String, Option<i32>, String);

pub(super) fn pool_meme(row: PoolRow) -> PoolMeme {
    let (short_id, slug, title, summary, category, origin_year, safety_level) = row;
    PoolMeme {
        short_id,
        slug,
        title,
        summary,
        category,
        origin_year,
        safety_level,
    }
}

/// One query in its own anonymous transaction, as in the TypeScript.
async fn pool_page(
    db: &Db,
    sql: &'static str,
    pivot: &str,
    limit: usize,
    years: YearRange,
) -> Result<Vec<PoolMeme>, sqlx::Error> {
    let pivot = pivot.to_owned();
    let limit = i32::try_from(limit).unwrap_or(i32::MAX);
    let rows: Vec<PoolRow> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(sql)
                    .bind(pivot)
                    .bind(limit)
                    .bind(years.from)
                    .bind(years.to)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    Ok(rows.into_iter().map(pool_meme).collect())
}
