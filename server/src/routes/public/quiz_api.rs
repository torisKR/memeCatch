//! `GET /api/quiz`: `app/api/quiz/route.ts`. Ten questions drawn at random,
//! or with `set=<short ids>` the questions of a shared link, whose options
//! are seeded by the set so everyone sees the same ones. The questions are
//! built in `quiz.rs`.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::CACHE_CONTROL;
use axum::response::Response;
use serde::Serialize;

use super::daily_quiz::{self, PoolRow, YearRange};
use super::js;
use super::quiz::{self, PoolMeme, Question, Rng};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::request;
use crate::{AppState, proxy};

/// `QUIZ_SIZE` in lib/quiz.ts.
const QUIZ_SIZE: usize = 10;
const POOL_SIZE: usize = 300;
const TARGETS: &str = "select short_id, slug, title, summary, category::text, origin_year, safety_level::text \
     from public.memes where moderation_status = 'approved' and short_id = any($1)";
const INVALID_SET: &str = r#"{"error":"잘못된 문제 세트예요.","code":"QUIZ_INVALID_SET"}"#;
const GENERATION_FAILED: &str = r#"{"error":"퀴즈 문항을 만들지 못했어요. 잠시 후 다시 시도해 주세요.","code":"QUIZ_GENERATION_FAILED"}"#;

/// `QuizMode` with its `MODE_YEAR_FILTER`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    All,
    Now,
    Retro,
}

impl Mode {
    /// `parseMode`: anything but `now` and `retro` is `all`.
    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("now") => Self::Now,
            Some("retro") => Self::Retro,
            _ => Self::All,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Now => "now",
            Self::Retro => "retro",
        }
    }

    fn years(self) -> YearRange {
        match self {
            Self::All => YearRange::default(),
            Self::Now => YearRange {
                from: Some(2020),
                to: None,
            },
            Self::Retro => YearRange {
                from: None,
                to: Some(2009),
            },
        }
    }
}

pub async fn quiz(State(state): State<AppState>, request: Request) -> Response {
    if !request::has_ascii_target(request.uri()) {
        return proxy::forward(State(state), request).await;
    }
    let params = request::query_pairs(request.uri());
    let mode = Mode::parse(request::first_param(&params, "mode"));
    let raw_set = request::first_param(&params, "set");
    let set = raw_set.and_then(parse_set);
    if raw_set.is_some() && set.is_none() {
        return answer(StatusCode::BAD_REQUEST, INVALID_SET.to_owned());
    }

    let questions = match &set {
        Some(ids) => set_questions(&state.db, ids, mode).await,
        None => random_questions(&state.db, mode).await,
    };
    match questions {
        Ok(Some(questions)) => {
            #[derive(Serialize)]
            struct Quiz {
                mode: &'static str,
                questions: Vec<Question>,
            }
            let body = serde_json::to_string(&Quiz {
                mode: mode.as_str(),
                questions,
            })
            .expect("strings and numbers");
            answer(StatusCode::OK, body)
        }
        // A failed query and too few questions answer alike.
        Ok(None) => answer(StatusCode::BAD_GATEWAY, GENERATION_FAILED.to_owned()),
        Err(error) => {
            tracing::warn!(%error, "quiz pool query failed");
            answer(StatusCode::BAD_GATEWAY, GENERATION_FAILED.to_owned())
        }
    }
}

fn answer(status: StatusCode, body: String) -> Response {
    let mut response = request::json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("header value"));
    response
}

/// `parseSet`: one to ten distinct short ids separated by commas, each
/// trimmed. `None` is an invalid set; an empty value is invalid too.
fn parse_set(value: &str) -> Option<Vec<String>> {
    if value.is_empty() {
        return None;
    }
    let ids: Vec<&str> = value.split(',').map(js::trim).collect();
    // QUIZ_SHORT_ID_PATTERN in lib/quiz-share.ts: /^[a-z0-9]{8}$/.
    let is_short_id = |id: &&str| {
        id.len() == 8
            && id
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
    };
    let distinct = |ids: &[&str]| {
        ids.iter()
            .enumerate()
            .all(|(index, id)| !ids[..index].contains(id))
    };
    (ids.len() <= QUIZ_SIZE && ids.iter().all(is_short_id) && distinct(&ids))
        .then(|| ids.into_iter().map(str::to_owned).collect())
}

/// Ten questions from the pool at a random pivot. `None` when the pool
/// gives fewer ("insufficient pool").
async fn random_questions(db: &Db, mode: Mode) -> Result<Option<Vec<Question>>, sqlx::Error> {
    let mut rng = Rng::random();
    let pivot = quiz::short_id_pivot(&mut rng);
    let pool = daily_quiz::pool_around(db, &pivot, POOL_SIZE, mode.years()).await?;
    let questions = quiz::build_questions(&pool, QUIZ_SIZE, &mut rng);
    Ok((questions.len() >= QUIZ_SIZE).then_some(questions))
}

/// `fetchSetQuestions`: the memes of the set in the order of the link, with
/// wrong options from the pool that starts at the first id. The mode filters
/// that pool only, not the set. `None` when fewer than half can be asked
/// ("insufficient set").
async fn set_questions(
    db: &Db,
    ids: &[String],
    mode: Mode,
) -> Result<Option<Vec<Question>>, sqlx::Error> {
    let found = approved_memes(db, ids.to_vec()).await?;
    let targets: Vec<PoolMeme> = ids
        .iter()
        .filter_map(|id| found.iter().find(|meme| meme.short_id == *id).cloned())
        .collect();
    let pool = daily_quiz::pool_around(db, &ids[0], POOL_SIZE, mode.years()).await?;
    let mut rng = Rng::from_text(&ids.concat());
    let questions = quiz::build_questions_for_set(&targets, &pool, &mut rng);
    Ok((questions.len() >= ids.len().div_ceil(2)).then_some(questions))
}

async fn approved_memes(db: &Db, ids: Vec<String>) -> Result<Vec<PoolMeme>, sqlx::Error> {
    let rows: Vec<PoolRow> = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query_as(TARGETS).bind(ids).fetch_all(tx).await })
        })
        .await?;
    Ok(rows.into_iter().map(daily_quiz::pool_meme).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mode_is_all_unless_it_is_exactly_now_or_retro() {
        assert_eq!(Mode::parse(Some("now")), Mode::Now);
        assert_eq!(Mode::parse(Some("retro")), Mode::Retro);
        for other in [
            None,
            Some(""),
            Some("all"),
            Some("NOW"),
            Some(" now"),
            Some("x"),
        ] {
            assert_eq!(Mode::parse(other), Mode::All, "{other:?}");
        }
        assert_eq!(Mode::Now.years().from, Some(2020));
        assert_eq!(Mode::Retro.years().to, Some(2009));
        assert_eq!(Mode::All.years(), YearRange::default());
    }

    // Expected values are what parseSet returns under Node.
    #[test]
    fn set_is_one_to_ten_distinct_short_ids() {
        let ten = "aaaaaaa0,aaaaaaa1,aaaaaaa2,aaaaaaa3,aaaaaaa4,aaaaaaa5,aaaaaaa6,aaaaaaa7,aaaaaaa8,aaaaaaa9";

        assert_eq!(parse_set("abcdefgh"), Some(vec!["abcdefgh".to_owned()]));
        // Each id is trimmed with JavaScript's whitespace class.
        assert_eq!(
            parse_set(" jkm2022k ,\toyj2021k\u{feff}\n"),
            Some(vec!["jkm2022k".to_owned(), "oyj2021k".to_owned()])
        );
        assert_eq!(parse_set(ten).map(|ids| ids.len()), Some(10));
        for invalid in [
            "",
            ",",
            "abcdefgh,",
            "abcdefg",
            "abcdefghi",
            "ABCDEFGH",
            "abcdefg-",
            "abcdefgh,abcdefgh",
            "abcdefgh, abcdefgh",
            "abcde fgh",
            "abcdefg밈",
            "abcdefgh\u{85}",
        ] {
            assert_eq!(parse_set(invalid), None, "{invalid:?}");
        }
        assert_eq!(parse_set(&format!("{ten},aaaaaaab")), None);
    }
}
