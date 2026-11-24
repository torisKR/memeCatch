//! The three reads: `GET /api/meme-cards` (the public catalogue),
//! `GET /api/meme-cards/{id}` (one card) and
//! `GET /api/meme-cards/collection` (the signed-in user's cards).

use std::collections::HashMap;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde::Serialize;

use super::store::{self, Card, CardFilter, Counted, Owned};
use super::{
    CardError, PAGE_SIZE, PageOptions, card_api_error, card_response, is_card_id, parse_card_ids,
    parse_page_options, private,
};
use crate::auth::SessionUser;
use crate::db::Db;
use crate::routes::request;
use crate::AppState;

const CARD_PATH_PREFIX: &str = "/api/meme-cards/";
/// The paths Next answers with a route of their own, never with `[id]`.
const INVALID_INPUT: &str = r#"{"error":"invalid_input"}"#;

/// `MemeCardCatalogPage` and `MemeCardCollectionPage`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Page<T> {
    cards: Vec<T>,
    total: i32,
    page: i32,
    page_size: i32,
    has_more: bool,
}

impl<T: Serialize> Page<T> {
    fn new(cards: Vec<T>, total: i32, options: &PageOptions) -> Self {
        Self {
            cards,
            total,
            page: options.page,
            page_size: PAGE_SIZE,
            has_more: options.offset() + PAGE_SIZE < total,
        }
    }

    fn json(&self) -> String {
        serde_json::to_string(self).expect("strings and numbers")
    }
}

/// `GET /api/meme-cards`.
pub async fn catalog(State(state): State<AppState>, request: Request) -> Response {
    let Some(options) = parse_page_options(&request::query_pairs(request.uri())) else {
        return card_response(
            StatusCode::BAD_REQUEST,
            "no-store",
            INVALID_INPUT.to_owned(),
        );
    };
    match catalog_page(&state.db, &options).await {
        Ok(page) => card_response(
            StatusCode::OK,
            "public, max-age=0, must-revalidate",
            page.json(),
        ),
        Err(error) => card_api_error(error),
    }
}

/// `getMemeCardCatalogPage`.
async fn catalog_page(db: &Db, options: &PageOptions) -> Result<Page<Card>, CardError> {
    let (cards, total) = catalog_cards(db, options).await?;
    Ok(Page::new(cards, total, options))
}

/// The cards and total of one catalogue page (`getMemeCardCatalogPage`).
pub(super) async fn catalog_cards(
    db: &Db,
    options: &PageOptions,
) -> Result<(Vec<Card>, i32), CardError> {
    let filter = CardFilter::of_page(options.query.as_deref(), options.category.as_deref());
    let Counted { rows, total } = store::eligible_page(db, filter, options.offset()).await?;
    if options.is_filtered() {
        return Ok((rows, total));
    }
    // An unfiltered page is read a second time, identities only, and anything
    // the first read did not have is fetched. The first read used to come
    // from a cache; both now come from Postgres, so they differ only when a
    // card changes in between.
    let current = store::eligible_identities(db, options.offset()).await?;
    let mut by_id: HashMap<String, Card> = rows
        .into_iter()
        .map(|card| (card.id.clone(), card))
        .collect();
    let missing: Vec<String> = current
        .rows
        .iter()
        .filter(|(id, meme_id)| by_id.get(id).map(|card| &card.meme_id) != Some(meme_id))
        .map(|(id, _)| id.clone())
        .collect();
    if !missing.is_empty() {
        for card in store::eligible_by_ids(db, missing).await? {
            by_id.insert(card.id.clone(), card);
        }
    }
    let cards = current
        .rows
        .iter()
        .filter_map(|(id, meme_id)| by_id.get(id).filter(|card| card.meme_id == *meme_id))
        .cloned()
        .collect();
    Ok((cards, current.total))
}

/// `REVEAL_HEADERS`.
fn reveal(status: StatusCode, body: String) -> Response {
    card_response(status, "no-store", body)
}

/// `GET /api/meme-cards/{id}`.
pub async fn card(State(state): State<AppState>, request: Request) -> Response {
    let id = request
        .uri()
        .path()
        .strip_prefix(CARD_PATH_PREFIX)
        .unwrap_or_default();
    // The segment is decoded first; one that does not decode is no id.
    let id = percent_encoding::percent_decode_str(id)
        .decode_utf8()
        .unwrap_or_default();
    let id = id.as_ref();
    if !is_card_id(id) {
        return reveal(StatusCode::BAD_REQUEST, INVALID_INPUT.to_owned());
    }
    match store::eligible_by_ids(&state.db, vec![id.to_owned()]).await {
        Ok(cards) => match cards.first() {
            Some(card) => {
                #[derive(Serialize)]
                struct Revealed<'a> {
                    card: &'a Card,
                }
                let body = serde_json::to_string(&Revealed { card }).expect("strings and numbers");
                reveal(StatusCode::OK, body)
            }
            None => reveal(StatusCode::NOT_FOUND, CardError::NOT_FOUND.body()),
        },
        // Any failure is 503 here, with this route's own headers.
        Err(_) => reveal(
            StatusCode::SERVICE_UNAVAILABLE,
            CardError::UNAVAILABLE.body(),
        ),
    }
}

/// `OwnedMemeCollectibleCard`: a card the user owns, or only its id when the
/// card is no longer public.
#[derive(Serialize)]
#[serde(untagged)]
enum OwnedCard {
    Available {
        #[serde(flatten)]
        card: Box<Card>,
        available: bool,
        #[serde(rename = "claimedAt")]
        claimed_at: String,
    },
    Unavailable {
        id: String,
        available: bool,
        #[serde(rename = "claimedAt")]
        claimed_at: String,
    },
}

/// What a collection request asks for.
enum CollectionQuery {
    /// `?cardIds=...`: which of these cards the user owns.
    Owned(Vec<String>),
    Page(PageOptions),
}

/// The checks of the route before it looks at the session. `cardIds` must
/// be the only parameter and appear once.
fn collection_query(params: &[(String, String)]) -> Option<CollectionQuery> {
    match request::first_param(params, "cardIds") {
        Some(value) => parse_card_ids(value)
            .filter(|_| params.len() == 1)
            .map(CollectionQuery::Owned),
        None => parse_page_options(params).map(CollectionQuery::Page),
    }
}

/// `GET /api/meme-cards/collection`.
pub async fn collection(State(state): State<AppState>, request: Request) -> Response {
    let Some(query) = collection_query(&request::query_pairs(request.uri())) else {
        return private(StatusCode::BAD_REQUEST, INVALID_INPUT.to_owned());
    };
    let (mut parts, _) = request.into_parts();
    // `getMemeCardAuthenticatedUser`: no session is 401.
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return card_api_error(CardError::SIGNED_OUT);
    };
    let body = match query {
        CollectionQuery::Owned(ids) => owned_ids_json(&state.db, &user, ids).await,
        CollectionQuery::Page(options) => collection_page(&state.db, &user, &options)
            .await
            .map(|page| page.json()),
    };
    match body {
        Ok(body) => private(StatusCode::OK, body),
        Err(error) => card_api_error(error),
    }
}

/// `{ ownedCardIds: await getOwnedMemeCardIds(...) }`.
async fn owned_ids_json(
    db: &Db,
    user: &SessionUser,
    ids: Vec<String>,
) -> Result<String, CardError> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct OwnedIds {
        owned_card_ids: Vec<String>,
    }
    let owned_card_ids = store::owned_ids(db, &user.db_identity(), user.id.clone(), ids).await?;
    Ok(serde_json::to_string(&OwnedIds { owned_card_ids }).expect("strings"))
}

/// The first page of `user`'s collection, as `/api/meme-cards/collection`
/// answers it: the `initialPage` the `/my` page hands its collection
/// (batch B6). `None` when it cannot be read (`initialError`).
pub(crate) async fn first_collection_page(db: &Db, user: &SessionUser) -> Option<String> {
    let options = PageOptions {
        page: 1,
        query: None,
        category: None,
    };
    match collection_page(db, user, &options).await {
        Ok(page) => Some(page.json()),
        Err(_) => None,
    }
}

/// `getMemeCardCollectionPage`: the user's rows as that user, then the cards
/// behind them as the anonymous visitor, so a card that left the public
/// catalogue shows as unavailable even to its owner.
async fn collection_page(
    db: &Db,
    user: &SessionUser,
    options: &PageOptions,
) -> Result<Page<OwnedCard>, CardError> {
    let filter = options
        .is_filtered()
        .then(|| CardFilter::of_page(options.query.as_deref(), options.category.as_deref()));
    let Counted { rows, total } = store::owned_page(
        db,
        &user.db_identity(),
        user.id.clone(),
        filter,
        options.offset(),
    )
    .await?;
    let mut cards_by_id: HashMap<String, Card> = HashMap::new();
    if !rows.is_empty() {
        let ids = rows.iter().map(|row| row.card_id.clone()).collect();
        for card in store::eligible_by_ids(db, ids).await? {
            cards_by_id.insert(card.id.clone(), card);
        }
    }
    let cards = rows
        .into_iter()
        .map(
            |Owned {
                 card_id,
                 claimed_at,
             }| match cards_by_id.get(&card_id) {
                Some(card) => OwnedCard::Available {
                    card: Box::new(card.clone()),
                    available: true,
                    claimed_at,
                },
                None => OwnedCard::Unavailable {
                    id: card_id,
                    available: false,
                    claimed_at,
                },
            },
        )
        .collect();
    Ok(Page::new(cards, total, options))
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
    fn collection_takes_card_ids_alone_or_page_options() {
        let query = |pairs: &[(&str, &str)]| collection_query(&params(pairs));

        assert!(matches!(query(&[]), Some(CollectionQuery::Page(_))));
        assert!(matches!(
            query(&[("page", "2"), ("category", "song")]),
            Some(CollectionQuery::Page(_))
        ));
        assert!(matches!(
            query(&[("cardIds", "mc-0002,mc-0001,mc-0002")]),
            Some(CollectionQuery::Owned(ids)) if ids == ["mc-0002", "mc-0001"]
        ));
        for invalid in [
            &[("cardIds", "")][..],
            &[("cardIds", "mc-0000")],
            &[("cardIds", "mc-0001"), ("page", "1")],
            &[("page", "1"), ("cardIds", "mc-0001")],
            &[("cardIds", "mc-0001"), ("cardIds", "mc-0002")],
            &[("cardIds", "mc-0001"), ("x", "")],
            &[("page", "0")],
            &[("x", "1")],
        ] {
            assert!(query(invalid).is_none(), "{invalid:?}");
        }
    }

    #[test]
    fn page_json_has_the_keys_of_the_typescript_page() {
        let options = PageOptions {
            page: 2,
            query: None,
            category: None,
        };
        let last = Page::<Card>::new(Vec::new(), 48, &options);
        let more = Page::<Card>::new(Vec::new(), 49, &options);

        assert_eq!(
            last.json(),
            r#"{"cards":[],"total":48,"page":2,"pageSize":24,"hasMore":false}"#
        );
        assert!(more.json().ends_with(r#""hasMore":true}"#));
    }

    #[test]
    fn an_unavailable_card_keeps_only_its_id_and_claim_time() {
        let hidden = OwnedCard::Unavailable {
            id: "mc-0007".to_owned(),
            available: false,
            claimed_at: "2026-11-24T01:02:03.456789+00:00".to_owned(),
        };

        assert_eq!(
            serde_json::to_string(&hidden).unwrap(),
            r#"{"id":"mc-0007","available":false,"claimedAt":"2026-11-24T01:02:03.456789+00:00"}"#
        );
    }
}
