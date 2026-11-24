//! The collectible meme cards: `app/api/meme-cards/**`, with
//! `lib/meme-collectible.ts` and `lib/meme-collectible.server.ts`.
//!
//! | Route id | Path | Method |
//! | --- | --- | --- |
//! | `meme-cards` | `/api/meme-cards` | `GET` |
//! | `meme-card` | `/api/meme-cards/{id}` | `GET` |
//! | `meme-cards-collection` | `/api/meme-cards/collection` | `GET` |
//! | `meme-cards-claim` | `/api/meme-cards/claim` | `POST` |
//!
//! The catalogue is read as the anonymous visitor, a user's own cards as
//! that user; row-level security decides what each may see, as in Next.

mod catalog;
mod claim;
mod pages;

pub(crate) use pages::first_collection_page;
pub(crate) mod store;

use axum::Router;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, X_CONTENT_TYPE_OPTIONS};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};

use super::Routes;
use super::public::js;
use super::request::SiteOrigin;
use crate::AppState;

/// `MEME_CARD_PAGE_SIZE`.
const PAGE_SIZE: i32 = 24;
/// `MEME_CARD_TARGET_COUNT`: the catalogue never holds more cards.
const TARGET_COUNT: i32 = 1000;
/// `MEME_CARD_MAX_PAGE`: `Math.ceil(1000 / 24)`.
const MAX_PAGE: i32 = 42;
const MAX_QUERY_LENGTH: usize = 80;
const CATEGORIES: [&str; 6] = ["phrase", "dance", "song", "image", "comment", "challenge"];
const PAGE_PARAMS: [&str; 3] = ["page", "query", "category"];

pub fn router(state: &AppState) -> Router<AppState> {
    let routes = Routes::new(state)
        .add("meme-cards", "/api/meme-cards", get(pages::catalog))
        .add("meme-card", "/api/meme-cards/{id}", get(pages::card))
        .add(
            "meme-cards-collection",
            "/api/meme-cards/collection",
            get(pages::collection),
        );
    match SiteOrigin::from_site_url(&state.config.site_url) {
        Some(site) => routes.add(
            "meme-cards-claim",
            "/api/meme-cards/claim",
            post(move |state: State<AppState>, request: Request| {
                claim::claim(state, site.clone(), request)
            }),
        ),
        None => {
            tracing::warn!(
                "NEXT_PUBLIC_SITE_URL is not an absolute URL: /api/meme-cards/claim stays with the upstream"
            );
            routes
        }
    }
    .build()
}

/// `MemeCardServiceError`: a status and the `error` code of the body.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct CardError {
    status: StatusCode,
    code: &'static str,
}

impl CardError {
    const INVALID_INPUT: Self = Self::new(StatusCode::BAD_REQUEST, "invalid_input");
    const SIGNED_OUT: Self = Self::new(StatusCode::UNAUTHORIZED, "signed_out");
    const NOT_FOUND: Self = Self::new(StatusCode::NOT_FOUND, "card_unavailable");
    const CONFLICT: Self = Self::new(StatusCode::CONFLICT, "card_unavailable");
    /// `unavailable()`, and what `cardApiError` makes of any other error.
    const UNAVAILABLE: Self = Self::new(StatusCode::SERVICE_UNAVAILABLE, "cards_unavailable");

    const fn new(status: StatusCode, code: &'static str) -> Self {
        Self { status, code }
    }

    fn body(self) -> String {
        format!(r#"{{"error":"{}"}}"#, self.code)
    }
}

impl From<sqlx::Error> for CardError {
    fn from(error: sqlx::Error) -> Self {
        tracing::warn!(%error, "meme card query failed");
        Self::UNAVAILABLE
    }
}

/// A JSON answer with one of the three header sets the routes use.
fn card_response(status: StatusCode, cache_control: &'static str, body: String) -> Response {
    (
        status,
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, cache_control),
            (X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        body,
    )
        .into_response()
}

/// `PRIVATE_CARD_HEADERS`.
fn private(status: StatusCode, body: String) -> Response {
    card_response(status, "private, no-store", body)
}

/// `cardApiError`.
fn card_api_error(error: CardError) -> Response {
    private(error.status, error.body())
}

/// `isMemeCardId`: `mc-0001` to `mc-1000`.
fn is_card_id(value: &str) -> bool {
    value.strip_prefix("mc-").is_some_and(|digits| {
        digits.len() == 4
            && digits.bytes().all(|byte| byte.is_ascii_digit())
            && matches!(digits.parse::<u16>(), Ok(1..=1000))
    })
}

/// `parseMemeCardIds`: 1 to 24 card ids separated by commas, repeats dropped.
fn parse_card_ids(value: &str) -> Option<Vec<String>> {
    let ids: Vec<&str> = value.split(',').collect();
    if ids.len() > PAGE_SIZE as usize || !ids.iter().all(|id| is_card_id(id)) {
        return None;
    }
    let mut distinct: Vec<String> = Vec::with_capacity(ids.len());
    for id in ids {
        if !distinct.iter().any(|seen| seen == id) {
            distinct.push(id.to_owned());
        }
    }
    Some(distinct)
}

/// `MemeCardPageOptions`.
#[derive(Clone, Debug, PartialEq, Eq)]
struct PageOptions {
    page: i32,
    query: Option<String>,
    category: Option<String>,
}

impl PageOptions {
    /// The rows before this page.
    fn offset(&self) -> i32 {
        (self.page - 1) * PAGE_SIZE
    }

    fn is_filtered(&self) -> bool {
        self.query.is_some() || self.category.is_some()
    }
}

/// `parseMemeCardPageOptions`. `None` is `invalid_input`.
fn parse_page_options(params: &[(String, String)]) -> Option<PageOptions> {
    let first = |name: &str| super::request::first_param(params, name);
    let page = parse_page(first("page"))?;
    let query = first("query")
        .map(js::trim)
        .filter(|query| !query.is_empty());
    let category = first("category").filter(|category| !category.is_empty());
    let too_long = query.is_some_and(|query| js::utf16_len(query) > MAX_QUERY_LENGTH);
    let unknown_category = category.is_some_and(|category| !CATEGORIES.contains(&category));
    let unknown_param = params
        .iter()
        .any(|(key, _)| !PAGE_PARAMS.contains(&key.as_str()));
    let repeated_param = PAGE_PARAMS
        .iter()
        .any(|name| params.iter().filter(|(key, _)| key == name).count() > 1);
    if too_long || unknown_category || unknown_param || repeated_param {
        return None;
    }
    Some(PageOptions {
        page,
        query: query.map(str::to_owned),
        category: category.map(str::to_owned),
    })
}

/// `parseMemeCardPage`: no value is page 1; otherwise `/^[1-9]\d?$/` and at
/// most the last page.
fn parse_page(value: Option<&str>) -> Option<i32> {
    let Some(value) = value else {
        return Some(1);
    };
    let digits = value.as_bytes();
    let well_formed =
        matches!(digits.len(), 1 | 2) && digits[0] != b'0' && digits.iter().all(u8::is_ascii_digit);
    let page: i32 = well_formed.then(|| value.parse().ok()).flatten()?;
    (page <= MAX_PAGE).then_some(page)
}

/// What the /meme-cards page reads (`pages::meme_cards`): one page of the
/// catalogue as `getMemeCardCatalogPage({ page })` gives it, with its total
/// and whether more follow.
pub(crate) async fn catalogue_page(
    db: &crate::db::Db,
    page: i32,
) -> Result<(Vec<store::Card>, i32, bool), CardError> {
    let options = PageOptions {
        page,
        query: None,
        category: None,
    };
    let (cards, total) = pages::catalog_cards(db, &options).await?;
    let has_more = options.offset() + PAGE_SIZE < total;
    Ok((cards, total, has_more))
}

/// `getMemeCollectibleCard(id)`: the card when it is eligible.
pub(crate) async fn eligible_card(
    db: &crate::db::Db,
    id: &str,
) -> Result<Option<store::Card>, CardError> {
    Ok(store::eligible_by_ids(db, vec![id.to_owned()])
        .await?
        .into_iter()
        .next())
}

/// `parseMemeCardPage` and `isMemeCardId`, for the page.
pub(crate) fn page_number(value: Option<&str>) -> Option<i32> {
    parse_page(value)
}

pub(crate) fn card_id(value: &str) -> bool {
    is_card_id(value)
}

/// `MEME_CARD_PAGE_SIZE`, `MEME_CARD_TARGET_COUNT`.
pub(crate) const CATALOGUE_PAGE_SIZE: i32 = PAGE_SIZE;
pub(crate) const CATALOGUE_TARGET: i32 = TARGET_COUNT;

/// `ensureCount`: a count outside the catalogue's size means something is
/// wrong with the data, and the route answers 503.
fn ensure_count(count: i32) -> Result<i32, CardError> {
    if (0..=TARGET_COUNT).contains(&count) {
        Ok(count)
    } else {
        Err(CardError::UNAVAILABLE)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn card_id_is_mc_and_a_number_from_0001_to_1000() {
        for valid in ["mc-0001", "mc-0009", "mc-0010", "mc-0999", "mc-1000"] {
            assert!(is_card_id(valid), "{valid}");
        }
        for invalid in [
            "",
            "mc-",
            "mc-0000",
            "mc-1001",
            "mc-9999",
            "mc-001",
            "mc-00010",
            "MC-0001",
            "mc-000a",
            "mc-+001",
            " mc-0001",
            "mc-0001 ",
            "mc-0001\n",
            "mc-０００１",
        ] {
            assert!(!is_card_id(invalid), "{invalid:?}");
        }
    }

    // Expected values are what parseMemeCardIds returns under Node.
    #[test]
    fn card_ids_are_1_to_24_valid_ids_with_repeats_dropped() {
        let numbered = |count: usize| -> String {
            (1..=count)
                .map(|number| format!("mc-{number:04}"))
                .collect::<Vec<_>>()
                .join(",")
        };

        assert_eq!(parse_card_ids("mc-0001"), Some(vec!["mc-0001".to_owned()]));
        assert_eq!(
            parse_card_ids("mc-0002,mc-0001,mc-0002"),
            Some(vec!["mc-0002".to_owned(), "mc-0001".to_owned()])
        );
        assert_eq!(parse_card_ids(&numbered(24)).map(|ids| ids.len()), Some(24));
        assert_eq!(parse_card_ids(&numbered(25)), None);
        // 25 entries are refused before repeats are dropped.
        assert_eq!(parse_card_ids(&["mc-0001"; 25].join(",")), None);
        for invalid in ["", ",", "mc-0001,", "mc-0001, mc-0002", "mc-0000", "x"] {
            assert_eq!(parse_card_ids(invalid), None, "{invalid:?}");
        }
    }

    // Expected values are what parseMemeCardPageOptions returns under Node.
    #[test]
    fn page_options_accept_only_page_query_and_category_once_each() {
        let options = |pairs: &[(&str, &str)]| parse_page_options(&params(pairs));
        let plain = |page: i32| PageOptions {
            page,
            query: None,
            category: None,
        };

        assert_eq!(options(&[]), Some(plain(1)));
        assert_eq!(options(&[("page", "42")]), Some(plain(42)));
        assert_eq!(
            options(&[("query", "  밈 a  "), ("category", "dance"), ("page", "7")]),
            Some(PageOptions {
                page: 7,
                query: Some("밈 a".to_owned()),
                category: Some("dance".to_owned()),
            })
        );
        // An empty or blank value is the same as none.
        assert_eq!(
            options(&[("query", " \u{feff}"), ("category", "")]),
            Some(plain(1))
        );
        for invalid in [
            &[("page", "0")][..],
            &[("page", "43")],
            &[("page", "01")],
            &[("page", "1.0")],
            &[("page", " 1")],
            &[("page", "")],
            &[("page", "１")],
            &[("category", "Dance")],
            &[("category", "meme")],
            &[("cardIds", "mc-0001")],
            &[("", "")],
            &[("page", "1"), ("page", "1")],
            &[("query", "a"), ("query", "")],
            &[("category", ""), ("category", "")],
        ] {
            assert_eq!(options(invalid), None, "{invalid:?}");
        }
    }

    #[test]
    fn query_length_is_counted_in_utf16_units_after_trimming() {
        let options = |query: &str| parse_page_options(&params(&[("query", query)]));

        assert!(options(&"가".repeat(80)).is_some());
        assert!(options(&format!("  {}  ", "a".repeat(80))).is_some());
        assert!(options(&"a".repeat(81)).is_none());
        // 40 astral characters are 80 UTF-16 units; 41 are 82.
        assert!(options(&"😀".repeat(40)).is_some());
        assert!(options(&"😀".repeat(41)).is_none());
    }

    #[test]
    fn page_offset_and_count_bounds() {
        let page = |page: i32| PageOptions {
            page,
            query: None,
            category: None,
        };

        assert_eq!(page(1).offset(), 0);
        assert_eq!(page(42).offset(), 984);
        assert_eq!(ensure_count(0), Ok(0));
        assert_eq!(ensure_count(1000), Ok(1000));
        assert_eq!(ensure_count(1001), Err(CardError::UNAVAILABLE));
        assert_eq!(ensure_count(-1), Err(CardError::UNAVAILABLE));
        assert_eq!(
            CardError::CONFLICT.body(),
            r#"{"error":"card_unavailable"}"#
        );
    }
}
