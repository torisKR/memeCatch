//! Native routes. Each module exposes `router(&AppState)`; `router` below
//! merges them. A request no native route answers reaches `fallback::answer`.

pub mod account;
pub mod admin;
pub mod better_auth;
pub mod cards;
pub mod chat;
pub mod community;
pub mod contribution;
pub mod db_query;
pub mod embeddings;
pub mod health;
pub mod js_json;
pub mod js_string;
pub mod mcp;
pub mod media;
pub mod media_type;
pub mod metadata;
pub mod mpe;
pub mod multipart;
pub mod next_compat;
pub mod og;
mod og_share;
pub mod openrouter;
pub mod ops;
pub mod origin;
pub mod public;
pub mod request;
pub mod search;
pub mod sources;
pub mod studio;
pub mod submit;
pub mod tracking;
pub mod unicode_classes;
pub mod upload;

use axum::Router;
use axum::middleware;
use axum::routing::MethodRouter;

use crate::{AppState, headers};

/// The id of every native route. `Routes::add` takes no other id, so this
/// list cannot fall behind the routes.
pub const ROUTE_IDS: [&str; 191] = [
    "page-admin-mpe-candidate",
    "page-admin-mpe",
    "admin-action-mpe-reprocess",
    "admin-action-mpe-claim",
    "admin-action-mpe-source-rights",
    "admin-action-mpe-revision",
    "admin-action-mpe-review",
    "page-admin-meme",
    "admin-action-meme-korean-draft",
    "admin-action-meme-update",
    "admin-action-meme-origin-country",
    "admin-action-meme-transition",
    "page-admin-catalog-new",
    "admin-action-catalog-register",
    "admin-action-catalog-duplicates",
    "page-admin-meme-new",
    "admin-action-house-original",
    "page-admin-memes",
    "page-admin-translations",
    "admin-action-translation-stale",
    "admin-action-translation-delete",
    "admin-action-translation-reject",
    "admin-action-translation-review",
    "admin-action-translation-save",
    "admin-action-translation-draft",
    "admin-action-translation-preview",
    "admin-action-translation-gpt-review",
    "admin-action-source-review",
    "page-admin-sources",
    "admin-action-submission-approve",
    "admin-action-submission-draft",
    "admin-action-submission-reject",
    "admin-action-submission-claim",
    "page-admin-submission",
    "admin-action-contribution-review",
    "page-admin-submissions",
    "admin-action-inquiry-status",
    "admin-action-inquiry-answer",
    "page-admin-inquiries",
    "admin-action-discussion-visibility",
    "admin-action-report-handle",
    "page-admin-reports",
    "page-admin",
    "page-admin-analytics",
    "page-admin-radar-safety",
    "admin-action-radar-review",
    "admin-action-radar-match",
    "page-admin-publisher-readiness",
    "page-admin-growth",
    "admin-action-growth-slot",
    "admin-action-growth-interview",
    "admin-action-user-password",
    "admin-action-user-reset",
    "admin-action-user-role",
    "page-admin-activity",
    "page-admin-users",
    "page-admin-user",
    "page-home",
    "page-locale-explore",
    "page-locale-search",
    "page-locale-meme",
    "page-locale-home",
    "page-locale-rankings",
    "page-locale-meme-cards",
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
    "page-originals",
    "page-original-edition",
    "page-memes",
    "page-collections",
    "page-collection",
    "page-weekly",
    "page-timeline",
    "page-slang",
    "page-explore",
    "page-global",
    "page-meme-cards",
    "page-news",
    "page-quiz",
    "page-quiz-result",
    "page-rankings",
    "page-search",
    "page-studio",
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
    "meme-contribution",
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
    "auth-get-session",
    "auth-sign-out",
    "memes-chat",
    "mcp",
    "mcp-operator",
    "mcp-operator-post",
    "mcp-oauth-authorize",
    "mcp-oauth-token",
    "mcp-oauth-metadata",
    "mcp-resource-metadata",
    "mcp-github",
    "mcp-events-cron",
    "og-default",
    "opengraph-image",
    "og-quiz",
    "og-meme",
    "og-meme-locale",
    "meme-export",
    "growth-baseline",
    "saved-state-emails",
    "source-refresh",
    "trend-pulse",
    "instagram-video-cache",
    "adpick-hotdeals",
    "creator-products",
    "db-query",
    "auth-sign-in-email",
    "auth-sign-up-email",
    "auth-verify-email",
    "auth-request-password-reset",
    "auth-reset-password",
    "auth-oauth",
    "auth-callback",
    "page-forgot-password",
    "account-password",
    "page-reset-password",
    "page-login",
    "page-onboarding",
    "account-onboarding",
    "page-my",
    "account-nickname",
    "support-inquiry",
    "page-support",
    "page-community",
    "page-community-post",
    "page-community-new",
    "community-comment",
    "community-report",
    "community-post-comment",
    "community-post",
    "community-preview",
    "submit-meme",
    "page-submit",
    "oembed",
    "admin-source-ingestions",
    "source-refresh-run",
    "dead-link-sweep",
    "meme-view-id",
    "public-files",
    "app-icons",
    "web-manifest",
    "sitemap",
    "v1-embeddings",
    "meme-embeddings-cron",
    "meme-embeddings-cron-post",
    "auth-tiktok",
];

/// The route ids of the pages.
pub const PAGE_ROUTE_IDS: [&str; 102] = [
    "page-admin-mpe-candidate",
    "page-admin-mpe",
    "admin-action-mpe-reprocess",
    "admin-action-mpe-claim",
    "admin-action-mpe-source-rights",
    "admin-action-mpe-revision",
    "admin-action-mpe-review",
    "page-admin-meme",
    "admin-action-meme-korean-draft",
    "admin-action-meme-update",
    "admin-action-meme-origin-country",
    "admin-action-meme-transition",
    "page-admin-catalog-new",
    "admin-action-catalog-register",
    "admin-action-catalog-duplicates",
    "page-admin-meme-new",
    "admin-action-house-original",
    "page-admin-memes",
    "page-admin-translations",
    "admin-action-translation-stale",
    "admin-action-translation-delete",
    "admin-action-translation-reject",
    "admin-action-translation-review",
    "admin-action-translation-save",
    "admin-action-translation-draft",
    "admin-action-translation-preview",
    "admin-action-translation-gpt-review",
    "admin-action-source-review",
    "page-admin-sources",
    "admin-action-submission-approve",
    "admin-action-submission-draft",
    "admin-action-submission-reject",
    "admin-action-submission-claim",
    "page-admin-submission",
    "admin-action-contribution-review",
    "page-admin-submissions",
    "admin-action-inquiry-status",
    "admin-action-inquiry-answer",
    "page-admin-inquiries",
    "admin-action-discussion-visibility",
    "admin-action-report-handle",
    "page-admin-reports",
    "page-admin",
    "page-admin-analytics",
    "page-admin-radar-safety",
    "admin-action-radar-review",
    "admin-action-radar-match",
    "page-admin-publisher-readiness",
    "page-admin-growth",
    "admin-action-growth-slot",
    "admin-action-growth-interview",
    "admin-action-user-password",
    "admin-action-user-reset",
    "admin-action-user-role",
    "page-admin-activity",
    "page-admin-users",
    "page-admin-user",
    "page-home",
    "page-locale-explore",
    "page-locale-search",
    "page-locale-meme",
    "page-locale-home",
    "page-locale-rankings",
    "page-locale-meme-cards",
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
    "page-originals",
    "page-original-edition",
    "page-memes",
    "page-collections",
    "page-collection",
    "page-weekly",
    "page-timeline",
    "page-slang",
    "page-explore",
    "page-global",
    "page-meme-cards",
    "page-news",
    "page-quiz",
    "page-quiz-result",
    "page-rankings",
    "page-search",
    "page-studio",
    "page-forgot-password",
    "page-reset-password",
    "page-login",
    "page-onboarding",
    "page-my",
    "page-support",
    "page-community",
    "page-community-post",
    "page-community-new",
    "page-submit",
];

/// Builds one module's router. Every route has an id (`ROUTE_IDS`).
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

    /// Registers `methods` at `path`.
    ///
    /// The handlers in `methods` get the site's response headers
    /// (`headers::apply`). Another method gets 405 with `Allow`. Call `add`
    /// once per path, with all its methods in one `MethodRouter`, and do not
    /// give that `MethodRouter` a fallback of its own.
    pub fn add(self, id: &'static str, path: &str, methods: MethodRouter<AppState>) -> Self {
        self.add_each(path, vec![(id, methods)])
    }

    /// Registers several methods of one path, each under its own id.
    pub fn add_each(
        mut self,
        path: &str,
        entries: Vec<(&'static str, MethodRouter<AppState>)>,
    ) -> Self {
        let mut native: Option<MethodRouter<AppState>> = None;
        for (id, methods) in entries {
            assert!(
                ROUTE_IDS.contains(&id),
                "add the route id {id:?} to ROUTE_IDS"
            );
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
        // Another method gets the router's 405 with `Allow`.
        self.router = self.router.route(path, native);
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
        .merge(better_auth::router(state))
        .merge(account::router(state))
        .merge(community::router(state))
        .merge(submit::router(state))
        .merge(admin::router(state))
        .merge(ops::router(state))
        .merge(crate::pages::router(state))
        .merge(contribution::router(state))
        .merge(mpe::router(state))
        .merge(upload::router(state))
        .merge(studio::router(state))
        .merge(og::router(state))
        .merge(search::router(state))
        .merge(sources::router(state))
        .merge(chat::router(state))
        .merge(db_query::router(state))
        .merge(mcp::router(state))
        .merge(metadata::router(state))
        .merge(embeddings::router(state))
}
