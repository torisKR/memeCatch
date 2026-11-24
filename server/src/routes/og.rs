//! Open Graph images drawn here (`crate::og`):
//!
//! | id | route | Next |
//! | --- | --- | --- |
//! | `og-default` | `GET /og/{ko,en,ja,zh,zh-tw,ar}` | `app/og/[locale]/route.ts`, prerendered |
//! | `opengraph-image` | `GET /opengraph-image` | `app/opengraph-image.tsx`, prerendered (the Korean card) |
//! | `og-quiz` | `GET /og/quiz/{token}` | `app/og/quiz/[token]/route.ts` |
//!
//! `HEAD` gets the same headers. Left to Next: other methods (Next answers
//! the prerendered card to a `POST` of `/og/{locale}` and 405 to the
//! others), any other `/og/{segment}` (Next renders its 404 once and keeps
//! it), and a quiz token with a `%` in the path (Next decodes and trims it).
//!
//! `proxy.ts` runs on these paths: `Content-Language: ko` on every answer,
//! and the www host goes to Next (`www_to_upstream`).

use std::sync::Arc;

use axum::Router;
use axum::body::Bytes;
use axum::extract::Request;
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use tokio::sync::OnceCell;

use super::Routes;
use crate::og::{Renderer, default_card, quiz_card};
use crate::AppState;

const DEFAULT_CACHE: &str = "public, max-age=86400";
/// The header next/og sets, kept for the prerendered root card.
const ROOT_CACHE: &str = "public, max-age=0, must-revalidate";
const QUIZ_CACHE: &str = "public, max-age=86400, s-maxage=604800";

/// The cards drawn once, as Next prerenders them at build time.
#[derive(Default)]
pub(crate) struct Prerendered {
    renderer: Renderer,
    cards: [OnceCell<Bytes>; default_card::LOCALES.len()],
}

impl Prerendered {
    /// `renderOgDefaultImage(locale)`: an unknown locale is the English
    /// card, Arabic the committed PNG.
    pub(crate) async fn png(&self, locale: &str) -> Result<Bytes, String> {
        if locale == "ar" {
            return Ok(Bytes::from_static(default_card::AR_PNG));
        }
        let index = default_card::LOCALES
            .iter()
            .position(|(code, _)| *code == locale)
            .or_else(|| {
                default_card::LOCALES
                    .iter()
                    .position(|(code, _)| *code == "en")
            })
            .ok_or("no English card")?;
        self.card(index).await
    }

    async fn card(&self, index: usize) -> Result<Bytes, String> {
        let (locale, _) = default_card::LOCALES[index];
        self.cards[index]
            .get_or_try_init(|| async {
                let svg = default_card::svg(locale).ok_or("no card for the locale")?;
                self.renderer.png(svg).await.map(Bytes::from)
            })
            .await
            .cloned()
    }
}

pub fn router(state: &AppState) -> Router<AppState> {
    let cards = Arc::new(Prerendered::default());
    let (for_root, for_quiz) = (cards.clone(), cards.renderer.clone());
    let share = super::og_share::router(state, cards.renderer.clone(), cards.clone());
    Routes::new(state)
        .add(
            "og-default",
            "/og/{locale}",
            get(move |request: Request| default_route(cards.clone(), request)),
        )
        .add(
            "opengraph-image",
            "/opengraph-image",
            get(move |request: Request| root_route(for_root.clone(), request)),
        )
        .add(
            "og-quiz",
            "/og/quiz/{token}",
            get(move |request: Request| quiz_route(for_quiz.clone(), request)),
        )
        .build()
        .merge(share)
}

fn png(body: Bytes, cache_control: &'static str, prerendered: bool) -> Response {
    let mut response = (
        [
            (CONTENT_TYPE, "image/png"),
            (CACHE_CONTROL, cache_control),
            (CONTENT_LANGUAGE, "ko"),
        ],
        body,
    )
        .into_response();
    if prerendered {
        response
            .headers_mut()
            .insert("x-nextjs-cache", HeaderValue::from_static("HIT"));
    }
    response
}

/// A card that could not be drawn: 500, not kept by any cache.
fn render_failed(request: &Request, error: &str) -> Response {
    tracing::error!(%error, path = request.uri().path(), "open graph render failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        [
            (CONTENT_TYPE, "text/plain; charset=utf-8"),
            (CACHE_CONTROL, "no-store"),
        ],
        "Internal Server Error",
    )
        .into_response()
}

/// No card at this address.
fn card_not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        [
            (CONTENT_TYPE, "text/plain; charset=utf-8"),
            (CONTENT_LANGUAGE, "ko"),
        ],
        "Not found",
    )
        .into_response()
}

async fn default_route(
    cards: Arc<Prerendered>,
    request: Request,
) -> Response {
    let locale = request.uri().path().trim_start_matches("/og/");
    if locale == "ar" {
        // Next serves the committed PNG (`renderOgDefaultImage("ar")`).
        return png(
            Bytes::from_static(default_card::AR_PNG),
            DEFAULT_CACHE,
            true,
        );
    }
    let Some(index) = default_card::LOCALES
        .iter()
        .position(|(code, _)| *code == locale)
    else {
        return card_not_found();
    };
    match cards.card(index).await {
        Ok(body) => png(body, DEFAULT_CACHE, true),
        Err(error) => render_failed(&request, &error),
    }
}

async fn root_route(cards: Arc<Prerendered>, request: Request) -> Response {
    // `app/opengraph-image.tsx` is `renderOgDefaultImage("ko")`.
    match cards.card(0).await {
        Ok(body) => png(body, ROOT_CACHE, true),
        Err(error) => render_failed(&request, &error),
    }
}

async fn quiz_route(renderer: Renderer, request: Request) -> Response {
    let token = request.uri().path().trim_start_matches("/og/quiz/");
    // The segment is decoded first; one that does not decode is no token.
    let token = percent_encoding::percent_decode_str(token)
        .decode_utf8()
        .unwrap_or_default();
    let Some(result) = quiz_card::decode_token(&token) else {
        return card_not_found();
    };
    match renderer.png(quiz_card::svg(&result)).await {
        Ok(body) => png(Bytes::from(body), QUIZ_CACHE, false),
        Err(error) => render_failed(&request, &error),
    }
}
