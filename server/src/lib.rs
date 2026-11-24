//! The memecatch server: every page and route of the site. server/README.md
//! describes it; docs/axum-migration/PLAN.md is the history of the port from
//! the Next app it replaced.

pub mod auth;
pub mod client_address;
pub mod config;
pub mod db;
pub mod embedder;
pub mod fallback;
pub mod headers;
pub mod markdown;
pub mod next_rules;
pub mod oembed;
pub mod og;
pub mod outbound;
pub mod pages;
pub mod public_files;
pub mod routes;
pub mod standalone;
pub mod storage;

use std::sync::Arc;

use axum::Router;
use axum::middleware;

use crate::config::Config;
use crate::db::Db;
use crate::headers::NativeRouteHeaders;
use crate::oembed::OEmbed;
use crate::outbound::Outbound;
use crate::pages::Pages;
use crate::public_files::PublicFiles;
use crate::storage::Storage;

/// Shared by every handler. Cheap to clone.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: Db,
    pub storage: Storage,
    pub native_headers: NativeRouteHeaders,
    pub pages: Pages,
    pub outbound: Outbound,
    /// The oEmbed client and its cache, shared by every route that calls it.
    pub oembed: OEmbed,
    /// The site's `public/` files, when `AXUM_PUBLIC_DIR` is set.
    pub public_files: Option<Arc<PublicFiles>>,
    /// better-auth's rate limiter (production only), shared by the native
    /// `/api/auth/*` endpoints and the catch-all for the others.
    pub(crate) auth_limiter: Option<Arc<routes::better_auth::rate_limit::AuthRateLimiter>>,
}

impl AppState {
    /// Opens no connection: the database pools connect on first use.
    pub fn new(config: Config) -> Result<Self, String> {
        let db = Db::connect_lazy(config.database_url.expose(), config.db_pool_max)
            .map_err(|error| format!("DATABASE_URL is not a valid Postgres URL: {error}"))?;
        let native_headers = NativeRouteHeaders::new(&config).map_err(|_| {
            "RELEASE_SHA, NEXT_PUBLIC_SITE_URL and CSP_REPORT_URI must be valid header text"
                .to_owned()
        })?;
        let public_files = match &config.public_dir {
            Some(dir) => Some(Arc::new(PublicFiles::scan(std::path::Path::new(dir))?)),
            None => None,
        };
        Ok(Self {
            auth_limiter: config
                .node_env_production
                .then(|| Arc::new(routes::better_auth::rate_limit::AuthRateLimiter::new())),
            public_files,
            storage: Storage::new(&config)?,
            pages: Pages::new(&config),
            outbound: Outbound::new(config.extra_ca_certs.as_deref())?,
            oembed: OEmbed::new(&config)?,
            db,
            native_headers,
            config: Arc::new(config),
        })
    }
}

/// The whole application: the native routes, the fallback answer for
/// everything else, and what runs before routing (`standalone::before_routing`:
/// URL normalisation, the redirects and the sign-in gate).
pub fn build_app(state: AppState) -> Router {
    routes::router(&state)
        .fallback(fallback::answer)
        .layer(middleware::from_fn_with_state(
            state.clone(),
            standalone::before_routing,
        ))
        .with_state(state)
}
