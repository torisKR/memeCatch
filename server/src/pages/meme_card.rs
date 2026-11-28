//! The catalog card of every list page: `components/meme-card.tsx` (the
//! client entry: a link, the image that falls back to the poster when it
//! fails to load, and the official TikTok or Instagram player behind a
//! button) over `MemeCardFrame` of `components/meme-card-poster.tsx`.
//!
//! The art is `memeCardArtFromMeme` (lib/meme-card-art.ts) and the video
//! still and the player are `videoPreview` and `socialVideoPreview`
//! (lib/meme-video-preview.ts). What happens in the browser is
//! `ui/card.js`: the fallback and the player dialog.

use maud::{Markup, html};
use serde::Deserialize;
use url::Url;

use super::content_depth::{DEPTH_COLUMNS, row_depth};
use super::labels::SafetyLevel;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::public::labels::meme_path;
use crate::routes::public::meme_delivery::{Normalized, normalize_source_url};

/// The columns a card needs, for a query on `memes m`: its own and
/// `meme_contents` as JSON text in the order Postgres returns them, as the
/// planner's embed has it.
pub const CARD_COLUMNS: &str = "\
m.id::text as id, m.short_id, m.slug, m.title, m.summary, m.category::text as category, \
m.safety_level::text as safety_level, m.trend_score, \
m.origin_year, \
(select coalesce(json_agg(json_build_object('type', c.type, 'thumbnail_url', c.thumbnail_url, \
        'is_representative', c.is_representative, 'platform', c.platform, 'url', c.url, 'content_id', c.content_id, \
        'availability', c.availability, 'moderation_status', c.moderation_status, \
        'manual_video_verified', c.manual_video_verified)), '[]'::json)::text \
   from public.meme_contents c where c.meme_id = m.id) as card_contents";

/// One `meme_contents` row as the card reads it.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct CardContent {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub thumbnail_url: Option<String>,
    pub is_representative: Option<bool>,
    pub url: Option<String>,
    pub content_id: Option<String>,
    pub availability: Option<String>,
    pub moderation_status: Option<String>,
    pub manual_video_verified: Option<bool>,
}

/// `MemeCardModel`.
#[derive(Clone, Debug)]
pub struct CardMeme {
    pub id: String,
    pub category: String,
    pub short_id: String,
    pub slug: String,
    pub title: String,
    pub summary: String,
    pub safety_level: Option<SafetyLevel>,
    pub origin_year: Option<i32>,
    pub trend_score: Option<f64>,
    pub contents: Vec<CardContent>,
}

impl CardMeme {
    /// From a row that has `CARD_COLUMNS`.
    pub fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        let contents: String = row.try_get("card_contents")?;
        let safety: Option<String> = row.try_get("safety_level")?;
        let title: Option<String> = row.try_get("title")?;
        let summary: Option<String> = row.try_get("summary")?;
        Ok(Self {
            id: row.try_get("id")?,
            category: row.try_get("category")?,
            short_id: row.try_get("short_id")?,
            slug: row.try_get("slug")?,
            title: title.unwrap_or_default(),
            summary: summary.unwrap_or_default(),
            safety_level: safety.as_deref().and_then(SafetyLevel::parse_known),
            origin_year: row.try_get("origin_year")?,
            trend_score: row.try_get("trend_score")?,
            contents: serde_json::from_str(&contents)
                .map_err(|error| sqlx::Error::Decode(Box::new(error)))?,
        })
    }

    pub fn path(&self) -> String {
        meme_path(&self.short_id, &self.slug)
    }
}

/// `m.id` among the uuids of `array` (a `uuid[]` SQL expression), as a
/// semi-join on `unnest`: linear in both lists whatever plan Postgres picks.
/// `m.id = any(array)` is a linear search of the array for every row a scan
/// filters, and in a generic plan the cast runs again on each: the discovery
/// index (3,600 ids) against the catalog took 2.3 s (`PLAN.md` C3-1).
pub fn id_in(array: &str) -> String {
    format!("m.id in (select unnest({array}))")
}

/// A listing as `takeIndexableMemes` reads it: up to `scan` rows of
/// `memes m` matching `condition` in `order`, of which the first `take` that
/// pass the index test. `condition` and `order` are SQL built from constants;
/// values travel in `binds` (text, `$1`...).
pub async fn indexable(
    db: &Db,
    condition: &str,
    order: &str,
    scan: usize,
    take: usize,
    binds: Vec<String>,
) -> Result<Vec<CardMeme>, sqlx::Error> {
    let sql = format!(
        "select {CARD_COLUMNS}, {DEPTH_COLUMNS} from public.memes m \
          where {condition} order by {order} limit {scan}"
    );
    let rows = db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut statement = sqlx::query(sqlx::AssertSqlSafe(sql));
                for value in binds {
                    statement = statement.bind(value);
                }
                statement.fetch_all(tx).await
            })
        })
        .await?;
    let mut cards = Vec::new();
    for row in rows {
        if cards.len() == take {
            break;
        }
        if row_depth(&row)?.is_indexable() {
            cards.push(CardMeme::from_row(&row)?);
        }
    }
    Ok(cards)
}

/// `indexableScanLimit(limit)`.
pub fn scan_limit(take: usize) -> usize {
    (take * 20).clamp(take, 400)
}

/// `MIN_PUBLIC_LISTING_CARDS`: a rail of fewer cards is not shown.
pub const MIN_LISTING: usize = 3;

/// `isRenderableContent`.
fn is_renderable(content: &CardContent) -> bool {
    !matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    ) && content.moderation_status.as_deref() == Some("approved")
}

fn truthy(value: Option<&String>) -> Option<&str> {
    value.map(String::as_str).filter(|value| !value.is_empty())
}

const OWNED_ART_HOSTS: [&str; 2] = ["catchmeme.com", "www.catchmeme.com"];
const OWNED_ART_PREFIX: &str = "/api/media/meme-card-art/";
const ART_WIDTHS: [u32; 3] = [600, 900, 1200];
const ART_WIDTH: u32 = 1200;
const ART_HEIGHT: u32 = 900;
const GRID_SIZES: &str = "(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw";
const DETAIL_SIZES: &str = "(min-width: 1024px) 360px, 100vw";

fn is_https_site_url(url: &Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url
            .host_str()
            .is_some_and(|host| OWNED_ART_HOSTS.contains(&host.to_lowercase().as_str()))
}

/// `ownedMemeCardArtPath`.
pub(crate) fn owned_art_path(value: Option<&str>) -> Option<String> {
    let trimmed = js::trim(value?);
    if trimmed.is_empty() || trimmed.starts_with("data:") {
        return None;
    }
    let pathname = if trimmed.starts_with('/') {
        trimmed
            .split(['?', '#'])
            .next()
            .unwrap_or_default()
            .to_owned()
    } else {
        let url = Url::parse(trimmed).ok().filter(is_https_site_url)?;
        url.path().to_owned()
    };
    let file = pathname.strip_prefix(OWNED_ART_PREFIX)?;
    let plain = !file.is_empty()
        && file
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'~' | b'-'));
    (plain && !pathname.contains("..")).then_some(pathname)
}

/// `memeCardArtFromMeme`: the 1200 by 900 original, and its width variants.
/// `memes` has no `card_art_url` column, so the art comes from a content.
fn art(meme: &CardMeme) -> Option<Art> {
    let approved = meme
        .contents
        .iter()
        .filter(|content| is_renderable(content));
    let mut ordered = approved
        .clone()
        .filter(|content| content.is_representative == Some(true))
        .chain(approved.filter(|content| content.is_representative != Some(true)));
    ordered.find_map(|content| {
        let thumbnail = content.thumbnail_url.as_deref()?;
        owned_art_path(Some(thumbnail)).map(Art::Owned).or_else(|| {
            if content.kind.as_deref() != Some("image") {
                return None;
            }
            // Existing editorial illustrations shipped with the site. Do not
            // expand this to arbitrary paths or remote thumbnails.
            let path = js::trim(thumbnail);
            matches!(
                path,
                "/ai-memes/ai-slop.jpg"
                    | "/ai-memes/ballerina-cappuccina.jpg"
                    | "/ai-memes/italian-brainrot.jpg"
                    | "/ai-memes/shrimp-jesus.jpg"
                    | "/ai-memes/tralalero-tralala.jpg"
            )
            .then(|| Art::Editorial(path.to_owned()))
        })
    })
}

fn is_video_kind(content: &CardContent) -> bool {
    truthy(content.kind.as_ref()).is_none_or(|kind| kind == "video" || kind == "embed")
}

/// `isVerifiedVideoSource`.
fn is_verified_video(source: &Normalized, content: &CardContent) -> bool {
    if source.platform != "instagram" {
        return true;
    }
    let canonical = &source.canonical_url;
    canonical.starts_with("https://www.instagram.com/reel/")
        || canonical.starts_with("https://www.instagram.com/tv/")
        || (canonical.starts_with("https://www.instagram.com/p/")
            && content.manual_video_verified == Some(true))
}

/// The source of a content whose URL names exactly its `content_id`.
fn matching_source(content: &CardContent) -> Option<Normalized> {
    if !is_video_kind(content) {
        return None;
    }
    let url = truthy(content.url.as_ref())?;
    let content_id = truthy(content.content_id.as_ref())?;
    normalize_source_url(url).filter(|source| source.external_id == content_id)
}

/// `representativeContent`.
fn representative(contents: &[CardContent]) -> Option<&CardContent> {
    let mut renderable = contents.iter().filter(|content| is_renderable(content));
    let first = renderable.clone().next();
    renderable
        .find(|content| content.is_representative == Some(true))
        .or(first)
}

/// `videoPreview`: a YouTube still, or a verified stored social cover.
pub(crate) fn video_preview(contents: &[CardContent]) -> Option<String> {
    let content = representative(contents)?;
    let source = matching_source(content)?;
    if matches!(source.platform, "youtube" | "youtube_shorts") {
        return Some(format!(
            "https://i.ytimg.com/vi/{}/hqdefault.jpg",
            source.external_id
        ));
    }
    let thumbnail = truthy(content.thumbnail_url.as_ref())?;
    if !matches!(source.platform, "instagram" | "tiktok") || !is_verified_video(&source, content) {
        return None;
    }
    let path = format!(
        "/api/media/meme-thumbs/verified/{}/{}.jpg",
        source.platform, source.external_id
    );
    if thumbnail == path {
        return Some(path);
    }
    let image = Url::parse(thumbnail).ok()?;
    (is_https_site_url(&image)
        && image.path() == path
        && image.query().is_none()
        && image.fragment().is_none())
    .then_some(path)
}

/// `SocialVideoPreview`.
pub struct SocialPreview {
    pub provider: &'static str,
    pub source_url: String,
    pub embed_url: String,
    pub is_tiktok: bool,
}

/// `socialVideoPreview`: only when the card can name the one post the meme
/// page will play.
pub(crate) fn social_preview(contents: &[CardContent]) -> Option<SocialPreview> {
    let renderable: Vec<&CardContent> = contents.iter().filter(|c| is_renderable(c)).collect();
    let representatives: Vec<&&CardContent> = renderable
        .iter()
        .filter(|content| content.is_representative == Some(true))
        .collect();
    let content = match (representatives.as_slice(), renderable.as_slice()) {
        ([only], _) => **only,
        ([], [only]) => *only,
        _ => return None,
    };
    let source = matching_source(content)?;
    if !matches!(source.platform, "tiktok" | "instagram") || !is_verified_video(&source, content) {
        return None;
    }
    let is_tiktok = source.platform == "tiktok";
    let embed_url = if is_tiktok {
        format!(
            "https://www.tiktok.com/player/v1/{}?description=1&music_info=1",
            source.external_id
        )
    } else {
        let kind = ["p", "reel", "tv"]
            .into_iter()
            .find(|kind| {
                source
                    .canonical_url
                    .starts_with(&format!("https://www.instagram.com/{kind}/"))
            })
            .unwrap_or("reel");
        format!(
            "https://www.instagram.com/{kind}/{}/embed/captioned/",
            source.external_id
        )
    };
    Some(SocialPreview {
        provider: if is_tiktok { "TikTok" } else { "Instagram" },
        source_url: source.canonical_url,
        embed_url,
        is_tiktok,
    })
}

// `MEME_CARD_LINK_CLASS` with the module's `shell` class.
const CARD_LINK: &str = "meme-card-link block min-w-0 rounded-[16px] text-inherit no-underline outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,20,20,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5c38] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0 meme-card-shell";
const NEON_RING: &str = "shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)]";
const ART_CLASS: &str = "absolute inset-0 h-full w-full object-cover";
const BUBBLE_PATH: &str =
    "M8 6h78a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H42L26 74V58H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z";

/// `SafetyBadge` at its small size, in Korean.
pub fn safety_badge(level: SafetyLevel) -> Markup {
    safety_badge_labelled(level, level.label())
}

/// `SafetyBadge` at its small size with the label of another language.
pub fn safety_badge_labelled(level: SafetyLevel, label: &str) -> Markup {
    html! {
        span role="img" aria-label=(label) class={"safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold " (NEON_RING) " " (level.tone())} {
            span aria-hidden="true" class="leading-none" { (level.icon("size-4")) }
            span class="min-w-0" { (label) }
        }
    }
}

/// `memeCardArtAlt(title, locale)` for the home editions.
fn art_alt(title: &str, locale: &str) -> String {
    match locale {
        "ko" => format!("{title} 상징 일러스트"),
        "ja" => format!("{title}の象徴イラスト"),
        "zh" => format!("{title}象征插画"),
        "zh-tw" => format!("{title}象徵插畫"),
        _ => format!("{title} symbol illustration"),
    }
}

enum Art {
    Video(String),
    Owned(String),
    Editorial(String),
    Poster,
}

/// What draws in the art slot when there is no image, or when one fails
/// (`ui/card.js` swaps it in from the card's template).
fn poster() -> Markup {
    html! { div aria-hidden="true" data-meme-card-art="fallback" class="absolute inset-0 bg-[#141414]" {} }
}

fn bubble() -> Markup {
    html! {
        div class="meme-card-bubble-slot" {
            svg viewBox="0 0 120 80" class="meme-card-bubble" aria-hidden="true" data-meme-card-bubble="" focusable="false" {
                path fill="#ff5c38" d=(BUBBLE_PATH) {}
            }
        }
    }
}

/// `MemeCardTitleSize`: `detail` is the larger title of the meme page's
/// related cards, with its own image sizes.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum TitleSize {
    Grid,
    Detail,
}

impl TitleSize {
    fn name(self) -> &'static str {
        match self {
            Self::Grid => "grid",
            Self::Detail => "detail",
        }
    }

    fn image_sizes(self) -> &'static str {
        match self {
            Self::Grid => GRID_SIZES,
            Self::Detail => DETAIL_SIZES,
        }
    }
}

/// `MemeCard` for a grid. `href` defaults to the meme page.
pub fn card(meme: &CardMeme, href: Option<&str>) -> Markup {
    card_with(meme, href, &meme.contents, TitleSize::Grid, false, "ko")
}

/// `MemeCard` with its `titleSize`.
pub fn card_sized(meme: &CardMeme, href: Option<&str>, size: TitleSize) -> Markup {
    card_with(meme, href, &meme.contents, size, false, "ko")
}

/// `MemeCard` with `previewContents`: the still and the player come from
/// `preview` (the explore grid's reviewed preview), the art from the meme.
pub fn card_previewing(meme: &CardMeme, href: Option<&str>, preview: &[CardContent]) -> Markup {
    card_with(meme, href, preview, TitleSize::Grid, false, "ko")
}

pub(super) fn card_with_image(
    meme: &CardMeme,
    preview: &[CardContent],
    priority: bool,
) -> Option<Markup> {
    let images = card_art(meme, preview);
    if matches!(images.0, Art::Poster) {
        return None;
    }
    Some(render_card(
        meme,
        None,
        preview,
        TitleSize::Grid,
        priority,
        "ko",
        images,
    ))
}

/// `MemeCard` with `priority` (its image loads eagerly and first: the first
/// cards of the home deck) and `locale` (its badge and image text).
pub fn card_priority(meme: &CardMeme, href: Option<&str>, priority: bool, locale: &str) -> Markup {
    card_with(
        meme,
        href,
        &meme.contents,
        TitleSize::Grid,
        priority,
        locale,
    )
}

/// `MemeCard` with its link, `titleSize` and `locale`.
pub fn card_in(meme: &CardMeme, href: &str, size: TitleSize, locale: &str) -> Markup {
    card_with(meme, Some(href), &meme.contents, size, false, locale)
}

fn card_with(
    meme: &CardMeme,
    href: Option<&str>,
    preview: &[CardContent],
    size: TitleSize,
    priority: bool,
    locale: &str,
) -> Markup {
    render_card(
        meme,
        href,
        preview,
        size,
        priority,
        locale,
        card_art(meme, preview),
    )
}

fn card_art(meme: &CardMeme, preview: &[CardContent]) -> (Art, Option<Art>) {
    let illustration = art(meme);
    match video_preview(preview) {
        Some(still) => (Art::Video(still), illustration),
        None => (illustration.unwrap_or(Art::Poster), None),
    }
}

fn render_card(
    meme: &CardMeme,
    href: Option<&str>,
    preview: &[CardContent],
    size: TitleSize,
    priority: bool,
    locale: &str,
    (art, alternate): (Art, Option<Art>),
) -> Markup {
    let social = social_preview(preview);
    let is_poster = matches!(art, Art::Poster);
    let href = href.map_or_else(|| meme.path(), str::to_owned);
    let face = Face {
        title: &meme.title,
        summary: &meme.summary,
        safety: meme.safety_level,
        year: meme.origin_year,
    };
    html! {
        div class="isolate relative min-w-0" data-card {
            a href=(href) class=(CARD_LINK) data-meme-card="" data-pointer-light="" data-meme-card-title-size=(size.name()) {
                (frame(&face, &art, size, priority, locale))
            }
            @if let Some(alternate) = &alternate {
                template data-card-alt-image { (art_image(&face, alternate, size, priority, locale)) }
            }
            @if !is_poster {
                template data-card-fallback { (poster()) (bubble()) }
            }
            @if let Some(preview) = social {
                (preview_dialog(&meme.title, &preview, locale))
            }
        }
    }
}

/// What the face of a card shows.
pub(crate) struct Face<'a> {
    pub title: &'a str,
    pub summary: &'a str,
    pub safety: Option<SafetyLevel>,
    pub year: Option<i32>,
}

/// `MemeCardFace`: the frame without the link around it.
fn frame(face: &Face<'_>, art: &Art, size: TitleSize, priority: bool, locale: &str) -> Markup {
    let is_poster = matches!(art, Art::Poster);
    html! {
        div data-safety=[face.safety.map(SafetyLevel::token)] class="meme-card-frame relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#141414] text-[#f7f4ee]" {
            div class="meme-card-art" {
                (art_image(face, art, size, priority, locale))
            }
            div aria-hidden="true" data-meme-card-scrim="" class="meme-card-scrim" {}
            div aria-hidden="true" class="meme-card-light" {}
            div class={"meme-card-face " @if is_poster { "meme-card-fallback " } "absolute inset-0"} {
                @if is_poster { (bubble()) }
                div class="meme-card-copy" {
                    p title=(face.title) data-meme-card-title="" data-title-size=(size.name()) class="meme-card-title" { (face.title) }
                    @if !js::trim(face.summary).is_empty() {
                        p title=(face.summary) data-meme-card-summary="" class="meme-card-summary" { (face.summary) }
                    }
                    div class="meme-card-badges" {
                        @if let Some(level) = face.safety {
                            span class="meme-card-safety" {
                                @if locale == "ko" {
                                    (safety_badge(level))
                                } @else {
                                    (safety_badge_labelled(level, &super::home::copy::copy(locale).signals.levels[level.token()].label))
                                }
                            }
                        }
                        @if let Some(year) = face.year {
                            span class="meme-card-year inline-flex items-center rounded-full bg-[#141414] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white ring-1 ring-white/70" { (year) }
                        }
                    }
                }
            }
            div aria-hidden="true" class="meme-card-edge" {}
        }
    }
}

fn art_image(face: &Face<'_>, art: &Art, size: TitleSize, priority: bool, locale: &str) -> Markup {
    let loading = if priority { "eager" } else { "lazy" };
    let fetch_priority = priority.then_some("high");
    html! {
        @match art {
            Art::Video(src) => {
                img src=(src) alt="" loading=(loading) fetchpriority=[fetch_priority] decoding="async" referrerpolicy="no-referrer" data-meme-card-art="video" class=(ART_CLASS);
            }
            Art::Owned(path) => {
                img src=(format!("{path}?w={ART_WIDTH}")) srcset=(ART_WIDTHS.map(|w| format!("{path}?w={w} {w}w")).join(", ")) sizes=(size.image_sizes()) width=(ART_WIDTH) height=(ART_HEIGHT) alt=(art_alt(face.title, locale)) loading=(loading) fetchpriority=[fetch_priority] decoding="async" draggable="false" data-meme-card-art="image" class=(ART_CLASS);
            }
            Art::Editorial(path) => {
                img src=(path) alt=(art_alt(face.title, locale)) loading=(loading) fetchpriority=[fetch_priority] decoding="async" draggable="false" data-meme-card-art="image" class=(ART_CLASS);
            }
            Art::Poster => { (poster()) }
        }
    }
}

/// `MemeCardFace` of a card with no image: the poster (the meme cards).
pub(crate) fn poster_face(face: &Face<'_>) -> Markup {
    frame(face, &Art::Poster, TitleSize::Grid, false, "ko")
}

/// `MemeCardFace` with the card art at `path` (`ownedMemeCardArtPath`).
pub(crate) fn owned_face(face: &Face<'_>, path: &str) -> Markup {
    frame(
        face,
        &Art::Owned(path.to_owned()),
        TitleSize::Grid,
        false,
        "ko",
    )
}

/// `SocialVideoPreviewDialog`: the button and the closed dialog. Its content
/// is a template `ui/card.js` puts in while it is open.
fn preview_dialog(title: &str, preview: &SocialPreview, locale: &str) -> Markup {
    let provider = preview.provider;
    // `previewCopy`: Korean, or English for every other language.
    let korean = locale == "ko";
    let (button, heading) = if korean {
        (
            format!("{provider} 영상 미리보기"),
            format!("{provider} 공식 영상 미리보기"),
        )
    } else {
        (
            format!("Preview {provider} video"),
            format!("Official {provider} video preview"),
        )
    };
    let (privacy, unavailable, close, source) = if korean {
        (
            "선택한 공식 플레이어에서 재생할 수 있어요.",
            "이 영상은 현재 재생할 수 없어요.",
            "미리보기 닫기",
            format!("{provider}에서 원본 열기"),
        )
    } else {
        (
            "Play the post in the official embedded player.",
            "This video cannot be played right now.",
            "Close preview",
            format!("Open original on {provider}"),
        )
    };
    let player_size = if preview.is_tiktok {
        "h-[min(72svh,680px)] max-w-[382px]"
    } else {
        "h-[min(72svh,720px)] max-w-[540px]"
    };
    html! {
        button type="button" aria-haspopup="dialog" aria-label=(format!("{title} · {button}")) class="absolute right-2 top-2 z-10 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/70 bg-black/75 px-2.5 text-sm font-bold text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" data-card-preview {
            span aria-hidden="true" class="inline-flex items-center gap-1.5 leading-none" {
                span class="text-xs" { "▶" }
                span class="text-xs font-semibold" { (provider) }
            }
            span class="sr-only" { (button) }
        }
        dialog class="m-auto w-[min(94vw,620px)] max-w-none rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/70" data-card-dialog {}
        template data-card-dialog-content data-embed=(preview.embed_url) data-tiktok[preview.is_tiktok] {
            div class="space-y-3 p-4 sm:p-5" {
                div class="flex items-start justify-between gap-3" {
                    div {
                        h2 class="text-lg font-extrabold" data-card-dialog-title { (heading) }
                        p class="mt-1 text-sm text-muted" { (privacy) }
                    }
                    button type="button" aria-label=(close) class="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xl font-bold hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-card-dialog-close {
                        span aria-hidden="true" { "×" }
                    }
                }
                iframe src=(if preview.is_tiktok { "about:blank" } else { preview.embed_url.as_str() }) title=(format!("{title} — {heading}")) sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen="" referrerpolicy="strict-origin-when-cross-origin" class={"mx-auto block w-full rounded-xl border border-border bg-white " (player_size)} {}
                a href=(preview.source_url) target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center font-semibold text-muted underline underline-offset-4 hover:text-foreground focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                    (source) " " span aria-hidden="true" { "↗" }
                }
            }
            div class="mx-auto flex min-h-32 w-full max-w-[382px] items-center justify-center rounded-xl border border-border bg-surface-2 p-5 text-center" data-card-unavailable {
                p role="alert" class="text-sm text-muted" { (unavailable) }
            }
        }
    }
}

/// `MotionList` as a grid of `li.min-w-0`, every card shown at once
/// (`PLAN.md` B2-4).
pub fn grid(class: &str, items: impl IntoIterator<Item = Markup>) -> Markup {
    html! {
        ul class=(class) {
            @for item in items {
                li class="min-w-0" { (item) }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn content(url: &str, id: &str) -> CardContent {
        CardContent {
            kind: Some("video".to_owned()),
            url: Some(url.to_owned()),
            content_id: Some(id.to_owned()),
            availability: Some("available".to_owned()),
            moderation_status: Some("approved".to_owned()),
            ..CardContent::default()
        }
    }

    #[test]
    fn owned_art_is_a_card_art_file_on_this_site_only() {
        let path = |value: &str| owned_art_path(Some(value));
        assert_eq!(
            path("/api/media/meme-card-art/a.webp?x=1").as_deref(),
            Some("/api/media/meme-card-art/a.webp")
        );
        assert_eq!(
            path(" https://catchmeme.com/api/media/meme-card-art/a.webp ").as_deref(),
            Some("/api/media/meme-card-art/a.webp")
        );
        assert_eq!(
            path("https://catchmeme.com:8443/api/media/meme-card-art/a.webp"),
            None
        );
        assert_eq!(
            path("http://catchmeme.com/api/media/meme-card-art/a.webp"),
            None
        );
        assert_eq!(
            path("https://example.com/api/media/meme-card-art/a.webp"),
            None
        );
        assert_eq!(path("/api/media/meme-card-art/../x"), None);
        assert_eq!(path("/api/media/meme-card-art/"), None);
        assert_eq!(path("data:image/png;base64,xx"), None);
        assert_eq!(path("https://i.ytimg.com/vi/x/hq.jpg"), None);
    }

    #[test]
    fn cards_show_approved_editorial_art_and_offer_it_after_a_video_still_fails() {
        let illustration = CardContent {
            kind: Some("image".to_owned()),
            thumbnail_url: Some("/ai-memes/tralalero-tralala.jpg".to_owned()),
            availability: Some("live".to_owned()),
            moderation_status: Some("approved".to_owned()),
            ..CardContent::default()
        };
        let mut meme = CardMeme {
            id: "fixture".to_owned(),
            category: "image".to_owned(),
            short_id: "fixture".to_owned(),
            slug: "tralalero-tralala".to_owned(),
            title: "트랄랄레로 트랄랄라".to_owned(),
            summary: String::new(),
            safety_level: None,
            origin_year: None,
            trend_score: None,
            contents: vec![illustration],
        };
        let image = "src=\"/ai-memes/tralalero-tralala.jpg\"";
        assert!(
            card_previewing(&meme, None, &[])
                .into_string()
                .contains(image)
        );
        let youtube = content("https://www.youtube.com/watch?v=abcdefghijk", "abcdefghijk");
        let rendered = card_previewing(&meme, None, &[youtube]).into_string();
        assert!(rendered.contains("data-meme-card-art=\"video\""));
        assert!(rendered.contains(&format!("<template data-card-alt-image><img {image}")));

        meme.contents[0].moderation_status = Some("rejected".to_owned());
        assert!(
            !card_previewing(&meme, None, &[])
                .into_string()
                .contains(image)
        );
        meme.contents[0].moderation_status = Some("approved".to_owned());
        meme.contents[0].thumbnail_url =
            Some("https://example.com/ai-memes/tralalero-tralala.jpg".to_owned());
        assert!(
            !card_previewing(&meme, None, &[])
                .into_string()
                .contains("example.com")
        );
    }

    #[test]
    fn a_youtube_video_shows_its_still_and_one_social_post_its_player() {
        let youtube = content("https://www.youtube.com/watch?v=abcdefghijk", "abcdefghijk");
        assert_eq!(
            video_preview(std::slice::from_ref(&youtube)).as_deref(),
            Some("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")
        );
        assert!(social_preview(&[youtube]).is_none());

        let tiktok = content(
            "https://www.tiktok.com/@a/video/1234567890123",
            "1234567890123",
        );
        let preview = social_preview(std::slice::from_ref(&tiktok)).expect("a tiktok player");
        assert_eq!(
            preview.embed_url,
            "https://www.tiktok.com/player/v1/1234567890123?description=1&music_info=1"
        );
        // Two posts and no representative: which one the page plays is not known.
        assert!(social_preview(&[tiktok.clone(), tiktok.clone()]).is_none());
        // An Instagram post is a video only when a reviewer said so.
        let post = content("https://www.instagram.com/p/ABCDE12/", "ABCDE12");
        assert!(social_preview(std::slice::from_ref(&post)).is_none());
        let verified = CardContent {
            manual_video_verified: Some(true),
            ..post
        };
        assert_eq!(
            social_preview(&[verified]).unwrap().embed_url,
            "https://www.instagram.com/p/ABCDE12/embed/captioned/"
        );
        // A dead content is not shown.
        let dead = CardContent {
            availability: Some("dead".to_owned()),
            ..tiktok
        };
        assert!(social_preview(std::slice::from_ref(&dead)).is_none());
        assert!(video_preview(&[dead]).is_none());
    }
}
