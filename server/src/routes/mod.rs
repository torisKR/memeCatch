//! Native routes. Each module exposes `router(&AppState)`; `router` below
//! merges them. A request no native route answers reaches `proxy::forward`.

pub mod health;
pub mod media;
pub mod public;

use std::collections::HashSet;

use axum::Router;
use axum::middleware;
use axum::routing::{MethodRouter, any};

use crate::{AppState, headers, proxy};

/// The id of every native route. `Routes::add` takes no other id, so this
/// list cannot fall behind the routes.
pub const ROUTE_IDS: [&str; 13] = [
    "health",
    "media-signed",
    "robots",
    "memes-random",
    "random-meme",
    "csp-report",
    "daily-quiz",
    "llms",
    "llms-full",
    "feed",
    "feed-updated",
    "llms-localized",
    "llms-full-localized",
];

/// Refuses an `AXUM_DISABLED_ROUTES` that names an id no route has. The
/// variable is the rollback switch: an ignored typo would leave the route
/// native while the operator believes Next has it back.
pub fn check_disabled_ids(disabled: &HashSet<String>) -> Result<(), String> {
    let mut unknown: Vec<&str> = disabled
        .iter()
        .map(String::as_str)
        .filter(|id| !ROUTE_IDS.contains(id))
        .collect();
    if unknown.is_empty() {
        return Ok(());
    }
    unknown.sort_unstable();
    Err(format!(
        "AXUM_DISABLED_ROUTES names no native route: {}. The route ids are: {}",
        unknown.join(", "),
        ROUTE_IDS.join(", ")
    ))
}

/// Builds one module's router. Every native route has an id; an id listed in
/// `AXUM_DISABLED_ROUTES` is not registered, so Next keeps answering it.
///
/// ```ignore
/// pub fn router(state: &AppState) -> Router<AppState> {
///     Routes::new(state)
///         .add("robots", "/robots.txt", get(robots))
///         .build()
/// }
/// ```
pub struct Routes<'a> {
    state: &'a AppState,
    router: Router<AppState>,
}

impl<'a> Routes<'a> {
    pub fn new(state: &'a AppState) -> Self {
        Self {
            state,
            router: Router::new(),
        }
    }

    /// Registers `methods` at `path` unless `id` is disabled.
    ///
    /// The handlers in `methods` get the response headers Next adds
    /// (`headers::apply`). Methods without a handler are proxied to Next, so a
    /// route that ports only `GET` leaves `POST` and `OPTIONS` as they were.
    /// Call `add` once per path, with all its methods in one `MethodRouter`,
    /// and do not give that `MethodRouter` a fallback of its own.
    pub fn add(mut self, id: &'static str, path: &str, methods: MethodRouter<AppState>) -> Self {
        assert!(
            ROUTE_IDS.contains(&id),
            "add the route id {id:?} to ROUTE_IDS"
        );
        if self.state.config.disabled_routes.contains(id) {
            tracing::info!(id, path, "native route disabled, proxying to upstream");
            return self;
        }
        let native = methods.route_layer(middleware::from_fn_with_state(
            self.state.clone(),
            headers::apply,
        ));
        // `any` first: a method router that starts from `any` adds no `Allow`
        // header. `native.fallback(proxy::forward)` would add `Allow: GET,HEAD`
        // to every response proxied for another method.
        let methods = any(proxy::forward).merge(native);
        self.router = self.router.route(path, methods);
        self
    }

    pub fn build(self) -> Router<AppState> {
        self.router
    }
}

pub fn router(state: &AppState) -> Router<AppState> {
    health::router(state)
        .merge(media::router(state))
        .merge(public::router(state))
}
