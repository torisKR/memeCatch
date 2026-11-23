//! Public routes answered without Next: `/robots.txt`, `/api/random-meme`,
//! `/memes/random`, `/api/csp-report` and `/api/daily-quiz`.
//!
//! Each has a route id for `AXUM_DISABLED_ROUTES`: `robots`, `random-meme`,
//! `memes-random`, `csp-report`, `daily-quiz`.

mod csp_report;
pub mod daily_quiz;
mod js;
pub mod quiz;
mod random;
mod rate_limit;
mod robots;

use std::sync::Arc;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{Request, State};
use axum::http::HeaderMap;
use axum::http::header::HOST;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, post};

use self::random::RedirectTargets;
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

    let limiter = Arc::new(RateLimiter::new(csp_report::now_ms()));
    let api = Routes::new(state)
        .add("random-meme", "/api/random-meme", get(random::json))
        .add(
            "csp-report",
            "/api/csp-report",
            post(move |request: Request| csp_report::report(limiter.clone(), request)),
        )
        .add("daily-quiz", "/api/daily-quiz", get(daily_quiz::daily_quiz));

    // Only the paths outside /api: proxy.ts never runs for /api.
    pages
        .build()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            www_to_upstream,
        ))
        .merge(api.build())
}

/// Leaves requests for the `www` host to Next. `proxy.ts` answers them with a
/// 301 to the apex host before any route runs, and that logic has not moved
/// here yet (PLAN.md, stage 4). This sits outside the native-route header
/// layer, so the upstream's answer goes back untouched.
async fn www_to_upstream(State(state): State<AppState>, request: Request, next: Next) -> Response {
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

/// A response body with no declared size.
///
/// Next sends route handler bodies chunked, without `Content-Length`, and its
/// `HEAD` answers carry no length either. Given a body of known size, axum
/// adds a `Content-Length`, also to the `HEAD` answer.
fn unsized_body(bytes: impl Into<Bytes>) -> Body {
    Body::from_stream(Body::from(bytes.into()).into_data_stream())
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
