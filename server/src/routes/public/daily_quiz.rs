//! `GET /api/daily-quiz`: `app/api/daily-quiz/route.ts`. The question itself
//! is built in `quiz.rs`.

use std::time::SystemTime;

use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};

use super::quiz::{self, PoolMeme};
use super::unsized_body;
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};

const POOL_SIZE: usize = 120;
// The enum columns are read as text, which is what row_to_json gives the
// TypeScript.
const POOL_AT_OR_AFTER: &str = "select short_id, slug, title, summary, category::text, origin_year, safety_level::text \
     from public.memes where moderation_status = 'approved' and short_id >= $1 \
     order by short_id asc limit $2";
const POOL_BEFORE: &str = "select short_id, slug, title, summary, category::text, origin_year, safety_level::text \
     from public.memes where moderation_status = 'approved' and short_id < $1 \
     order by short_id asc limit $2";
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
            unsized_body(body),
        )
            .into_response(),
        // A failed query and a pool too small for a question answer alike.
        None => (
            StatusCode::BAD_GATEWAY,
            [
                (CONTENT_TYPE, "application/json"),
                (CACHE_CONTROL, "no-store"),
            ],
            unsized_body(UNAVAILABLE),
        )
            .into_response(),
    }
}

/// Up to 120 approved memes in short id order starting at the pivot, wrapping
/// around to the smallest ids when fewer than 120 follow it. Public for the
/// tests, which cannot see the pool through the response.
pub async fn pool(db: &Db, pivot: &str) -> Result<Vec<PoolMeme>, sqlx::Error> {
    let mut pool = pool_page(db, POOL_AT_OR_AFTER, pivot, POOL_SIZE).await?;
    if pool.len() < POOL_SIZE {
        pool.extend(pool_page(db, POOL_BEFORE, pivot, POOL_SIZE - pool.len()).await?);
    }
    Ok(pool)
}

type PoolRow = (String, String, String, String, String, Option<i32>, String);

/// One query in its own anonymous transaction, as in the TypeScript.
async fn pool_page(
    db: &Db,
    sql: &'static str,
    pivot: &str,
    limit: usize,
) -> Result<Vec<PoolMeme>, sqlx::Error> {
    let pivot = pivot.to_owned();
    let limit = i32::try_from(limit).unwrap_or(i32::MAX);
    let rows: Vec<PoolRow> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(sql)
                    .bind(pivot)
                    .bind(limit)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(short_id, slug, title, summary, category, origin_year, safety_level)| PoolMeme {
                short_id,
                slug,
                title,
                summary,
                category,
                origin_year,
                safety_level,
            },
        )
        .collect())
}
