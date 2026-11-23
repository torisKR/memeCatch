//! `/api/quiz`.

use memecatch_server::routes::public::quiz::{self, PoolMeme, Rng};
use serde::Deserialize;
use serde_json::{Value, json};

use super::*;

const INVALID_SET: &str = r#"{"error":"잘못된 문제 세트예요.","code":"QUIZ_INVALID_SET"}"#;
const GENERATION_FAILED: &str = r#"{"error":"퀴즈 문항을 만들지 못했어요. 잠시 후 다시 시도해 주세요.","code":"QUIZ_GENERATION_FAILED"}"#;

/// The first `count` rows of the TypeScript fixture, with slugs of this test.
fn fixture_memes(count: usize) -> Vec<PoolMeme> {
    #[derive(Deserialize)]
    struct Fixture {
        rows: Vec<PoolMeme>,
    }
    let fixture: Fixture =
        serde_json::from_str(include_str!("../fixtures/daily_quiz.json")).expect("fixture parses");
    fixture
        .rows
        .into_iter()
        .take(count)
        .enumerate()
        .map(|(index, row)| PoolMeme {
            slug: format!("axum-r2-quiz-{index}"),
            ..row
        })
        .collect()
}

/// Makes the approved memes exactly `memes`, plus two that are not approved.
async fn replace_approved_memes(db: &Db, memes: &[PoolMeme]) {
    let quote = |text: &str| format!("'{}'", text.replace('\'', "''"));
    let mut statements =
        "delete from public.memes where slug like 'axum-r2-%' or moderation_status = 'approved';"
            .to_owned();
    for meme in memes {
        statements.push_str(&format!(
            "insert into public.memes (short_id, slug, title, summary, category, origin_year,
                                       safety_level, moderation_status)
             values ({}, {}, {}, {}, {}::meme_category, {}, {}::safety_level, 'approved');",
            quote(&meme.short_id),
            quote(&meme.slug),
            quote(&meme.title),
            quote(&meme.summary),
            quote(&meme.category),
            meme.origin_year
                .map_or_else(|| "null".to_owned(), |year| year.to_string()),
            quote(&meme.safety_level),
        ));
    }
    statements.push_str(
        "insert into public.memes (short_id, slug, title, summary, moderation_status) values
         ('zzzzzzz8', 'axum-r2-quiz-limited', '숨은 밈', '승인되지 않아서 어떤 퀴즈에도 나오면 안 되는 요약이에요.', 'limited'),
         ('22222228', 'axum-r2-quiz-pending', '대기 밈', '승인되지 않아서 어떤 퀴즈에도 나오면 안 되는 요약이에요.', 'pending');",
    );
    execute(db, statements).await;
}

async fn remove_test_memes(db: &Db) {
    execute(
        db,
        "delete from public.memes where slug like 'axum-r2-%';".to_owned(),
    )
    .await;
}

/// What `fetchPool` must return: the approved memes whose year the mode
/// keeps, in short id order from the pivot, wrapping around, at most 300.
fn expected_pool(
    memes: &[PoolMeme],
    pivot: &str,
    keeps: impl Fn(Option<i32>) -> bool,
) -> Vec<PoolMeme> {
    let mut sorted: Vec<PoolMeme> = memes
        .iter()
        .filter(|meme| keeps(meme.origin_year))
        .cloned()
        .collect();
    sorted.sort_by(|a, b| a.short_id.cmp(&b.short_id));
    let (before, from_pivot): (Vec<PoolMeme>, Vec<PoolMeme>) = sorted
        .into_iter()
        .partition(|meme| meme.short_id.as_str() < pivot);
    from_pivot.into_iter().chain(before).take(300).collect()
}

fn questions_json(questions: &[quiz::Question]) -> Value {
    serde_json::to_value(questions).expect("questions")
}

#[tokio::test]
async fn quiz_db_shared_set_asks_the_set_in_order_with_options_seeded_by_it() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    let memes = fixture_memes(120);
    replace_approved_memes(&db, &memes).await;
    // Ten ids spread over the pool, one of them unknown, in link order.
    let mut ids: Vec<String> = (0..9).map(|n| memes[n * 13 + 2].short_id.clone()).collect();
    ids.insert(4, "zzzzzzz8".to_owned());
    let set = ids.join(",");

    let all = get(app, &format!("/api/quiz?set={set}"), &[]).await;
    let now = get(app, &format!("/api/quiz?mode=now&set={set}"), &[]).await;
    let retro = get(
        app,
        &format!("/api/quiz?set=%20{set}&mode=retro&set=x"),
        &[],
    )
    .await;
    let head = send(
        app,
        "HEAD",
        &format!("/api/quiz?set={set}"),
        &[],
        Body::empty(),
    )
    .await;
    let too_few = get(app, "/api/quiz?set=zzzzzzz8,zzzzzzz9,22222228", &[]).await;
    remove_test_memes(&db).await;

    let targets: Vec<PoolMeme> = ids
        .iter()
        .filter_map(|id| memes.iter().find(|meme| meme.short_id == *id).cloned())
        .collect();
    // The mode filters the pool of wrong options, never the set. A meme
    // without a year is in no mode's pool but `all`.
    let expected = |keeps: &dyn Fn(Option<i32>) -> bool| {
        let pool = expected_pool(&memes, &ids[0], keeps);
        questions_json(&quiz::build_questions_for_set(
            &targets,
            &pool,
            &mut Rng::from_text(&ids.concat()),
        ))
    };
    for (reply, mode, questions) in [
        (&all, "all", expected(&|_| true)),
        (
            &now,
            "now",
            expected(&|year| year.is_some_and(|year| year >= 2020)),
        ),
        (
            &retro,
            "retro",
            expected(&|year| year.is_some_and(|year| year <= 2009)),
        ),
    ] {
        assert_eq!(reply.status, StatusCode::OK, "{mode}: {}", reply.body);
        assert_eq!(
            reply.json(),
            json!({ "mode": mode, "questions": questions })
        );
        assert!(reply.body.starts_with(&format!(
            "{{\"mode\":\"{mode}\",\"questions\":[{{\"question\":"
        )));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        // The unknown id is skipped; the rest keep the order of the link.
        let asked: Vec<String> = reply.json()["questions"]
            .as_array()
            .expect("questions")
            .iter()
            .map(|question| question["meme"]["shortId"].as_str().expect("id").to_owned())
            .collect();
        let in_link_order: Vec<String> = ids
            .iter()
            .filter(|id| asked.contains(id))
            .cloned()
            .collect();
        assert_eq!(asked, in_link_order, "{mode}");
        assert!(asked.len() >= 5, "{mode}: {} questions", asked.len());
    }
    // The pool differs by mode, so the wrong options do.
    assert_ne!(all.json()["questions"], now.json()["questions"]);
    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.body, "");
    assert_eq!(too_few.status, StatusCode::BAD_GATEWAY);
    assert_eq!(too_few.body, GENERATION_FAILED);
    assert_eq!(too_few.header("cache-control"), Some("no-store"));
}

#[tokio::test]
async fn quiz_db_random_quiz_asks_ten_approved_memes_of_the_mode() {
    let _lock = lock_tables().await;
    let db = test_db();
    let app = app_with_db().await;
    let memes = fixture_memes(300);
    replace_approved_memes(&db, &memes).await;

    let mut replies = Vec::new();
    for query in ["", "?mode=now", "?mode=retro", "?mode=nope"] {
        for _ in 0..4 {
            replies.push((query, get(app, &format!("/api/quiz{query}"), &[]).await));
        }
    }
    // Four approved memes cannot fill ten questions.
    replace_approved_memes(&db, &memes[..4]).await;
    let small = get(app, "/api/quiz", &[]).await;
    replace_approved_memes(&db, &[]).await;
    let empty = get(app, "/api/quiz?mode=now", &[]).await;
    remove_test_memes(&db).await;

    let year_of = |id: &str| {
        let meme = memes.iter().find(|meme| meme.short_id == id);
        meme.unwrap_or_else(|| panic!("{id} is not an approved meme"))
            .origin_year
    };
    let mut first_ids = std::collections::BTreeSet::new();
    for (query, reply) in &replies {
        assert_eq!(reply.status, StatusCode::OK, "{query}: {}", reply.body);
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        let body = reply.json();
        let mode = match *query {
            "?mode=now" => "now",
            "?mode=retro" => "retro",
            _ => "all",
        };
        assert_eq!(body["mode"], mode);
        let questions = body["questions"].as_array().expect("questions");
        assert_eq!(questions.len(), 10, "{query}");
        let mut asked = std::collections::BTreeSet::new();
        for question in questions {
            let id = question["meme"]["shortId"].as_str().expect("short id");
            assert!(asked.insert(id.to_owned()), "{id} is asked twice");
            match mode {
                "now" => assert!(year_of(id).is_some_and(|year| year >= 2020), "{id}"),
                "retro" => assert!(year_of(id).is_some_and(|year| year <= 2009), "{id}"),
                _ => {
                    year_of(id);
                }
            }
            let options = question["options"].as_array().expect("options");
            assert_eq!(options.len(), 4);
            let answer = question["answerIndex"].as_u64().expect("answer index");
            assert!(answer < 4);
        }
        first_ids.insert(questions[0]["meme"]["shortId"].to_string());
    }
    // Sixteen quizzes do not all start with the same meme.
    assert!(first_ids.len() > 1, "{first_ids:?}");
    for reply in [small, empty] {
        assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
        assert_eq!(reply.body, GENERATION_FAILED);
        assert_eq!(reply.header("cache-control"), Some("no-store"));
    }
}

#[tokio::test]
async fn quiz_refuses_an_invalid_set_without_asking_the_database() {
    let app = app_without_db(closed_addr().await, &[]).await;

    for query in [
        "?set=",
        "?set=abcdefg",
        "?set=ABCDEFGH",
        "?set=abcdefgh,abcdefgh",
        "?set=abcdefgh,",
        "?mode=now&set=aaaaaaa0,aaaaaaa1,aaaaaaa2,aaaaaaa3,aaaaaaa4,aaaaaaa5,aaaaaaa6,aaaaaaa7,aaaaaaa8,aaaaaaa9,aaaaaaab",
        "?set=x&set=abcdefgh",
    ] {
        let reply = get(app, &format!("/api/quiz{query}"), &[]).await;

        assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{query}");
        assert_eq!(reply.body, INVALID_SET, "{query}");
        assert_eq!(reply.header("cache-control"), Some("no-store"), "{query}");
        assert_eq!(reply.header("content-type"), Some("application/json"));
    }
}
