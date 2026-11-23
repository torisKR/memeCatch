//! Puts the `memes` table in a known state for the routes that read it.

use super::*;

/// Tests that depend on what `memes` holds take this lock: cargo runs the
/// tests of one binary in parallel.
static MEMES_TABLE: Mutex<()> = Mutex::const_new(());

pub(crate) struct SeedMeme {
    pub(crate) short_id: String,
    pub(crate) slug: String,
    pub(crate) title: String,
    pub(crate) summary: String,
    pub(crate) category: String,
    pub(crate) origin_year: Option<i32>,
    pub(crate) safety_level: String,
    pub(crate) status: &'static str,
}

impl SeedMeme {
    pub(crate) fn new(short_id: &str, slug_suffix: &str, status: &'static str) -> Self {
        Self {
            short_id: short_id.to_owned(),
            slug: format!("{SLUG_PREFIX}{slug_suffix}"),
            title: format!("테스트 밈 {short_id}"),
            summary: format!(
                "{short_id}라는 말이 어디에서 왔고 언제 쓰는지 설명하는 충분히 긴 요약이에요."
            ),
            category: "phrase".to_owned(),
            origin_year: Some(2024),
            safety_level: "green".to_owned(),
            status,
        }
    }
}

pub(crate) fn seed_db() -> Db {
    Db::connect_lazy(&database_url(), 1).expect("database url")
}

/// The `memes` table in a state one test set up. Holds the table lock.
pub(crate) struct MemesTable {
    db: Db,
    _lock: MutexGuard<'static, ()>,
}

impl MemesTable {
    /// Deletes what the test inserted. Call it before the assertions, so that
    /// a failing one leaves nothing behind.
    pub(crate) async fn remove_test_memes(self) {
        let result: Result<(), sqlx::Error> = self
            .db
            .with_identity(
                &DbIdentity::service_role(),
                IdentityOptions::default(),
                |tx| {
                    Box::pin(async move {
                        sqlx::query("delete from memes where slug like $1")
                            .bind(format!("{SLUG_PREFIX}%"))
                            .execute(tx)
                            .await
                            .map(|_| ())
                    })
                },
            )
            .await;
        result.expect("remove test memes");
    }
}

/// Makes the approved rows of `memes` exactly the approved rows of `rows`.
pub(crate) async fn replace_approved_memes(db: &Db, rows: Vec<SeedMeme>) -> MemesTable {
    let lock = MEMES_TABLE.lock().await;
    let result: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let (profiles, other_memes): (i64, i64) = sqlx::query_as(
                        // Profiles named `ax` + 12 hex digits are the users
                        // tests/auth.rs and better_auth_cookie.mjs create on
                        // this same database; any other profile is a real one.
                        "select (select count(*) from profiles
                                 where nickname !~ '^ax[0-9a-f]{12}$'),
                            (select count(*) from memes where slug not like $1)",
                    )
                    .bind(format!("{SLUG_PREFIX}%"))
                    .fetch_one(&mut *tx)
                    .await?;
                    assert!(
                        profiles == 0 && other_memes <= 20,
                        "refusing to replace the approved memes: this does not look like the \
                     scripts/test-db.sh database ({profiles} profiles of its own, {other_memes} memes)"
                    );
                    sqlx::query(
                        "delete from memes where slug like $1 or moderation_status = 'approved'",
                    )
                    .bind(format!("{SLUG_PREFIX}%"))
                    .execute(&mut *tx)
                    .await?;
                    for row in rows {
                        sqlx::query(
                            "insert into memes (short_id, slug, title, summary, category,
                                            origin_year, safety_level, moderation_status)
                         values ($1, $2, $3, $4, $5::meme_category, $6, $7::safety_level,
                                 $8::moderation_status)",
                        )
                        .bind(row.short_id)
                        .bind(row.slug)
                        .bind(row.title)
                        .bind(row.summary)
                        .bind(row.category)
                        .bind(row.origin_year)
                        .bind(row.safety_level)
                        .bind(row.status)
                        .execute(&mut *tx)
                        .await?;
                    }
                    Ok(())
                })
            },
        )
        .await;
    result.expect("seed memes");
    MemesTable {
        db: db.clone(),
        _lock: lock,
    }
}
