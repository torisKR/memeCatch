//! `GET /search` (`app/(default)/search/page.tsx`): the keyword search
//! (`searchMemes`: curated cards and `search_memes`, merged), the semantic
//! reference search's button, the "not caught yet" panel, the themes, and
//! this year's trending memes as the fallback and the popular terms.
//!
//! What happens in the browser is `ui/search-page.js` (its own bundle): the
//! combobox with suggestions (Next's own `POST /api/db/query` plan), recent
//! and popular terms, the address that follows the box after 300 ms with
//! the body below the box replaced in place (`/_axum/search/body`), the
//! reference search, and the outcome events.
//!
//! A failed search read is an error Next streams (a 200 with its loading
//! skeleton): Next answers it, as for /memes (`PLAN.md` B2-3).

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use maud::{Markup, html};
use serde_json::json;

use super::document::{self, Head, ShareImage};
use super::explore::{self, Item};
use super::labels::category_tag;
use super::meme_card::{self, CARD_COLUMNS, MIN_LISTING};
use super::{DYNAMIC_PAGE_CACHE, collections, html, path_and_query};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::content_depth::{DEPTH_COLUMNS, row_depth};
use crate::routes::public::explore_previews;
use crate::routes::search;
use crate::{AppState, proxy};

const DESCRIPTION: &str = "밈 이름, 초성, 별칭으로 무슨 밈인지 바로 찾아보세요.";
/// `searchMemes(q)`: 20 results; `search_memes` returns at most 50 rows.
const LIMIT: usize = 20;
const ROWS: usize = 50;
/// `getTrendingMemes(8)`, of which six are the fallback grid.
const TRENDING: usize = 8;
const FALLBACK_CARDS: usize = 6;
const GRID: &str =
    "mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6 max-md:pb-[calc(4.5rem+4rem+1rem)]";
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];

fn indexable(rows: &[sqlx::postgres::PgRow], take: usize) -> Result<Vec<Item>, sqlx::Error> {
    let mut items = Vec::new();
    for row in rows {
        if items.len() == take {
            break;
        }
        if row_depth(row)?.is_indexable() {
            items.push(explore::query::item(row)?);
        }
    }
    Ok(items)
}

/// `search_memes(q, 50)` as `INDEXABLE_LIST_SELECT` of the public memes,
/// the indexable ones, in the function's order.
async fn rows(db: &Db, query: &str) -> Result<Vec<Item>, sqlx::Error> {
    let sql = format!(
        "select {CARD_COLUMNS}, {DEPTH_COLUMNS} from public.search_memes(p_query => $1, p_limit => $2) m \
          where m.moderation_status::text = any($3::text[])"
    );
    let query = query.to_owned();
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(sqlx::AssertSqlSafe(sql))
                    .bind(query)
                    .bind(ROWS as i32)
                    .bind(vec!["approved".to_owned(), "limited".to_owned()])
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    indexable(&rows, ROWS)
}

/// `searchMemes(q, 20)`: the curated cards, then the rows, one per
/// presentation key, the prefix widened until twenty or the end.
async fn search_memes(db: &Db, query: &str) -> Result<Vec<Item>, sqlx::Error> {
    let candidates: Vec<Item> = explore::curated(query)
        .into_iter()
        .chain(rows(db, query).await?)
        .collect();
    let indexed: Vec<(usize, &Item)> = candidates.iter().enumerate().collect();
    let merge = |end: usize| {
        search::merge_presentation(&indexed[..end.min(indexed.len())], |(_, item)| {
            (item.meme.id.as_str(), item.meme.short_id.as_str())
        })
    };
    let mut end = LIMIT;
    let mut merged = merge(end);
    while merged.len() < LIMIT && end < candidates.len() {
        end += LIMIT - merged.len();
        merged = merge(end);
    }
    let merged: Vec<usize> = merged.into_iter().map(|(index, _)| index).collect();
    let mut pool: Vec<Option<Item>> = candidates.into_iter().map(Some).collect();
    Ok(merged
        .into_iter()
        .filter_map(|index| pool[index].take())
        .collect())
}

/// `getTrendingMemes(8)`: this year's memes by trend. A failure is none.
async fn trending(db: &Db) -> Vec<Item> {
    let sql = format!(
        "select {CARD_COLUMNS}, {DEPTH_COLUMNS} from public.memes m \
          where m.moderation_status in ('approved', 'limited') \
            and (m.origin_year = 2026 or m.korea_viral_year = 2026) \
          order by m.trend_score desc, m.published_at desc, m.id asc limit {}",
        meme_card::scan_limit(TRENDING)
    );
    let read = async {
        let rows = db
            .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
                Box::pin(async move { sqlx::query(sqlx::AssertSqlSafe(sql)).fetch_all(tx).await })
            })
            .await?;
        indexable(&rows, TRENDING)
    };
    read.await
        .inspect_err(|error| tracing::warn!(%error, "search trending not read"))
        .unwrap_or_default()
}

/// `qualifySearchPreviews(cards)` and the cards: a curated card keeps its
/// own contents; a failed ledger read leaves every card without a preview.
async fn render_cards(db: &Db, items: &[Item]) -> Vec<Markup> {
    let checked = items
        .iter()
        .filter(|item| !item.curated)
        .map(|item| (item.meme.id.clone(), item.contents.clone()))
        .collect();
    let previews = explore_previews::ledger_previews(db, checked)
        .await
        .inspect_err(|error| tracing::warn!(%error, "search previews not read"))
        .ok();
    explore::cards(items, previews.as_deref())
}

/// `q` as `searchParams` gives it: a single value, trimmed.
fn query_of(query: Option<&str>) -> String {
    let mut values = url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
        .filter(|(key, _)| key == "q")
        .map(|(_, value)| value.into_owned());
    match (values.next(), values.next()) {
        (Some(value), None) => crate::routes::public::js::trim(&value).to_owned(),
        _ => String::new(),
    }
}

/// What the page shows of the data, or `None` when the search failed.
struct Body {
    results: usize,
    trending_titles: Vec<String>,
    markup: Markup,
}

async fn body(db: &Db, query: &str) -> Option<Body> {
    let results = if query.is_empty() {
        Vec::new()
    } else {
        match search_memes(db, query).await {
            Ok(results) => results,
            Err(error) => {
                tracing::warn!(%error, "search_memes failed");
                return None;
            }
        }
    };
    let needs_fallback = query.is_empty() || results.is_empty();
    let trending = trending(db).await;
    let shown: &[Item] = if needs_fallback {
        &trending[..trending.len().min(FALLBACK_CARDS)]
    } else {
        &results
    };
    let cards = render_cards(db, shown).await;
    let markup = html! {
        @if !query.is_empty() { (reference_search(query)) }
        @if !query.is_empty() && !results.is_empty() {
            section aria-label="검색 결과" class="mt-8" {
                p class="text-base text-muted" { "‘" (query) "’ 검색 결과 " span class="stat-mono" { (results.len()) } "개예요." }
                // `TrackedBlock`: ui/page.js reports the card followed (`track` drops the query).
                div data-track="search_result_click" {
                    ul class=(GRID) {
                        @for card in &cards { li class="min-w-0" { (card) } }
                    }
                }
            }
        }
        @if !query.is_empty() && results.is_empty() { (not_caught(query)) }
        @if query.is_empty() {
            section aria-labelledby="search-themes" class="mt-7" {
                h2 id="search-themes" class="text-lg font-bold" { "테마로 시작해 볼까요?" }
                ul class="mt-3 flex flex-wrap gap-2" {
                    @for (slug, title) in collections::first(6) {
                        li { a href=(format!("/collections/{slug}")) class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" { (title) } }
                    }
                }
            }
        }
        @if needs_fallback && trending.len() >= MIN_LISTING {
            section aria-labelledby="search-trending" class="mt-8" {
                h2 id="search-trending" class="text-xl font-bold" { "오늘의 급상승" }
                ul class=(GRID) {
                    @for card in &cards { li class="min-w-0" { (card) } }
                }
            }
        }
    };
    Some(Body {
        results: results.len(),
        trending_titles: trending
            .iter()
            .map(|card| card.meme.title.clone())
            .collect(),
        markup,
    })
}

/// `MemeReferenceSearch` before it is used: its button (for 2 to 120
/// UTF-16 units) and the rights note.
fn reference_search(query: &str) -> Markup {
    let units = query.encode_utf16().count();
    html! {
        section aria-label="상황에 맞는 밈" class="mt-4 rounded-2xl border border-border bg-surface p-4" data-search-reference {
            button type="button" disabled[!(2..=120).contains(&units)] class="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50" { "상황·의미로 찾기" }
            p class="mt-2 text-xs text-muted" { "참고 자료이며 재사용 권한은 별도로 확인해 주세요." }
            div role="status" aria-live="polite" class="mt-3 text-sm text-muted" {}
        }
    }
}

/// `StatusPanel` with `tone="missing"`.
fn not_caught(query: &str) -> Markup {
    let dot = |on: bool| {
        html! { span class="h-2 w-2 rounded-full " style=(if on { "background-color:var(--accent)" } else { "background-color:rgb(255 255 255 / 0.22)" }) {} }
    };
    let submit = format!(
        "/submit?name={}",
        crate::routes::public::js::encode_uri_component(query)
    );
    html! {
        div role="status" class="glass-panel relative overflow-hidden rounded-3xl px-6 py-7 text-center sm:px-8 sm:py-8 mt-6" {
            div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
            div class="relative mx-auto max-w-md" {
                img src="/brand/state-empty-search.webp" alt="" width="1024" height="768" loading="lazy" decoding="async" class="mx-auto mb-3 w-44 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-48";
                div class="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white" {
                    span aria-hidden="true" class="flex items-center gap-1" { (dot(true)) (dot(false)) (dot(false)) }
                    "아직 미포착"
                }
                p class="mt-4 text-xl font-extrabold tracking-tight" { "이 밈, 저희도 아직 몰라요" }
                p class="mt-1.5 text-base text-muted" { "제보해 주시면 뜻과 유래를 정리해서 알려드려요." }
                div class="mt-5 flex flex-wrap items-center justify-center gap-2.5" {
                    a rel="nofollow" class="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-[0.97]" href=(submit) { "‘" (query) "’ 제보하기" }
                }
            }
        }
    }
}

/// `SearchInput` as the server renders it (closed), with what the script
/// needs: the popular terms and the category tags of suggestions.
fn input(query: &str, popular: &[String]) -> Markup {
    html! {
        div class="relative mt-5" {
            div class="relative" data-search-box=(json!({ "popular": popular, "query": query })) {
                form role="search" {
                    label for="search-q" class="sr-only" { "밈 검색" }
                    div class="relative" {
                        svg viewBox="0 0 24 24" aria-hidden="true" class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" {
                            circle cx="11" cy="11" r="7" {}
                            path d="m20 20-3.5-3.5" {}
                        }
                        input id="search-q" name="q" type="search" value=(query) placeholder="무슨 밈인지 검색해보세요" autocomplete="off" enterkeyhint="search" autofocus[query.is_empty()] role="combobox" aria-expanded="false" aria-controls="search-suggest-listbox" aria-haspopup="listbox" aria-autocomplete="list" class="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20";
                    }
                }
                template data-search-tags {
                    @for category in CATEGORIES {
                        @if let Some(tag) = category_tag(category, "shrink-0") { span data-category=(category) { (tag) } }
                    }
                }
            }
        }
    }
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let query = query_of(request.uri().query());
    let Some(body) = body(&state.db, &query).await else {
        return proxy::forward(State(state), request).await;
    };
    let site = &state.pages.site;
    let head = Head {
        title: "검색".to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/search".to_owned()),
        image: Some(ShareImage::site_default(site)),
        script: Some("search-page"),
        ..Head::default()
    };
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-6" data-search-page=(json!({ "query": query, "results": body.results })) {
            h1 class="page-title" { "밈 검색" }
            p class="page-lede" { "이름·초성·별칭으로 바로 찾아보세요." }
            (input(&query, &body.trending_titles))
            (body.markup)
        }
    };
    html(
        StatusCode::OK,
        document::page(site, &head, path_and_query(&request), main),
    )
}

/// `GET /_axum/search/body?q=`: what follows the box for that query, and
/// the result count the outcome events report.
pub async fn body_fragment(State(state): State<AppState>, request: Request) -> Response {
    let query = query_of(request.uri().query());
    let Some(body) = body(&state.db, &query).await else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let payload = json!({ "results": body.results, "html": body.markup.into_string() });
    (
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        payload.to_string(),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_query_is_one_trimmed_value() {
        assert_eq!(query_of(Some("q=%20%EB%B0%88%20")), "밈");
        assert_eq!(query_of(Some("q=a&q=b")), "");
        assert_eq!(query_of(None), "");
        assert_eq!(query_of(Some("q=+")), "");
    }
}
