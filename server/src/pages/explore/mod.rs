//! `GET /explore` (`app/(default)/explore/page.tsx`): every public meme,
//! filtered and sorted by the address, 24 cards at a time
//! (`components/explore-filters.tsx`, `components/explore-grid.tsx`).
//!
//! The page answers the first window. The grid's later windows and its
//! preview retry come from two fragments under `/_axum/explore/` that
//! `ui/explore.js` asks for; it still sends `POST /api/explore/previews`
//! for each window, as the React grid does. The same address in place
//! (a filter, the sort, a search) is the third fragment, the page's body.
//!
//! What the query does is what `lib/db/execute.ts` compiled for
//! `buildQuery` on the test database (Postgres statement log), including
//! one TypeScript quirk: the platform filter compares `availability` with
//! the one-element list `{"(dead,region_blocked)"}`, so it drops contents
//! without an availability and keeps dead ones (`PLAN.md` B2-10).

pub(crate) mod query;
mod view;

use std::sync::Arc;
use std::time::Duration;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use maud::Markup;

use self::query::{Filters, Params};
use super::document::{self, Head, ShareImage};
use super::meme_card::{CardContent, CardMeme};
use super::{DYNAMIC_PAGE_CACHE, html, path_and_query};
use crate::AppState;
use crate::routes::public::explore_previews;
use crate::routes::public::localized::load_discovery_ids;
use crate::routes::public::meme_delivery::PreviewContent;
use crate::routes::search;

/// How long the discovery index is kept. Next keeps it an hour and drops it
/// on a catalog edit (`PLAN.md` B2-1).
pub const DISCOVERY_TTL: Duration = Duration::from_secs(300);
const TITLE: &str = "밈 탐색";
const DESCRIPTION: &str = "카테고리·연도·난이도로 거르고 급상승·최신·인기·논쟁 순으로 전체 밈을 탐색해요. 카드마다 뜻과 지금 써도 되는지 사용 신호가 붙어 있고, 플랫폼별 사례로도 좁힐 수 있어요. 가나다순 전체 목록도 있어요.";

/// One card of the grid: the meme, whether it is a curated card, and the
/// contents its preview is chosen from.
pub struct Item {
    pub meme: CardMeme,
    pub curated: bool,
    pub(crate) contents: Vec<PreviewContent>,
}

impl Item {
    /// `searchPresentationKey`.
    pub fn key(&self) -> String {
        search::presentation_key(&self.meme.short_id)
    }

    /// `preference` of `mergeSearchPresentationItems`.
    pub fn preference(&self) -> u8 {
        search::preference(&self.meme.id, &self.meme.short_id)
    }
}

/// The first window as the page renders it (`initialLoad`).
pub struct Load {
    pub items: Vec<Item>,
    /// Rows a catalog equivalent hid: `(id, key, preference)`.
    pub alternatives: Vec<(String, String, u8)>,
    pub unavailable: bool,
    pub scanned: usize,
    pub has_more: bool,
}

impl Load {
    fn failed() -> Self {
        Self {
            items: Vec::new(),
            alternatives: Vec::new(),
            unavailable: true,
            scanned: 0,
            has_more: false,
        }
    }
}

pub(crate) async fn discovery(state: &AppState) -> Option<Arc<Vec<String>>> {
    state
        .pages
        .discovery
        .get_or_load(|| async {
            load_discovery_ids(&state.db)
                .await
                .map(|ids| Arc::new(ids.into_iter().collect()))
        })
        .await
        .inspect_err(|error| tracing::warn!(%error, "explore discovery index not read"))
        .ok()
}

fn curated_items(filters: &Filters) -> Vec<Item> {
    filters.q.as_deref().map(curated).unwrap_or_default()
}

/// `curatedSearchCards(q)` as grid items (also /search's).
pub(crate) fn curated(q: &str) -> Vec<Item> {
    search::curated_search_cards(q)
        .into_iter()
        .map(|card| Item {
            meme: CardMeme {
                id: card.id,
                category: card.category,
                short_id: card.short_id,
                slug: card.slug,
                title: card.title,
                summary: card.summary,
                safety_level: card
                    .safety_level
                    .as_deref()
                    .and_then(super::labels::SafetyLevel::parse_known),
                origin_year: card.origin_year,
                trend_score: Some(100.0),
                // Its one content is a data: URL card, which is not owned art.
                contents: Vec::new(),
            },
            curated: true,
            contents: Vec::new(),
        })
        .collect()
}

/// The page's `initialLoad`: the curated cards of a search, then the
/// window, one card per presentation key.
async fn first_window(state: &AppState, filters: &Filters) -> Load {
    let Some(ids) = discovery(state).await else {
        return Load::failed();
    };
    let window = match query::window(&state.db, filters, &ids, 0).await {
        Ok(window) => window,
        Err(error) => {
            tracing::warn!(%error, "explore window not read");
            return Load::failed();
        }
    };
    let pool: Vec<Item> = curated_items(filters)
        .into_iter()
        .chain(window.items)
        .collect();
    let idents: Vec<(usize, String, String)> = pool
        .iter()
        .enumerate()
        .map(|(index, item)| (index, item.meme.id.clone(), item.meme.short_id.clone()))
        .collect();
    let winners: Vec<usize> = search::merge_presentation(&idents, |(_, id, short_id)| {
        (id.as_str(), short_id.as_str())
    })
    .into_iter()
    .map(|(index, ..)| index)
    .collect();
    // Rows that lost to another row of the same key, kept for a recheck.
    let alternatives = pool
        .iter()
        .filter(|item| {
            !item.curated
                && winners.iter().any(|winner| {
                    let winner = &pool[*winner];
                    winner.key() == item.key()
                        && winner.meme.id != item.meme.id
                        && winner.meme.short_id != item.meme.short_id
                })
        })
        .map(|item| (item.meme.id.clone(), item.key(), item.preference()))
        .collect();
    let mut pool: Vec<Option<Item>> = pool.into_iter().map(Some).collect();
    let items = winners
        .iter()
        .filter_map(|index| pool[*index].take())
        .collect();
    Load {
        items,
        alternatives,
        unavailable: false,
        scanned: window.scanned,
        has_more: window.has_more,
    }
}

/// `{ type, thumbnail_url, … }` of a preview, as the card reads it.
fn card_content(content: &PreviewContent) -> CardContent {
    CardContent {
        kind: content.kind.clone(),
        thumbnail_url: content.thumbnail_url.clone(),
        is_representative: content.is_representative,
        url: content.url.clone(),
        content_id: content.content_id.clone(),
        availability: content.availability.clone(),
        moderation_status: content.moderation_status.clone(),
        manual_video_verified: content.manual_video_verified,
    }
}

/// Each item's card: with its reviewed preview from `previews` (one entry
/// per non-curated item; `None`: the ledger was not read, so none has one),
/// and the meme's own contents for a curated card.
pub(crate) fn cards(items: &[Item], previews: Option<&[Vec<PreviewContent>]>) -> Vec<Markup> {
    let mut checked = previews.map(<[_]>::iter);
    items
        .iter()
        .map(|item| {
            if item.curated {
                return super::meme_card::card(&item.meme, None);
            }
            let preview: Vec<CardContent> = checked
                .as_mut()
                .and_then(Iterator::next)
                .map(|contents| contents.iter().map(card_content).collect())
                .unwrap_or_default();
            super::meme_card::card_previewing(&item.meme, None, &preview)
        })
        .collect()
}

/// `qualifySearchPreviews` of the non-curated items, in their order.
async fn previews(state: &AppState, items: &[Item]) -> Option<Vec<Vec<PreviewContent>>> {
    let cards = items
        .iter()
        .filter(|item| !item.curated)
        .map(|item| (item.meme.id.clone(), item.contents.clone()))
        .collect();
    explore_previews::qualify_cards(&state.db, &state.pages.previews, cards).await
}

/// The filters, the toolbar and the first window: the page's body below
/// its title, also the in-place fragment.
async fn body(state: &AppState, params: &Params) -> Markup {
    let filters = Filters::from(params);
    let load = first_window(state, &filters).await;
    let previews = previews(state, &load.items).await;
    let cards = cards(&load.items, previews.as_deref());
    view::body(params, &filters, &load, &cards, previews.is_none())
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let params = Params::parse(request.uri().query());
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/explore".to_owned()),
        image: Some(ShareImage::site_default(site)),
        script: Some("explore"),
        ..Head::default()
    };
    let main = view::page(site, body(&state, &params).await);
    html(
        StatusCode::OK,
        document::page(site, &head, path_and_query(&request), main),
    )
}

fn fragment(content_type: &'static str, body: String) -> Response {
    (
        [
            (CONTENT_TYPE, content_type),
            (CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        body,
    )
        .into_response()
}

/// `GET /_axum/explore/body?<the page's query>`: the body for the same
/// address, when a filter changes it in place.
pub async fn body_fragment(State(state): State<AppState>, request: Request) -> Response {
    let params = Params::parse(request.uri().query());
    fragment(
        "text/html; charset=utf-8",
        body(&state, &params).await.into_string(),
    )
}

#[derive(serde::Serialize)]
struct MoreItem {
    id: String,
    key: String,
    pref: u8,
    /// With the preview the ledger allows; the same as `plain` when the
    /// ledger was not read.
    card: String,
    plain: String,
}

#[derive(serde::Serialize)]
struct More {
    items: Vec<MoreItem>,
    scanned: usize,
    #[serde(rename = "hasMore")]
    has_more: bool,
}

/// `GET /_axum/explore/more?<the page's query>&from=<rows read>`: the next
/// window (`fetchFrom`), each card with and without its preview. The grid
/// decides which to show from its own `POST /api/explore/previews`.
pub async fn more(State(state): State<AppState>, request: Request) -> Response {
    let params = Params::parse(request.uri().query());
    let Some(from) = params
        .first("from")
        .and_then(|from| from.parse::<usize>().ok())
    else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    let filters = Filters::from(&params);
    let Some(ids) = discovery(&state).await else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let window = match query::window(&state.db, &filters, &ids, from).await {
        Ok(window) => window,
        Err(error) => {
            tracing::warn!(%error, "explore window not read");
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        }
    };
    let previews = previews(&state, &window.items).await;
    let checked = cards(&window.items, previews.as_deref());
    let plain = cards(&window.items, None);
    let items = window
        .items
        .iter()
        .zip(checked.into_iter().zip(plain))
        .map(|(item, (card, plain))| MoreItem {
            id: item.meme.id.clone(),
            key: item.key(),
            pref: item.preference(),
            card: card.into_string(),
            plain: plain.into_string(),
        })
        .collect();
    let body = More {
        items,
        scanned: window.scanned,
        has_more: window.has_more,
    };
    fragment(
        "application/json",
        serde_json::to_string(&body).expect("strings and numbers serialize"),
    )
}

/// `GET /_axum/explore/cards?id=…`: the cards of these memes with the
/// preview the ledger allows now, for the grid's preview retry after
/// `POST /api/explore/previews` answered. A meme that is no longer public
/// is left out, as that route leaves it out.
pub async fn cards_fragment(State(state): State<AppState>, request: Request) -> Response {
    let params = Params::parse(request.uri().query());
    let ids: Vec<String> = params
        .all("id")
        .take(view::PAGE_SIZE * 2)
        .map(str::to_owned)
        .collect();
    let items = match query::by_ids(&state.db, ids).await {
        Ok(items) => items,
        Err(error) => {
            tracing::warn!(%error, "explore cards not read");
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        }
    };
    let contents = items
        .iter()
        .map(|item| (item.meme.id.clone(), item.contents.clone()))
        .collect();
    let previews = match explore_previews::ledger_previews(&state.db, contents).await {
        Ok(previews) => previews,
        Err(error) => {
            tracing::warn!(%error, "explore card previews not read");
            return StatusCode::SERVICE_UNAVAILABLE.into_response();
        }
    };
    let cards: serde_json::Map<String, serde_json::Value> = items
        .iter()
        .zip(cards(&items, Some(&previews)))
        .map(|(item, card)| (item.meme.id.clone(), card.into_string().into()))
        .collect();
    fragment(
        "application/json",
        serde_json::Value::Object(cards).to_string(),
    )
}
