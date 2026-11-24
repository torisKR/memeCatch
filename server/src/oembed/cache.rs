//! The cache of the oEmbed requests (`lib/oembed.ts`): an hour, with a
//! background refresh after it.
//!
//! - The key is the provider URL: every caller sends the same request.
//! - Only a 200 whose body was read whole is stored.
//! - Within the hour an entry is answered as it was stored. After the hour it
//!   is still answered (stale), and a refresh without the caller's timeout
//!   runs in the background; a 200 replaces the entry, anything else leaves
//!   it. undici gives up on that refresh after 300 s (`headersTimeout`).
//! - A miss holds a lock on its key until it has fetched and stored, so a
//!   second caller of the same URL waits and then reads the entry.
//! - `expire_all` expires every entry stored before it
//!   (`pages::expire_public`).
//!
//! The cache is in memory only and drops its oldest entries past 50 MB.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use tokio::sync::OwnedMutexGuard;
use tokio::time::Instant;

use super::http::Fetched;

pub const REVALIDATE: Duration = Duration::from_secs(3_600);
// ponytail: oldest-first eviction by a scan, an LRU if the cache ever grows large.
const MAX_BYTES: usize = 50 * 1024 * 1024;

#[derive(Clone)]
struct Entry {
    fetched: Fetched,
    stored: Instant,
}

#[derive(Default)]
struct Store {
    entries: HashMap<String, Entry>,
    bytes: usize,
}

/// What a read found.
pub enum Lookup {
    Fresh(Fetched),
    /// Answer with it, and refresh it in the background.
    Stale(Fetched),
    Miss,
}

#[derive(Default)]
pub struct FetchCache {
    store: Mutex<Store>,
    locks: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
}

/// Held while a miss fetches; dropping it lets the next caller of the key in.
pub struct KeyLock {
    key: String,
    guard: Option<OwnedMutexGuard<()>>,
    cache: Arc<FetchCache>,
}

impl Drop for KeyLock {
    fn drop(&mut self) {
        drop(self.guard.take());
        let mut locks = self
            .cache
            .locks
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        // Only the map holds it now: nobody waits, so forget the key.
        if locks
            .get(&self.key)
            .is_some_and(|lock| Arc::strong_count(lock) == 1)
        {
            locks.remove(&self.key);
        }
    }
}

impl FetchCache {
    pub async fn lock(self: &Arc<Self>, key: &str) -> KeyLock {
        let lock = {
            let mut locks = self.locks.lock().unwrap_or_else(PoisonError::into_inner);
            locks.entry(key.to_owned()).or_default().clone()
        };
        KeyLock {
            key: key.to_owned(),
            guard: Some(lock.lock_owned().await),
            cache: self.clone(),
        }
    }

    pub fn get(&self, key: &str) -> Lookup {
        let store = self.store.lock().unwrap_or_else(PoisonError::into_inner);
        match store.entries.get(key) {
            None => Lookup::Miss,
            Some(entry) if entry.stored.elapsed() > REVALIDATE => {
                Lookup::Stale(entry.fetched.clone())
            }
            Some(entry) => Lookup::Fresh(entry.fetched.clone()),
        }
    }

    /// Stores `fetched` when it is a 200 with its whole body.
    pub fn put(&self, key: &str, fetched: &Fetched) {
        let Some(body) = fetched.body.as_ref().filter(|_| fetched.status == 200) else {
            return;
        };
        let mut store = self.store.lock().unwrap_or_else(PoisonError::into_inner);
        let size = body.len();
        if let Some(old) = store.entries.insert(
            key.to_owned(),
            Entry {
                fetched: fetched.clone(),
                stored: Instant::now(),
            },
        ) {
            store.bytes -= old.fetched.body.as_ref().map_or(0, |body| body.len());
        }
        store.bytes += size;
        while store.bytes > MAX_BYTES {
            let Some(oldest) = store
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.stored)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some(entry) = store.entries.remove(&oldest) {
                store.bytes -= entry.fetched.body.as_ref().map_or(0, |body| body.len());
            }
        }
    }

    pub fn expire_all(&self) {
        let mut store = self.store.lock().unwrap_or_else(PoisonError::into_inner);
        *store = Store::default();
    }

    #[cfg(test)]
    pub(super) fn age(&self, key: &str, by: Duration) {
        let mut store = self.store.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(entry) = store.entries.get_mut(key) {
            entry.stored = entry
                .stored
                .checked_sub(by)
                .expect("the clock is past an hour");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Bytes;

    fn answer(status: u16, body: Option<&'static str>) -> Fetched {
        Fetched {
            status,
            content_length: None,
            body: body.map(|text| Bytes::from_static(text.as_bytes())),
        }
    }

    #[tokio::test]
    async fn only_whole_200s_are_kept_and_they_go_stale_after_an_hour() {
        let cache = FetchCache::default();
        cache.put("a", &answer(404, Some("{}")));
        cache.put("b", &answer(200, None));
        cache.put("c", &answer(201, Some("{}")));
        for key in ["a", "b", "c"] {
            assert!(matches!(cache.get(key), Lookup::Miss), "{key}");
        }
        cache.put("d", &answer(200, Some("{}")));
        assert!(matches!(cache.get("d"), Lookup::Fresh(_)));
        cache.age("d", REVALIDATE - Duration::from_secs(1));
        assert!(
            matches!(cache.get("d"), Lookup::Fresh(_)),
            "within the hour"
        );
        cache.age("d", Duration::from_secs(2));
        assert!(matches!(cache.get("d"), Lookup::Stale(_)));
        cache.expire_all();
        assert!(matches!(cache.get("d"), Lookup::Miss));
    }

    #[tokio::test]
    async fn a_second_caller_waits_for_the_key_and_the_lock_is_forgotten() {
        let cache = Arc::new(FetchCache::default());
        let first = cache.lock("k").await;
        let waiting = {
            let cache = cache.clone();
            tokio::spawn(async move { drop(cache.lock("k").await) })
        };
        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(!waiting.is_finished(), "the second caller waits");
        let other = cache.lock("other").await;
        drop(other);
        drop(first);
        waiting.await.expect("the second caller gets the lock");
        assert!(cache.locks.lock().unwrap().is_empty());
    }
}
