//! memecatch Axum server: answers migrated routes itself and streams
//! everything else to the Next server. See docs/axum-migration/PLAN.md.

pub mod auth;
pub mod config;
pub mod db;
pub mod headers;
pub mod proxy;
pub mod routes;
pub mod storage;

use std::sync::Arc;

use axum::Router;

use crate::config::Config;
use crate::db::Db;
use crate::headers::NativeRouteHeaders;
use crate::proxy::Upstream;
use crate::storage::Storage;

/// Shared by every handler. Cheap to clone.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: Db,
    pub storage: Storage,
    pub upstream: Upstream,
    pub native_headers: NativeRouteHeaders,
}

impl AppState {
    /// Opens no connection: the database pools connect on first use.
    pub fn new(config: Config) -> Result<Self, String> {
        routes::check_disabled_ids(&config.disabled_routes)?;
        let db = Db::connect_lazy(config.database_url.expose(), config.db_pool_max)
            .map_err(|error| format!("DATABASE_URL is not a valid Postgres URL: {error}"))?;
        let native_headers = NativeRouteHeaders::new(&config).map_err(|_| {
            "RELEASE_SHA, NEXT_PUBLIC_SITE_URL and CSP_REPORT_URI must be valid header text"
                .to_owned()
        })?;
        Ok(Self {
            storage: Storage::new(&config)?,
            upstream: Upstream::new(config.upstream.clone()),
            db,
            native_headers,
            config: Arc::new(config),
        })
    }
}

/// The whole application: native routes, and the proxy for everything else.
pub fn build_app(state: AppState) -> Router {
    routes::router(&state)
        .fallback(proxy::forward)
        .with_state(state)
}
