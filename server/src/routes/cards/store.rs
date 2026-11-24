//! The queries of `lib/meme-collectible.server.ts` as plain SQL, and the card
//! each catalogue row becomes.
//!
//! The TypeScript builds every select through the query planner, which wraps
//! the `memes` embed in `EXISTS`; a card has at most one meme, so the inner
//! join below returns the same rows. Each function runs in a transaction of
//! its own with the identity the TypeScript gives that query.

use serde::Serialize;
use sqlx::PgConnection;

use super::catalog;
use super::{CardError, PAGE_SIZE, ensure_count, is_card_id};
use crate::db::{BoxFuture, Db, DbIdentity, IdentityOptions};
use crate::routes::public::labels;

/// `eligibleQuery`: active cards of approved, green, published memes. `$1`
/// is a title pattern, `$2` a category and `$3` a list of card ids; a null
/// one filters nothing.
macro_rules! eligible {
    ($select:literal, $tail:literal) => {
        concat!(
            "select ",
            $select,
            " from public.meme_collectible_cards c join public.memes m on m.id = c.meme_id \
             where c.active = true and m.moderation_status = 'approved' \
             and m.safety_level = 'green' and m.published_at is not null \
             and ($1::text is null or m.title ilike $1) \
             and ($2::text is null or m.category = $2::meme_category) \
             and ($3::text[] is null or c.id = any($3))",
            $tail
        )
    };
}

const ELIGIBLE_CARDS: &str = eligible!(
    "c.id, c.card_no, c.edition, c.art_seed, m.id::text, m.short_id, m.title, m.slug, \
     m.category::text, m.origin_year",
    " order by c.card_no asc limit $4 offset $5"
);
const ELIGIBLE_IDENTITIES: &str = eligible!(
    "c.id, c.meme_id::text",
    " order by c.card_no asc limit $4 offset $5"
);
const ELIGIBLE_COUNT: &str = eligible!("count(*)::int", "");

// A timestamp is read as the text row_to_json gives the TypeScript
// (`2026-11-24T01:02:03.456789+00:00`).
const OWNED_PAGE: &str = "select u.card_id, to_json(u.created_at) #>> '{}' \
     from public.user_meme_cards u where u.user_id = $1::uuid \
     order by u.created_at desc, u.card_id asc limit $2 offset $3";
const OWNED_COUNT: &str =
    "select count(*)::int from public.user_meme_cards u where u.user_id = $1::uuid";
/// `readFilteredOwnershipPage`: only cards that are still eligible, and whose
/// meme matches the title pattern `$2` and the category `$3`.
macro_rules! owned_filtered {
    ($select:literal, $tail:literal) => {
        concat!(
            "select ",
            $select,
            " from public.user_meme_cards u where u.user_id = $1::uuid \
             and exists (select 1 from public.meme_collectible_cards c \
               where c.id = u.card_id and c.active = true \
               and exists (select 1 from public.memes m where m.id = c.meme_id \
                 and m.moderation_status = 'approved' and m.safety_level = 'green' \
                 and m.published_at is not null \
                 and ($2::text is null or m.title ilike $2) \
                 and ($3::text is null or m.category = $3::meme_category)))",
            $tail
        )
    };
}
const OWNED_FILTERED_PAGE: &str = owned_filtered!(
    "u.card_id, to_json(u.created_at) #>> '{}'",
    " order by u.created_at desc, u.card_id asc limit $4 offset $5"
);
const OWNED_FILTERED_COUNT: &str = owned_filtered!("count(*)::int", "");
// No ORDER BY, as in the TypeScript.
const OWNED_IDS: &str = "select u.card_id from public.user_meme_cards u \
     where u.user_id = $1::uuid and u.card_id = any($2) limit $3";
const CLAIM: &str = "insert into public.user_meme_cards (user_id, card_id) \
     values ($1::uuid, $2) on conflict (user_id, card_id) do nothing";
const OWNERSHIP: &str = "select u.card_id, to_json(u.created_at) #>> '{}' \
     from public.user_meme_cards u where u.user_id = $1::uuid and u.card_id = $2";

/// `MemeCollectibleCard`. Field order is the key order of the JSON.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Card {
    pub id: String,
    pub(crate) card_no: i32,
    pub(crate) edition: i32,
    pub(crate) art_seed: i32,
    pub meme_id: String,
    pub(crate) title: String,
    pub(crate) slug: String,
    pub(crate) href: String,
    pub(crate) summary: &'static str,
    pub(crate) category: String,
    pub(crate) origin_year: Option<i32>,
    /// Always `null`: cards show procedural art, never a source image.
    pub(crate) thumbnail_url: Option<String>,
    pub(crate) art_motif: &'static str,
    pub(crate) art_symbols: &'static [String],
    pub(crate) art_composition: &'static str,
}

impl Card {
    /// An empty card: what the /meme-cards page's templates are made from.
    pub(crate) fn placeholder() -> Self {
        Self {
            id: String::new(),
            card_no: 0,
            edition: 0,
            art_seed: 0,
            meme_id: String::new(),
            title: String::new(),
            slug: String::new(),
            href: String::new(),
            summary: "",
            category: String::new(),
            origin_year: None,
            thumbnail_url: None,
            art_motif: "",
            art_symbols: &[],
            art_composition: "",
        }
    }
}

/// id, card_no, edition, art_seed, meme id, short_id, title, slug, category,
/// origin_year.
type CardRow = (
    String,
    i32,
    i32,
    i32,
    String,
    String,
    String,
    String,
    String,
    Option<i32>,
);

/// `normalizeCard`. The checks it makes on the meme (approved, green,
/// published, the card's own meme) are the `where` clause and the join of
/// the query; the ones on the card are repeated here.
fn normalize(row: CardRow) -> Result<Card, CardError> {
    let (id, card_no, edition, art_seed, meme_id, short_id, title, slug, category, origin_year) =
        row;
    let consistent =
        is_card_id(&id) && id == format!("mc-{card_no:04}") && edition == 1 && art_seed >= 0;
    let art = catalog::card_art(&id).filter(|_| consistent);
    let art = art.ok_or(CardError::UNAVAILABLE)?;
    Ok(Card {
        href: labels::meme_path(&short_id, &slug),
        id,
        card_no,
        edition,
        art_seed,
        meme_id,
        title,
        slug,
        summary: &art.caption,
        category,
        origin_year,
        thumbnail_url: None,
        art_motif: &art.motif,
        art_symbols: &art.symbols,
        art_composition: &art.composition,
    })
}

/// Which eligible cards a query is about.
#[derive(Clone, Debug, Default)]
pub struct CardFilter {
    /// `namePattern(query)` for `memes.title ILIKE`.
    pub title_pattern: Option<String>,
    pub category: Option<String>,
    pub ids: Option<Vec<String>>,
}

impl CardFilter {
    /// The filter of a page request: the name search and the category.
    pub fn of_page(query: Option<&str>, category: Option<&str>) -> Self {
        Self {
            title_pattern: query.map(name_pattern),
            category: category.map(str::to_owned),
            ids: None,
        }
    }
}

/// `namePattern`: the query between two `%`, with `\`, `%` and `_` escaped so
/// they match themselves.
fn name_pattern(query: &str) -> String {
    let mut pattern = String::with_capacity(query.len() + 2);
    pattern.push('%');
    for character in query.chars() {
        if matches!(character, '\\' | '%' | '_') {
            pattern.push('\\');
        }
        pattern.push(character);
    }
    pattern.push('%');
    pattern
}

/// A page of rows and the number of rows the same filter matches in all
/// (`{ count: "exact" }`).
pub struct Counted<T> {
    pub rows: Vec<T>,
    pub total: i32,
}

async fn run<T, F>(db: &Db, identity: &DbIdentity, query: F) -> Result<T, sqlx::Error>
where
    F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<T, sqlx::Error>> + Send,
    T: Send,
{
    db.with_identity(identity, IdentityOptions::default(), query)
        .await
}

/// One page of the eligible cards in card number order, as the anonymous
/// visitor.
pub async fn eligible_page(
    db: &Db,
    filter: CardFilter,
    offset: i32,
) -> Result<Counted<Card>, CardError> {
    let (rows, total): (Vec<CardRow>, i32) = run(db, &DbIdentity::anon(), |tx| {
        Box::pin(async move {
            let rows = sqlx::query_as(ELIGIBLE_CARDS)
                .bind(&filter.title_pattern)
                .bind(&filter.category)
                .bind(&filter.ids)
                .bind(PAGE_SIZE)
                .bind(offset)
                .fetch_all(&mut *tx)
                .await?;
            let total = sqlx::query_scalar(ELIGIBLE_COUNT)
                .bind(&filter.title_pattern)
                .bind(&filter.category)
                .bind(&filter.ids)
                .fetch_one(tx)
                .await?;
            Ok((rows, total))
        })
    })
    .await?;
    Ok(Counted {
        total: ensure_count(total)?,
        rows: rows.into_iter().map(normalize).collect::<Result<_, _>>()?,
    })
}

/// The card id and meme id of each card on one unfiltered page: the second
/// read of the catalogue route.
pub async fn eligible_identities(
    db: &Db,
    offset: i32,
) -> Result<Counted<(String, String)>, CardError> {
    let none = CardFilter::default();
    let (rows, total): (Vec<(String, String)>, i32) = run(db, &DbIdentity::anon(), |tx| {
        Box::pin(async move {
            let rows = sqlx::query_as(ELIGIBLE_IDENTITIES)
                .bind(&none.title_pattern)
                .bind(&none.category)
                .bind(&none.ids)
                .bind(PAGE_SIZE)
                .bind(offset)
                .fetch_all(&mut *tx)
                .await?;
            let total = sqlx::query_scalar(ELIGIBLE_COUNT)
                .bind(&none.title_pattern)
                .bind(&none.category)
                .bind(&none.ids)
                .fetch_one(tx)
                .await?;
            Ok((rows, total))
        })
    })
    .await?;
    Ok(Counted {
        total: ensure_count(total)?,
        rows,
    })
}

/// The eligible cards among `ids` (at most a page of them), as the anonymous
/// visitor: `eligibleQuery(...).in("id", ids).limit(24)` and
/// `getMemeCollectibleCard`.
pub async fn eligible_by_ids(db: &Db, ids: Vec<String>) -> Result<Vec<Card>, CardError> {
    let rows: Vec<CardRow> = run(db, &DbIdentity::anon(), |tx| {
        Box::pin(async move {
            sqlx::query_as(ELIGIBLE_CARDS)
                .bind(None::<String>)
                .bind(None::<String>)
                .bind(Some(ids))
                .bind(PAGE_SIZE)
                .bind(0_i32)
                .fetch_all(tx)
                .await
        })
    })
    .await?;
    rows.into_iter().map(normalize).collect()
}

/// A row of `user_meme_cards`: the card and when it was claimed.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Owned {
    pub card_id: String,
    pub claimed_at: String,
}

fn owned((card_id, claimed_at): (String, String)) -> Owned {
    Owned {
        card_id,
        claimed_at,
    }
}

/// One page of the cards `user_id` owns, newest first, read as that user.
/// With a name search or a category, only cards that are still eligible.
pub async fn owned_page(
    db: &Db,
    user: &DbIdentity,
    user_id: String,
    filter: Option<CardFilter>,
    offset: i32,
) -> Result<Counted<Owned>, CardError> {
    let (rows, total): (Vec<(String, String)>, i32) = run(db, user, |tx| {
        Box::pin(async move {
            let Some(filter) = filter else {
                let rows = sqlx::query_as(OWNED_PAGE)
                    .bind(&user_id)
                    .bind(PAGE_SIZE)
                    .bind(offset)
                    .fetch_all(&mut *tx)
                    .await?;
                let total = sqlx::query_scalar(OWNED_COUNT)
                    .bind(&user_id)
                    .fetch_one(tx)
                    .await?;
                return Ok((rows, total));
            };
            let rows = sqlx::query_as(OWNED_FILTERED_PAGE)
                .bind(&user_id)
                .bind(&filter.title_pattern)
                .bind(&filter.category)
                .bind(PAGE_SIZE)
                .bind(offset)
                .fetch_all(&mut *tx)
                .await?;
            let total = sqlx::query_scalar(OWNED_FILTERED_COUNT)
                .bind(&user_id)
                .bind(&filter.title_pattern)
                .bind(&filter.category)
                .fetch_one(tx)
                .await?;
            Ok((rows, total))
        })
    })
    .await?;
    Ok(Counted {
        total: ensure_count(total)?,
        rows: rows.into_iter().map(owned).collect(),
    })
}

/// `getOwnedMemeCardIds`: which of `card_ids` the user owns, in the order
/// Postgres returns them.
pub async fn owned_ids(
    db: &Db,
    user: &DbIdentity,
    user_id: String,
    card_ids: Vec<String>,
) -> Result<Vec<String>, CardError> {
    let ids = run(db, user, |tx| {
        Box::pin(async move {
            sqlx::query_scalar(OWNED_IDS)
                .bind(user_id)
                .bind(card_ids)
                .bind(PAGE_SIZE)
                .fetch_all(tx)
                .await
        })
    })
    .await?;
    Ok(ids)
}

/// The upsert of `claimMemeCollectibleCard`: a second claim of the same card
/// changes nothing. The error is returned as is: its code decides the answer.
pub async fn claim(
    db: &Db,
    user: &DbIdentity,
    user_id: String,
    card_id: String,
) -> Result<(), sqlx::Error> {
    run(db, user, |tx| {
        Box::pin(async move {
            sqlx::query(CLAIM)
                .bind(user_id)
                .bind(card_id)
                .execute(tx)
                .await
                .map(|_| ())
        })
    })
    .await
}

/// The user's row for one card, read as that user.
pub async fn ownership(
    db: &Db,
    user: &DbIdentity,
    user_id: String,
    card_id: String,
) -> Result<Option<Owned>, CardError> {
    let row: Option<(String, String)> = run(db, user, |tx| {
        Box::pin(async move {
            sqlx::query_as(OWNERSHIP)
                .bind(user_id)
                .bind(card_id)
                .fetch_optional(tx)
                .await
        })
    })
    .await?;
    Ok(row.map(owned))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, card_no: i32) -> CardRow {
        (
            id.to_owned(),
            card_no,
            1,
            379_289_995,
            "48653a33-c3d5-4ee4-9670-330c1a145118".to_owned(),
            "rk3w632x".to_owned(),
            "PPAP (펜-파인애플-애플-펜)".to_owned(),
            "ppap 밈".to_owned(),
            "song".to_owned(),
            Some(2016),
        )
    }

    // The expected text is what JSON.stringify(normalizeCard(row)) gives
    // under Node for the same row.
    #[test]
    fn card_json_has_the_keys_of_the_typescript_card_in_its_order() {
        let card = normalize(row("mc-0001", 1)).expect("a consistent row");

        assert_eq!(
            serde_json::to_string(&card).unwrap(),
            r#"{"id":"mc-0001","cardNo":1,"edition":1,"artSeed":379289995,"memeId":"48653a33-c3d5-4ee4-9670-330c1a145118","title":"PPAP (펜-파인애플-애플-펜)","slug":"ppap 밈","href":"/memes/rk3w632x-ppap%20%EB%B0%88","summary":"펜과 사과, 파인애플을 조합하며 리듬을 만드는 짧은 노래","category":"song","originYear":2016,"thumbnailUrl":null,"artMotif":"pen-pineapple","artSymbols":["pen","apple","pineapple"],"artComposition":"exchange"}"#
        );
    }

    #[test]
    fn a_row_that_contradicts_itself_is_unavailable() {
        let mut second_edition = row("mc-0001", 1);
        second_edition.2 = 2;
        let mut negative_seed = row("mc-0001", 1);
        negative_seed.3 = -1;
        let mut no_year = row("mc-1000", 1000);
        no_year.9 = None;

        assert_eq!(normalize(row("mc-0001", 2)), Err(CardError::UNAVAILABLE));
        assert_eq!(normalize(row("mc-1001", 1001)), Err(CardError::UNAVAILABLE));
        assert_eq!(normalize(second_edition), Err(CardError::UNAVAILABLE));
        assert_eq!(normalize(negative_seed), Err(CardError::UNAVAILABLE));
        assert!(
            serde_json::to_string(&normalize(no_year).unwrap())
                .unwrap()
                .contains(r#""originYear":null"#)
        );
    }

    #[test]
    fn name_pattern_escapes_like_wildcards() {
        assert_eq!(name_pattern("밈"), "%밈%");
        assert_eq!(name_pattern(r"100%_\x"), r"%100\%\_\\x%");
        assert_eq!(name_pattern(""), "%%");
    }
}
