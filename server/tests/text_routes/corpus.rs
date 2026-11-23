//! Puts the meme tables in the state of `tests/fixtures/r1_seed.sql`.

use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use tokio::sync::{Mutex, MutexGuard};

use super::*;

const REVIEWER: &str = include_str!("../fixtures/r1_reviewer.sql");
const SEED: &str = include_str!("../fixtures/r1_seed.sql");

/// Every test of this binary reads the same tables: cargo runs them in
/// parallel, so each holds this lock while its rows are in place.
static CORPUS: Mutex<()> = Mutex::const_new(());

/// The corpus one test set up. Holds the lock.
pub(crate) struct Corpus {
    db: Db,
    _lock: MutexGuard<'static, ()>,
}

impl Corpus {
    /// Deletes what the seed inserted. Call it before the assertions, so that
    /// a failing one leaves nothing behind: `tests/public_routes` refuses a
    /// database that holds this many memes.
    pub(crate) async fn remove(self) {
        as_service_role(
            &self.db,
            "delete from public.memes where slug like 'axum-r1-%';
             delete from public.tags where name like 'axum-r1-%'",
        )
        .await;
    }
}

async fn as_service_role(db: &Db, sql: &'static str) {
    let result: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::raw_sql(sql).execute(tx).await.map(|_| ()) }),
        )
        .await;
    result.expect("write the corpus");
}

/// Refuses a database that is not the one `scripts/test-db.sh` makes: the
/// seed deletes every meme.
async fn lock_test_database() -> Corpus {
    let lock = CORPUS.lock().await;
    let db = Db::connect_lazy(&database_url(), 1).expect("database url");
    let counted: Result<(i64, i64), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(
                        // Profiles named `ax` + 12 hex digits are test users
                        // (tests/auth.rs, r1_reviewer.sql); any other profile
                        // is a real one.
                        "select (select count(*) from public.profiles
                                 where nickname !~ '^ax[0-9a-f]{12}$'),
                            (select count(*) from public.memes
                             where slug not like 'axum-r1-%' and slug not like 'axum-t4-%')",
                    )
                    .fetch_one(tx)
                    .await
                })
            },
        )
        .await;
    let (profiles, other_memes) = counted.expect("count rows");
    assert!(
        profiles == 0 && other_memes <= 20,
        "refusing to replace the memes: this does not look like the scripts/test-db.sh \
         database ({profiles} profiles of its own, {other_memes} memes)"
    );
    Corpus { db, _lock: lock }
}

/// The rows of `r1_seed.sql`, and nothing else in `memes`.
pub(crate) async fn seeded_corpus() -> Corpus {
    let corpus = lock_test_database().await;
    // Only the login role may write auth.users.
    sqlx::raw_sql(REVIEWER)
        .execute(corpus.db.pool())
        .await
        .expect("insert the reviewer");
    as_service_role(&corpus.db, SEED).await;
    corpus
}

/// No meme at all.
pub(crate) async fn empty_corpus() -> Corpus {
    let corpus = lock_test_database().await;
    as_service_role(&corpus.db, "delete from public.memes").await;
    corpus
}
