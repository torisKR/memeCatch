//! `GET /{locale}/explore` (`app/[locale]/explore/page.tsx`): the reviewed
//! translations of an edition, as cards (`getLocalizedExploreMemes`). It is
//! indexable only when the list has entries and the address has no query.

use std::collections::HashMap;
use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use serde::Deserialize;
use serde_json::json;

use super::document::{self, Head, ShareImage, Site};
use super::home::edition::EDITIONS;
use super::home::localized;
use super::i18n::Locale;
use super::meme_card;
use super::{DYNAMIC_PAGE_CACHE, html_in, path_and_query};
use crate::AppState;
use crate::routes::public::labels::meme_path;
use crate::routes::public::localized::explored;

/// `LOCALIZED_EXPLORE_COPY` (`server/i18n/locale-explore.json`).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Copy {
    title: String,
    description: String,
    intro: String,
    read: String,
    home: String,
    original_explore: String,
    empty_title: String,
    empty_description: String,
    unavailable_title: String,
    unavailable_description: String,
    /// With `{count}`.
    result_summary: String,
}

static COPY: LazyLock<HashMap<String, Copy>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/locale-explore.json"))
        .expect("locale-explore.json")
});

/// `MOBILE_CARD_CLEARANCE` of components/mobile-card-clearance.ts.
const MOBILE_CARD_CLEARANCE: &str = "max-md:pb-[calc(4.5rem+4rem+1rem)]";

pub fn paths() -> Vec<String> {
    EDITIONS
        .iter()
        .map(|code| format!("/{code}/explore"))
        .collect()
}

/// `hasQuery`: any parameter with a value.
fn has_query(pairs: &[(String, String)]) -> bool {
    pairs.iter().any(|(_, value)| !value.is_empty())
}

/// `ExploreJsonLd`.
fn json_ld(site: &Site, code: &str, copy: &Copy) -> Markup {
    let data = json!({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": copy.title,
        "description": copy.description,
        "url": site.absolute(&format!("/{code}/explore")),
        "inLanguage": code,
        "isPartOf": { "@type": "WebSite", "name": "MemeCatch", "url": site.absolute(&format!("/{code}")) },
    });
    let text = data.to_string().replace('<', "\\u003c");
    html! { script type="application/ld+json" { (PreEscaped(text)) } }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let code = request
        .uri()
        .path()
        .trim_start_matches('/')
        .split('/')
        .next()
        .unwrap_or_default();
    let Some(code) = EDITIONS.into_iter().find(|edition| *edition == code) else {
        return crate::proxy::forward(State(state), request).await;
    };
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(request.uri().query().unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    // `parseSort`: the first `sort`.
    let recent = pairs
        .iter()
        .find(|(key, _)| key == "sort")
        .is_some_and(|(_, value)| value == "recent");
    let target = path_and_query(&request).to_owned();
    let result = explored(&state.db, code, recent)
        .await
        .inspect_err(|error| tracing::warn!(%error, code, "localized explore not read"));
    let available = result.is_ok();
    let items = result.unwrap_or_default();
    let indexable = !items.is_empty() && !has_query(&pairs);
    let copy = &COPY[code];
    let site = &state.pages.site;
    let locale = Locale::get(code).expect("an edition is a locale");
    let language = locale.info().lang.as_str();
    let head = Head {
        title: copy.title.clone(),
        description: Some(copy.description.clone()),
        robots: Some(if indexable {
            "index, follow"
        } else {
            "noindex, follow"
        }),
        canonical: Some(format!("/{code}/explore")),
        image: Some(ShareImage::edition_default(site, code)),
        edition: Some(code),
        ..Head::default()
    };
    let main = html! {
        main lang=(language) dir="ltr" class="bg-background pb-16 text-foreground" {
            @if indexable { (json_ld(site, code, copy)) }
            section class="border-b border-border px-4 py-12 sm:py-16" {
                div class="mx-auto max-w-site" {
                    h1 class="page-title max-w-3xl" { (copy.title) }
                    p class="mt-5 max-w-2xl text-lg leading-relaxed text-muted" { (copy.description) }
                    p class="mt-3 max-w-2xl text-sm leading-relaxed text-muted" { (copy.intro) }
                    a href=(localized(code, "/search")) class="mt-7 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" { (copy.read) }
                }
            }
            section aria-labelledby="localized-explore-results" class="mx-auto max-w-site px-4 py-12" {
                div class="flex flex-wrap items-end justify-between gap-3" {
                    div {
                        h2 id="localized-explore-results" class="text-2xl font-black tracking-tight" {
                            (copy.result_summary.replace("{count}", &items.len().to_string()))
                        }
                    }
                    a href=(localized(code, "/")) class="text-sm font-semibold text-muted underline decoration-border underline-offset-4 hover:text-accent" { (copy.home) }
                }
                @if !available {
                    div role="alert" class="mt-6 rounded-2xl border border-border bg-surface p-6" {
                        p class="font-bold" { (copy.unavailable_title) }
                        p class="mt-2 text-sm leading-relaxed text-muted" { (copy.unavailable_description) }
                    }
                } @else if items.is_empty() {
                    div role="status" class="mt-6 rounded-2xl border border-border bg-surface p-6" {
                        p class="font-bold" { (copy.empty_title) }
                        p class="mt-2 text-sm leading-relaxed text-muted" { (copy.empty_description) }
                        a href="/explore" data-localized-explore-original-action="true" class="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" { (copy.original_explore) }
                    }
                }
                @if !items.is_empty() {
                    ul aria-label=(copy.title) class={"mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3 " (MOBILE_CARD_CLEARANCE)} {
                        @for (index, meme) in items.iter().enumerate() {
                            li class="min-w-0" {
                                (meme_card::card_priority(&meme.card, Some(&localized(code, &meme_path(&meme.short_id, &meme.slug))), index < 6, code))
                            }
                        }
                    }
                }
            }
        }
    };
    html_in(
        StatusCode::OK,
        DYNAMIC_PAGE_CACHE,
        language,
        document::page_in(site, &head, &target, main, locale),
    )
}
