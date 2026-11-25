//! The routes that read a source's provider through `getOEmbed`
//! (`lib/oembed.ts`), and the source pipeline they share
//! (`lib/sources/*.ts`). One oEmbed client and cache serve them all
//! (`src/oembed`).
//!
//! | Route id | Path | Method | TypeScript |
//! | --- | --- | --- | --- |
//! | `oembed` | `/api/oembed` | `GET` | `app/api/oembed/route.ts` |
//! | `admin-source-ingestions` | `/api/admin/source-ingestions` | `POST` | `app/api/admin/source-ingestions/route.ts` |
//! | `source-refresh-run` | `/api/cron/source-refresh` | `GET` | `app/api/cron/source-refresh/route.ts` (registered in `ops.rs` beside R4's `POST`) |
//!

pub(crate) mod db;
pub(crate) mod dead_link_sweep;
mod ingest;
mod oembed_route;
mod recovery;
pub(crate) mod refresh;
mod refresh_select;
mod refresh_social;
mod refresh_writes;
mod refresh_youtube;
pub(crate) mod url;
mod youtube;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::routing::{get, post};

use super::Routes;
use super::public::csp_report::now_ms;
use super::public::rate_limit::RateLimiter;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    Routes::new(state)
        .add(
            "oembed",
            "/api/oembed",
            get(move |state: State<AppState>, request: Request| {
                oembed_route::get(state, limiter.clone(), request)
            }),
        )
        .add(
            "admin-source-ingestions",
            "/api/admin/source-ingestions",
            post(ingest::post),
        )
        .build()
}
