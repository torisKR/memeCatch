//! `GET /{locale}/search` (`app/[locale]/search/page.tsx`): the Korean
//! search (`searchMemes`, this year's trending memes) shown in an edition.
//! A result with a reviewed translation (`getLocalizedSearchMemesResult`)
//! is that translation's card; any other is the Korean card, marked as the
//! Korean original. Never indexed.
//!
//! The box, the suggestions and the in-place body are B2's (`search.rs`,
//! `ui/search-page.js`), with the edition's copy and its own body route
//! (`/_axum/{locale}/search/body`).

use std::collections::HashMap;
use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};
use serde::Deserialize;
use serde_json::{Value, json};

use super::document::{self, Head, ShareImage};
use super::explore::{self, Item};
use super::home::edition::EDITIONS;
use super::home::localized;
use super::i18n::Locale;
use super::meme_card::{self, MIN_LISTING};
use super::search::{self, GRID, Tone};
use super::{DYNAMIC_PAGE_CACHE, html_in, path_and_query};
use crate::AppState;
use crate::routes::public::labels::meme_path;
use crate::routes::public::localized::{LocalizedMeme, search as localized_search};

/// `getTrendingMemes(8)`, of which six are the fallback grid.
const FALLBACK_CARDS: usize = 6;

#[derive(Deserialize)]
struct Summary {
    one: String,
    /// With `{query}` and `{count}`.
    other: String,
}

/// `GLOBAL_SEARCH_COPY` (`server/i18n/locale-search.json`).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Copy {
    title: String,
    description: String,
    result_section: String,
    result_summary: Summary,
    fallback_label: String,
    no_result_label: String,
    no_result_title: String,
    no_result_description: String,
    /// With `{query}`.
    submit: String,
    trending_title: String,
    input: Value,
}

/// The empty-coverage panel's copy of `LOCALIZED_EXPLORE_COPY`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExploreCopy {
    eyebrow: String,
    empty_title: String,
    empty_description: String,
    original_explore: String,
}

static COPY: LazyLock<HashMap<String, Copy>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/locale-search.json")).expect("locale-search.json")
});

static EXPLORE_COPY: LazyLock<HashMap<String, ExploreCopy>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/locale-explore.json"))
        .expect("locale-explore.json")
});

pub fn paths() -> Vec<String> {
    EDITIONS
        .iter()
        .map(|code| format!("/{code}/search"))
        .collect()
}

pub fn body_paths() -> Vec<String> {
    EDITIONS
        .iter()
        .map(|code| format!("/_axum/{code}/search/body"))
        .collect()
}

/// The edition a path names: its first segment, or the one after `/_axum`.
fn edition(path: &str) -> Option<&'static str> {
    let mut segments = path.trim_start_matches('/').split('/');
    let first = segments.next().unwrap_or_default();
    let code = if first == "_axum" {
        segments.next().unwrap_or_default()
    } else {
        first
    };
    EDITIONS.into_iter().find(|edition| *edition == code)
}

impl Copy {
    /// `resultSummary(query, count)`.
    fn summary(&self, query: &str, count: usize) -> String {
        if count == 1 {
            self.result_summary.one.replace("{query}", query)
        } else {
            self.result_summary
                .other
                .replace("{count}", &count.to_string())
                .replace("{query}", query)
        }
    }
}

/// `shouldOfferLocalizedSearchRecovery`: Korean results, none translated,
/// and the translations were read.
fn offers_original(query: &str, results: usize, localized: Option<usize>) -> bool {
    !query.is_empty() && results > 0 && localized == Some(0)
}

struct Body {
    results: usize,
    trending_titles: Vec<String>,
    markup: Markup,
}

/// One card of a grid: the translation's when there is one, else the Korean
/// card under the "Korean original" label, in Korean.
fn cell(code: &str, copy: &Copy, item: &Item, translation: Option<&LocalizedMeme>) -> Markup {
    let card = match translation {
        Some(meme) => meme_card::card_priority(
            &meme.card,
            Some(&localized(code, &meme_path(&meme.short_id, &meme.slug))),
            false,
            code,
        ),
        None => meme_card::card_priority(&item.meme, Some(&item.meme.path()), false, code),
    };
    html! {
        li class="min-w-0" {
            div lang=[translation.is_none().then_some("ko")] class="flex h-full flex-col gap-2" {
                @if translation.is_none() {
                    span class="text-xs font-semibold text-muted" { (copy.fallback_label) }
                }
                (card)
            }
        }
    }
}

/// `getLocalizedSearchMemesResult` of the results and the trending memes:
/// `None` when the translations or the discovery index were not read.
async fn translations(
    state: &AppState,
    code: &'static str,
    cards: &[&Item],
) -> Option<HashMap<String, LocalizedMeme>> {
    let ids: Vec<&str> = cards
        .iter()
        .map(|item| item.meme.short_id.as_str())
        .collect();
    if ids.iter().all(|id| id.is_empty()) {
        return Some(HashMap::new());
    }
    let discovery = explore::discovery(state).await?;
    localized_search(&state.db, code, &ids, &discovery, false)
        .await
        .inspect_err(|error| tracing::warn!(%error, code, "localized search not read"))
        .ok()
}

async fn body(state: &AppState, code: &'static str, query: &str) -> Option<Body> {
    let results = if query.is_empty() {
        Vec::new()
    } else {
        match search::search_memes(&state.db, query).await {
            Ok(results) => results,
            Err(error) => {
                tracing::warn!(%error, "search_memes failed");
                return None;
            }
        }
    };
    let trending = search::trending(&state.db).await;
    let all: Vec<&Item> = results.iter().chain(&trending).collect();
    let translated = translations(state, code, &all).await;
    let empty = HashMap::new();
    let by_id = translated.as_ref().unwrap_or(&empty);
    let localized_results = translated.as_ref().map(|items| {
        results
            .iter()
            .filter(|item| items.contains_key(&item.meme.short_id))
            .count()
    });
    let copy = &COPY[code];
    let explore = &EXPLORE_COPY[code];
    let needs_fallback = query.is_empty() || results.is_empty();
    let cell = |item: &Item| cell(code, copy, item, by_id.get(&item.meme.short_id));
    let markup = html! {
        @if !query.is_empty() && !results.is_empty() {
            section aria-label=(copy.result_section) class="mt-8" {
                p class="text-base text-muted" { (copy.summary(query, results.len())) }
                // `TrackedBlock`: ui/page.js reports the card followed.
                div data-track="search_result_click" {
                    ul class=(GRID) {
                        @for item in &results { (cell(item)) }
                    }
                }
            }
        }
        @if offers_original(query, results.len(), localized_results) {
            (search::status_panel(
                Tone::Waiting,
                false,
                &explore.eyebrow,
                &explore.empty_title,
                &explore.empty_description,
                html! {
                    div class="flex flex-wrap gap-3" {
                        a href="/explore" data-localized-search-original-action="true" class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" { (explore.original_explore) }
                    }
                },
            ))
        }
        @if !query.is_empty() && results.is_empty() {
            (search::status_panel(
                Tone::Missing,
                true,
                &copy.no_result_label,
                &copy.no_result_title,
                &copy.no_result_description,
                search::submit_link(query, &copy.submit.replace("{query}", query)),
            ))
        }
        @if needs_fallback && trending.len() >= MIN_LISTING {
            section aria-labelledby="search-trending" class="mt-8" {
                h2 id="search-trending" class="text-xl font-bold" { (copy.trending_title) }
                ul class=(GRID) {
                    @for item in trending.iter().take(FALLBACK_CARDS) { (cell(item)) }
                }
            }
        }
    };
    Some(Body {
        results: results.len(),
        trending_titles: trending
            .iter()
            .map(|item| item.meme.title.clone())
            .collect(),
        markup,
    })
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let Some(code) = edition(request.uri().path()) else {
        return super::not_found::locale_response(
            &state.pages.site,
            super::path_and_query(&request),
        );
    };
    let query = search::query_of(request.uri().query());
    let Some(body) = body(&state, code, &query).await else {
        return super::error::response(&state.pages.site, super::path_and_query(&request));
    };
    let copy = &COPY[code];
    let site = &state.pages.site;
    let locale = Locale::get(code).expect("an edition is a locale");
    let head = Head {
        title: copy.title.clone(),
        description: Some(copy.description.clone()),
        robots: Some("noindex, follow"),
        canonical: Some(format!("/{code}/search")),
        image: Some(ShareImage::edition_default(site, code)),
        script: Some("search-page"),
        edition: Some(code),
        ..Head::default()
    };
    let config = json!({
        "query": query,
        "results": body.results,
        "body": format!("/_axum/{code}/search/body"),
    });
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-6" data-search-page=(config) {
            h1 class="page-title" { (copy.title) }
            p class="page-lede" { (copy.description) }
            (search::input(&query, &body.trending_titles, Some(&copy.input)))
            (body.markup)
        }
    };
    html_in(
        StatusCode::OK,
        DYNAMIC_PAGE_CACHE,
        locale.info().lang.as_str(),
        document::page_in(site, &head, path_and_query(&request), main, locale),
    )
}

/// `GET /_axum/{locale}/search/body?q=`: what follows the box.
pub async fn body_fragment(State(state): State<AppState>, request: Request) -> Response {
    let Some(code) = edition(request.uri().path()) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let query = search::query_of(request.uri().query());
    match body(&state, code, &query).await {
        Some(body) => search::fragment(body.results, body.markup),
        None => StatusCode::SERVICE_UNAVAILABLE.into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_edition_is_the_first_segment_or_the_one_after_axum() {
        assert_eq!(edition("/en/search"), Some("en"));
        assert_eq!(edition("/_axum/zh-tw/search/body"), Some("zh-tw"));
        assert_eq!(edition("/ko/search"), None);
    }

    #[test]
    fn english_counts_one_result_in_the_singular() {
        let copy = &COPY["en"];

        assert_eq!(copy.summary("a{count}", 1), "1 result for “a{count}”.");
        assert_eq!(copy.summary("a{count}", 2), "2 results for “a{count}”.");
        assert_eq!(COPY["ja"].summary("x", 1), "「x」の検索結果 1件");
    }

    #[test]
    fn the_original_explore_is_offered_only_for_untranslated_results() {
        assert!(offers_original("q", 2, Some(0)));
        assert!(!offers_original("q", 2, Some(1)));
        assert!(!offers_original("q", 2, None));
        assert!(!offers_original("q", 0, Some(0)));
        assert!(!offers_original("", 2, Some(0)));
    }
}
