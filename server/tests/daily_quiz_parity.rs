//! The quiz logic against the real TypeScript. No database needed.
//!
//! `fixtures/daily_quiz.json` holds what `lib/quiz.ts` and `lib/daily-quiz.ts`
//! return under Node for the inputs in it. Regenerate it with
//! `node server/parity/daily-quiz-fixture.mjs > server/tests/fixtures/daily_quiz.json`.

use std::time::{Duration, UNIX_EPOCH};

use memecatch_server::routes::public::quiz::{
    self, PoolMeme, Rng, daily_pivot, daily_quiz_json, hash_code, kst_day_key,
};
use serde::Deserialize;

#[derive(Deserialize)]
struct Fixture {
    rows: Vec<PoolMeme>,
    cases: Vec<Case>,
    hashes: Vec<Hash>,
    rng: Vec<Draws>,
    pivots: Vec<Pivot>,
    kst: Vec<Instant>,
    tokens: Vec<Tokens>,
    masks: Vec<Mask>,
}

/// One request: the rows the route's two queries return for `day`, and the
/// body it answers with (`None` is its 502).
#[derive(Deserialize)]
struct Case {
    day: String,
    size: usize,
    pool: Vec<usize>,
    body: Option<String>,
}

#[derive(Deserialize)]
struct Hash {
    input: String,
    hash: u32,
}

#[derive(Deserialize)]
struct Draws {
    seed: u32,
    draws: Vec<u64>,
}

#[derive(Deserialize)]
struct Pivot {
    day: String,
    pivot: String,
}

#[derive(Deserialize)]
struct Instant {
    ms: i64,
    day: String,
}

#[derive(Deserialize)]
struct Tokens {
    title: String,
    tokens: Vec<String>,
}

#[derive(Deserialize)]
struct Mask {
    title: usize,
    text: usize,
    masked: String,
}

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/daily_quiz.json")).expect("fixture parses")
}

#[test]
fn response_body_equals_the_typescript_one_for_every_date_and_pool() {
    let fixture = fixture();
    let mut dates = std::collections::BTreeSet::new();
    let mut with_question = 0;

    for case in &fixture.cases {
        let pool: Vec<PoolMeme> = case
            .pool
            .iter()
            .map(|row| fixture.rows[*row].clone())
            .collect();

        let body = daily_quiz_json(&case.day, &pool);

        assert_eq!(body, case.body, "{} with {} memes", case.day, case.size);
        dates.insert(case.day.as_str());
        with_question += usize::from(body.is_some());
    }
    // The fixture really covers what the test name says.
    assert!(dates.len() >= 25, "{} dates", dates.len());
    assert!(
        with_question >= 100,
        "{with_question} cases produced a question"
    );
    assert!(fixture.cases.iter().any(|case| case.body.is_none()));
}

#[test]
fn pivot_equals_daily_pivot_for_800_consecutive_days() {
    let fixture = fixture();

    assert_eq!(fixture.pivots.len(), 800);
    for expected in &fixture.pivots {
        assert_eq!(
            daily_pivot(&expected.day),
            expected.pivot,
            "{}",
            expected.day
        );
    }
}

#[test]
fn hash_equals_hash_code() {
    for expected in &fixture().hashes {
        assert_eq!(
            hash_code(&expected.input),
            expected.hash,
            "{:?}",
            expected.input
        );
    }
}

#[test]
fn generator_draws_equal_seeded_rng() {
    for expected in &fixture().rng {
        let mut rng = Rng::seeded(expected.seed);

        // A draw is n / 2^32 for a 32-bit n, so n compares exactly.
        let draws: Vec<u64> = (0..expected.draws.len())
            .map(|_| (rng.next_value() * 4_294_967_296.0) as u64)
            .collect();

        assert_eq!(draws, expected.draws, "seed {}", expected.seed);
    }
}

#[test]
fn day_key_equals_kst_day_key() {
    for expected in &fixture().kst {
        let offset = Duration::from_millis(expected.ms.unsigned_abs());
        let now = if expected.ms >= 0 {
            UNIX_EPOCH + offset
        } else {
            UNIX_EPOCH - offset
        };

        assert_eq!(kst_day_key(now), expected.day, "{} ms", expected.ms);
    }
}

#[test]
fn title_tokens_equal_title_name_tokens() {
    for expected in &fixture().tokens {
        assert_eq!(
            quiz::title_name_tokens(&expected.title),
            expected.tokens,
            "{:?}",
            expected.title
        );
    }
}

#[test]
fn masked_text_equals_mask_title_words() {
    let fixture = fixture();

    for expected in &fixture.masks {
        let title = &fixture.rows[expected.title].title;
        let text = &fixture.rows[expected.text].summary;

        let masked = quiz::mask_title_words(text, &quiz::title_name_tokens(title));

        assert_eq!(masked, expected.masked, "title {title:?}, text {text:?}");
    }
}
