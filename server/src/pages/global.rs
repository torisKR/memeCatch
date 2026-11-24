//! `GET /global` (`app/(default)/global/page.tsx`): the reviewed YouTube,
//! TikTok or Instagram content of approved memes, by trend
//! (`getGlobalFeed` of lib/global-feed.server.ts,
//! `components/global-feed/global-feed-tabs.tsx`). A meme is in the feed
//! when it has a reviewed origin market, a live approved content on the
//! platform, and that content is an approved embeddable source in the
//! reviewed media ledger (read as `service_role`).
//!
//! The tabs are links (`?platform=`), so the page needs no script of its
//! own beyond the thumbnail's fallback (`ui/thumbnail.js`).

use std::collections::{HashMap, HashSet};

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;

use super::document::{self, Head, ShareImage};
use super::labels::SafetyLevel;
use super::meme_card::{self, CardContent};
use super::{html, path_and_query};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::public::labels::meme_path;
use crate::routes::public::meme_delivery::source_platform;
use crate::routes::public::publication_export::parse_rows;

const TITLE: &str = "Global Meme Feed";
const DESCRIPTION: &str = "Browse reviewed YouTube, TikTok, and Instagram meme sources. Each item opens a Korean MemeCatch detail page with context and safety guidance.";
/// `limit` of `getGlobalFeed(…, 24)`.
const LIMIT: usize = 24;
/// `FEED_BATCH_SIZE`.
const BATCH: i32 = 48;
const EMBEDDABLE_RIGHTS: [&str; 4] = [
    "official_embed",
    "creator_permission",
    "creative_commons",
    "public_data",
];

/// `FeedPlatformKey`: the tab, its label, and the stored platform values it
/// reads (each platform of `QUERY_PLATFORMS` and its `SOURCE_PLATFORM_META`
/// label).
const TABS: [(&str, &str, &[&str]); 3] = [
    (
        "youtube",
        "YouTube",
        &["youtube", "YouTube", "youtube_shorts", "YouTube Shorts"],
    ),
    ("tiktok", "TikTok", &["tiktok", "TikTok"]),
    ("instagram", "Instagram", &["instagram", "Instagram"]),
];

// What lib/db/execute.ts compiles for the feed's window (statement log),
// the constants inline and the statuses compared as text.
const FEED_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."category", r1."safety_level", r1."origin_year", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."platform", r2."content_id", r2."url", r2."thumbnail_url", r2."availability", r2."moderation_status", r2."is_representative", r2."manual_video_verified" FROM public."meme_contents" r2 WHERE r2."meme_id" = r1."id" AND r2."platform" = ANY($1::text[]) AND r2."moderation_status"::text = 'approved' AND r2."availability"::text = 'live') e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3."market_code", r3."role", r3."review_state" FROM public."meme_market_profiles" r3 WHERE r3."meme_id" = r1."id" AND r3."role" = 'origin' AND r3."review_state" = 'reviewed') e) AS "meme_market_profiles" FROM public."memes" r1 WHERE r1."moderation_status"::text = 'approved' AND EXISTS (SELECT 1 FROM public."meme_contents" r4 WHERE r4."meme_id" = r1."id" AND r4."platform" = ANY($1::text[]) AND r4."moderation_status"::text = 'approved' AND r4."availability"::text = 'live') AND EXISTS (SELECT 1 FROM public."meme_market_profiles" r5 WHERE r5."meme_id" = r1."id" AND r5."role" = 'origin' AND r5."review_state" = 'reviewed') ORDER BY r1."trend_score" DESC, r1."id" ASC LIMIT $2::int OFFSET $3::int) SELECT row_to_json(__q)::text FROM __q"#;
// The ledger of those memes: approved, embeddable rights, an embeddable
// source that was not removed.
const LEDGER_SQL: &str = r#"WITH __q AS (SELECT r1."meme_id", (SELECT row_to_json(e) FROM (SELECT r2."platform", r2."external_id", r2."canonical_url" FROM public."media_sources" r2 WHERE r2."id" = r1."source_id" AND r2."embeddable" = true AND r2."removed_at" IS NULL) e) AS "media_sources" FROM public."meme_media" r1 WHERE r1."meme_id" = ANY($1::uuid[]) AND r1."review_state" = 'approved' AND r1."rights_basis" = ANY($2::text[]) AND EXISTS (SELECT 1 FROM public."media_sources" r3 WHERE r3."id" = r1."source_id" AND r3."embeddable" = true AND r3."removed_at" IS NULL)) SELECT row_to_json(__q)::text FROM __q"#;

#[derive(Deserialize)]
struct FeedContent {
    platform: Option<String>,
    content_id: Option<String>,
    url: Option<String>,
    thumbnail_url: Option<String>,
    availability: Option<String>,
    moderation_status: Option<String>,
    is_representative: Option<bool>,
    manual_video_verified: Option<bool>,
}

#[derive(Deserialize)]
struct Profile {
    market_code: String,
    role: String,
    review_state: String,
}

#[derive(Deserialize)]
struct FeedRow {
    id: String,
    short_id: String,
    slug: String,
    title: Option<String>,
    summary: Option<String>,
    category: String,
    safety_level: Option<String>,
    meme_contents: Vec<FeedContent>,
    meme_market_profiles: Vec<Profile>,
}

#[derive(Deserialize)]
struct Source {
    platform: String,
    external_id: Option<String>,
    canonical_url: String,
}

#[derive(Deserialize)]
struct LedgerRow {
    meme_id: String,
    media_sources: Option<Source>,
}

/// `GlobalFeedItem`, what the page shows of it.
struct Item {
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    category: String,
    safety_level: Option<SafetyLevel>,
    country: Option<&'static str>,
    platform: &'static str,
    thumbnail: Option<String>,
}

/// `MEME_COUNTRIES` with their English labels.
const COUNTRIES: [(&str, &str); 10] = [
    ("KR", "South Korea"),
    ("US", "United States"),
    ("JP", "Japan"),
    ("GB", "United Kingdom"),
    ("BR", "Brazil"),
    ("MX", "Mexico"),
    ("CN", "China"),
    ("TW", "Taiwan"),
    ("DE", "Germany"),
    ("FR", "France"),
];

/// `originCountryCode`.
fn origin_country(profiles: &[Profile]) -> Option<&'static str> {
    profiles
        .iter()
        .filter(|p| p.role == "origin" && p.review_state == "reviewed")
        .find_map(|p| {
            let code = js::trim(&p.market_code).to_uppercase();
            COUNTRIES.iter().find(|(c, _)| *c == code).map(|(c, _)| *c)
        })
}

/// `SOURCE_PLATFORM_META[platform].label` of a social platform.
fn platform_label(platform: &str) -> &'static str {
    match platform {
        "youtube" => "YouTube",
        "youtube_shorts" => "YouTube Shorts",
        "tiktok" => "TikTok",
        _ => "Instagram",
    }
}

/// `isRenderableContent`.
fn renderable(content: &FeedContent) -> bool {
    !matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    ) && content.moderation_status.as_deref() == Some("approved")
}

fn truthy(value: Option<&String>) -> Option<&str> {
    value.map(String::as_str).filter(|value| !value.is_empty())
}

/// Whether the ledger approves this content: a source on the same platform
/// with its URL or its id.
fn approves(source: &Source, content: &FeedContent) -> bool {
    source_platform(Some(&source.platform), Some(&source.canonical_url))
        == source_platform(content.platform.as_deref(), content.url.as_deref())
        && (truthy(content.url.as_ref()) == Some(source.canonical_url.as_str())
            || truthy(content.content_id.as_ref())
                .is_some_and(|id| source.external_id.as_deref() == Some(id)))
}

/// `pickContent`: the platform and the still of the content the ledger
/// approves, the representative one first.
fn pick(row: &FeedRow, sources: &[&Source]) -> Option<(&'static str, Option<String>)> {
    let alive: Vec<&FeedContent> = row
        .meme_contents
        .iter()
        .filter(|content| {
            renderable(content) && sources.iter().any(|source| approves(source, content))
        })
        .collect();
    let best = alive
        .iter()
        .find(|content| content.is_representative == Some(true))
        .or(alive.first())?;
    let stored = truthy(best.platform.as_ref())?;
    let platform = source_platform(Some(&stored.replace('_', " ")), best.url.as_deref())?;
    if !matches!(
        platform,
        "youtube" | "youtube_shorts" | "tiktok" | "instagram"
    ) {
        return None;
    }
    let content = CardContent {
        kind: None,
        thumbnail_url: best.thumbnail_url.clone(),
        is_representative: best.is_representative,
        url: best.url.clone(),
        content_id: best.content_id.clone(),
        availability: best.availability.clone(),
        moderation_status: best.moderation_status.clone(),
        manual_video_verified: best.manual_video_verified,
    };
    Some((platform, meme_card::video_preview(&[content])))
}

async fn window(db: &Db, stored: Vec<String>, from: i32) -> Result<Vec<FeedRow>, sqlx::Error> {
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            let rows = sqlx::query_scalar(FEED_SQL)
                .persistent(false)
                .bind(stored)
                .bind(BATCH)
                .bind(from)
                .fetch_all(tx)
                .await?;
            parse_rows(rows)
        })
    })
    .await
}

async fn ledger(db: &Db, ids: Vec<String>) -> Result<Vec<LedgerRow>, sqlx::Error> {
    let rights: Vec<String> = EMBEDDABLE_RIGHTS.map(str::to_owned).to_vec();
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                let rows = sqlx::query_scalar(LEDGER_SQL)
                    .persistent(false)
                    .bind(ids)
                    .bind(rights)
                    .fetch_all(tx)
                    .await?;
                parse_rows(rows)
            })
        },
    )
    .await
}

/// `getGlobalFeed(platforms, 24)`. `None` is its "error" state.
async fn feed(db: &Db, stored: &[&str]) -> Option<Vec<Item>> {
    let stored: Vec<String> = stored.iter().map(|value| (*value).to_owned()).collect();
    let mut seen = HashSet::new();
    let mut items = Vec::new();
    let mut from = 0;
    while items.len() < LIMIT {
        let batch = window(db, stored.clone(), from)
            .await
            .inspect_err(|error| tracing::warn!(%error, "global feed not read"))
            .ok()?;
        if batch.is_empty() {
            break;
        }
        let ids: Vec<String> = batch
            .iter()
            .map(|row| row.id.clone())
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let ledger = ledger(db, ids)
            .await
            .inspect_err(|error| tracing::warn!(%error, "global feed ledger not read"))
            .ok()?;
        let mut approved: HashMap<&str, Vec<&Source>> = HashMap::new();
        for row in &ledger {
            if let Some(source) = &row.media_sources {
                approved
                    .entry(row.meme_id.as_str())
                    .or_default()
                    .push(source);
            }
        }
        for row in &batch {
            if seen.contains(&row.id) {
                continue;
            }
            let sources = approved.get(row.id.as_str()).map_or(&[][..], Vec::as_slice);
            let Some((platform, thumbnail)) = pick(row, sources) else {
                continue;
            };
            seen.insert(row.id.clone());
            items.push(Item {
                short_id: row.short_id.clone(),
                slug: row.slug.clone(),
                title: row.title.clone().unwrap_or_default(),
                summary: row.summary.clone().unwrap_or_default(),
                category: row.category.clone(),
                safety_level: row
                    .safety_level
                    .as_deref()
                    .and_then(SafetyLevel::parse_known),
                country: origin_country(&row.meme_market_profiles),
                platform,
                thumbnail,
            });
            if items.len() >= LIMIT {
                break;
            }
        }
        if batch.len() < BATCH as usize {
            break;
        }
        from += BATCH;
    }
    Some(items)
}

/// `resolveGlobalFeedPlatform(searchParams.platform)`: the tab when the
/// address names it once, else YouTube.
fn tab_of(query: Option<&str>) -> &'static (&'static str, &'static str, &'static [&'static str]) {
    let mut values = url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
        .filter(|(key, _)| key == "platform")
        .map(|(_, value)| value.into_owned());
    let key = match (values.next(), values.next()) {
        (Some(value), None) if value == "tiktok" || value == "instagram" => value,
        _ => "youtube".to_owned(),
    };
    TABS.iter()
        .find(|(name, ..)| *name == key)
        .expect("a known tab")
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let (key, label, stored) = tab_of(request.uri().query());
    let feed = feed(&state.db, stored).await;
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/global".to_owned()),
        image: Some(ShareImage::site_default(site)),
        alternate_locales: true,
        ..Head::default()
    };
    let main = html! {
        main class="bg-background text-foreground" {
            div class="mx-auto w-full max-w-site px-4 pb-16 pt-8 sm:pt-10" {
                header lang="en" class="max-w-3xl" {
                    p class="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent" { "Global feed" }
                    h1 class="mt-2 text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl" { "See what the world is remixing" }
                    p class="mt-4 max-w-2xl text-base leading-relaxed text-muted" { "Browse reviewed platform sources. Detail links open Korean MemeCatch pages with context and safety notes." }
                }
                (tabs(key, label, feed.as_deref()))
            }
        }
    };
    html(
        StatusCode::OK,
        document::page(site, &head, path_and_query(&request), main),
    )
}

const ACTION: &str = "mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100";

/// `GlobalFeedTabs`.
fn tabs(active: &str, label: &str, feed: Option<&[Item]>) -> Markup {
    html! {
        section class="mt-8" aria-labelledby="global-feed-results" {
            h2 id="global-feed-results" lang="en" class="sr-only" { (label) " meme feed" }
            nav aria-label="Choose a platform" lang="en" class="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1" {
                @for (key, name, _) in TABS {
                    @let on = key == active;
                    a href=(format!("/global?platform={key}")) aria-current=[on.then_some("page")] class={"inline-flex min-h-11 min-w-0 items-center justify-center rounded-lg px-2 text-xs font-bold transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100 motion-reduce:transition-none sm:text-sm " (if on { "bg-accent-strong text-white" } else { "text-muted hover:bg-surface-2 hover:text-foreground" })} { (name) }
                }
            }
            @match feed {
                None => {
                    div role="alert" lang="en" class="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8" {
                        h3 class="text-xl font-black" { "Could not load " (label) }
                        p class="mt-2 max-w-lg text-sm leading-relaxed text-muted" { "The feed query failed before any items could be shown. No placeholder memes were substituted." }
                        a href=(format!("/global?platform={active}")) class=(ACTION) { "Try again" }
                    }
                }
                Some([]) => {
                    div lang="en" class="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8" {
                        h3 class="text-xl font-black" { "No reviewed " (label) " picks yet" }
                        p class="mt-2 max-w-lg text-sm leading-relaxed text-muted" { "We only show public sources that passed review. Browse the Korean meme index while this feed fills up." }
                        a href="/explore" class=(ACTION) { "Browse Korean meme index" }
                    }
                }
                Some([lead, rest @ ..]) => { (ready(lead, rest)) }
            }
        }
    }
}

/// `FEED_LAYOUT`.
const LAYOUT: [&str; 4] = [
    "lg:col-span-7",
    "lg:col-span-5",
    "lg:col-span-5",
    "lg:col-span-7",
];

fn ready(lead: &Item, rest: &[Item]) -> Markup {
    html! {
        div class="mt-6 min-w-0" {
            article class="overflow-hidden rounded-2xl border border-border bg-surface" {
                a href=(meme_path(&lead.short_id, &lead.slug)) class="group grid min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)]" {
                    div class="min-w-0 border-b border-border md:border-b-0 md:border-r" {
                        div class="relative aspect-[16/10] overflow-hidden bg-surface-2" {
                            div class="absolute right-3 top-3 z-10" { (flag(lead.country)) }
                            (thumbnail(lead, true))
                        }
                        (platform_meta(lead))
                    }
                    div class="flex min-w-0 flex-col items-start justify-center p-5 sm:p-7" {
                        h3 class="break-words text-2xl font-black leading-tight tracking-[-0.025em] sm:text-3xl" { (lead.title) }
                        p class="mt-3 line-clamp-4 break-words text-sm leading-relaxed text-muted sm:text-base" { (lead.summary) }
                        div class="mt-5" { (badge(lead)) }
                        span lang="en" class="mt-6 text-sm font-bold text-accent group-hover:underline group-hover:underline-offset-4" { "Open Korean detail" }
                    }
                }
            }
            @if !rest.is_empty() {
                ul class="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12" {
                    @for (index, item) in rest.iter().enumerate() {
                        li class={"min-w-0 sm:col-span-1 " (LAYOUT[index % LAYOUT.len()])} {
                            article class="h-full overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0" {
                                a href=(meme_path(&item.short_id, &item.slug)) class="group flex h-full min-w-0 flex-col focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent" {
                                    div class={"relative overflow-hidden bg-surface-2 " (if index % 4 == 0 || index % 4 == 3 { "aspect-[16/10]" } else { "aspect-[4/3]" })} {
                                        div class="absolute right-3 top-3 z-10" { (flag(item.country)) }
                                        (thumbnail(item, index < 2))
                                    }
                                    (platform_meta(item))
                                    div class="flex min-w-0 flex-1 flex-col items-start p-4 pt-2" {
                                        h3 class="line-clamp-2 break-words text-base font-black leading-snug sm:text-lg" { (item.title) }
                                        div class="mt-auto pt-4" { (badge(item)) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            p lang="en" class="mt-6 max-w-2xl text-xs leading-relaxed text-muted" { "Source media stays on its original platform. MemeCatch stores reviewed links and context, not copied media." }
        }
    }
}

fn badge(item: &Item) -> Markup {
    html! { @if let Some(level) = item.safety_level { (meme_card::safety_badge(level)) } }
}

fn platform_meta(item: &Item) -> Markup {
    html! {
        p data-global-feed-platform="true" lang="en" class="px-4 pb-2 pt-3 text-xs font-semibold text-muted" { (platform_label(item.platform)) }
    }
}

/// `CountryFlagBadge` with `locale="en"`.
fn flag(code: Option<&'static str>) -> Markup {
    let country = code.and_then(|code| COUNTRIES.iter().find(|(c, _)| *c == code));
    let label = country.map_or("Origin unconfirmed", |(_, name)| *name);
    let accessible = match country {
        Some(_) => format!("Origin country: {label}"),
        None => label.to_owned(),
    };
    html! {
        span title=(label) data-country-code=(code.unwrap_or("UNKNOWN")) data-country-flag=(code.unwrap_or("unknown")) data-country-state=(if country.is_some() { "reviewed" } else { "unconfirmed" }) class="relative z-10 inline-flex min-h-8 max-w-[min(52vw,12rem)] min-w-0 shrink-0 items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold leading-tight text-foreground shadow-md" {
            span class="sr-only" { (accessible) }
            span aria-hidden="true" class="truncate" { (label) }
        }
    }
}

/// `MemeThumbnail` with `variant="compact"`: the image, or the title card
/// it falls back to, also when the image fails (`ui/thumbnail.js`).
fn thumbnail(item: &Item, priority: bool) -> Markup {
    let fallback = html! {
        div aria-hidden="true" data-thumbnail-state="fallback" class="instrument-grid relative flex h-full w-full flex-col justify-end gap-1.5 p-3" style=(format!("background:var(--cat-{0}-bg);color:var(--cat-{0}-text)", item.category)) {
            svg viewBox="0 0 24 24" fill="currentColor" class="pointer-events-none absolute left-2 top-3 opacity-[0.12] size-12" {
                path d="M10.6 4.9C6.8 7.1 4.6 10.3 4.6 14.2c0 2.8 1.7 4.6 4 4.6 2 0 3.6-1.5 3.6-3.6 0-2-1.4-3.3-3.2-3.3-.3 0-.7 0-.9.1.4-2 2.1-4 4-5.2L10.6 4.9Zm8.9 0c-3.9 2.2-6 5.4-6 9.3 0 2.8 1.7 4.6 4 4.6 2 0 3.5-1.5 3.5-3.6 0-2-1.3-3.3-3.1-3.3-.3 0-.7 0-.9.1.4-2 2-4 4-5.2L19.5 4.9Z" {}
            }
            span class="relative line-clamp-3 font-extrabold leading-snug text-base" { (item.title) }
            @if !item.summary.is_empty() {
                span class="relative line-clamp-3 leading-snug text-xs" { (item.summary) }
            }
        }
    };
    match &item.thumbnail {
        Some(src) => html! {
            img src=(src) alt="" loading=(if priority { "eager" } else { "lazy" }) fetchpriority=[priority.then_some("high")] decoding="async" referrerpolicy="no-referrer" draggable="false" data-thumbnail-state="image" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100";
            template data-thumbnail-fallback { (fallback) }
        },
        None => fallback,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_tab_is_tiktok_or_instagram_when_named_once() {
        assert_eq!(tab_of(None).0, "youtube");
        assert_eq!(tab_of(Some("platform=tiktok")).0, "tiktok");
        assert_eq!(tab_of(Some("platform=instagram&x=1")).0, "instagram");
        // An array is not a string to resolveGlobalFeedPlatform.
        assert_eq!(tab_of(Some("platform=tiktok&platform=tiktok")).0, "youtube");
        assert_eq!(tab_of(Some("platform=TikTok")).0, "youtube");
    }

    #[test]
    fn an_unknown_or_unreviewed_market_has_no_country() {
        let profile = |code: &str, role: &str| Profile {
            market_code: code.to_owned(),
            role: role.to_owned(),
            review_state: "reviewed".to_owned(),
        };
        assert_eq!(origin_country(&[profile(" us ", "origin")]), Some("US"));
        assert_eq!(
            origin_country(&[profile("XX", "origin"), profile("JP", "origin")]),
            Some("JP")
        );
        assert_eq!(origin_country(&[profile("KR", "adopted")]), None);
    }
}
