//! Object storage (R2 with a local directory fallback). Filled in by T2.

use crate::config::Config;

/// Held in `AppState` as `state.storage`. T2 gives it fields; `new` already
/// runs at startup, so `lib.rs` does not change.
#[derive(Clone)]
pub struct Storage {}

impl Storage {
    pub fn new(_config: &Config) -> Result<Self, String> {
        Ok(Self {})
    }
}
