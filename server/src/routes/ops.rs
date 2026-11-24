//! Cron jobs and small operator endpoints.
//!
//! | Route id | Path | Method | TypeScript |
//! | --- | --- | --- | --- |
//! | `growth-baseline` | `/api/cron/growth-baseline` | `GET` | `app/api/cron/growth-baseline/route.ts` |
//! | `saved-state-emails` | `/api/cron/saved-state-emails` | `GET` | `app/api/cron/saved-state-emails/route.ts` |
//! | `source-refresh` | `/api/cron/source-refresh` | `POST` | `app/api/cron/source-refresh/route.ts` |
//! | `trend-pulse` | `/api/cron/trend-pulse` | `GET` | `app/api/cron/trend-pulse/route.ts` |
//! | `instagram-video-cache` | `/api/admin/instagram-video-verification/revalidate` | `POST` | its `route.ts` |
//! | `adpick-hotdeals` | `/api/cron/adpick-hotdeals` | `GET`, `POST` | its `route.ts` |
//! | `creator-products` | `/api/creator-products`, `/api/creator-products/{...}` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | `app/api/creator-products/[[...slug]]/route.ts` |
//!
//! `GET /api/cron/source-refresh` (the refresh run itself) stays with Next:
//! it reads the oEmbed endpoints through `getOEmbed`, whose answers Next
//! keeps for an hour in its fetch cache, shared with `/api/oembed` and the
//! other callers (docs/axum-migration/PLAN.md section 15).
//!
//! The two cache routes expire Next's cache through Next
//! (`proxy::Upstream::expire_cache`), with the cron bearer. Without
//! `CRON_SECRET` the operator route cannot do that, so it is left to Next.

mod cache_expiry;
mod growth_baseline;
mod radar;
mod radar_connectors;
pub(crate) mod radar_text;
mod retired;
mod saved_state;
mod saved_state_email;
mod trend_pulse;

use axum::Router;
use axum::extract::{Request, State};
use axum::routing::{get, post};

use super::Routes;
use super::request::SiteOrigin;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    let retired = get(retired::gone).post(retired::gone);
    let any_product = retired
        .clone()
        .put(retired::gone)
        .patch(retired::gone)
        .delete(retired::gone);
    let mut routes = Routes::new(state)
        .add(
            "growth-baseline",
            "/api/cron/growth-baseline",
            get(growth_baseline::capture),
        )
        .add(
            "source-refresh",
            "/api/cron/source-refresh",
            post(cache_expiry::source_refresh),
        )
        .add("adpick-hotdeals", "/api/cron/adpick-hotdeals", retired)
        .add(
            "creator-products",
            "/api/creator-products",
            any_product.clone(),
        )
        .add(
            "creator-products",
            "/api/creator-products/{*slug}",
            any_product,
        );
    let site = SiteOrigin::from_site_url(&state.config.site_url);
    match (&site, &state.config.cron_secret) {
        (Some(site), Some(_)) => {
            let operator = cache_expiry::OperatorExpiry::new(site.clone());
            routes = routes.add(
                "instagram-video-cache",
                "/api/admin/instagram-video-verification/revalidate",
                post(move |state: State<AppState>, request: Request| {
                    cache_expiry::instagram_video(state, operator.clone(), request)
                }),
            );
        }
        _ => tracing::warn!(
            "CRON_SECRET is not set or NEXT_PUBLIC_SITE_URL is not an absolute URL: \
             /api/admin/instagram-video-verification/revalidate stays with the upstream"
        ),
    }
    match trend_pulse::TrendPulse::new(state) {
        Ok(pulse) => {
            routes = routes.add(
                "trend-pulse",
                "/api/cron/trend-pulse",
                get(move |guard, state: State<AppState>| {
                    trend_pulse::run(guard, state, pulse.clone())
                }),
            );
        }
        Err(error) => tracing::warn!(%error, "/api/cron/trend-pulse stays with the upstream"),
    }
    match saved_state::Delivery::new(&state.config) {
        Some(delivery) => {
            routes = routes.add(
                "saved-state-emails",
                "/api/cron/saved-state-emails",
                get(move |guard, state: State<AppState>| {
                    saved_state::run(guard, state, delivery.clone())
                }),
            );
        }
        None => tracing::warn!(
            "NEXT_PUBLIC_SITE_URL is not an absolute URL: \
             /api/cron/saved-state-emails stays with the upstream"
        ),
    }
    routes.build()
}
