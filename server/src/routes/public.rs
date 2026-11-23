//! Public read routes (`/robots.txt`, `/api/random-meme`, ...). Filled in by T4.

use axum::Router;

use super::Routes;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state).build()
}
