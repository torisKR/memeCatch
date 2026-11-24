//! One cached value with a time limit, for a read too heavy to repeat on
//! every request.
//!
//! This is what replaces `unstable_cache` and ISR for a native page. A
//! failed load is not kept, as a thrown error is not kept by `unstable_cache`.
//! The lock is held while loading, so concurrent requests wait for one load
//! instead of each starting their own.
//!
//! Every cache here also follows a [`Freshness`]: an edit that changes what
//! the public pages show (an operator action, a cron run) expires them all at
//! once, so the next request reads again.

use std::collections::HashMap;
use std::future::Future;
use std::hash::Hash;
use std::sync::Arc;
use std::sync::Mutex as SyncMutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

/// The generation of what the caches built with it hold: [`expire`] starts a
/// new one, and a value loaded in an older one is not served. Cheap to clone;
/// clones share the generation.
///
/// [`expire`]: Freshness::expire
#[derive(Clone, Default)]
pub struct Freshness(Arc<AtomicU64>);

impl Freshness {
    pub fn expire(&self) {
        self.0.fetch_add(1, Ordering::SeqCst);
    }

    pub fn generation(&self) -> u64 {
        self.0.load(Ordering::SeqCst)
    }
}

pub struct Timed<T> {
    ttl: Duration,
    freshness: Freshness,
    slot: Mutex<Option<(Instant, u64, T)>>,
}

impl<T: Clone> Timed<T> {
    pub fn new(ttl: Duration, freshness: &Freshness) -> Self {
        Self {
            ttl,
            freshness: freshness.clone(),
            slot: Mutex::new(None),
        }
    }

    pub async fn get_or_load<E, F, Fut>(&self, load: F) -> Result<T, E>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, E>>,
    {
        let mut slot = self.slot.lock().await;
        if let Some((loaded_at, generation, value)) = slot.as_ref()
            && loaded_at.elapsed() < self.ttl
            && *generation == self.freshness.generation()
        {
            return Ok(value.clone());
        }
        // The generation the load starts in: an edit during the load leaves
        // the value stale.
        let generation = self.freshness.generation();
        let value = load().await?;
        *slot = Some((Instant::now(), generation, value.clone()));
        Ok(value)
    }
}

/// Many cached values, each under its own key and time limit, with a cap on
/// the bytes they hold together: the server runs in 256 MB, and a key can
/// come from a request. When an insert passes the cap, expired entries go
/// first, then the oldest. `weigh` says how many bytes a value holds.
///
/// Unlike `Timed`, a load does not hold the lock, so two requests for the
/// same missing key may both load it; the second result replaces the first.
pub struct Keyed<K, V> {
    ttl: Duration,
    max_bytes: usize,
    weigh: fn(&V) -> usize,
    freshness: Freshness,
    entries: SyncMutex<KeyedEntries<K, V>>,
}

struct KeyedEntries<K, V> {
    map: HashMap<K, (Instant, usize, V)>,
    bytes: usize,
    /// The generation of `freshness` the entries were loaded in.
    generation: u64,
}

impl<K: Eq + Hash + Clone, V: Clone> Keyed<K, V> {
    pub fn new(
        ttl: Duration,
        max_bytes: usize,
        weigh: fn(&V) -> usize,
        freshness: &Freshness,
    ) -> Self {
        Self {
            ttl,
            max_bytes,
            weigh,
            entries: SyncMutex::new(KeyedEntries {
                map: HashMap::new(),
                bytes: 0,
                generation: freshness.generation(),
            }),
            freshness: freshness.clone(),
        }
    }

    /// The entries, emptied first when an edit expired them.
    fn lock(&self) -> std::sync::MutexGuard<'_, KeyedEntries<K, V>> {
        // A panic while holding the lock leaves the map consistent.
        let mut entries = self
            .entries
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let generation = self.freshness.generation();
        if entries.generation != generation {
            entries.map.clear();
            entries.bytes = 0;
            entries.generation = generation;
        }
        entries
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let entries = self.lock();
        let (loaded_at, _, value) = entries.map.get(key)?;
        (loaded_at.elapsed() < self.ttl).then(|| value.clone())
    }

    pub fn insert(&self, key: K, value: V) {
        let size = (self.weigh)(&value);
        if size > self.max_bytes {
            return;
        }
        let mut entries = self.lock();
        if let Some((_, old, _)) = entries.map.remove(&key) {
            entries.bytes -= old;
        }
        if entries.bytes + size > self.max_bytes {
            let ttl = self.ttl;
            entries.map.retain(|_, (at, _, _)| at.elapsed() < ttl);
            entries.bytes = entries.map.values().map(|(_, bytes, _)| bytes).sum();
        }
        // ponytail: an O(n) scan per eviction; fine for the few thousand
        // entries a few MB hold. An ordered index would make it O(log n).
        while entries.bytes + size > self.max_bytes {
            let Some(oldest) = entries
                .map
                .iter()
                .min_by_key(|(_, (at, _, _))| *at)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some((_, bytes, _)) = entries.map.remove(&oldest) {
                entries.bytes -= bytes;
            }
        }
        entries.bytes += size;
        entries.map.insert(key, (Instant::now(), size, value));
    }

    /// The cached value, or `load`'s, which is kept unless it failed or an
    /// edit expired the cache while it loaded.
    pub async fn get_or_load<E, F, Fut>(&self, key: K, load: F) -> Result<V, E>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<V, E>>,
    {
        if let Some(value) = self.get(&key) {
            return Ok(value);
        }
        let generation = self.freshness.generation();
        let value = load().await?;
        if self.freshness.generation() == generation {
            self.insert(key, value.clone());
        }
        Ok(value)
    }

    #[cfg(test)]
    fn bytes(&self) -> usize {
        self.lock().bytes
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[test]
    fn a_keyed_cache_stays_under_its_cap_by_dropping_the_oldest() {
        let cache: Keyed<u32, String> = Keyed::new(Duration::from_secs(60), 10, String::len, &Freshness::default());
        cache.insert(1, "aaaa".to_owned());
        cache.insert(2, "bbbb".to_owned());
        assert_eq!(cache.bytes(), 8);
        cache.insert(3, "cccc".to_owned());
        assert_eq!(cache.get(&1), None, "the oldest went");
        assert_eq!(cache.get(&2).as_deref(), Some("bbbb"));
        assert_eq!(cache.get(&3).as_deref(), Some("cccc"));
        assert_eq!(cache.bytes(), 8);
        // Replacing a key does not count it twice; a value over the cap is not kept.
        cache.insert(3, "cc".to_owned());
        assert_eq!(cache.bytes(), 6);
        cache.insert(4, "x".repeat(11));
        assert_eq!(cache.get(&4), None);
    }

    #[tokio::test]
    async fn a_keyed_value_expires_and_a_failed_load_is_not_kept() {
        let cache: Keyed<&str, String> = Keyed::new(Duration::from_millis(40), 100, String::len, &Freshness::default());
        let failed: Result<String, &str> = cache.get_or_load("k", || async { Err("down") }).await;
        assert_eq!(failed, Err("down"));
        let first: Result<String, &str> = cache
            .get_or_load("k", || async { Ok("one".to_owned()) })
            .await;
        assert_eq!(first.as_deref(), Ok("one"));
        let cached: Result<String, &str> = cache
            .get_or_load("k", || async { Ok("two".to_owned()) })
            .await;
        assert_eq!(cached.as_deref(), Ok("one"));
        tokio::time::sleep(Duration::from_millis(60)).await;
        let reloaded: Result<String, &str> = cache
            .get_or_load("k", || async { Ok("two".to_owned()) })
            .await;
        assert_eq!(reloaded.as_deref(), Ok("two"));
    }

    #[tokio::test]
    async fn a_value_is_loaded_once_until_it_expires_and_errors_are_not_kept() {
        let loads = AtomicU32::new(0);
        let cache = Timed::new(Duration::from_millis(40), &Freshness::default());
        let load = || async {
            let n = loads.fetch_add(1, Ordering::SeqCst);
            if n == 0 { Err("down") } else { Ok(n) }
        };

        assert_eq!(cache.get_or_load(load).await, Err("down"));
        assert_eq!(cache.get_or_load(load).await, Ok(1));
        assert_eq!(cache.get_or_load(load).await, Ok(1));
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert_eq!(cache.get_or_load(load).await, Ok(2));
    }

    #[tokio::test]
    async fn an_expiry_makes_every_cache_of_its_freshness_read_again() {
        let freshness = Freshness::default();
        let timed = Timed::new(Duration::from_secs(60), &freshness);
        let keyed: Keyed<&str, String> =
            Keyed::new(Duration::from_secs(60), 100, String::len, &freshness);
        let other = Timed::new(Duration::from_secs(60), &Freshness::default());
        let read = |value: &'static str| async move { Ok::<_, ()>(value.to_owned()) };

        assert_eq!(timed.get_or_load(|| read("one")).await.as_deref(), Ok("one"));
        assert_eq!(keyed.get_or_load("k", || read("one")).await.as_deref(), Ok("one"));
        assert_eq!(other.get_or_load(|| read("one")).await.as_deref(), Ok("one"));
        assert_eq!(timed.get_or_load(|| read("two")).await.as_deref(), Ok("one"));

        freshness.expire();
        assert_eq!(timed.get_or_load(|| read("two")).await.as_deref(), Ok("two"));
        assert_eq!(keyed.get_or_load("k", || read("two")).await.as_deref(), Ok("two"));
        assert_eq!(keyed.get(&"k").as_deref(), Some("two"));
        // A cache of another freshness keeps its value.
        assert_eq!(other.get_or_load(|| read("two")).await.as_deref(), Ok("one"));
    }

}
