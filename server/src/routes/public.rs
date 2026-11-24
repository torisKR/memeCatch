//! Public routes and their ids:
//!
//! | id | route |
//! | --- | --- |
//! | `robots` | `/robots.txt` |
//! | `sitemap` | `/sitemap.xml` |
//! | `memes-random` | `/memes/random` |
//! | `random-meme` | `/api/random-meme` |
//! | `csp-report` | `/api/csp-report` |
//! | `daily-quiz` | `/api/daily-quiz` |
//! | `quiz` | `/api/quiz` |
//! | `llms` | `/llms.txt` |
//! | `llms-full` | `/llms-full.txt` |
//! | `feed` | `/feed.xml` |
//! | `feed-updated` | `/feed/updated.xml` |
//! | `llms-localized` | `/{en,ja,zh,zh-tw}/llms.txt` |
//! | `llms-full-localized` | `/{en,ja,zh,zh-tw}/llms-full.txt` |
//! | `explore-previews` | `POST /api/explore/previews` |

pub(crate) mod content_depth;
pub(crate) mod csp_report;
pub mod daily_quiz;
pub(crate) mod explore_previews;
mod feeds;
pub(crate) mod js;
pub(crate) mod js_date;
pub(crate) mod labels;
mod llms;
mod llms_full;
mod llms_localized;
pub(crate) mod localized;
pub(crate) mod meme_delivery;
pub(crate) mod publication_export;
pub mod quiz;
mod quiz_api;
mod random;
pub(crate) mod rankings;
pub(crate) mod rate_limit;
mod robots;
mod sitemap;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::routing::{get, post};

use self::random::RedirectTargets;
use self::rate_limit::RateLimiter;
use super::Routes;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    let config = &state.config;

    let robots_txt = robots::render(&config.site_url);
    let mut pages = Routes::new(state).add(
        "robots",
        "/robots.txt",
        get(move || std::future::ready(robots::response(robots_txt.clone()))),
    );
    match RedirectTargets::new(config.site_url_env.as_deref()) {
        Some(targets) => {
            pages = pages.add(
                "memes-random",
                "/memes/random",
                get(move |state: State<AppState>| random::redirect(state, targets.clone())),
            );
        }
        None => tracing::warn!(
            "NEXT_PUBLIC_SITE_URL is not an absolute URL: /memes/random stays with the upstream"
        ),
    }

    let sitemap = Arc::new(sitemap::SitemapCache::new(&state.pages.freshness));
    pages = pages.add(
        "sitemap",
        "/sitemap.xml",
        get(move |State(state): State<AppState>| sitemap::sitemap(state, sitemap.clone())),
    );
    let pages = text_routes(pages);

    let limiter = Arc::new(RateLimiter::new(csp_report::now_ms()));
    // One with the explore page: `withPreviewDeadline` counts both.
    let previews = state.pages.previews.clone();
    let api = Routes::new(state)
        .add("random-meme", "/api/random-meme", get(random::json))
        .add(
            "csp-report",
            "/api/csp-report",
            post(move |request: Request| csp_report::report(limiter.clone(), request)),
        )
        .add("daily-quiz", "/api/daily-quiz", get(daily_quiz::daily_quiz))
        .add("quiz", "/api/quiz", get(quiz_api::quiz))
        .add(
            "explore-previews",
            "/api/explore/previews",
            post(move |state: State<AppState>, request: Request| {
                explore_previews::previews(state, previews.clone(), request)
            }),
        );

    // Only the paths outside /api: proxy.ts never runs for /api.
    pages.build().merge(api.build())
}

/// The feeds and the llms exports. `proxy.ts` skips paths that end in `.txt`
/// or `.xml`, so nothing but the www redirect applies to them, and the
/// handlers set `Content-Language` themselves where Next does.
fn text_routes(pages: Routes<'_>) -> Routes<'_> {
    let mut pages = pages
        .add(
            "llms",
            "/llms.txt",
            // One board with /rankings: the page and /llms.txt share it.
            get(|state: State<AppState>| {
                let rankings = state.pages.rankings.clone();
                llms::index(state, rankings)
            }),
        )
        .add("llms-full", "/llms-full.txt", get(llms_full::full))
        .add("feed", "/feed.xml", get(feeds::new_memes))
        .add(
            "feed-updated",
            "/feed/updated.xml",
            get(feeds::updated_memes),
        );
    // One fixed path per locale. Next's `[locale]` segment also matches every
    // other prefix (and answers 404); those requests keep going to Next.
    for locale in &llms_localized::LOCALES {
        pages = pages
            .add(
                "llms-localized",
                &format!("/{}/llms.txt", locale.code),
                get(move |state: State<AppState>| llms_localized::index(state, locale)),
            )
            .add(
                "llms-full-localized",
                &format!("/{}/llms-full.txt", locale.code),
                get(move |state: State<AppState>| llms_localized::full(state, locale)),
            );
    }
    pages
}
