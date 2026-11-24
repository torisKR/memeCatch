//! The password hashes this app accepts (lib/auth/passwords.ts): bcrypt
//! (`$2a$`, `$2b$`, `$2y$`) for accounts imported from the previous store,
//! verified as bcryptjs 3.0.3 verifies them, and better-auth's scrypt for
//! every other hash and every new one (@better-auth/utils dist/password.node.mjs).
//!
//! scrypt: the password NFKC-normalized, the salt 16 random bytes written as
//! 32 lowercase hex digits and used as that text, N = 16384, r = 16, p = 1,
//! a 64-byte key; the hash is `<salt>:<key as hex>`.
//!
//! Each hash takes 32 MB (128 · N · r) and tens of milliseconds, so it runs
//! on a blocking thread, at most `CONCURRENT_HASHES` at a time: Node runs at
//! most four in libuv's pool, and this container has 256 MB. The turn is
//! held by the blocking work itself, so a request that goes away while its
//! hash runs does not free a turn for another 32 MB (PLAN.md A2-11). At most
//! `MAX_WAITING` more requests wait for a turn; beyond that the request is
//! answered `Overloaded`, which the endpoints send as the limiter's 429.

use rand::Rng;
use subtle::ConstantTimeEq;
use tokio::sync::Semaphore;
use unicode_normalization::UnicodeNormalization;

const CONCURRENT_HASHES: usize = 2;
/// Requests that may wait for a hashing turn. Each holds its body (up to
/// 64 KB) while it waits.
const MAX_WAITING: usize = 8;
const SCRYPT_LOG_N: u8 = 14;
const SCRYPT_R: u32 = 16;
const SCRYPT_P: u32 = 1;
const SCRYPT_KEY_LEN: usize = 64;
const BCRYPT_HASH_LEN: usize = 60;

static HASHING: Semaphore = Semaphore::const_new(CONCURRENT_HASHES);
/// Hashes running or waiting for a turn.
static QUEUE: Semaphore = Semaphore::const_new(CONCURRENT_HASHES + MAX_WAITING);

/// Too many hashes are running and waiting. better-auth has no such answer:
/// Node queues without a bound in libuv's pool.
#[derive(Debug, PartialEq, Eq)]
pub struct Overloaded;

/// What `verifyStoredPassword(hash, password)` decides.
#[derive(Debug, PartialEq, Eq)]
pub enum Verdict {
    Match,
    Mismatch,
    /// The TypeScript would throw (a hash it cannot read): the request goes
    /// to Next, which answers as it does for that.
    Unreadable,
    /// No hashing turn could be waited for (`Overloaded`).
    Overloaded,
}

/// `hashPassword(password)`: a new scrypt hash.
pub async fn hash(password: &str) -> Result<String, Overloaded> {
    let mut salt_bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut salt_bytes);
    let salt = hex::encode(salt_bytes);
    let password = password.to_owned();
    let key = blocking(move || scrypt_key(&password, &salt).map(|key| (salt, key))).await?;
    match key {
        Some((salt, key)) => Ok(format!("{salt}:{}", hex::encode(key))),
        // The parameters are constants that scrypt accepts.
        None => unreachable!("scrypt parameters are valid"),
    }
}

/// `verifyStoredPassword(hash, password)`.
pub async fn verify(stored: &str, password: &str) -> Verdict {
    let stored = stored.to_owned();
    let password = password.to_owned();
    match blocking(move || Some(verify_now(&stored, &password))).await {
        Ok(verdict) => verdict.unwrap_or(Verdict::Unreadable),
        Err(Overloaded) => Verdict::Overloaded,
    }
}

fn verify_now(stored: &str, password: &str) -> Verdict {
    if ["$2a$", "$2b$", "$2y$"]
        .iter()
        .any(|prefix| stored.starts_with(prefix))
    {
        return verify_bcrypt(stored, password);
    }
    // `const [salt, key] = hash.split(":")`.
    let mut parts = stored.split(':');
    let (Some(salt), Some(key)) = (parts.next(), parts.next()) else {
        return Verdict::Unreadable;
    };
    if salt.is_empty() || key.is_empty() {
        return Verdict::Unreadable;
    }
    let Some(computed) = scrypt_key(password, salt) else {
        return Verdict::Unreadable;
    };
    // `key.toString("hex") === key`, without an early exit.
    equal(hex::encode(computed).as_bytes(), key.as_bytes())
}

/// `bcrypt.compare(password, hash)`: a hash that is not 60 characters is a
/// mismatch; otherwise bcryptjs hashes the password with the stored salt,
/// writes the result with the stored version, and compares the two strings.
fn verify_bcrypt(stored: &str, password: &str) -> Verdict {
    if stored.encode_utf16().count() != BCRYPT_HASH_LEN {
        return Verdict::Mismatch;
    }
    let version = match stored.as_bytes()[2] {
        b'a' => bcrypt::Version::TwoA,
        b'b' => bcrypt::Version::TwoB,
        _ => bcrypt::Version::TwoY,
    };
    let Ok(parts) = stored.parse::<bcrypt::HashParts>() else {
        return Verdict::Unreadable;
    };
    let Ok(computed) =
        bcrypt::hash_with_salt(password.as_bytes(), parts.get_cost(), parts.get_salt_raw())
    else {
        return Verdict::Unreadable;
    };
    equal(
        computed.format_for_version(version).as_bytes(),
        stored.as_bytes(),
    )
}

fn equal(left: &[u8], right: &[u8]) -> Verdict {
    if bool::from(left.ct_eq(right)) {
        Verdict::Match
    } else {
        Verdict::Mismatch
    }
}

/// `scrypt(password.normalize("NFKC"), salt, 64, { N, r, p })`.
fn scrypt_key(password: &str, salt: &str) -> Option<[u8; SCRYPT_KEY_LEN]> {
    let normalized: String = password.nfkc().collect();
    let params = scrypt::Params::new(SCRYPT_LOG_N, SCRYPT_R, SCRYPT_P).ok()?;
    let mut key = [0u8; SCRYPT_KEY_LEN];
    scrypt::scrypt(normalized.as_bytes(), salt.as_bytes(), &params, &mut key).ok()?;
    Some(key)
}

/// Runs `work` on a blocking thread once a hashing turn is free. `None`
/// when the thread panicked.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Option<T> + Send + 'static,
) -> Result<Option<T>, Overloaded> {
    limited(&HASHING, &QUEUE, work).await
}

/// `work` on a blocking thread with a place in `queue` (none free:
/// `Overloaded`) and then a turn of `running`. Both are moved into the
/// blocking closure: they are released when the work ends, not when the
/// caller stops waiting for it.
async fn limited<T: Send + 'static>(
    running: &'static Semaphore,
    queue: &'static Semaphore,
    work: impl FnOnce() -> Option<T> + Send + 'static,
) -> Result<Option<T>, Overloaded> {
    let place = queue.try_acquire().map_err(|_| Overloaded)?;
    let Ok(turn) = running.acquire().await else {
        return Ok(None);
    };
    let done = tokio::task::spawn_blocking(move || {
        let _held = (place, turn);
        work()
    });
    Ok(done.await.ok().flatten())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(serde::Deserialize)]
    struct Fixture {
        password: String,
        hash: String,
        matches: bool,
        note: String,
    }

    /// Hashes made by the app's own code and its verdicts on them
    /// (server/parity/password-fixture.mjs).
    fn fixtures() -> Vec<Fixture> {
        serde_json::from_str(include_str!("../../../tests/fixtures/password_hashes.json"))
            .expect("password_hashes.json")
    }

    #[tokio::test]
    async fn every_hash_the_typescript_made_gets_its_verdict() {
        let all = fixtures();
        assert!(all.len() >= 12, "{}", all.len());
        for fixture in all {
            let expected = if fixture.matches {
                Verdict::Match
            } else {
                Verdict::Mismatch
            };
            assert_eq!(
                verify(&fixture.hash, &fixture.password).await,
                expected,
                "{}",
                fixture.note
            );
        }
    }

    /// A blocking job the test lets finish, and a signal when it started.
    fn held_job() -> (
        impl FnOnce() -> Option<()> + Send + 'static,
        tokio::sync::oneshot::Receiver<()>,
        std::sync::mpsc::Sender<()>,
    ) {
        let (started, started_rx) = tokio::sync::oneshot::channel();
        let (finish, finish_rx) = std::sync::mpsc::channel::<()>();
        let job = move || {
            let _ = started.send(());
            finish_rx.recv().ok()
        };
        (job, started_rx, finish)
    }

    async fn until(condition: impl Fn() -> bool) -> bool {
        for _ in 0..200 {
            if condition() {
                return true;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        condition()
    }

    #[tokio::test]
    async fn a_hash_keeps_its_turn_when_the_request_goes_away() {
        static RUNNING: Semaphore = Semaphore::const_new(1);
        static QUEUE: Semaphore = Semaphore::const_new(4);
        let (job, started, finish) = held_job();
        let request = tokio::spawn(limited(&RUNNING, &QUEUE, job));
        started.await.expect("the hash started");
        // The client disconnects: the request future is dropped.
        request.abort();
        let _ = request.await;
        assert_eq!(
            RUNNING.available_permits(),
            0,
            "the turn is held while the hash still runs"
        );
        finish.send(()).expect("the job waits");
        assert!(until(|| RUNNING.available_permits() == 1).await);
        assert!(until(|| QUEUE.available_permits() == 4).await);
    }

    #[tokio::test]
    async fn requests_beyond_the_queue_are_overloaded() {
        static RUNNING: Semaphore = Semaphore::const_new(1);
        static QUEUE: Semaphore = Semaphore::const_new(2);
        let (job, started, finish) = held_job();
        let first = tokio::spawn(limited(&RUNNING, &QUEUE, job));
        started.await.expect("the first hash runs");
        let (second_job, _second_started, second_finish) = held_job();
        let second = tokio::spawn(limited(&RUNNING, &QUEUE, second_job));
        assert!(
            until(|| QUEUE.available_permits() == 0).await,
            "the second waits"
        );
        assert_eq!(
            limited(&RUNNING, &QUEUE, || Some(())).await,
            Err(Overloaded)
        );
        finish.send(()).expect("first");
        second_finish.send(()).expect("second");
        assert_eq!(first.await.expect("first ends"), Ok(Some(())));
        assert_eq!(second.await.expect("second ends"), Ok(Some(())));
        assert_eq!(limited(&RUNNING, &QUEUE, || Some(7)).await, Ok(Some(7)));
    }

    #[tokio::test]
    async fn a_new_hash_is_better_auth_s_format_and_verifies() {
        let made = hash("correct horse battery").await.expect("a turn");
        let (salt, key) = made.split_once(':').expect("salt:key");
        assert_eq!(salt.len(), 32);
        assert_eq!(key.len(), 128);
        assert!(
            made.bytes()
                .all(|byte| byte == b':' || byte.is_ascii_hexdigit())
        );
        assert!(!made.bytes().any(|byte| byte.is_ascii_uppercase()));
        assert_eq!(verify(&made, "correct horse battery").await, Verdict::Match);
        assert_eq!(
            verify(&made, "correct horse batter").await,
            Verdict::Mismatch
        );
        assert_ne!(
            hash("correct horse battery").await.expect("a turn"),
            made,
            "a fresh salt each time"
        );
    }

    #[tokio::test]
    async fn hashes_the_typescript_cannot_read_go_to_next() {
        for stored in [
            "",
            "nocolon",
            ":key",
            "salt:",
            "$2b$xx$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ] {
            assert_eq!(
                verify(stored, "password1234").await,
                Verdict::Unreadable,
                "{stored:?}"
            );
        }
        // bcryptjs answers false before reading a hash of another length.
        assert_eq!(
            verify("$2b$10$short", "password1234").await,
            Verdict::Mismatch
        );
    }
}
