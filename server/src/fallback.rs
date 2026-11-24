//! The answer for a request no native route takes, and for the few a native
//! route declines (an unreadable target, a document it cannot render): the
//! service worker, the public files, the image optimizer and otherwise the
//! not-found document (`standalone::answer`).

use axum::extract::{Request, State};
use axum::response::Response;

use crate::AppState;

/// Marks an answer [`answer`] produced, with all its headers: the layer that
/// adds the headers of a native answer (`headers::apply`) leaves it as it is.
#[derive(Clone, Copy)]
pub struct FromFallback;

/// The router fallback, and the fallback of every native route for methods it
/// does not handle.
pub async fn answer(State(state): State<AppState>, request: Request) -> Response {
    let mut response = crate::standalone::answer(&state, request).await;
    response.extensions_mut().insert(FromFallback);
    response
}
