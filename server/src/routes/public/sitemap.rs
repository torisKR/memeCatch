//! `GET /sitemap.xml`: `app/sitemap.ts`, serialised as Next's
//! `resolveSitemap` does (next/dist/build/webpack/loaders/metadata/
//! resolve-route-data.js). Route id `sitemap`.
//!
//! The static pages, then every public meme of the discovery index (newest
//! published first) with its reviewed translations, then the pages of
//! `/memes`, then the localized explore pages that list enough memes. A
//! catalogue that cannot be read gives the static pages alone, not kept.
//! The answer is kept for an hour, as the module cache of the TypeScript.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use sqlx::{AssertSqlSafe, Row};

use super::csp_report::now_ms;
use super::labels::meme_path;
use super::localized::load_discovery_ids;
use super::rankings::RankingsVisibility;
use super::{js, js_date};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::next_rules;
use crate::pages::cache::Timed;
use crate::pages::content_depth::{DEPTH_COLUMNS, row_depth};
use crate::pages::{collections, directory, documents, meme_detail};
use crate::routes::ops::radar_text::iso_string;

const CACHE_TTL: Duration = Duration::from_secs(60 * 60);
const MAX_SITEMAP_URLS: usize = 50_000;
const MIN_LOCALIZED_EXPLORE_ITEMS: usize = 24;
const PAGE: i64 = 1_000;
const PAGE_LIMIT: i64 = 49_000;
const SEO_CONTENT_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
const STATIC_PAGES: [&str; 11] = [
    "/timeline",
    "/slang",
    "/weekly",
    "/rankings",
    "/community",
    "/news",
    "/about",
    "/editorial",
    "/privacy",
    "/terms",
    "/contact",
];

/// The kept answer, and the switch of `/rankings`.
pub struct SitemapCache {
    body: Timed<Arc<str>>,
    rankings: RankingsVisibility,
}

impl SitemapCache {
    pub fn new() -> Self {
        Self {
            body: Timed::new(CACHE_TTL),
            rankings: RankingsVisibility::default(),
        }
    }
}

pub async fn sitemap(state: AppState, cache: Arc<SitemapCache>) -> Response {
    let body = cache
        .body
        .get_or_load(|| async {
            let (body, available) = build(&state, &cache.rankings).await;
            // An outage is not kept: the next request reads again.
            if available { Ok(body) } else { Err(body) }
        })
        .await
        .unwrap_or_else(|unavailable| unavailable);
    let cache_control = next_rules::config_cache_control("/sitemap.xml").unwrap_or_default();
    (
        [
            (CONTENT_TYPE, "application/xml"),
            (CACHE_CONTROL, cache_control),
        ],
        body.to_string(),
    )
        .into_response()
}

/// `toHrefLang`.
fn href_lang(locale: &str) -> &str {
    match locale {
        "zh" => "zh-Hans",
        "zh-tw" => "zh-Hant",
        other => other,
    }
}

/// `localizedPath(path, locale)`: no prefix for Korean, `/en` for `/`.
fn localized_path(path: &str, locale: &str) -> String {
    match (locale, path) {
        ("ko", _) => path.to_owned(),
        (_, "/") => format!("/{locale}"),
        _ => format!("/{locale}{path}"),
    }
}

struct Entry {
    url: String,
    languages: Vec<(String, String)>,
    last_modified: Option<i64>,
    change_frequency: &'static str,
    priority: &'static str,
}

impl Entry {
    fn new(url: String, change_frequency: &'static str, priority: &'static str) -> Self {
        Self {
            url,
            languages: Vec::new(),
            last_modified: None,
            change_frequency,
            priority,
        }
    }
}

struct Site<'a>(&'a str);

impl Site<'_> {
    /// `absolute`: the site URL, and nothing more for `/`.
    fn absolute(&self, path: &str) -> String {
        if path == "/" {
            self.0.to_owned()
        } else {
            format!("{}{path}", self.0)
        }
    }

    fn home_languages(&self) -> Vec<(String, String)> {
        let mut languages: Vec<(String, String)> = ["ko"]
            .iter()
            .chain(&SEO_CONTENT_LOCALES)
            .map(|locale| {
                (
                    href_lang(locale).to_owned(),
                    self.absolute(&localized_path("/", locale)),
                )
            })
            .collect();
        languages.push(("x-default".to_owned(), self.absolute("/en")));
        languages
    }
}

#[derive(Deserialize)]
struct Translation {
    locale: String,
    status: String,
    localized_slug: Option<String>,
    source_updated_at: String,
    updated_at: String,
    title: String,
    summary: String,
    description: String,
    origin: String,
}

impl Translation {
    /// `publishedLocalizedSlug`.
    fn slug<'a>(&'a self, korean: &'a str) -> &'a str {
        let trimmed = self
            .localized_slug
            .as_deref()
            .map(js::trim)
            .unwrap_or_default();
        if trimmed.is_empty() { korean } else { trimmed }
    }

    /// `isIndexableLocalizedMeme` for a meme already in the discovery index:
    /// reviewed, of the meme's current revision, with all four texts.
    fn is_indexable(&self, meme_updated_ms: i64) -> bool {
        self.status == "reviewed"
            && js_date::parse_ms(&self.source_updated_at) == Some(meme_updated_ms)
            && [&self.title, &self.summary, &self.description, &self.origin]
                .iter()
                .all(|text| !js::trim(text).is_empty())
    }
}

/// `validDate` for the text of a JSON timestamp.
fn valid_text_date(text: &str, now: i64) -> Option<i64> {
    js_date::evidence_ms(js::trim(text), now)
}

/// `validDate` for a `Date` node-pg made: its `toISOString()` must pass too.
fn valid_ms(ms: Option<i64>, now: i64) -> Option<i64> {
    let text = iso_string(ms? as f64)?;
    js_date::evidence_ms(&text, now)
}

/// The entries before the memes; the index of `/explore` among them.
fn static_entries(
    site: &Site<'_>,
    home_modified: Option<i64>,
    show_rankings: bool,
) -> (Vec<Entry>, usize) {
    let mut entries = vec![Entry {
        last_modified: home_modified,
        languages: site.home_languages(),
        ..Entry::new(site.0.to_owned(), "hourly", "1")
    }];
    for locale in SEO_CONTENT_LOCALES {
        entries.push(Entry {
            languages: site.home_languages(),
            ..Entry::new(site.absolute(&localized_path("/", locale)), "daily", "0.8")
        });
    }
    entries.push(Entry::new(
        format!("{}/collections", site.0),
        "daily",
        "0.75",
    ));
    for slug in collections::slugs() {
        entries.push(Entry::new(
            format!("{}/collections/{slug}", site.0),
            "daily",
            "0.7",
        ));
    }
    let explore = entries.len();
    entries.push(Entry {
        last_modified: home_modified,
        ..Entry::new(format!("{}/explore", site.0), "daily", "0.6")
    });
    for path in STATIC_PAGES
        .iter()
        .filter(|path| show_rankings || **path != "/rankings")
    {
        entries.push(Entry::new(format!("{}{path}", site.0), "daily", "0.6"));
    }
    entries.push(Entry::new(format!("{}/guides", site.0), "monthly", "0.6"));
    for slug in documents::guides::slugs() {
        entries.push(Entry::new(
            format!("{}/guides/{slug}", site.0),
            "monthly",
            "0.6",
        ));
    }
    (entries, explore)
}

/// What the meme loop counts for the localized home and explore pages.
#[derive(Default)]
struct Localized {
    explore_counts: HashMap<&'static str, usize>,
    modified: HashMap<&'static str, i64>,
}

async fn build(state: &AppState, rankings: &RankingsVisibility) -> (Arc<str>, bool) {
    let site = Site(super::labels::site_url(&state.config.site_url));
    let db = &state.db;
    let now = now_ms();
    let latest = latest_published_ms(db).await;
    let mut available = latest.is_ok();
    let home_modified = latest.ok().flatten().and_then(|ms| valid_ms(Some(ms), now));
    let show_rankings = rankings.visible(db, now).await;
    let (mut entries, explore_index) = static_entries(&site, home_modified, show_rankings);

    let mut korean_count = 0;
    let mut localized = Localized::default();
    if available {
        let read = match load_discovery_ids(db).await {
            Ok(discovery) => {
                let memes = Memes {
                    site: &site,
                    discovery: &discovery,
                    now,
                };
                memes.add_all(db, &mut entries, &mut localized).await
            }
            Err(error) => {
                tracing::warn!(%error, "sitemap discovery index");
                Err(())
            }
        };
        match read {
            Ok(count) => korean_count = count,
            Err(()) => available = false,
        }
    }
    if !available {
        // reportCatalogUnavailable: the error text is not printed there.
        tracing::error!("[sitemap] catalog unavailable");
    }
    if available && korean_count > 0 {
        for page in 1..=directory::page_count(korean_count) {
            let priority = if page == 1 { "0.7" } else { "0.5" };
            let url = site.absolute(&directory::page_path(page));
            entries.push(Entry::new(url, "weekly", priority));
        }
    }
    for (index, locale) in SEO_CONTENT_LOCALES.iter().enumerate() {
        entries[1 + index].last_modified = localized.modified.get(locale).copied();
    }
    add_localized_explore(&site, &mut entries, explore_index, &localized);
    entries.truncate(MAX_SITEMAP_URLS);
    (Arc::from(serialize(&entries)), available)
}

/// The localized explore pages that list enough memes, and their languages
/// on the Korean one.
fn add_localized_explore(
    site: &Site<'_>,
    entries: &mut Vec<Entry>,
    explore_index: usize,
    localized: &Localized,
) {
    let active: Vec<&str> = SEO_CONTENT_LOCALES
        .iter()
        .copied()
        .filter(|locale| {
            localized.explore_counts.get(locale).copied().unwrap_or(0)
                >= MIN_LOCALIZED_EXPLORE_ITEMS
        })
        .collect();
    if active.is_empty() {
        return;
    }
    let mut languages = vec![("ko".to_owned(), site.absolute("/explore"))];
    for locale in &active {
        let url = site.absolute(&localized_path("/explore", locale));
        languages.push((href_lang(locale).to_owned(), url));
    }
    let default = languages
        .iter()
        .find(|(lang, _)| lang == "en")
        .map_or_else(|| languages[0].1.clone(), |(_, url)| url.clone());
    languages.push(("x-default".to_owned(), default));
    entries[explore_index].languages = languages.clone();
    for locale in active {
        entries.push(Entry {
            last_modified: localized.modified.get(locale).copied(),
            languages: languages.clone(),
            ..Entry::new(
                site.absolute(&localized_path("/explore", locale)),
                "daily",
                "0.65",
            )
        });
    }
}

/// `published_at` of the newest public meme (`nullsFirst: false`).
async fn latest_published_ms(db: &Db) -> Result<Option<i64>, sqlx::Error> {
    const SQL: &str = "select floor(extract(epoch from published_at) * 1000)::bigint \
                         from public.memes \
                        where moderation_status in ('approved', 'limited') \
                        order by published_at desc nulls last limit 1";
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            sqlx::query_scalar::<_, Option<i64>>(SQL)
                .fetch_optional(tx)
                .await
        })
    })
    .await
    .map(Option::flatten)
    .inspect_err(|error| tracing::warn!(%error, "sitemap latest meme"))
}

// `DEPTH_SELECT` with the translations, a thousand rows at a time, newest
// published first and then by id (the tie-breaker of the TypeScript).
fn page_sql() -> String {
    format!(
        "select m.id::text as id, m.short_id, m.slug, \
                floor(extract(epoch from m.updated_at) * 1000)::bigint as updated_ms, \
                {DEPTH_COLUMNS}, \
                (select coalesce(json_agg(json_build_object('locale', t.locale, \
                        'status', t.status, 'localized_slug', t.localized_slug, \
                        'source_updated_at', t.source_updated_at, 'updated_at', t.updated_at, \
                        'title', t.title, 'summary', t.summary, \
                        'description', t.description, 'origin', t.origin)), '[]'::json)::text \
                   from public.meme_translations t where t.meme_id = m.id) as translations \
           from public.memes m \
          where m.moderation_status in ('approved', 'limited') \
          order by m.published_at desc, m.id desc \
          limit {PAGE} offset $1"
    )
}

struct Memes<'a> {
    site: &'a Site<'a>,
    discovery: &'a HashSet<String>,
    now: i64,
}

impl Memes<'_> {
    /// Adds the meme entries; the number of Korean ones, or `Err` when a page
    /// could not be read.
    async fn add_all(
        &self,
        db: &Db,
        entries: &mut Vec<Entry>,
        localized: &mut Localized,
    ) -> Result<usize, ()> {
        let sql = page_sql();
        let mut korean = 0;
        let mut from = 0;
        while from < PAGE_LIMIT {
            let sql = sql.clone();
            let rows = db
                .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
                    Box::pin(async move {
                        sqlx::query(AssertSqlSafe(sql))
                            .bind(from)
                            .fetch_all(tx)
                            .await
                    })
                })
                .await
                .map_err(|error| tracing::warn!(%error, "sitemap catalog page"))?;
            for row in &rows {
                korean += self
                    .add(row, entries, localized)
                    .map_err(|error| tracing::warn!(%error, "sitemap catalog row"))?;
            }
            if (rows.len() as i64) < PAGE {
                break;
            }
            from += PAGE;
        }
        Ok(korean)
    }

    fn add(
        &self,
        row: &sqlx::postgres::PgRow,
        entries: &mut Vec<Entry>,
        localized: &mut Localized,
    ) -> Result<usize, sqlx::Error> {
        let short_id: String = row.try_get("short_id")?;
        let id: String = row.try_get("id")?;
        if meme_detail::is_canonical_alias(&short_id) || !self.discovery.contains(&id) {
            return Ok(0);
        }
        let slug: String = row.try_get("slug")?;
        let updated_ms: Option<i64> = row.try_get("updated_ms")?;
        let raw: String = row.try_get("translations")?;
        let rows: Vec<Translation> =
            serde_json::from_str(&raw).map_err(|error| sqlx::Error::Decode(Box::new(error)))?;
        // `reviewedTranslations`: a later row of a locale replaces an earlier
        // one that passed (`Map.set`).
        let translations: Vec<(&'static str, &Translation)> = SEO_CONTENT_LOCALES
            .iter()
            .filter_map(|locale| {
                rows.iter()
                    .rev()
                    .find(|t| {
                        t.locale == *locale && updated_ms.is_some_and(|ms| t.is_indexable(ms))
                    })
                    .map(|found| (*locale, found))
            })
            .collect();
        let korean_path = meme_path(&short_id, &slug);
        let localized_url = |locale: &str, translation: &Translation| {
            let path = meme_path(&short_id, translation.slug(&slug));
            self.site.absolute(&localized_path(&path, locale))
        };
        let mut languages = vec![("ko".to_owned(), self.site.absolute(&korean_path))];
        for (locale, translation) in &translations {
            languages.push((
                href_lang(locale).to_owned(),
                localized_url(locale, translation),
            ));
        }
        let default = languages
            .iter()
            .find(|(lang, _)| lang == "en")
            .map_or_else(|| self.site.absolute(&korean_path), |(_, url)| url.clone());
        languages.push(("x-default".to_owned(), default));

        for (locale, translation) in &translations {
            *localized.explore_counts.entry(locale).or_default() += 1;
            if let Some(at) = valid_text_date(&translation.updated_at, self.now) {
                let latest = localized.modified.entry(locale).or_insert(at);
                *latest = (*latest).max(at);
            }
        }
        let mut korean = 0;
        // `!isThinMeme(meme)`: the discovery index already requires it.
        if entries.len() < MAX_SITEMAP_URLS && row_depth(row)?.is_indexable() {
            entries.push(Entry {
                last_modified: valid_ms(updated_ms, self.now),
                languages: languages.clone(),
                ..Entry::new(self.site.absolute(&korean_path), "weekly", "0.8")
            });
            korean = 1;
        }
        for (locale, translation) in &translations {
            if entries.len() >= MAX_SITEMAP_URLS {
                break;
            }
            entries.push(Entry {
                last_modified: valid_text_date(&translation.updated_at, self.now),
                languages: languages.clone(),
                ..Entry::new(localized_url(locale, translation), "weekly", "0.75")
            });
        }
        Ok(korean)
    }
}

fn serialize(entries: &[Entry]) -> String {
    let mut out = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    out.push_str("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"");
    if entries.iter().any(|entry| !entry.languages.is_empty()) {
        out.push_str(" xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n");
    } else {
        out.push_str(">\n");
    }
    for entry in entries {
        out.push_str("<url>\n");
        out.push_str(&format!("<loc>{}</loc>\n", entry.url));
        for (lang, href) in &entry.languages {
            out.push_str(&format!(
                "<xhtml:link rel=\"alternate\" hreflang=\"{lang}\" href=\"{href}\" />\n"
            ));
        }
        if let Some(text) = entry.last_modified.and_then(|ms| iso_string(ms as f64)) {
            out.push_str(&format!("<lastmod>{text}</lastmod>\n"));
        }
        out.push_str(&format!(
            "<changefreq>{}</changefreq>\n",
            entry.change_frequency
        ));
        out.push_str(&format!("<priority>{}</priority>\n", entry.priority));
        out.push_str("</url>\n");
    }
    out.push_str("</urlset>\n");
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_and_languages_follow_i18n_routing() {
        assert_eq!(localized_path("/", "en"), "/en");
        assert_eq!(localized_path("/explore", "zh-tw"), "/zh-tw/explore");
        assert_eq!(localized_path("/memes/a-b", "ko"), "/memes/a-b");
        assert_eq!(href_lang("zh"), "zh-Hans");
        let site = Site("https://catchmeme.com");
        assert_eq!(site.absolute("/"), "https://catchmeme.com");
        let languages = site.home_languages();
        assert_eq!(languages[0].1, "https://catchmeme.com");
        assert_eq!(
            languages.last().unwrap(),
            &(
                "x-default".to_owned(),
                "https://catchmeme.com/en".to_owned()
            )
        );
    }

    #[test]
    fn serialization_is_resolve_sitemap() {
        let entries = [Entry {
            last_modified: Some(1_795_998_055_949),
            ..Entry::new("https://catchmeme.com/about".to_owned(), "daily", "0.6")
        }];
        assert_eq!(
            serialize(&entries),
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n<url>\n<loc>https://catchmeme.com/about</loc>\n<lastmod>2026-11-30T00:20:55.949Z</lastmod>\n<changefreq>daily</changefreq>\n<priority>0.6</priority>\n</url>\n</urlset>\n"
        );
    }
}
