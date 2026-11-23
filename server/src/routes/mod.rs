//! Native routes. Each module exposes `router(&AppState)`; `router` below
//! merges them. A request no native route answers reaches `proxy::forward`.

pub mod cards;
pub mod chat;
pub mod health;
pub mod js_json;
pub mod js_string;
pub mod media;
pub mod media_type;
pub mod mpe;
pub mod multipart;
pub mod openrouter;
pub mod origin;
pub mod public;
pub mod request;
pub mod search;
pub mod studio;
pub mod tracking;
pub mod unicode_classes;
pub mod upload;

use std::collections::HashSet;

use axum::Router;
use axum::middleware;
use axum::routing::{MethodRouter, any};

use crate::{AppState, headers, proxy};

/// The id of every native route. `Routes::add` takes no other id, so this
/// list cannot fall behind the routes.
pub const ROUTE_IDS: [&str; 44] = [
    "page-about",
    "page-meme",
    "page-assets",
    "page-contact",
    "page-editorial",
    "page-guides",
    "page-guide",
    "page-privacy",
    "page-terms",
    "page-offline",
    "page-missing-meme",
    "page-retired-products",
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
    "media-object",
    "upload",
    "mpe-uploads",
    "admin-mpe-candidates",
    "admin-mpe-candidates-post",
    "meme-studio",
    "admin-meme-studio",
    "memes-semantic-search",
    "memes-chat",
];

/// Pages, which are off unless `AXUM_PILOT_ROUTES` names them: a page is
/// switched on in its batch, after both parity gates pass on production-sized
/// data (docs/axum-migration/UI-PLAN.md). The meme page still stops after the
/// origin section and leaves the meme pages it cannot render to Next.
pub const PAGE_ROUTE_IDS: [&str; 11] = [
    "page-about",
    "page-meme",
    "page-contact",
    "page-editorial",
    "page-guides",
    "page-guide",
    "page-privacy",
    "page-terms",
    "page-offline",
    "page-missing-meme",
    "page-retired-products",
];

/// Refuses an `AXUM_DISABLED_ROUTES` that names an id no route has. The
/// variable is the rollback switch: an ignored typo would leave the route
/// native while the operator believes Next has it back.
pub fn check_disabled_ids(disabled: &HashSet<String>) -> Result<(), String> {
    check_ids("AXUM_DISABLED_ROUTES", "native", disabled, &ROUTE_IDS)
}

/// Refuses an `AXUM_PILOT_ROUTES` that names anything but a page route.
pub fn check_page_ids(pages: &HashSet<String>) -> Result<(), String> {
    check_ids("AXUM_PILOT_ROUTES", "page", pages, &PAGE_ROUTE_IDS)
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
/// page route is registered only when `AXUM_PILOT_ROUTES` lists it as well.
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
    pub fn add(self, id: &'static str, path: &str, methods: MethodRouter<AppState>) -> Self {
        self.add_each(path, vec![(id, methods)])
    }

    /// Registers several methods of one path, each under its own id, so each
    /// can be handed back to Next on its own. The ids that are disabled (or
    /// pages not switched on) are left out; with none left, Next keeps the
    /// whole path.
    pub fn add_each(
        mut self,
        path: &str,
        entries: Vec<(&'static str, MethodRouter<AppState>)>,
    ) -> Self {
        let config = &self.state.config;
        let mut native: Option<MethodRouter<AppState>> = None;
        for (id, methods) in entries {
            assert!(
                ROUTE_IDS.contains(&id),
                "add the route id {id:?} to ROUTE_IDS"
            );
            if config.disabled_routes.contains(id) {
                tracing::info!(id, path, "native route disabled, proxying to upstream");
                continue;
            }
            if PAGE_ROUTE_IDS.contains(&id) && !config.page_routes.contains(id) {
                tracing::info!(id, path, "page route not switched on, proxying to upstream");
                continue;
            }
            native = Some(match native {
                Some(known) => known.merge(methods),
                None => methods,
            });
        }
        let Some(native) = native else {
            return self;
        };
        let native = native.route_layer(middleware::from_fn_with_state(
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

    /// `add` for several paths under one id and one set of methods.
    pub fn add_all(
        mut self,
        id: &'static str,
        paths: &[String],
        methods: MethodRouter<AppState>,
    ) -> Self {
        for path in paths {
            self = self.add(id, path, methods.clone());
        }
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
        .merge(upload::router(state))
        .merge(studio::router(state))
        .merge(search::router(state))
        .merge(chat::router(state))
}
