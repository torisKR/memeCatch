//! The answer for a request no route takes (`standalone::answer`), and the
//! not-found document a route gives when it finds nothing at its path.

use axum::extract::{Request, State};
use axum::response::Response;

use crate::AppState;
use crate::standalone::not_found::{self, Variant};

/// Marks an answer made here, with all its headers: the layer that adds the
/// headers of a route's answer (`headers::apply`) leaves it as it is.
#[derive(Clone, Copy)]
pub struct FromFallback;

/// The router fallback.
pub async fn answer(State(state): State<AppState>, request: Request) -> Response {
    mark(crate::standalone::answer(&state, request).await)
}

/// The not-found document for `request`, as a path no route takes gets it.
pub fn not_found(state: &AppState, request: &Request) -> Response {
    let target = crate::pages::path_and_query(request);
    mark(not_found::response(
        state,
        Variant::Global,
        request.uri().path(),
        target,
    ))
}

fn mark(mut response: Response) -> Response {
    response.extensions_mut().insert(FromFallback);
    response
}
