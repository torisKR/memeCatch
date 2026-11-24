//! The retired product pages: `/retired-products`, `/products/...` and
//! `/go/products/...`, bare or under `/en`, `/ja`, `/zh` and `/zh-tw`, and
//! `/admin/creator-products/...`. `proxy.ts` answers them before any page
//! (`retiredProductDecision` in lib/retired-products.ts): a 410 document of
//! its own (lib/retired-product-document.ts: no site frame, no script) with
//! four meme cards, a 308, or an empty 404. Route id `page-retired-products`,
//! off until `AXUM_PILOT_ROUTES` names it.
//!
//! Its copy, navigation, fallback illustrations and safety labels are the
//! TypeScript's, exported to `i18n/retired.json` by `scripts/build-i18n.mjs`.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use std::time::Duration;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE, LOCATION, VARY};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use maud::{DOCTYPE, Markup, html};
use serde::Deserialize;
use serde_json::Value;
use sqlx::Row;

use super::chrome::brand_tile;
use super::content_depth::{ContentRow, DepthInput, SourceRow, content_depth};
use super::i18n::Locale;
use super::i18n::routing::SEO_CONTENT_LOCALES;
use super::labels::SafetyLevel;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::headers::AnsweredBeforeRouting;
use crate::routes::public::labels::meme_path;
use crate::{AppState, fallback};

const RETIRED_JSON: &str = include_str!("../../i18n/retired.json");
/// Next reads the cards through its public catalog cache, which keeps them
/// up to a day. Nothing tells this process about an edit, so it asks sooner.
pub const RETIRED_CARDS_TTL: Duration = Duration::from_secs(300);
const CARD_COUNT: usize = 4;
const CATALOG_LIMIT: i64 = 48;
const TRENDING_LIMIT: usize = 24;
// `indexableScanLimit(24)` in lib/thin-meme.ts: 24 × 20, capped at 400.
const TRENDING_SCAN: i64 = 400;
const TRENDING_YEAR: i32 = 2026;
const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
// `buttonVariants({ size: "lg" })` with the page's own classes.
const BUTTON: &str = "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm transition outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)] h-12 px-6 has-[>svg]:px-4 mt-6 rounded-xl bg-accent-strong font-bold text-white hover:bg-accent-strong/90";
// `MEME_CARD_LINK_CLASS` with the module's `shell` class.
const CARD_LINK: &str = "meme-card-link block min-w-0 rounded-[16px] text-inherit no-underline outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,20,20,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5c38] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 meme-card-shell";
const NEON_RING: &str = "shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)]";

#[derive(Deserialize)]
struct RetiredJson {
    copy: HashMap<String, PageCopy>,
    document: HashMap<String, DocumentCopy>,
    brand: HashMap<String, Brand>,
    nav: HashMap<String, Vec<(String, String)>>,
    #[serde(rename = "fallbackPicks")]
    fallback_picks: Vec<FallbackPick>,
    #[serde(rename = "safetyLabels")]
    safety_labels: HashMap<String, HashMap<String, String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageCopy {
    message: String,
    explore: String,
    explore_href: String,
    popular: String,
}

#[derive(Deserialize)]
struct DocumentCopy {
    lang: String,
    title: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Brand {
    name: String,
    home: String,
    home_href: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FallbackPick {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    safety: String,
    year: i32,
    thumbnail: String,
}

static RETIRED: LazyLock<RetiredJson> =
    LazyLock::new(|| serde_json::from_str(RETIRED_JSON).expect("i18n/retired.json parses"));

/// A card as the page needs it.
#[derive(Clone, Debug)]
pub struct Card {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    safety_level: Option<SafetyLevel>,
    origin_year: Option<i32>,
    /// `representativeThumbnail`: the representative content's, or the first.
    thumbnail: Option<String>,
}

/// `RetiredProductDecision`. `locale` is the copy (`ko` or `en`), `route`
/// the language the cards are labelled in.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Decision {
    Gone {
        locale: &'static str,
        route: &'static str,
    },
    Redirect(&'static str),
    Missing,
}

/// `retiredProductDecision(pathname)`.
pub(crate) fn decision(pathname: &str) -> Option<Decision> {
    let path = if pathname.len() > 1 {
        pathname.strip_suffix('/').unwrap_or(pathname)
    } else {
        pathname
    };
    if path == "/admin/creator-products" || path.starts_with("/admin/creator-products/") {
        return Some(Decision::Redirect("/"));
    }
    // `/^\/(en|ja|zh-tw|zh)(?=\/|$)/`.
    let prefix = ["en", "ja", "zh-tw", "zh"].into_iter().find(|prefix| {
        path.strip_prefix('/')
            .and_then(|rest| rest.strip_prefix(prefix))
            .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
    });
    let rest = match prefix {
        Some(prefix) => match &path[prefix.len() + 1..] {
            "" => "/",
            rest => rest,
        },
        None => path,
    };
    if rest == "/retired-products" {
        return Some(match prefix {
            Some("en") => Decision::Gone {
                locale: "en",
                route: "en",
            },
            None => Decision::Gone {
                locale: "ko",
                route: "ko",
            },
            Some(_) => Decision::Missing,
        });
    }
    let product = rest == "/products" || rest.starts_with("/products/");
    let go = rest == "/go/products" || rest.starts_with("/go/products/");
    if !product && !go {
        return None;
    }
    let route = prefix.unwrap_or("ko");
    Some(match (route, product) {
        ("en", true) => Decision::Redirect("/en"),
        ("en", false) => Decision::Gone {
            locale: "en",
            route: "en",
        },
        _ => Decision::Gone {
            locale: "ko",
            route,
        },
    })
}

/// `Content-Language` of `proxy.ts`: the URL's document locale, else the
/// `?locale=` of an `/export` path, else Korean.
pub(crate) fn content_language(pathname: &str, query: Option<&str>) -> &'static str {
    let first = pathname.split('/').find(|part| !part.is_empty());
    if let Some(locale) = first.and_then(Locale::get).filter(|l| !l.is_korean()) {
        return &locale.info().lang;
    }
    if pathname.ends_with("/export") {
        let requested = query
            .into_iter()
            .flat_map(|query| url::form_urlencoded::parse(query.as_bytes()))
            .find(|(key, _)| key == "locale")
            .map(|(_, value)| value.into_owned());
        if let Some(locale) = requested
            .as_deref()
            .filter(|code| SEO_CONTENT_LOCALES.contains(code))
            .and_then(Locale::get)
        {
            return &locale.info().lang;
        }
    }
    "ko"
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let pathname = request.uri().path().to_owned();
    // Next answers these before `proxy.ts` runs: a trailing slash
    // (`DEFAULT_TRAILING_SLASH_REDIRECT`) and the English product redirects
    // (`EN_PRODUCT_GONE_REDIRECTS`) are `next.config.ts` redirects, and the
    // first matcher of `proxy.ts` skips file names.
    let before_proxy = (pathname.len() > 1 && pathname.ends_with('/'))
        || crate::next_rules::has_skipped_ending(&pathname)
        || decision(&pathname) == Some(Decision::Redirect("/en"));
    let Some(decision) = decision(&pathname).filter(|_| !before_proxy) else {
        return fallback::answer(State(state), request).await;
    };
    let language = HeaderValue::from_static(content_language(&pathname, request.uri().query()));
    let mut response = match decision {
        Decision::Redirect(location) => {
            let mut response = Response::new(Body::from(location));
            *response.status_mut() = StatusCode::PERMANENT_REDIRECT;
            let headers = response.headers_mut();
            headers.insert(LOCATION, HeaderValue::from_static(location));
            // `NextResponse.redirect` as Next sends it.
            let refresh = format!("0;url={location}");
            headers.insert(
                "refresh",
                HeaderValue::from_str(&refresh).expect("a header value"),
            );
            response
        }
        Decision::Missing => StatusCode::NOT_FOUND.into_response(),
        Decision::Gone { locale, route } => {
            let cards = cards(&state).await;
            let mut response = (
                StatusCode::GONE,
                [
                    (CONTENT_TYPE, "text/html; charset=utf-8"),
                    (CACHE_CONTROL, NO_STORE),
                ],
                tombstone(&state.pages.site.css_href, locale, route, &cards).into_string(),
            )
                .into_response();
            let headers = response.headers_mut();
            headers.insert("x-robots-tag", HeaderValue::from_static("noindex"));
            // Next adds it to every body it could compress.
            headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
            response
        }
    };
    response.headers_mut().insert(CONTENT_LANGUAGE, language);
    // `proxy.ts` answers before the app router, which adds its `Vary`.
    response.extensions_mut().insert(AnsweredBeforeRouting);
    response
}

// ---------------------------------------------------------------------------
// The cards: `loadRetiredProductMemes` in lib/retired-product-memes.ts.

async fn cards(state: &AppState) -> Vec<Card> {
    let loaded = state
        .pages
        .retired_cards
        .get_or_load(|| load_cards(&state.db))
        .await;
    loaded.unwrap_or_else(|error: sqlx::Error| {
        // Next's two reads each give an empty list on an error; the shipped
        // illustrations then fill the four places.
        tracing::warn!(%error, "retired product cards failed");
        choose(&[], &[])
    })
}

async fn load_cards(db: &Db) -> Result<Vec<Card>, sqlx::Error> {
    let (catalog, trending) = tokio::try_join!(catalog(db), trending(db))?;
    Ok(choose(&catalog, &trending))
}

// The card columns both reads select, as a literal: sqlx takes fixed SQL.
macro_rules! card_columns {
    () => {
        "m.id::text as id, m.short_id, m.slug, m.title, m.summary, \
     m.safety_level::text as safety_level, m.origin_year, \
     (select coalesce(json_agg(json_build_object('thumbnail_url', c.thumbnail_url, \
             'is_representative', c.is_representative, 'availability', c.availability, \
             'moderation_status', c.moderation_status)), '[]'::json)::text \
        from public.meme_contents c where c.meme_id = m.id) as contents"
    };
}

#[derive(Deserialize)]
struct CardContent {
    thumbnail_url: Option<String>,
    is_representative: Option<bool>,
    availability: Option<String>,
    moderation_status: Option<String>,
}

fn truthy(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

fn card_of(row: &sqlx::postgres::PgRow, contents: &[CardContent]) -> Result<Card, sqlx::Error> {
    let thumbnail = contents
        .iter()
        .find(|content| {
            content.is_representative == Some(true) && truthy(&content.thumbnail_url).is_some()
        })
        .or_else(|| {
            contents
                .iter()
                .find(|content| truthy(&content.thumbnail_url).is_some())
        })
        .and_then(|content| content.thumbnail_url.clone());
    let safety: Option<String> = row.try_get("safety_level")?;
    Ok(Card {
        id: row.try_get("id")?,
        short_id: row.try_get("short_id")?,
        slug: row.try_get("slug")?,
        title: row.try_get("title")?,
        summary: row
            .try_get::<Option<String>, _>("summary")?
            .unwrap_or_default(),
        safety_level: safety.as_deref().and_then(SafetyLevel::parse_known),
        origin_year: row.try_get("origin_year")?,
        thumbnail,
    })
}

fn contents_of(row: &sqlx::postgres::PgRow) -> Result<Vec<CardContent>, sqlx::Error> {
    serde_json::from_str(row.try_get("contents")?)
        .map_err(|error| sqlx::Error::Decode(Box::new(error)))
}

/// `loadPublicMemes(48)`.
async fn catalog(db: &Db) -> Result<Vec<Card>, sqlx::Error> {
    const SQL: &str = concat!(
        "select ",
        card_columns!(),
        " from public.memes m \
          where m.moderation_status in ('approved', 'limited') \
          order by m.trend_score desc, m.published_at desc limit $1"
    );
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(SQL).bind(CATALOG_LIMIT).fetch_all(tx).await })
        })
        .await?;
    rows.iter()
        .map(|row| card_of(row, &contents_of(row)?))
        .collect()
}

/// `getTrendingMemes(24)`: this year's memes by trend, without the thin ones.
async fn trending(db: &Db) -> Result<Vec<Card>, sqlx::Error> {
    const SQL: &str = concat!(
        "select ",
        card_columns!(),
        ", m.description, m.origin, m.usage_note, m.caution, \
                m.usage_examples::text as usage_examples, \
                (select coalesce(json_agg(json_build_object('source_url', s.source_url, \
                        'hidden_from_public', s.hidden_from_public)), '[]'::json)::text \
                   from public.meme_sources s where s.meme_id = m.id) as sources, \
                (select count(*) from public.meme_tags_map t where t.meme_id = m.id) as tag_count \
           from public.memes m \
          where m.moderation_status in ('approved', 'limited') \
            and (m.origin_year = $1 or m.korea_viral_year = $1) \
          order by m.trend_score desc, m.published_at desc, m.id asc limit $2"
    );
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(SQL)
                    .bind(TRENDING_YEAR)
                    .bind(TRENDING_SCAN)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    let decode = |error: serde_json::Error| sqlx::Error::Decode(Box::new(error));
    let mut cards = Vec::new();
    for row in &rows {
        let contents = contents_of(row)?;
        let sources: Vec<SourceRow> =
            serde_json::from_str(row.try_get("sources")?).map_err(decode)?;
        let depth_contents: Vec<ContentRow> = contents
            .iter()
            .map(|content| ContentRow {
                availability: content.availability.clone(),
                moderation_status: content.moderation_status.clone(),
            })
            .collect();
        let usage_examples: Option<String> = row.try_get("usage_examples")?;
        let usage_examples = usage_examples
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or(Value::Null);
        let description: Option<String> = row.try_get("description")?;
        let origin: Option<String> = row.try_get("origin")?;
        let usage_note: Option<String> = row.try_get("usage_note")?;
        let caution: Option<String> = row.try_get("caution")?;
        let tag_count: i64 = row.try_get("tag_count")?;
        let depth = content_depth(&DepthInput {
            description: description.as_deref().unwrap_or_default(),
            origin: origin.as_deref().unwrap_or_default(),
            usage_note: usage_note.as_deref(),
            caution: caution.as_deref(),
            usage_examples: &usage_examples,
            sources: &sources,
            contents: &depth_contents,
            tag_count: usize::try_from(tag_count).unwrap_or_default(),
        });
        if depth.is_indexable() {
            cards.push(card_of(row, &contents)?);
            if cards.len() == TRENDING_LIMIT {
                break;
            }
        }
    }
    Ok(cards)
}

/// `isYouTubeThumbnailUrl` in lib/retired-card-image.ts.
fn is_youtube_thumbnail(value: &str) -> bool {
    let Ok(url) = url::Url::parse("https://catchmeme.com").and_then(|base| base.join(value)) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default().to_lowercase();
    [
        "i.ytimg.com",
        "img.youtube.com",
        "youtube.com",
        "www.youtube.com",
    ]
    .contains(&host.as_str())
        || host.ends_with(".ytimg.com")
}

/// `verifiedRetiredCardImage`: a same-origin illustration the site ships.
fn verified_image(value: Option<&str>) -> Option<&str> {
    let trimmed = value?.trim();
    if trimmed.is_empty() || is_youtube_thumbnail(trimmed) {
        return None;
    }
    // `/^\/(?:ai-memes|images\/originals)\/[a-z0-9-]+\.(?:jpg|png)$/`.
    let file = trimmed
        .strip_prefix("/ai-memes/")
        .or_else(|| trimmed.strip_prefix("/images/originals/"))?;
    let (name, extension) = file.rsplit_once('.')?;
    let named = !name.is_empty()
        && name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    (named && matches!(extension, "jpg" | "png")).then_some(trimmed)
}

fn fallback_cards() -> Vec<Card> {
    RETIRED
        .fallback_picks
        .iter()
        .map(|pick| Card {
            id: pick.id.clone(),
            short_id: pick.short_id.clone(),
            slug: pick.slug.clone(),
            title: pick.title.clone(),
            summary: pick.summary.clone(),
            safety_level: SafetyLevel::parse_known(&pick.safety),
            origin_year: Some(pick.year),
            thumbnail: Some(pick.thumbnail.clone()),
        })
        .collect()
}

/// `chooseRetiredProductCards`: verified art first, then this year's memes
/// without a YouTube still, then the shipped illustrations.
fn choose(catalog: &[Card], trending: &[Card]) -> Vec<Card> {
    let mut chosen: Vec<Card> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut push = |card: &Card, chosen: &mut Vec<Card>| {
        let known = [&card.id, &card.slug, &card.short_id]
            .iter()
            .any(|key| seen.contains(*key));
        if chosen.len() >= CARD_COUNT || known {
            return;
        }
        if card
            .thumbnail
            .as_deref()
            .is_some_and(|thumbnail| !thumbnail.is_empty() && is_youtube_thumbnail(thumbnail))
        {
            return;
        }
        for key in [&card.id, &card.slug, &card.short_id] {
            seen.insert(key.clone());
        }
        chosen.push(card.clone());
    };
    for card in catalog {
        if verified_image(card.thumbnail.as_deref()).is_some() {
            push(card, &mut chosen);
        }
    }
    for card in trending {
        push(card, &mut chosen);
    }
    if chosen.len() < CARD_COUNT {
        for card in &fallback_cards() {
            push(card, &mut chosen);
        }
    }
    chosen.truncate(CARD_COUNT);
    chosen
}

// ---------------------------------------------------------------------------
// The document.

/// `memeThumbnailAlt(title, locale)`.
fn thumbnail_alt(title: &str, route: &str) -> String {
    match route {
        "ja" => format!("{title}の象徴イラスト"),
        "zh" => format!("{title}象征插画"),
        "zh-tw" => format!("{title}象徵插畫"),
        "en" => format!("{title} symbol illustration"),
        _ => format!("{title} 상징 일러스트"),
    }
}

/// `SafetyBadge` at its small size.
fn safety_badge(level: SafetyLevel, route: &str) -> Markup {
    let label = &RETIRED.safety_labels[route][level.token()];
    html! {
        span role="img" aria-label=(label) class={"safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold " (NEON_RING) " " (level.tone())} {
            span aria-hidden="true" class="leading-none" { (level.icon("size-4")) }
            span class="min-w-0" { (label) }
        }
    }
}

/// `MemeCard` with `staticMarkup`: a verified image or the bubble fallback.
fn card(card: &Card, route: &str) -> Markup {
    let image = verified_image(card.thumbnail.as_deref());
    html! {
        li class="min-w-0" {
            a href=(meme_path(&card.short_id, &card.slug)) class=(CARD_LINK) data-meme-card="" data-pointer-light="" data-meme-card-title-size="grid" data-meme-card-aspect="fixed" {
                div data-safety=[card.safety_level.map(SafetyLevel::token)] class="meme-card-frame relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#141414] text-[#f7f4ee]" {
                    div class="meme-card-art" {
                        @if let Some(src) = image {
                            img src=(src) alt=(thumbnail_alt(&card.title, route)) data-thumbnail-state="image" data-meme-card-art="image" class="absolute inset-0 h-full w-full object-cover";
                        } @else {
                            div aria-hidden="true" data-meme-card-art="fallback" class="absolute inset-0 overflow-hidden bg-[#141414]" {
                                svg viewBox="0 0 120 80" class="absolute left-6 top-6 h-[38%] w-[58%]" focusable="false" {
                                    path fill="#ff5c38" d="M8 6h78a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H42L26 74V58H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z" {}
                                }
                            }
                        }
                    }
                    div aria-hidden="true" data-meme-card-scrim="" class="meme-card-scrim" {}
                    div aria-hidden="true" class="meme-card-light" {}
                    div class="meme-card-face absolute inset-0" {
                        div class="meme-card-copy" {
                            p title=(card.title) data-meme-card-title="" data-title-size="grid" class="meme-card-title" { (card.title) }
                            @if !card.summary.trim().is_empty() {
                                p title=(card.summary) data-meme-card-summary="" class="meme-card-summary" { (card.summary) }
                            }
                            div class="meme-card-badges" {
                                @if let Some(level) = card.safety_level {
                                    span class="meme-card-safety" { (safety_badge(level, route)) }
                                }
                                @if let Some(year) = card.origin_year {
                                    span class="meme-card-year inline-flex items-center rounded-full bg-[#141414] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white ring-1 ring-white/70" { (year) }
                                }
                            }
                        }
                    }
                    div aria-hidden="true" class="meme-card-edge" {}
                }
            }
        }
    }
}

/// `TombstoneDocument` with the head `retiredProductDocument` writes.
fn tombstone(css_href: &str, locale: &str, route: &str, cards: &[Card]) -> Markup {
    let copy = &RETIRED.copy[locale];
    let document = &RETIRED.document[locale];
    let brand = &RETIRED.brand[locale];
    html! {
        (DOCTYPE)
        html lang=(document.lang) {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                meta name="robots" content="noindex, follow";
                title { (document.title) }
                link rel="stylesheet" href=(css_href);
            }
            body class="flex min-h-dvh flex-col pb-16 md:pb-0" {
                header class="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur" {
                    div class="mx-auto flex min-h-16 max-w-6xl items-center px-4 sm:px-6" {
                        a href=(brand.home_href) aria-label=(brand.home) class="flex items-center gap-2" {
                            (brand_tile("size-8"))
                            span class="text-lg font-extrabold tracking-[-0.045em]" { (brand.name) }
                        }
                    }
                }
                div class="flex-1" {
                    main class="mx-auto w-full max-w-site px-4 py-14 sm:py-20" {
                        meta name="robots" content="noindex, follow";
                        div class="mx-auto flex max-w-xl flex-col items-center text-center" {
                            h1 class="text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl" { (copy.message) }
                            a href=(copy.explore_href) class=(BUTTON) { (copy.explore) }
                        }
                        @if !cards.is_empty() {
                            section class="mt-12" aria-label=(copy.popular) {
                                ul class="grid grid-cols-2 gap-3 xl:grid-cols-4" {
                                    @for item in cards { (card(item, route)) }
                                }
                            }
                        }
                    }
                }
                nav aria-label=(if locale == "en" { "Main navigation" } else { "주 내비게이션" }) class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden" {
                    ul class="mx-auto flex max-w-2xl items-stretch justify-around" {
                        @for (href, label) in &RETIRED.nav[locale] {
                            li class="flex min-w-11 flex-1" {
                                a href=(href) class="flex min-h-14 w-full flex-col items-center justify-center whitespace-nowrap text-[11px] leading-none text-muted" { (label) }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gone(locale: &'static str, route: &'static str) -> Option<Decision> {
        Some(Decision::Gone { locale, route })
    }

    #[test]
    fn decisions_follow_lib_retired_products() {
        assert_eq!(decision("/retired-products"), gone("ko", "ko"));
        assert_eq!(decision("/en/retired-products"), gone("en", "en"));
        assert_eq!(decision("/ja/retired-products"), Some(Decision::Missing));
        assert_eq!(decision("/products"), gone("ko", "ko"));
        assert_eq!(decision("/products/abc/"), gone("ko", "ko"));
        assert_eq!(decision("/go/products/x"), gone("ko", "ko"));
        assert_eq!(decision("/en/products/x"), Some(Decision::Redirect("/en")));
        assert_eq!(decision("/en/go/products"), gone("en", "en"));
        assert_eq!(decision("/zh-tw/products"), gone("ko", "zh-tw"));
        assert_eq!(decision("/zh/go/products/a"), gone("ko", "zh"));
        assert_eq!(
            decision("/admin/creator-products/x"),
            Some(Decision::Redirect("/"))
        );
        assert_eq!(decision("/productsx"), None);
        assert_eq!(decision("/ar/products"), None);
        assert_eq!(decision("/enx/products"), None);
    }

    #[test]
    fn only_shipped_illustrations_are_card_art() {
        assert_eq!(
            verified_image(Some(" /ai-memes/ai-slop.jpg ")),
            Some("/ai-memes/ai-slop.jpg")
        );
        assert_eq!(
            verified_image(Some("/images/originals/a-1.png")),
            Some("/images/originals/a-1.png")
        );
        assert_eq!(verified_image(Some("/ai-memes/Upper.jpg")), None);
        assert_eq!(verified_image(Some("/ai-memes/a/b.jpg")), None);
        assert_eq!(verified_image(Some("https://i.ytimg.com/vi/x/0.jpg")), None);
        assert!(is_youtube_thumbnail("https://foo.ytimg.com/a.jpg"));
        assert!(!is_youtube_thumbnail("/ai-memes/a.jpg"));
    }

    #[test]
    fn missing_places_are_filled_with_the_shipped_illustrations() {
        let cards = choose(&[], &[]);
        assert_eq!(cards.len(), 4);
        assert_eq!(cards[0].slug, "ai-slop");
        assert_eq!(content_language("/zh/products", None), "zh-Hans");
        assert_eq!(
            content_language("/products/export", Some("locale=ja")),
            "ja"
        );
        assert_eq!(content_language("/products", None), "ko");
    }
}
