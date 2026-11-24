//! Batch B6: sign-in, account, submission and community pages
//! (`docs/axum-migration/UI-PLAN.md`, PLAN.md section B6). Next's forms call
//! server actions; these call the HTTP endpoints better-auth's client would
//! call (A1 to A4) or a native endpoint per write, from `ui/auth-forms.js`
//! and the other scripts named in each module.
//!
//! Route ids: `page-forgot-password`. Each is off until `AXUM_PILOT_ROUTES`
//! names it.

pub mod forgot_password;

use axum::extract::Request;
use axum::http::StatusCode;
use axum::response::Response;
use maud::Markup;

use super::document::{self, Head};
use super::{html_cached, path_and_query};
use crate::AppState;

/// A page with the frame around it and the `Cache-Control` Next sends.
fn respond(
    state: &AppState,
    request: &Request,
    cache_control: &'static str,
    head: Head,
    main: Markup,
) -> Response {
    let document = document::page(&state.pages.site, &head, path_and_query(request), main);
    html_cached(StatusCode::OK, cache_control, document)
}
