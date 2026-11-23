//! Native routes. Each module exposes `router(&AppState)`; `router` below
//! merges them. A request no native route answers reaches `proxy::forward`.

pub mod cards;
pub mod health;
pub mod js_json;
pub mod media;
pub mod mpe;
pub mod origin;
pub mod public;
pub mod request;
pub mod tracking;

use std::collections::HashSet;

use axum::Router;
use axum::middleware;
use axum::routing::{MethodRouter, any};

use crate::{AppState, headers, proxy};

/// The id of every native route. `Routes::add` takes no other id, so this
/// list cannot fall behind the routes.
pub const ROUTE_IDS: [&str; 26] = [
    "page-about",
    "page-meme",
    "page-assets",
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
    "explore-previews",
    "quiz",
    "meme-cards",
    "meme-card",
    "meme-cards-collection",
    "meme-cards-claim",
    "memes-view",
    "analytics-events",
    "mpe-job",
    "mpe-renders",
];

/// Routes that do not yet do all that Next's do, so they are off unless
/// `AXUM_PILOT_ROUTES` names them. Both render a complete document, but the
/// site chrome around it has no script yet: the header menu, the language
/// switch, the account menu and the chat panel do nothing, and the meme page
/// stops after the origin section (docs/axum-migration/UI-PLAN.md).
pub const PILOT_ROUTE_IDS: [&str; 2] = ["page-about", "page-meme"];

/// Refuses an `AXUM_DISABLED_ROUTES` that names an id no route has. The
/// variable is the rollback switch: an ignored typo would leave the route
/// native while the operator believes Next has it back.
pub fn check_disabled_ids(disabled: &HashSet<String>) -> Result<(), String> {
    check_ids("AXUM_DISABLED_ROUTES", "native", disabled, &ROUTE_IDS)
}

/// Refuses an `AXUM_PILOT_ROUTES` that names anything but a pilot route.
pub fn check_pilot_ids(pilot: &HashSet<String>) -> Result<(), String> {
    check_ids("AXUM_PILOT_ROUTES", "pilot", pilot, &PILOT_ROUTE_IDS)
}

fn check_ids(
    variable: &str,
    kind: &str,
    given: &HashSet<String>,
    known: &[&str],
) -> Result<(), String> {
    let mut unknown: Vec<&str> = given
        .iter()
        .map(String::as_str)
        .filter(|id| !known.contains(id))
        .collect();
    if unknown.is_empty() {
        return Ok(());
    }
    unknown.sort_unstable();
    Err(format!(
        "{variable} names no {kind} route: {}. The route ids are: {}",
        unknown.join(", "),
        known.join(", ")
    ))
}

/// Builds one module's router. Every native route has an id; an id listed in
/// `AXUM_DISABLED_ROUTES` is not registered, so Next keeps answering it. A
/// pilot route is registered only when `AXUM_PILOT_ROUTES` lists it as well.
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
        let config = &self.state.config;
        if config.disabled_routes.contains(id) {
            tracing::info!(id, path, "native route disabled, proxying to upstream");
            return self;
        }
        if PILOT_ROUTE_IDS.contains(&id) && !config.pilot_routes.contains(id) {
            tracing::info!(
                id,
                path,
                "pilot route not switched on, proxying to upstream"
            );
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
        .merge(cards::router(state))
        .merge(tracking::router(state))
        .merge(crate::pages::router(state))
        .merge(mpe::router(state))
}
