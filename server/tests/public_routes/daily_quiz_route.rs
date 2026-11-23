//! `/api/daily-quiz`.

use super::*;

/// The rows of the TypeScript fixture, as approved memes with unique slugs.
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
            slug: format!("{SLUG_PREFIX}{index}"),
            ..row
        })
        .collect()
}

fn approved(meme: &PoolMeme) -> SeedMeme {
    SeedMeme {
        short_id: meme.short_id.clone(),
        slug: meme.slug.clone(),
        title: meme.title.clone(),
        summary: meme.summary.clone(),
        category: meme.category.clone(),
        origin_year: meme.origin_year,
        safety_level: meme.safety_level.clone(),
        status: "approved",
    }
}

/// What the route's two queries must return: up to 120 memes in short id
/// order from the pivot, wrapping around to the smallest ids.
fn expected_pool(memes: &[PoolMeme], pivot: &str) -> Vec<PoolMeme> {
    let mut sorted = memes.to_vec();
    sorted.sort_by(|a, b| a.short_id.cmp(&b.short_id));
    let (before, from_pivot): (Vec<PoolMeme>, Vec<PoolMeme>) = sorted
        .into_iter()
        .partition(|meme| meme.short_id.as_str() < pivot);
    from_pivot.into_iter().chain(before).take(120).collect()
}

/// Requests the quiz and returns it with the Korean date it was served on.
async fn daily_quiz_on_one_day(app: SocketAddr) -> (String, Reply) {
    loop {
        let before = quiz::kst_day_key(SystemTime::now());
        let reply = get(app, "/api/daily-quiz").await;
        // Not across midnight in Korea.
        if quiz::kst_day_key(SystemTime::now()) == before {
            return (before, reply);
        }
    }
}

#[tokio::test]
async fn daily_quiz_db_builds_todays_question_from_the_approved_pool_around_the_pivot() {
    let db = seed_db();
    let app = app_with_db(closed_addr().await).await;

    // 40 memes: fewer than 120 follow any pivot, so the pool wraps around.
    // 300 memes: the first query alone fills the pool on most days.
    for count in [40, 300] {
        let memes = fixture_memes(count);
        let mut rows: Vec<SeedMeme> = memes.iter().map(approved).collect();
        // Memes right at the day's pivot that are not approved.
        rows.push(SeedMeme::new("zzzzzzzz", "limited", "limited"));
        rows.push(SeedMeme::new("yyyyyyyy", "pending", "pending"));
        let table = replace_approved_memes(&db, rows).await;

        let (day, reply) = daily_quiz_on_one_day(app).await;
        table.remove_test_memes().await;

        let pool = expected_pool(&memes, &quiz::daily_pivot(&day));
        let expected = quiz::daily_quiz_json(&day, &pool).expect("the pool is large enough");
        assert_eq!(reply.body, expected, "{count} memes on {day}");
        assert_eq!(reply.status, StatusCode::OK);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(
            reply.header("cache-control"),
            Some("public, s-maxage=300, stale-while-revalidate=60")
        );
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        assert!(
            reply
                .body
                .starts_with(&format!("{{\"date\":\"{day}\",\"question\":{{"))
        );
    }
}

#[tokio::test]
async fn daily_quiz_db_pool_is_120_memes_in_short_id_order_from_the_pivot_wrapping_around() {
    let db = seed_db();

    for count in [40, 300] {
        let memes = fixture_memes(count);
        let mut rows: Vec<SeedMeme> = memes.iter().map(approved).collect();
        rows.push(SeedMeme::new("mmmmmmmm", "limited", "limited"));
        let table = replace_approved_memes(&db, rows).await;
        let mut sorted: Vec<&str> = memes.iter().map(|meme| meme.short_id.as_str()).collect();
        sorted.sort_unstable();

        // Before every id (digits sort before letters), after every id, in
        // the middle, and exactly on an id (the comparison is `>=`), near
        // each end so that both queries contribute.
        let pivots = [
            "22222222",
            "zzzzzzzz",
            "mmmmmmmm",
            sorted[3],
            sorted[count - 4],
        ];
        let mut pools = Vec::new();
        for pivot in pivots {
            pools.push(daily_quiz::pool(&db, pivot).await.expect("pool query"));
        }
        table.remove_test_memes().await;

        for (pivot, pool) in pivots.into_iter().zip(pools) {
            assert_eq!(
                pool,
                expected_pool(&memes, pivot),
                "{count} memes, pivot {pivot}"
            );
            assert_eq!(pool.len(), count.min(120));
        }
    }
}

#[tokio::test]
async fn daily_quiz_db_answers_502_when_the_approved_pool_is_too_small() {
    let db = seed_db();
    let app = app_with_db(closed_addr().await).await;
    // Three approved memes cannot fill four options. With the 60 `limited`
    // ones a question could be built, and the anonymous role can read those;
    // the route must not.
    let memes = fixture_memes(63);
    let day = quiz::kst_day_key(SystemTime::now());
    assert!(quiz::daily_quiz_json(&day, &memes).is_some());
    let rows: Vec<SeedMeme> = memes
        .iter()
        .enumerate()
        .map(|(index, meme)| SeedMeme {
            status: if index < 3 { "approved" } else { "limited" },
            ..approved(meme)
        })
        .collect();

    for rows in [rows, Vec::new()] {
        let table = replace_approved_memes(&db, rows).await;

        let reply = get(app, "/api/daily-quiz").await;
        let head = send(app, "HEAD", "/api/daily-quiz", &[], Body::empty()).await;
        table.remove_test_memes().await;

        assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
        assert_eq!(reply.body, UNAVAILABLE);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(head.status, StatusCode::BAD_GATEWAY);
        assert_eq!(head.header("content-length"), None);
        assert_eq!(head.body, "");
    }
}
