//! The address of /explore, the filters it names (`parseFilters`), and the
//! window of memes they select (`buildQuery`, `collectIndexableWindow`).

use sqlx::Row;
use sqlx::postgres::PgRow;
use url::form_urlencoded;

use super::Item;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::pages::content_depth::{DEPTH_COLUMNS, row_depth};
use crate::pages::meme_card::{CARD_COLUMNS, CardMeme};
use crate::routes::public::js;

/// `PAGE_SIZE` of the grid.
const PAGE_SIZE: usize = 24;
/// `SEARCH_LIMIT`: `search_memes` returns at most this many rows.
const SEARCH_LIMIT: i32 = 50;
/// `LISTING_SCAN_CAP` of lib/thin-meme.ts.
const SCAN_CAP: usize = 400;
/// `UNAVAILABLE_FILTER`, sent as the planner sends it: one element.
const UNAVAILABLE: &str = "(dead,region_blocked)";

/// `DISPLAY_CATEGORIES`: token, label, the legacy categories it stands for.
pub const DISPLAY_CATEGORIES: [(&str, &str, &[&str]); 6] = [
    ("ai-meme", "AI 밈", &["phrase", "image"]),
    ("meme_term", "밈 용어(유행어)", &["phrase"]),
    ("challenge_dance", "챌린지 댄스", &["dance", "challenge"]),
    ("song", "노래", &["song"]),
    ("drama_scene", "드라마 장면", &["comment"]),
    ("meme_video", "밈 영상", &["image"]),
];
/// `DISPLAY_BY_LEGACY_CATEGORY`.
const LEGACY: [(&str, &str); 6] = [
    ("phrase", "meme_term"),
    ("dance", "challenge_dance"),
    ("song", "song"),
    ("image", "meme_video"),
    ("comment", "drama_scene"),
    ("challenge", "challenge_dance"),
];
const AI_MEME: &str = "ai-meme";
const AI_MEME_TAG: &str = "AI 밈";
pub const DIFFICULTIES: [(&str, &str); 3] =
    [("beginner", "입문"), ("normal", "보통"), ("deep", "고인물")];
pub const LIFECYCLES: [(&str, &str); 4] = [
    ("rising", "급상승"),
    ("active", "유행 중"),
    ("cooling", "식는 중"),
    ("archived", "추억 밈"),
];
pub const YEARS: [(&str, &str, i64, i64); 3] = [
    ("2020s", "2020년대", 2020, 2029),
    ("2010s", "2010년대", 2010, 2019),
    ("2000s", "2000년대", 2000, 2009),
];
pub const MEDIA: [(&str, &str); 5] = [
    ("image", "짤"),
    ("video", "영상"),
    ("audio", "오디오"),
    ("text", "텍스트"),
    ("embed", "임베드"),
];
pub const PLATFORMS: [(&str, &str); 5] = [
    ("", "전체 출처"),
    ("youtube", "YouTube"),
    ("youtube_shorts", "Shorts"),
    ("tiktok", "TikTok"),
    ("instagram", "Instagram"),
];
pub const SORTS: [(&str, &str); 4] = [
    ("trending", "급상승"),
    ("recent", "최신"),
    ("popular", "인기"),
    ("controversial", "논쟁 중"),
];

/// The query string as `URLSearchParams` reads it.
pub struct Params(Vec<(String, String)>);

impl Params {
    pub fn parse(query: Option<&str>) -> Self {
        Self(
            form_urlencoded::parse(query.unwrap_or_default().as_bytes())
                .map(|(key, value)| (key.into_owned(), value.into_owned()))
                .collect(),
        )
    }

    /// `get(key)`: the first value.
    pub fn first(&self, key: &str) -> Option<&str> {
        self.0
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    /// `getAll(key)`.
    pub fn all<'a>(&'a self, key: &'a str) -> impl Iterator<Item = &'a str> + 'a {
        self.0
            .iter()
            .filter(move |(name, _)| name == key)
            .map(|(_, value)| value.as_str())
    }

    pub fn pairs(&self) -> &[(String, String)] {
        &self.0
    }
}

/// `expandDisplayCategoryTokens`: known tokens and legacy categories as
/// display tokens, each once, in the order given.
pub fn display_tokens<'a>(tokens: impl Iterator<Item = &'a str>) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = Vec::new();
    for token in tokens {
        let display = DISPLAY_CATEGORIES
            .iter()
            .map(|(key, _, _)| *key)
            .find(|key| *key == token)
            .or_else(|| {
                LEGACY
                    .iter()
                    .find(|(legacy, _)| *legacy == token)
                    .map(|(_, display)| *display)
            });
        if let Some(display) = display
            && !out.contains(&display)
        {
            out.push(display);
        }
    }
    out
}

/// The first value of `key` when it is one of `allowed` (`one`).
fn one<'a>(
    params: &Params,
    key: &str,
    allowed: impl IntoIterator<Item = &'a str>,
) -> Option<&'a str> {
    let value = params.first(key)?;
    allowed
        .into_iter()
        .find(|candidate| *candidate == value && !value.is_empty())
}

/// `ExploreFilters` as the server reads them (`parseFilters`).
pub struct Filters {
    pub categories: Vec<&'static str>,
    pub topic_tag: bool,
    pub difficulty: Option<&'static str>,
    pub lifecycle: Option<&'static str>,
    pub media: Option<&'static str>,
    pub year: Option<(i64, i64)>,
    pub platform: Option<&'static str>,
    pub sort: &'static str,
    pub q: Option<String>,
}

impl From<&Params> for Filters {
    fn from(params: &Params) -> Self {
        let display = display_tokens(params.all("category"));
        let mut categories: Vec<&'static str> = Vec::new();
        for token in &display {
            let (_, _, legacy) = DISPLAY_CATEGORIES
                .iter()
                .find(|(key, _, _)| key == token)
                .expect("a display token");
            for category in *legacy {
                if !categories.contains(category) {
                    categories.push(category);
                }
            }
        }
        let year = one(params, "year", YEARS.map(|(key, ..)| key))
            .and_then(|key| YEARS.iter().find(|(name, ..)| *name == key))
            .map(|(_, _, lo, hi)| (*lo, *hi));
        Self {
            categories,
            topic_tag: display.contains(&AI_MEME),
            difficulty: one(params, "difficulty", DIFFICULTIES.map(|(key, _)| key)),
            lifecycle: one(params, "lifecycle", LIFECYCLES.map(|(key, _)| key)),
            media: one(params, "media", MEDIA.map(|(key, _)| key)),
            year,
            platform: one(
                params,
                "platform",
                PLATFORMS[1..].iter().map(|(key, _)| *key),
            ),
            sort: one(params, "sort", SORTS.map(|(key, _)| key)).unwrap_or("trending"),
            q: params
                .first("q")
                .map(js::trim)
                .filter(|q| !q.is_empty())
                .map(str::to_owned),
        }
    }
}

enum Bind {
    Text(String),
    Texts(Vec<String>),
    Int(i32),
    BigInt(i64),
}

/// SQL with numbered placeholders and the values that fill them.
#[derive(Default)]
struct Sql {
    text: String,
    binds: Vec<Bind>,
}

impl Sql {
    fn bind(&mut self, value: Bind) -> String {
        self.binds.push(value);
        format!("${}", self.binds.len())
    }

    fn text(&mut self, value: impl Into<String>) -> String {
        self.bind(Bind::Text(value.into()))
    }

    fn push(&mut self, part: &str) {
        self.text.push_str(part);
    }
}

/// The card (its contents carry what a preview is chosen from) and its depth.
fn columns() -> String {
    format!("{CARD_COLUMNS}, {DEPTH_COLUMNS}")
}

/// `withPublicContent` and `withPlatform` on the `matched_contents!inner`
/// embed: a content of the meme that is approved, not "unavailable" in the
/// planner's sense, and on the platform.
fn platform_condition(sql: &mut Sql, platform: &str) -> String {
    let approved = sql.text("approved");
    let unavailable = sql.bind(Bind::Texts(vec![UNAVAILABLE.to_owned()]));
    let mut condition = format!(
        "exists (select 1 from public.meme_contents pc where pc.meme_id = m.id \
         and pc.moderation_status::text = {approved} \
         and not (pc.availability::text = any({unavailable}::text[]))"
    );
    let (name, shorts) = match platform {
        "youtube" => ("youtube", Some(false)),
        "youtube_shorts" => ("youtube", Some(true)),
        other => (other, None),
    };
    let name = sql.text(name);
    condition.push_str(&format!(" and pc.platform ilike {name}"));
    if let Some(shorts) = shorts {
        let pattern = sql.text("%/shorts/%");
        condition.push_str(&if shorts {
            format!(" and pc.url ilike {pattern}")
        } else {
            format!(" and not (pc.url ilike {pattern})")
        });
    }
    condition.push(')');
    condition
}

/// `buildQuery(db, filters, indexableIds).range(from, from + count - 1)`.
fn window_sql(filters: &Filters, ids: &[String], from: usize, count: usize) -> Sql {
    let mut sql = Sql::default();
    let mut conditions = Vec::new();
    let source = match &filters.q {
        Some(q) => {
            let q = sql.text(q.clone());
            let limit = sql.bind(Bind::Int(SEARCH_LIMIT));
            let function = if filters.topic_tag {
                "search_ai_memes"
            } else {
                "search_memes"
            };
            format!("public.{function}(p_query => {q}, p_limit => {limit})")
        }
        None => {
            let statuses = sql.bind(Bind::Texts(vec!["approved".into(), "limited".into()]));
            conditions.push(format!(
                "m.moderation_status::text = any({statuses}::text[])"
            ));
            if filters.topic_tag {
                let tag = sql.text(AI_MEME_TAG);
                conditions.push(format!(
                    "exists (select 1 from public.meme_tags_map tm where tm.meme_id = m.id \
                     and exists (select 1 from public.tags t where t.id = tm.tag_id and t.name = {tag}))"
                ));
            }
            "public.memes".to_owned()
        }
    };
    if !filters.categories.is_empty() {
        let list = sql.bind(Bind::Texts(
            filters.categories.iter().map(|c| (*c).to_owned()).collect(),
        ));
        conditions.push(format!("m.category::text = any({list}::text[])"));
    }
    for (column, value) in [
        ("difficulty", filters.difficulty),
        ("lifecycle_status", filters.lifecycle),
        ("media_type", filters.media),
    ] {
        if let Some(value) = value {
            let value = sql.text(value);
            conditions.push(format!("m.{column}::text = {value}"));
        }
    }
    if let Some((lo, hi)) = filters.year {
        let lo = sql.bind(Bind::BigInt(lo));
        let hi = sql.bind(Bind::BigInt(hi));
        conditions.push(format!("m.origin_year >= {lo} and m.origin_year <= {hi}"));
    }
    if let Some(platform) = filters.platform {
        let condition = platform_condition(&mut sql, platform);
        conditions.push(condition);
    }
    if filters.sort == "controversial" {
        let sentiment = sql.text("controversial");
        conditions.push(format!("m.sentiment::text = {sentiment}"));
    }
    // `limitQueryToIds`: an empty index matches no row. The ids are cast in
    // a subquery, once: the statement is prepared, and in Postgres's generic
    // plan a plain `$n::uuid[]` of the text array is cast again on every row
    // scanned (3,600 ids × the catalog took 2.2 s).
    let ids = sql.bind(Bind::Texts(ids.to_vec()));
    conditions.push(format!("m.id = any((select {ids}::uuid[])::uuid[])"));
    let order = if matches!(filters.sort, "recent" | "controversial") {
        "m.published_at desc nulls last, m.id desc"
    } else {
        "m.trend_score desc, m.id desc"
    };
    let limit = sql.bind(Bind::Int(i32::try_from(count).unwrap_or(i32::MAX)));
    let offset = sql.bind(Bind::Int(i32::try_from(from).unwrap_or(i32::MAX)));
    sql.push(&format!(
        "select {columns} from {source} m where {conditions} order by {order} limit {limit} offset {offset}",
        columns = columns(),
        conditions = conditions.join(" and "),
    ));
    sql
}

async fn fetch(db: &Db, sql: Sql) -> Result<Vec<PgRow>, sqlx::Error> {
    let Sql { text, binds } = sql;
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            let mut statement = sqlx::query(sqlx::AssertSqlSafe(text));
            for bind in binds {
                statement = match bind {
                    Bind::Text(value) => statement.bind(value),
                    Bind::Texts(values) => statement.bind(values),
                    Bind::Int(value) => statement.bind(value),
                    Bind::BigInt(value) => statement.bind(value),
                };
            }
            statement.fetch_all(tx).await
        })
    })
    .await
}

pub(crate) fn item(row: &PgRow) -> Result<Item, sqlx::Error> {
    let contents: String = row.try_get("card_contents")?;
    Ok(Item {
        meme: CardMeme::from_row(row)?,
        curated: false,
        contents: serde_json::from_str(&contents)
            .map_err(|error| sqlx::Error::Decode(Box::new(error)))?,
    })
}

/// What `collectIndexableWindow` gives back.
pub struct Window {
    pub items: Vec<Item>,
    pub scanned: usize,
    pub has_more: bool,
}

/// `collectIndexableWindow(fetchRange, from, PAGE_SIZE, { pageSize: PAGE_SIZE })`
/// over `buildQuery`: rows in windows of 24 until 24 that are not thin, at
/// most 400 read.
pub async fn window(
    db: &Db,
    filters: &Filters,
    ids: &[String],
    start: usize,
) -> Result<Window, sqlx::Error> {
    let mut items = Vec::new();
    let mut scanned = 0;
    let mut has_more = false;
    while items.len() < PAGE_SIZE && scanned < SCAN_CAP {
        let batch = fetch(db, window_sql(filters, ids, start + scanned, PAGE_SIZE)).await?;
        if batch.is_empty() {
            has_more = false;
            break;
        }
        let mut consumed = 0;
        for row in &batch {
            consumed += 1;
            if !row_depth(row)?.is_thin() {
                items.push(item(row)?);
            }
            if items.len() == PAGE_SIZE {
                break;
            }
        }
        scanned += consumed;
        let continues = batch.len() == PAGE_SIZE;
        has_more = consumed < batch.len() || continues;
        if items.len() == PAGE_SIZE {
            break;
        }
        if !continues {
            has_more = false;
            break;
        }
    }
    Ok(Window {
        items,
        scanned,
        has_more,
    })
}

/// The public memes of these ids, as `/api/explore/previews` reads them
/// again, in the order Postgres returns them.
pub async fn by_ids(db: &Db, ids: Vec<String>) -> Result<Vec<Item>, sqlx::Error> {
    let ids: Vec<String> = ids
        .into_iter()
        .filter(|id| crate::routes::public::explore_previews::is_uuid(id))
        .collect();
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut sql = Sql::default();
    let ids = sql.bind(Bind::Texts(ids));
    let statuses = sql.bind(Bind::Texts(vec!["approved".into(), "limited".into()]));
    sql.push(&format!(
        "select {columns} from public.memes m where m.id = any({ids}::uuid[]) \
         and m.moderation_status::text = any({statuses}::text[])",
        columns = columns(),
    ));
    fetch(db, sql).await?.iter().map(item).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn filters(query: &str) -> Filters {
        Filters::from(&Params::parse(Some(query)))
    }

    #[test]
    fn the_address_names_filters_as_parse_filters_reads_it() {
        let f = filters(
            "category=dance&category=challenge_dance&category=song&category=nope&difficulty=zzz&difficulty=deep&year=2010s&platform=x&sort=bogus&q=%20%ED%95%9C%20",
        );
        assert_eq!(f.categories, ["dance", "challenge", "song"]);
        assert!(!f.topic_tag);
        // The first value only, and only a known one.
        assert_eq!(f.difficulty, None);
        assert_eq!(f.year, Some((2010, 2019)));
        assert_eq!(f.platform, None);
        assert_eq!(f.sort, "trending");
        assert_eq!(f.q.as_deref(), Some("한"));

        let f = filters("category=ai-meme&category=image&sort=recent&platform=youtube_shorts&q=+");
        assert_eq!(f.categories, ["phrase", "image"]);
        assert!(f.topic_tag);
        assert_eq!(f.sort, "recent");
        assert_eq!(f.platform, Some("youtube_shorts"));
        assert_eq!(f.q, None);
    }

    #[test]
    fn a_search_reads_the_search_function_without_the_moderation_filter() {
        let sql = window_sql(&filters("q=a&category=ai-meme"), &[], 24, 24);
        assert!(
            sql.text
                .contains("from public.search_ai_memes(p_query => $1, p_limit => $2) m")
        );
        assert!(!sql.text.contains("moderation_status::text = any"));
        assert!(!sql.text.contains("tags t"));
        assert!(
            sql.text
                .ends_with("order by m.trend_score desc, m.id desc limit $5 offset $6")
        );

        let sql = window_sql(
            &filters("category=ai-meme&platform=youtube&sort=controversial"),
            &[],
            0,
            24,
        );
        assert!(sql.text.contains("from public.memes m"));
        assert!(sql.text.contains("t.name = $2"));
        assert!(sql.text.contains("and not (pc.url ilike $7)"));
        assert!(
            sql.text
                .contains("order by m.published_at desc nulls last, m.id desc")
        );
    }
}
