//! Media routes (`/api/media/signed`). Filled in by T2.

use axum::Router;

use super::Routes;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state).build()
}
