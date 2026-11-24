//! `GET /collections` (`app/(default)/collections/page.tsx`), the themed
//! lists grouped, and `GET /collections/{slug}`
//! (`app/(default)/collections/[slug]/page.tsx`), one list: up to 48
//! indexable memes as cards, linked to each other for the meme page's
//! previous and next. The lists are lib/collections.ts, exported to
//! `i18n/collections.json` by `scripts/build-i18n.mjs`.
//!
//! An unknown slug and a list that cannot be read are Next's.

use std::sync::{Arc, LazyLock};
use std::time::Duration;

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;

use super::cache::Keyed;
use super::document::{self, Head, ShareImage};
use super::meme_card::{self, CardMeme};
use super::{html_cached, json_ld, path_and_query};
use crate::db::Db;
use crate::{AppState, proxy};

const COLLECTIONS_JSON: &str = include_str!("../../i18n/collections.json");
const INDEX_TITLE: &str = "테마별 밈 모음";
const INDEX_DESCRIPTION: &str = "최신 밈부터 시대별·주제별 한국 밈까지, 목적에 맞게 편집한 밈캐치 모음을 살펴보세요. 모음마다 소개글이 있고, 뜻·유래·사용 신호를 정리한 밈 문서로 바로 이어져요. 유행어·짤·챌린지별로도 골라 볼 수 있어요.";
/// `Cache-Control` of the index, prerendered at build time.
const INDEX_CACHE: &str = "s-maxage=31536000";
/// `revalidate = 86400` of a list, as Next sends it once the page is cached.
const LIST_CACHE: &str = "s-maxage=86400, stale-while-revalidate=31449600";
/// `LIMIT`: the indexable memes a list links.
const LIMIT: usize = 48;
// Next keeps a list a day and drops it on a catalog edit, which this process
// does not hear about: it reads again sooner.
pub const LIST_TTL: Duration = Duration::from_secs(300);
// Twelve lists of 48 cards, a few hundred bytes each.
pub const LIST_MAX_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum Filter {
    Decade { from: i32, to: i32 },
    Category { category: String },
    Beginner,
    Latest,
    Keywords { terms: Vec<String> },
}

/// `CollectionDef`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Collection {
    slug: String,
    title: String,
    description: String,
    intro: String,
    filter: Filter,
    explore_query: String,
}

#[derive(Deserialize)]
struct Group {
    key: String,
    eyebrow: String,
    title: String,
    description: String,
    slugs: Vec<String>,
}

#[derive(Deserialize)]
struct Catalog {
    collections: Vec<Collection>,
    groups: Vec<Group>,
}

static CATALOG: LazyLock<Catalog> =
    LazyLock::new(|| serde_json::from_str(COLLECTIONS_JSON).expect("i18n/collections.json parses"));

fn find(slug: &str) -> Option<&'static Collection> {
    CATALOG
        .collections
        .iter()
        .find(|collection| collection.slug == slug)
}

/// The lists by slug, cached.
pub type Lists = Keyed<&'static str, Arc<Vec<CardMeme>>>;

pub fn lists() -> Lists {
    Keyed::new(LIST_TTL, LIST_MAX_BYTES, |cards| {
        cards
            .iter()
            .map(|card| card.title.len() + card.summary.len() + 256)
            .sum()
    })
}

pub async fn index(State(state): State<AppState>, request: Request) -> Response {
    let site = &state.pages.site;
    let head = Head {
        title: INDEX_TITLE.to_owned(),
        description: Some(INDEX_DESCRIPTION.to_owned()),
        canonical: Some("/collections".to_owned()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let ordered: Vec<&Collection> = CATALOG
        .groups
        .iter()
        .flat_map(|group| group.slugs.iter().filter_map(|slug| find(slug)))
        .collect();
    let items: Vec<(String, String)> = ordered
        .iter()
        .map(|collection| {
            (
                collection.title.clone(),
                format!("/collections/{}", collection.slug),
            )
        })
        .collect();
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-8" data-ads=[site.ads_client()] {
            (json_ld::collection_page(site, INDEX_TITLE, Some(INDEX_DESCRIPTION), "/collections", items.len(), 0, &items))
            nav aria-label="브레드크럼" class="text-sm text-muted" {
                a class="hover:text-foreground" href="/" { "밈캐치" }
                " "
                span aria-hidden="true" { "›" }
                " 밈 모음"
            }
            header class="mt-6 max-w-3xl" {
                h1 class="page-title" { "흩어진 밈을," br; "맥락별로 모았습니다." }
                p class="page-lede" { "최신 유행을 따라가거나 한 시대의 분위기를 되짚고 싶을 때, 전체 목록을 헤매지 않고 목적에 맞는 모음에서 시작하세요." }
            }
            div class="mt-12 space-y-14" {
                @for (index, group) in CATALOG.groups.iter().enumerate() {
                    (group_section(index, group))
                }
            }
        }
    };
    let document = document::page(site, &head, path_and_query(&request), main);
    html_cached(StatusCode::OK, INDEX_CACHE, document)
}

fn group_section(index: usize, group: &Group) -> Markup {
    let id = format!("collection-group-{}", group.key);
    html! {
        section aria-labelledby=(id) {
            div class="grid gap-3 border-b border-border pb-4 sm:grid-cols-[8rem_1fr] sm:items-end" {
                p class="stat-mono text-xs font-semibold tracking-[0.14em] text-(--signal-cyan)" { "0" (index + 1) " / " (group.eyebrow) }
                div class="flex flex-wrap items-end justify-between gap-2" {
                    h2 id=(id) class="text-2xl font-extrabold" { (group.title) }
                    p class="text-sm text-muted" { (group.description) }
                }
            }
            ul {
                @for collection in group.slugs.iter().filter_map(|slug| find(slug)) {
                    li class="border-b border-border" {
                        a class="hover-glow-flame group grid min-h-28 gap-3 rounded-xl py-5 transition-colors hover:text-accent sm:grid-cols-[8rem_1fr_auto] sm:items-center" href=(format!("/collections/{}", collection.slug)) {
                            span class="font-mono text-xs uppercase tracking-[0.12em] text-muted" { (collection.slug) }
                            span {
                                span class="block text-lg font-extrabold text-foreground transition-colors group-hover:text-accent" { (collection.title) }
                                span class="mt-1 block max-w-2xl text-sm leading-relaxed text-muted" { (collection.description) }
                            }
                            span aria-hidden="true" class="hidden text-xl sm:block" { "↗" }
                        }
                    }
                }
            }
        }
    }
}

/// The `where` and `order by` of `loadMemes` for a filter, and the values
/// it binds. Built from constants and the numbers of the catalog only.
fn query(filter: &Filter) -> (String, &'static str, Vec<String>) {
    let mut binds = Vec::new();
    let (condition, order) = match filter {
        Filter::Decade { from, to } => (
            format!("m.origin_year >= {from} and m.origin_year <= {to}"),
            "m.trend_score desc",
        ),
        Filter::Category { category } => {
            binds.push(category.clone());
            ("m.category::text = $1".to_owned(), "m.trend_score desc")
        }
        Filter::Beginner => (
            "m.difficulty::text = 'beginner'".to_owned(),
            "m.trend_score desc",
        ),
        Filter::Latest => ("true".to_owned(), "m.published_at desc nulls last"),
        Filter::Keywords { terms } => {
            let mut any = Vec::new();
            for term in terms {
                binds.push(format!("%{term}%"));
                let n = binds.len();
                any.extend(
                    ["title", "summary", "origin"].map(|column| format!("m.{column} ilike ${n}")),
                );
            }
            (format!("({})", any.join(" or ")), "m.trend_score desc")
        }
    };
    (
        format!("m.moderation_status in ('approved', 'limited') and {condition}"),
        order,
        binds,
    )
}

async fn read(db: &Db, filter: &'static Filter) -> Result<Arc<Vec<CardMeme>>, sqlx::Error> {
    let (condition, order, binds) = query(filter);
    let order = format!("{order}, m.id desc");
    let mut cards = meme_card::indexable(
        db,
        &condition,
        &order,
        meme_card::scan_limit(LIMIT),
        LIMIT,
        binds,
    )
    .await?;
    // `hasPublicListing`.
    if cards.len() < meme_card::MIN_LISTING {
        cards.clear();
    }
    Ok(Arc::new(cards))
}

pub async fn list(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    request: Request,
) -> Response {
    let Some(collection) = find(&slug) else {
        return proxy::forward(State(state), request).await;
    };
    let loaded = state
        .pages
        .collections
        .get_or_load(collection.slug.as_str(), || {
            read(&state.db, &collection.filter)
        })
        .await;
    let cards = match loaded {
        Ok(cards) => cards,
        Err(error) => {
            tracing::warn!(%error, slug, "collection read failed");
            return proxy::forward(State(state), request).await;
        }
    };
    let site = &state.pages.site;
    let path = format!("/collections/{}", collection.slug);
    let head = Head {
        title: collection.title.clone(),
        description: Some(collection.description.clone()),
        canonical: Some(path.clone()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let items: Vec<(String, String)> = cards
        .iter()
        .take(10)
        .map(|card| (card.title.clone(), card.path()))
        .collect();
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" data-ads=[site.ads_client()] {
            (json_ld::collection_page(site, &collection.title, Some(&collection.description), &path, cards.len(), 0, &items))
            nav aria-label="브레드크럼" class="text-sm text-muted" {
                a class="hover:text-foreground" href="/" { "밈캐치" }
                " "
                span aria-hidden="true" { "›" }
                " "
                a class="hover:text-foreground" href="/collections" { "밈 모음" }
            }
            h1 class="mt-2 text-3xl font-extrabold tracking-tight" { (collection.title) }
            p class="mt-3 max-w-2xl text-base leading-relaxed text-muted" { (collection.intro) }
            @if !cards.is_empty() {
                (meme_card::grid("mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6", cards.iter().enumerate().map(|(index, card)| {
                    meme_card::card(card, Some(&context_href(collection, &cards, index)))
                })))
                div class="mt-8 flex flex-wrap gap-3" {
                    a class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-[filter] hover:brightness-95 active:scale-[0.97]" href=(explore_href(collection)) {
                        "전체 탐색에서 더 보기 "
                        span aria-hidden="true" class="ml-1" { "→" }
                    }
                    a class="inline-flex min-h-11 items-center rounded-full border border-border px-6 text-base font-semibold" href="/memes" { "밈 전체 목록(가나다순)" }
                }
            }
            section aria-labelledby="other-collections" class="mt-12" {
                div class="flex items-center justify-between gap-3" {
                    h2 id="other-collections" class="text-lg font-bold" { "다른 모음도 보기" }
                    a class="text-sm font-semibold text-muted hover:text-accent" href="/collections" { "전체 모음 →" }
                }
                ul class="mt-3 flex flex-wrap gap-2" {
                    @for other in CATALOG.collections.iter().filter(|other| other.slug != collection.slug) {
                        li {
                            a class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" href=(format!("/collections/{}", other.slug)) { (other.title) }
                        }
                    }
                }
            }
        }
    };
    let document = document::page(site, &head, path_and_query(&request), main);
    html_cached(StatusCode::OK, LIST_CACHE, document)
}

fn explore_href(collection: &Collection) -> String {
    if collection.explore_query.is_empty() {
        "/explore".to_owned()
    } else {
        format!("/explore?{}", collection.explore_query)
    }
}

/// The card's link with the list as its context: `ctx`, `prev`, `next`, `i`
/// and `total`, serialized as `URLSearchParams` does.
fn context_href(collection: &Collection, cards: &[CardMeme], index: usize) -> String {
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    query.append_pair("ctx", &collection.slug);
    if let Some(prev) = index.checked_sub(1).and_then(|prev| cards.get(prev)) {
        query.append_pair("prev", &prev.path());
    }
    if let Some(next) = cards.get(index + 1) {
        query.append_pair("next", &next.path());
    }
    query.append_pair("i", &(index + 1).to_string());
    query.append_pair("total", &cards.len().to_string());
    format!("{}?{}", cards[index].path(), query.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_group_names_lists_that_exist() {
        for group in &CATALOG.groups {
            for slug in &group.slugs {
                assert!(find(slug).is_some(), "{slug}");
            }
        }
        assert_eq!(CATALOG.collections.len(), 12);
    }

    #[test]
    fn a_keyword_list_binds_each_term_once_for_three_columns() {
        let (condition, _, binds) = query(&find("game").unwrap().filter);
        assert_eq!(binds.len(), 8);
        assert!(condition.contains("m.title ilike $8 or m.summary ilike $8 or m.origin ilike $8"));
        let (_, order, binds) = query(&find("latest").unwrap().filter);
        assert!(binds.is_empty());
        assert_eq!(order, "m.published_at desc nulls last");
    }
}
