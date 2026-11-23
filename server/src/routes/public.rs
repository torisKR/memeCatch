//! Public routes answered without Next. Each has a route id for
//! `AXUM_DISABLED_ROUTES`:
//!
//! | id | route |
//! | --- | --- |
//! | `robots` | `/robots.txt` |
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

mod content_depth;
pub(crate) mod csp_report;
pub mod daily_quiz;
mod explore_previews;
mod feeds;
pub(crate) mod js;
pub(crate) mod js_date;
pub(crate) mod labels;
mod llms;
mod llms_full;
mod llms_localized;
mod localized;
mod meme_delivery;
mod publication_export;
pub mod quiz;
mod quiz_api;
mod random;
mod rankings;
pub(crate) mod rate_limit;
mod robots;

use std::sync::Arc;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::HeaderMap;
use axum::http::header::HOST;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, post};

use self::random::RedirectTargets;
use self::rankings::RankingsVisibility;
use self::rate_limit::RateLimiter;
use super::Routes;
use crate::{AppState, proxy};

const WWW_HOST: &[u8] = b"www.catchmeme.com";

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

    let pages = text_routes(pages);

    let limiter = Arc::new(RateLimiter::new(csp_report::now_ms()));
    let previews = Arc::new(explore_previews::Previews::new(csp_report::now_ms()));
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
    pages
        .build()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            www_to_upstream,
        ))
        .merge(api.build())
}

/// The feeds and the llms exports. `proxy.ts` skips paths that end in `.txt`
/// or `.xml`, so nothing but the www redirect applies to them, and the
/// handlers set `Content-Language` themselves where Next does.
fn text_routes(pages: Routes<'_>) -> Routes<'_> {
    let rankings = Arc::new(RankingsVisibility::default());
    let mut pages = pages
        .add(
            "llms",
            "/llms.txt",
            get(move |state: State<AppState>| llms::index(state, rankings.clone())),
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

/// Leaves requests for the `www` host to Next. `proxy.ts` answers them with a
/// 301 to the apex host before any route runs, and that logic has not moved
/// here yet (PLAN.md, stage 4). This sits outside the native-route header
/// layer, so the upstream's answer goes back untouched.
pub(crate) async fn www_to_upstream(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    if names_www_host(request.headers()) {
        return proxy::forward(State(state), request).await;
    }
    next.run(request).await
}

/// Wider than the two checks in `proxy.ts` (an anchored, case-sensitive
/// matcher and a lowercased comparison): any `Host` that mentions the www
/// name. A request sent upstream without need is still answered correctly.
fn names_www_host(headers: &HeaderMap) -> bool {
    headers.get_all(HOST).iter().any(|host| {
        host.as_bytes()
            .to_ascii_lowercase()
            .windows(WWW_HOST.len())
            .any(|window| window == WWW_HOST)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn www_host_is_recognized_in_any_case_and_with_a_port() {
        let names = |host: &'static str| {
            let mut headers = HeaderMap::new();
            headers.insert(HOST, HeaderValue::from_static(host));
            names_www_host(&headers)
        };

        assert!(names("www.catchmeme.com"));
        assert!(names("WWW.CatchMeme.com:443"));
        assert!(!names("catchmeme.com"));
        assert!(!names("127.0.0.1:3000"));
        assert!(!names_www_host(&HeaderMap::new()));
    }
}
