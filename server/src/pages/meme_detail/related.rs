//! The two link sections under the origin: "비슷한 밈" (`ContinueStream` over
//! `getRelatedMemes` of lib/queries.ts, drawn by `components/related-memes.tsx`)
//! and "이어서 읽을 밈" (`directoryNeighbours` of lib/meme-directory.ts,
//! drawn by `components/meme-neighbour-links.tsx`).
//!
//! Next keeps the lexical pool and the category stream for a day and drops
//! them on a catalog edit; nothing tells this process about an edit, so they
//! are read for each document (`PLAN.md` B3).

use std::collections::{HashMap, HashSet};

use maud::{Markup, html};
use sqlx::{AssertSqlSafe, Row};

use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::directory::Item;
use crate::pages::labels;
use crate::pages::meme_card::{self, CardMeme, TitleSize};
use crate::routes::public::labels::meme_path;

/// `RELATED_MEMES_LIMIT`.
pub const LIMIT: usize = 12;
/// `directoryNeighbours(..., { limit: 8 })`.
const NEIGHBOURS: usize = 8;
const PUBLIC: &str = "m.moderation_status in ('approved', 'limited')";
// The limits of `loadRelatedLexicalPool`.
const TAGGED_IDS: usize = 30;
const TAGGED_ROWS: usize = 30;
const SAME_CATEGORY_ROWS: usize = 24;
const NEARBY_YEAR_ROWS: usize = 12;
const NEARBY_YEARS: i32 = 2;
/// `getSemanticRelatedMemeIds` asks for at most this many.
const SEMANTIC_MAX: usize = 40;

/// The meme whose page this is.
pub struct Current<'a> {
    pub id: &'a str,
    pub category: &'a str,
    pub origin_year: Option<i32>,
    pub tag_ids: &'a [String],
}

/// Ids as one text value for `string_to_array($n, ',')::uuid[]`: they are
/// UUIDs read from the database, so they hold no comma.
fn id_list<'a>(ids: impl IntoIterator<Item = &'a String>) -> String {
    ids.into_iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .join(",")
}

async fn tagged_ids(db: &Db, current: &Current<'_>) -> Result<Vec<String>, sqlx::Error> {
    if current.tag_ids.is_empty() {
        return Ok(Vec::new());
    }
    let tags = id_list(current.tag_ids);
    let id = current.id.to_owned();
    let sql = format!(
        "select t.meme_id::text as meme_id from public.meme_tags_map t \
          where t.tag_id = any(string_to_array($1, ',')::uuid[]) and t.meme_id <> $2::uuid \
          limit {TAGGED_IDS}"
    );
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(AssertSqlSafe(sql))
                    .bind(tags)
                    .bind(id)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    let mut seen = HashSet::new();
    let mut ids = Vec::new();
    for row in rows {
        let id: String = row.try_get("meme_id")?;
        if seen.insert(id.clone()) {
            ids.push(id);
        }
    }
    Ok(ids)
}

/// `loadRelatedLexicalPool`: the tagged, same-category and nearby-year rows,
/// those that pass the index test, and the ids that share a tag. Filtering
/// before the sort leaves the order of the kept rows as it was.
async fn lexical_pool(
    db: &Db,
    current: &Current<'_>,
) -> Result<(Vec<CardMeme>, HashSet<String>), sqlx::Error> {
    let tagged_ids = tagged_ids(db, current).await?;
    let tagged = async {
        if tagged_ids.is_empty() {
            return Ok(Vec::new());
        }
        meme_card::indexable(
            db,
            &format!("m.id = any(string_to_array($1, ',')::uuid[]) and {PUBLIC}"),
            "m.trend_score desc",
            TAGGED_ROWS,
            TAGGED_ROWS,
            vec![id_list(&tagged_ids)],
        )
        .await
    };
    let same_category_condition =
        format!("m.category::text = $1 and m.id <> $2::uuid and {PUBLIC}");
    let same_category = meme_card::indexable(
        db,
        &same_category_condition,
        "m.trend_score desc",
        SAME_CATEGORY_ROWS,
        SAME_CATEGORY_ROWS,
        vec![current.category.to_owned(), current.id.to_owned()],
    );
    let nearby_year = async {
        let Some(year) = current.origin_year else {
            return Ok(Vec::new());
        };
        meme_card::indexable(
            db,
            &format!(
                "m.origin_year >= $1::int and m.origin_year <= $2::int and m.id <> $3::uuid and {PUBLIC}"
            ),
            "m.trend_score desc",
            NEARBY_YEAR_ROWS,
            NEARBY_YEAR_ROWS,
            vec![
                (year - NEARBY_YEARS).to_string(),
                (year + NEARBY_YEARS).to_string(),
                current.id.to_owned(),
            ],
        )
        .await
    };
    let (tagged, same_category, nearby_year) = tokio::join!(tagged, same_category, nearby_year);
    let rows = [tagged?, same_category?, nearby_year?].concat();
    Ok((rows, tagged_ids.into_iter().collect()))
}

/// `getSemanticRelatedMemeIds` and the rows it names, or nothing: a failure
/// here only leaves the semantic candidates out.
async fn semantic_rows(db: &Db, current: &Current<'_>) -> Vec<CardMeme> {
    let id = current.id.to_owned();
    let limit = i32::try_from(LIMIT.clamp(1, SEMANTIC_MAX)).unwrap_or(1);
    let ids = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query("select meme_id::text as meme_id from public.related_meme_embeddings($1::uuid, $2)")
                    .bind(id)
                    .bind(limit)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    let Ok(ids) = ids.and_then(|rows| {
        rows.iter()
            .map(|row| row.try_get::<String, _>("meme_id"))
            .collect::<Result<Vec<_>, _>>()
    }) else {
        return Vec::new();
    };
    if ids.is_empty() {
        return Vec::new();
    }
    // No order: the rows come back as Postgres returns them, as Next reads them.
    meme_card::indexable(
        db,
        &format!("m.id = any(string_to_array($1, ',')::uuid[]) and {PUBLIC}"),
        "true",
        ids.len(),
        ids.len(),
        vec![id_list(&ids)],
    )
    .await
    .unwrap_or_default()
}

/// `getRelatedMemes(meme, tagIds, RELATED_MEMES_LIMIT)`: shared tags ×3, same
/// category ×2, a semantic neighbour ×2, an origin within two years ×1, then
/// the trend score. Any failure of the lexical reads is an empty list.
pub async fn related_memes(db: &Db, semantic: bool, current: &Current<'_>) -> Vec<CardMeme> {
    let semantic_rows = async {
        if semantic {
            semantic_rows(db, current).await
        } else {
            Vec::new()
        }
    };
    let (lexical, semantic_rows) = tokio::join!(lexical_pool(db, current), semantic_rows);
    let Ok((lexical, tagged)) = lexical else {
        return Vec::new();
    };
    let semantic_ids: HashSet<&str> = semantic_rows.iter().map(|row| row.id.as_str()).collect();
    // A `Map` keyed by id: the first position wins, the last row replaces it.
    let mut order: Vec<String> = Vec::new();
    let mut pool: HashMap<String, CardMeme> = HashMap::new();
    for row in lexical.iter().chain(&semantic_rows) {
        if row.id == current.id {
            continue;
        }
        if !pool.contains_key(&row.id) {
            order.push(row.id.clone());
        }
        pool.insert(row.id.clone(), row.clone());
    }
    let score = |row: &CardMeme| {
        let near = matches!((current.origin_year, row.origin_year), (Some(a), Some(b)) if (a - b).abs() <= NEARBY_YEARS);
        u8::from(tagged.contains(&row.id)) * 3
            + u8::from(row.category == current.category) * 2
            + u8::from(semantic_ids.contains(row.id.as_str())) * 2
            + u8::from(near)
    };
    let mut rows: Vec<CardMeme> = order
        .into_iter()
        .filter_map(|id| pool.remove(&id))
        .collect();
    // A stable sort, as `Array.prototype.sort` is.
    rows.sort_by(|a, b| {
        score(b).cmp(&score(a)).then_with(|| {
            let (a, b) = (a.trend_score.unwrap_or(0.0), b.trend_score.unwrap_or(0.0));
            b.partial_cmp(&a).unwrap_or(std::cmp::Ordering::Equal)
        })
    });
    rows.truncate(LIMIT);
    rows
}

/// `ContinueStream`: the related memes Next's discovery index lists, then
/// the trending memes of the same category up to twelve. `indexable` is that
/// index, `None` when it cannot be read (then the section is not drawn).
pub async fn continue_stream(
    db: &Db,
    current: &Current<'_>,
    related: &[CardMeme],
    indexable: Option<&HashSet<String>>,
) -> Vec<CardMeme> {
    let empty = HashSet::new();
    let indexable = indexable.unwrap_or(&empty);
    let mut cards: Vec<CardMeme> = related
        .iter()
        .filter(|meme| indexable.contains(&meme.id))
        .take(LIMIT)
        .cloned()
        .collect();
    let need = LIMIT - cards.len();
    let seen: HashSet<String> = cards
        .iter()
        .map(|meme| meme.id.clone())
        .chain([current.id.to_owned()])
        .collect();
    let fallback: Vec<&String> = indexable.iter().filter(|id| !seen.contains(*id)).collect();
    if need == 0 || fallback.is_empty() {
        return cards;
    }
    let scan = meme_card::scan_limit(LIMIT);
    let stream = meme_card::indexable(
        db,
        &format!(
            "m.id = any(string_to_array($1, ',')::uuid[]) and m.category::text = $2 \
             and m.id <> $3::uuid and {PUBLIC}"
        ),
        "m.trend_score desc, m.id desc",
        scan,
        scan,
        vec![
            id_list(fallback),
            current.category.to_owned(),
            current.id.to_owned(),
        ],
    )
    .await
    .unwrap_or_default();
    let mut seen = seen;
    for meme in stream {
        if cards.len() == LIMIT {
            break;
        }
        if seen.insert(meme.id.clone()) {
            cards.push(meme);
        }
    }
    cards
}

/// `RelatedMemes`: nothing below `MIN_PUBLIC_LISTING_CARDS`.
pub fn similar(cards: &[CardMeme]) -> Markup {
    if cards.len() < meme_card::MIN_LISTING {
        return html! {};
    }
    html! {
        section aria-labelledby="related-memes" class="mt-2" {
            h2 id="related-memes" class="text-xl font-bold" { "비슷한 밈" }
            p class="mt-1 text-sm text-muted" { "이 밈과 가까운 항목이에요." }
            (meme_card::grid(
                "mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
                cards.iter().map(|meme| meme_card::card_sized(meme, None, TitleSize::Detail)),
            ))
        }
    }
}

/// `directoryNeighbours`: up to eight of the same category, then up to eight
/// of the same year, each list started at a point that depends on the id so
/// that neighbouring pages do not all link the same first entries.
pub fn neighbours<'a>(
    items: &'a [Item],
    current: &Current<'_>,
    exclude: &[CardMeme],
) -> (Vec<&'a Item>, Vec<&'a Item>) {
    let mut taken: HashSet<&str> = exclude.iter().map(|meme| meme.id.as_str()).collect();
    taken.insert(current.id);
    // `for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0`: one
    // step per code point, with its first UTF-16 unit.
    let hash = current.id.chars().fold(0u32, |hash, ch| {
        let unit = ch.encode_utf16(&mut [0; 2])[0];
        hash.wrapping_mul(31).wrapping_add(u32::from(unit))
    });
    let mut pick = |matches: &dyn Fn(&Item) -> bool| {
        let list: Vec<&'a Item> = items.iter().filter(|item| matches(item)).collect();
        let mut picked = Vec::new();
        if list.is_empty() {
            return picked;
        }
        let start = usize::try_from(hash).unwrap_or_default() % list.len();
        for item in list[start..].iter().chain(&list[..start]) {
            if picked.len() == NEIGHBOURS {
                break;
            }
            if taken.insert(item.id.as_str()) {
                picked.push(*item);
            }
        }
        picked
    };
    let same_category = pick(&|item| item.category == current.category);
    let same_year = match current.origin_year {
        Some(year) => pick(&|item| item.origin_year == Some(year)),
        None => Vec::new(),
    };
    (same_category, same_year)
}

/// `MemeNeighbourLinks`.
pub fn neighbour_links(
    current: &Current<'_>,
    same_category: &[&Item],
    same_year: &[&Item],
) -> Markup {
    if same_category.is_empty() && same_year.is_empty() {
        return html! {};
    }
    let category = labels::category_label(current.category).unwrap_or("같은 분류");
    html! {
        section aria-labelledby="meme-neighbours" class="space-y-4" {
            h2 id="meme-neighbours" class="text-lg font-bold [word-break:keep-all]" { "이어서 읽을 밈" }
            @if !same_category.is_empty() {
                (link_group(&format!("같은 분류: {category}"), same_category))
            }
            @if let (false, Some(year)) = (same_year.is_empty(), current.origin_year) {
                (link_group(&format!("같은 해({year}년)로 정리된 밈"), same_year))
            }
            p class="text-sm" {
                a class="font-semibold underline underline-offset-4" href="/memes" { "밈 전체 목록(가나다순) 보기" }
            }
        }
    }
}

fn link_group(heading: &str, items: &[&Item]) -> Markup {
    html! {
        div {
            h3 class="text-sm font-semibold text-muted" { (heading) }
            ul class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5 text-base" {
                @for item in items {
                    li {
                        a class="underline decoration-border decoration-2 underline-offset-4 hover:decoration-accent [word-break:keep-all]" href=(meme_path(&item.short_id, &item.slug)) { (item.title) }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, category: &str, year: Option<i32>) -> Item {
        Item {
            id: id.to_owned(),
            short_id: id.to_owned(),
            slug: id.to_owned(),
            title: id.to_owned(),
            summary: String::new(),
            category: category.to_owned(),
            origin_year: year,
        }
    }

    #[test]
    fn neighbours_start_where_the_id_hash_points_and_skip_what_is_taken() {
        // `(h * 31 + code) >>> 0` over this id is 4103219909 (Node); the
        // same-category list has eight entries and starts at 4103219909 % 8.
        let id = "00000000-0000-4000-8000-000000000001";
        let current = Current {
            id,
            category: "phrase",
            origin_year: Some(2022),
            tag_ids: &[],
        };
        let mut items: Vec<Item> = (0..7)
            .map(|n| item(&format!("p{n}"), "phrase", Some(2022)))
            .collect();
        items.push(item(id, "phrase", Some(2022)));
        items.push(item("y1", "image", Some(2022)));
        // The current meme is in the list but never linked; 7 of 8 remain.
        let list_len = items.iter().filter(|i| i.category == "phrase").count();
        assert_eq!(list_len, 8);
        let (category, year) = neighbours(&items, &current, &[]);
        let start = 4_103_219_909usize % 8;
        let rotated: Vec<&str> = items
            .iter()
            .filter(|i| i.category == "phrase")
            .cycle()
            .skip(start)
            .take(8)
            .map(|i| i.id.as_str())
            .filter(|i| *i != id)
            .collect();
        assert_eq!(
            category.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(),
            rotated
        );
        // Same year: whatever the category list did not take.
        assert_eq!(
            year.iter().map(|i| i.id.as_str()).collect::<Vec<_>>(),
            ["y1"]
        );
    }
}
