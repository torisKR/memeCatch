//! One cached value with a time limit, for a read too heavy to repeat on
//! every request.
//!
//! This is what replaces `unstable_cache` and ISR for a native page. A
//! failed load is not kept, as a thrown error is not kept by `unstable_cache`.
//! The lock is held while loading, so concurrent requests wait for one load
//! instead of each starting their own.
//!
//! Next drops its entries when an admin action calls `revalidateTag`. Nothing
//! tells this process about such an edit while the admin pages are still
//! Next's, so the time limit is the only bound on staleness: keep it short.

use std::future::Future;
use std::time::{Duration, Instant};

use tokio::sync::Mutex;

pub struct Timed<T> {
    ttl: Duration,
    slot: Mutex<Option<(Instant, T)>>,
}

impl<T: Clone> Timed<T> {
    pub fn new(ttl: Duration) -> Self {
        Self {
            ttl,
            slot: Mutex::new(None),
        }
    }

    pub async fn get_or_load<E, F, Fut>(&self, load: F) -> Result<T, E>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, E>>,
    {
        let mut slot = self.slot.lock().await;
        if let Some((loaded_at, value)) = slot.as_ref()
            && loaded_at.elapsed() < self.ttl
        {
            return Ok(value.clone());
        }
        let value = load().await?;
        *slot = Some((Instant::now(), value.clone()));
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    #[tokio::test]
    async fn a_value_is_loaded_once_until_it_expires_and_errors_are_not_kept() {
        let loads = AtomicU32::new(0);
        let cache = Timed::new(Duration::from_millis(40));
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
}
