//! The questions of `/api/quiz` against the real TypeScript. No database
//! needed.
//!
//! `fixtures/quiz.json` holds what `buildQuestionsForSet`, `buildQuestions`
//! and `seededRng` of `lib/quiz.ts` return under Node for pools taken from the
//! rows of `fixtures/daily_quiz.json`. Regenerate it with
//! `node server/parity/quiz-fixture.mjs > server/tests/fixtures/quiz.json`.

use memecatch_server::routes::public::quiz::{self, PoolMeme, Rng};
use serde::Deserialize;

#[derive(Deserialize)]
struct Rows {
    rows: Vec<PoolMeme>,
}

#[derive(Deserialize)]
struct Fixture {
    sets: Vec<SharedSet>,
    quizzes: Vec<Quiz>,
    rng: Vec<Draws>,
}

/// One shared link: the ids in its order, the rows found for them, the pool
/// that starts at the first id, and `JSON.stringify` of the questions.
#[derive(Deserialize)]
struct SharedSet {
    mode: String,
    ids: Vec<String>,
    targets: Vec<usize>,
    pool: Vec<usize>,
    questions: String,
}

#[derive(Deserialize)]
struct Quiz {
    seed: String,
    pool: Vec<usize>,
    questions: String,
}

#[derive(Deserialize)]
struct Draws {
    seed: String,
    draws: Vec<u64>,
}

fn rows() -> Vec<PoolMeme> {
    let rows: Rows =
        serde_json::from_str(include_str!("fixtures/daily_quiz.json")).expect("rows parse");
    rows.rows
}

fn fixture() -> Fixture {
    serde_json::from_str(include_str!("fixtures/quiz.json")).expect("fixture parses")
}

fn pick(rows: &[PoolMeme], indices: &[usize]) -> Vec<PoolMeme> {
    indices.iter().map(|index| rows[*index].clone()).collect()
}

#[test]
fn shared_set_questions_equal_build_questions_for_set() {
    let (rows, fixture) = (rows(), fixture());
    let mut asked = 0;
    let mut skipped = 0;

    for set in &fixture.sets {
        let targets = pick(&rows, &set.targets);
        let pool = pick(&rows, &set.pool);

        let questions =
            quiz::build_questions_for_set(&targets, &pool, &mut Rng::from_text(&set.ids.concat()));

        assert_eq!(
            serde_json::to_string(&questions).unwrap(),
            set.questions,
            "set {:?}, mode {}",
            set.ids,
            set.mode
        );
        asked += questions.len();
        skipped += set.ids.len() - questions.len();
    }
    // The fixture covers sets that are asked in full and sets that lose
    // members (unknown ids, memes that cannot be asked).
    assert!(asked >= 100, "{asked} questions");
    assert!(skipped >= 20, "{skipped} skipped");
}

#[test]
fn quiz_of_ten_equals_build_questions() {
    let (rows, fixture) = (rows(), fixture());
    let mut full = 0;
    let mut short = 0;

    for case in &fixture.quizzes {
        let pool = pick(&rows, &case.pool);

        let questions = quiz::build_questions(&pool, 10, &mut Rng::from_text(&case.seed));

        assert_eq!(
            serde_json::to_string(&questions).unwrap(),
            case.questions,
            "seed {:?}, pool of {}",
            case.seed,
            pool.len()
        );
        full += usize::from(questions.len() == 10);
        short += usize::from(questions.len() < 10);
    }
    // Pools that fill a quiz, and pools too small for one (the route's 502).
    assert!(full >= 8, "{full} full quizzes");
    assert!(short >= 8, "{short} short quizzes");
}

#[test]
fn text_seeded_generator_equals_seeded_rng() {
    for expected in &fixture().rng {
        let mut rng = Rng::from_text(&expected.seed);

        // A draw is n / 2^32 for a 32-bit n, so n compares exactly.
        let draws: Vec<u64> = (0..expected.draws.len())
            .map(|_| (rng.next_value() * 4_294_967_296.0) as u64)
            .collect();

        assert_eq!(draws, expected.draws, "seed {:?}", expected.seed);
    }
}
