//! The media of the meme page: `components/meme-embed.tsx` (the representative
//! content and each related video), `components/related-video-list.tsx`, and
//! the contents as `getKoreanMediaSnapshot` (lib/korean-media-snapshot.server.ts)
//! checks them. What the players do in the browser is `ui/embed.js`: the
//! YouTube facade, the oEmbed check of a social post, and TikTok's
//! "unplayable" message.

use maud::{Markup, html};
use serde::Deserialize;
use url::Url;

use crate::pages::content_depth::is_context_source_url;
use crate::pages::labels;
use crate::pages::meme_card::{self, CardContent};
use crate::routes::public::js;
use crate::routes::public::meme_delivery::{PreviewContent, normalize_source_url, source_platform};

const HERO_IMAGE: &str =
    "aspect-[4/3] w-full rounded-[16px] object-cover lg:aspect-auto lg:h-[420px] lg:max-h-[420px]";
const LINK_BUTTON: &str = "mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent";
const ART_WIDTHS: [u32; 3] = [600, 900, 1200];
const INITIAL_RELATED: usize = 4;

/// A `meme_contents` row (`*`), the columns the page reads.
#[derive(Clone, Debug, Default, Deserialize)]
pub struct MediaContent {
    pub id: Option<String>,
    pub meme_id: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub platform: Option<String>,
    pub content_id: Option<String>,
    pub url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub availability: Option<String>,
    pub caption: Option<String>,
    pub moderation_status: Option<String>,
    pub is_representative: Option<bool>,
    pub manual_video_verified: Option<bool>,
    pub created_at: Option<String>,
}

impl MediaContent {
    /// `validContent` of the media snapshot.
    pub fn is_valid(&self, meme_id: &str) -> bool {
        self.id.is_some()
            && self.meme_id.as_deref() == Some(meme_id)
            && matches!(
                self.kind.as_deref(),
                Some("image" | "video" | "audio" | "text" | "embed")
            )
            && matches!(
                self.availability.as_deref(),
                Some("live" | "dead" | "region_blocked" | "unchecked")
            )
            && self.moderation_status.as_deref() == Some("approved")
            && self.is_representative.is_some()
            && self.manual_video_verified.is_some()
    }

    pub fn preview(&self) -> PreviewContent {
        PreviewContent {
            kind: self.kind.clone(),
            thumbnail_url: self.thumbnail_url.clone(),
            is_representative: self.is_representative,
            platform: self.platform.clone(),
            url: self.url.clone(),
            content_id: self.content_id.clone(),
            availability: self.availability.clone(),
            moderation_status: self.moderation_status.clone(),
            manual_video_verified: self.manual_video_verified,
        }
    }

    fn card(&self) -> CardContent {
        CardContent {
            kind: self.kind.clone(),
            thumbnail_url: self.thumbnail_url.clone(),
            is_representative: self.is_representative,
            url: self.url.clone(),
            content_id: self.content_id.clone(),
            availability: self.availability.clone(),
            moderation_status: self.moderation_status.clone(),
            manual_video_verified: self.manual_video_verified,
        }
    }

    fn truthy(value: &Option<String>) -> Option<&str> {
        value.as_deref().filter(|text| !text.is_empty())
    }
}

/// `SocialProvider` and `getSocialProvider`.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Provider {
    TikTok,
    Instagram,
    Facebook,
    Threads,
}

impl Provider {
    fn of(platform: Option<&str>, url: Option<&str>) -> Option<Self> {
        let hint = format!(
            "{} {}",
            platform.unwrap_or_default(),
            url.unwrap_or_default()
        )
        .to_lowercase();
        if hint.contains("tiktok") {
            Some(Self::TikTok)
        } else if hint.contains("instagram") {
            Some(Self::Instagram)
        } else if hint.contains("facebook") || hint.contains("fb.watch") {
            Some(Self::Facebook)
        } else if hint.contains("threads") {
            Some(Self::Threads)
        } else {
            None
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::TikTok => "TikTok",
            Self::Instagram => "Instagram",
            Self::Facebook => "Facebook",
            Self::Threads => "Threads",
        }
    }

    fn key(self) -> &'static str {
        match self {
            Self::TikTok => "tiktok",
            Self::Instagram => "instagram",
            Self::Facebook => "facebook",
            Self::Threads => "threads",
        }
    }

    fn width(self) -> &'static str {
        match self {
            Self::TikTok => "mx-auto w-full max-w-[382px]",
            _ => "mx-auto w-full max-w-[540px]",
        }
    }

    fn height(self) -> &'static str {
        match self {
            Self::TikTok => "h-[min(72svh,680px)]",
            Self::Instagram => "h-[min(72svh,720px)]",
            Self::Threads => "h-[min(72svh,700px)]",
            Self::Facebook => "h-[min(68svh,600px)]",
        }
    }
}

/// `immediateSocialEmbed`: the official player of a TikTok video or an
/// Instagram post, known from its link alone.
fn immediate_embed(provider: Provider, source_url: &str) -> Option<String> {
    let url = Url::parse(source_url).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let path = url.path();
    match (provider, url.host_str()?) {
        (Provider::TikTok, "www.tiktok.com") => {
            let rest = path.strip_prefix("/@")?;
            let (handle, rest) = rest.split_once('/')?;
            let valid_handle = !handle.is_empty()
                && handle
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'));
            let digits: String = rest
                .strip_prefix("video/")?
                .chars()
                .take_while(char::is_ascii_digit)
                .collect();
            (valid_handle && !digits.is_empty()).then(|| {
                format!("https://www.tiktok.com/player/v1/{digits}?description=1&music_info=1")
            })
        }
        (Provider::Instagram, "www.instagram.com") => {
            let mut parts = path.trim_start_matches('/').splitn(3, '/');
            let kind = parts.next()?;
            let code: String = parts
                .next()?
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
                .collect();
            (matches!(kind, "p" | "reel" | "tv") && !code.is_empty())
                .then(|| format!("https://www.instagram.com/{kind}/{code}/embed/captioned/"))
        }
        _ => None,
    }
}

/// `projectOwnedImage`: same-origin editorial art, not a video still.
fn project_image(value: Option<&str>) -> Option<String> {
    let trimmed = js::trim(value?);
    if !trimmed.starts_with('/') || trimmed.starts_with("//") || trimmed.contains("..") {
        return None;
    }
    let path = trimmed.split(['?', '#']).next().unwrap_or_default();
    let still = ["hqdefault", "mqdefault", "sddefault", "ytimg"]
        .iter()
        .any(|word| path.contains(word))
        || path.starts_with("/api/media/meme-thumbs/");
    (!still).then(|| path.to_owned())
}

fn owned_art(path: &str, title: &str) -> Markup {
    html! {
        img src=(format!("{path}?w=1200")) srcset=(ART_WIDTHS.map(|w| format!("{path}?w={w} {w}w")).join(", ")) sizes="(min-width: 1024px) 640px, 100vw" width="1200" height="900" alt=(format!("{title} 상징 일러스트")) class=(HERO_IMAGE);
    }
}

fn caption(content: Option<&MediaContent>) -> Markup {
    html! {
        @if let Some(caption) = content.and_then(|content| MediaContent::truthy(&content.caption)) {
            figcaption class="mt-2 text-sm text-muted" { (caption) }
        }
    }
}

/// What `MemeEmbed` is given.
pub struct Embed<'a> {
    pub content: Option<&'a MediaContent>,
    pub fallback_source_url: Option<&'a str>,
    pub fallback_reason: Option<&'static str>,
    pub embedding_allowed: bool,
    pub title: &'a str,
    pub representative: bool,
    /// The meme's category and year, for the note shown without a player.
    pub category: Option<&'a str>,
    pub origin_year: Option<i32>,
}

/// `MemeEmbed` for a catalog meme (a house original has its own visual).
pub fn embed(view: &Embed<'_>) -> Markup {
    let content = view.content;
    let platform = source_platform(
        content.and_then(|c| c.platform.as_deref()),
        content.and_then(|c| c.url.as_deref()),
    );
    let playable = !content
        .is_some_and(|c| matches!(c.availability.as_deref(), Some("dead" | "region_blocked")));
    let reason = view
        .fallback_reason
        .or((content.is_some() && !playable).then_some("confirmed_unavailable"));
    let content_id = content.and_then(|c| MediaContent::truthy(&c.content_id));
    let youtube = content.is_some()
        && matches!(platform, Some("youtube" | "youtube_shorts"))
        && content_id.is_some()
        && playable
        && view.embedding_allowed;
    let source_url: Option<&str> = if playable {
        content
            .and_then(|c| c.url.as_deref())
            .or(view.fallback_source_url)
    } else {
        view.fallback_source_url
    };
    let candidate = (playable && view.embedding_allowed)
        .then(|| Provider::of(content.and_then(|c| c.platform.as_deref()), source_url))
        .flatten();
    let unverified_post = candidate == Some(Provider::Instagram)
        && source_url
            .and_then(normalize_source_url)
            .is_some_and(|source| {
                source.platform == "instagram"
                    && Url::parse(&source.canonical_url)
                        .is_ok_and(|url| url.path().starts_with("/p/"))
            })
        && content.and_then(|c| c.manual_video_verified) != Some(true);
    let provider = candidate.filter(|_| !unverified_post);
    let thumbnail = content.and_then(|c| MediaContent::truthy(&c.thumbnail_url));
    let art = thumbnail.and_then(|thumb| meme_card::owned_art_path(Some(thumb)));
    let has_url = content.and_then(|c| MediaContent::truthy(&c.url)).is_some();

    if let (true, Some(image), None, false) = (playable, project_image(thumbnail), &art, has_url) {
        return html! {
            figure {
                img src=(image) alt=(format!("{} 대표 이미지", view.title)) class={(HERO_IMAGE) " border border-border bg-surface-2"};
                (caption(content))
            }
        };
    }
    if let (true, Some(path), false) = (playable, &art, has_url) {
        return html! { figure { (owned_art(path, view.title)) (caption(content)) } };
    }
    if youtube {
        let short = content
            .and_then(|c| c.url.as_deref())
            .is_some_and(|url| url.contains("/shorts/"));
        return html! {
            figure {
                (lite_youtube(content_id.unwrap_or_default(), view.title, short, view.representative))
                (caption(content))
            }
        };
    }
    if let (Some(provider), Some(source_url)) = (provider, source_url) {
        let poster = content.and_then(|c| meme_card::video_preview(&[c.card()]));
        return html! {
            figure {
                (lite_social(provider, source_url, view.title, poster.as_deref(), view.representative))
                (caption(content))
            }
        };
    }
    let note = |body: Markup| playback_note(art.as_deref(), view, body);
    if let Some(source_url) = source_url {
        if !view.embedding_allowed {
            return note(html! {
                p class="text-base font-semibold" { "콘텐츠는 출처에서 확인할 수 있어요." }
                p class="mt-1 text-sm leading-relaxed" { "외부 링크로 연결해요." }
                a href=(source_url) target="_blank" rel="noopener noreferrer" class=(LINK_BUTTON) { "출처에서 콘텐츠 보기 " span aria-hidden="true" { "↗" } }
            });
        }
        let (headline, detail, link) = if is_context_source_url(source_url) {
            (
                "원본 맥락은 출처에서 확인할 수 있어요.",
                "이 링크는 원본을 복제하지 않고 유래와 맥락을 설명하는 참고 출처예요.",
                "출처에서 원본 맥락 보기",
            )
        } else if reason == Some("confirmed_unavailable") {
            (
                "원본 콘텐츠는 현재 확인할 수 없어요.",
                "플랫폼에서 내려갔거나 접근할 수 없어 임베드하지 않아요. 뜻과 맥락은 아래 설명에 남아 있어요.",
                "출처 상태 확인하기",
            )
        } else {
            (
                "원본 콘텐츠는 출처에서 볼 수 있어요.",
                "저작권 보호를 위해 원본을 복제하지 않고 링크로 연결해요.",
                "출처에서 원본 보기",
            )
        };
        return note(html! {
            p class="text-base font-semibold" { (headline) }
            p class="mt-1 text-sm leading-relaxed" { (detail) }
            a href=(source_url) target="_blank" rel="noopener noreferrer" class=(LINK_BUTTON) { (link) span aria-hidden="true" { "↗" } }
        });
    }
    let confirmed = reason == Some("confirmed_unavailable");
    note(html! {
        p class="text-base font-semibold" {
            (if confirmed { "원본 콘텐츠는 현재 확인할 수 없지만, 뜻과 맥락은 여기 남아 있어요." } else { "원본을 아직 연결하지 못했지만, 뜻과 맥락은 여기 남아 있어요." })
        }
        p class="mt-1 text-sm leading-relaxed" {
            (if confirmed { "플랫폼에서 내려갔거나 접근할 수 없는 콘텐츠예요. 아래 설명이 이 밈의 기록이에요." } else { "아직 재생 가능한 원본 링크가 없는 콘텐츠예요. 아래 설명이 이 밈의 기록이에요." })
        }
    })
}

/// `PlaybackNote`: the owned art when there is one, the category and year
/// chips, then the message.
fn playback_note(art: Option<&str>, view: &Embed<'_>, body: Markup) -> Markup {
    let category = view.category.and_then(labels::category_label);
    html! {
        div class="space-y-3" {
            @if let Some(path) = art { (owned_art(path, view.title)) }
            @if category.is_some() || view.origin_year.is_some() {
                div class="flex flex-wrap items-center gap-1.5" {
                    @if let Some(category) = category {
                        span class="inline-flex items-center rounded-full border border-current/30 px-2.5 py-1 text-xs font-bold tracking-tight" { (category) }
                    }
                    @if let Some(year) = view.origin_year {
                        span class="inline-flex items-center rounded-full border border-current/30 px-2.5 py-1 text-xs font-bold tracking-tight" { (year) "년 무렵" }
                    }
                }
            }
            div class="max-w-prose text-foreground" { (body) }
        }
    }
}

/// `LiteYouTube`: the representative video's player in the document; a
/// related video's still behind a button `ui/embed.js` turns into the player.
fn lite_youtube(video_id: &str, title: &str, short: bool, representative: bool) -> Markup {
    let id = js::encode_uri_component(video_id);
    let box_class = if short {
        "mx-auto aspect-[9/16] w-full max-w-[394px]"
    } else {
        "aspect-video w-full lg:max-h-[420px]"
    };
    let label = if representative {
        "대표 영상"
    } else {
        "관련 영상"
    };
    html! {
        div class={"relative max-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2 " (box_class)} {
            @if representative {
                (youtube_frame(&id, title, label, false))
            } @else {
                button type="button" aria-label=(format!("{title} 관련 영상 재생")) class="group relative block h-full w-full" data-youtube=(id) data-youtube-title=(format!("{title} — {label}")) {
                    img src=(format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg")) alt="" loading="lazy" class="h-full w-full object-cover";
                    span class="absolute inset-0 flex items-center justify-center" {
                        span class="hover-glow-flame flex h-16 w-16 items-center justify-center rounded-full bg-background/85 shadow-lg transition-transform group-hover:scale-105" {
                            svg viewBox="0 0 24 24" class="ml-1 h-7 w-7 text-accent" fill="currentColor" aria-hidden="true" {
                                path d="M8 5.5v13l11-6.5z" {}
                            }
                        }
                    }
                }
            }
        }
    }
}

fn youtube_frame(id: &str, title: &str, label: &str, autoplay: bool) -> Markup {
    html! {
        iframe src=(format!("https://www.youtube-nocookie.com/embed/{id}?rel=0{}", if autoplay { "&autoplay=1" } else { "" })) title=(format!("{title} — {label}")) sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen="" loading="lazy" class="h-full w-full border-0" {}
    }
}

/// `LiteSocialEmbed` as the server renders it: the player when the link
/// names it (TikTok, Instagram), else the loading box. `ui/embed.js` checks
/// the post with Next's `/api/oembed` and shows the player or the error.
fn lite_social(
    provider: Provider,
    source_url: &str,
    title: &str,
    poster: Option<&str>,
    representative: bool,
) -> Markup {
    let name = provider.name();
    let frame = format!("{} {}", provider.width(), provider.height());
    let tape = html! {
        @if provider == Provider::TikTok {
            div class={"hover-glow-flame " (provider.width()) " rounded-xl border border-border bg-surface p-3 text-sm"} {
                div class="flex items-center gap-2" {
                    span class="font-bold tracking-tight" { (name) }
                    @if !representative { span class="text-muted" { "밈 사용 예시" } }
                }
                p class="mt-1.5 leading-relaxed text-muted" { "영상이 보이지 않으면 TikTok에서 직접 열어 보세요." }
                a href=(source_url) target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-strong px-4 font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:active:scale-100 motion-reduce:transition-none" {
                    (name) "에서 보기 " span aria-hidden="true" { "↗" }
                }
            }
        } @else {
            div class={"hover-glow-flame " (provider.width()) " flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm"} {
                span class="font-bold tracking-tight" { (name) }
                @if !representative { span class="text-muted" { "밈 사용 예시" } }
                a href=(source_url) target="_blank" rel="noopener noreferrer" class="ml-auto inline-flex min-h-11 items-center font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                    "게시물 열기 " span aria-hidden="true" { "↗" }
                }
            }
        }
    };
    let frame_title = format!(
        "{title} — {name} {}",
        if representative {
            "대표 콘텐츠"
        } else {
            "관련 콘텐츠"
        }
    );
    let sandbox = if provider == Provider::Threads {
        "allow-scripts allow-popups"
    } else {
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
    };
    html! {
        div class="space-y-2" data-social=(provider.key()) data-social-url=(source_url) data-social-name=(name) data-social-frame=(frame) data-social-title=(frame_title) data-social-sandbox=(sandbox) {
            (tape)
            @if let Some(player) = immediate_embed(provider, source_url) {
                iframe src=(player) title=(frame_title) sandbox=(sandbox) allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" class={(frame) " block rounded-2xl border border-border bg-white shadow-sm"} {}
            } @else {
                div role="status" aria-label=(format!("{name} 콘텐츠 불러오는 중")) class={(frame) " relative overflow-hidden rounded-2xl border border-border bg-surface-2"} {
                    @if let Some(poster) = poster {
                        img src=(poster) alt="" class="absolute inset-0 h-full w-full object-cover opacity-45 blur-[1px]";
                    }
                    div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
                    div class="absolute inset-0 animate-pulse bg-background/50 motion-reduce:animate-none" {}
                }
            }
        }
    }
}

/// `relatedVideoSourceUrl`.
fn related_source_url(content: &MediaContent) -> Option<String> {
    let content_id = MediaContent::truthy(&content.content_id);
    if let Some(url) = content.url.as_deref() {
        let normalized = normalize_source_url(url)?;
        return (Some(normalized.external_id.as_str()) == content_id)
            .then_some(normalized.canonical_url);
    }
    let id = content_id.filter(|id| {
        id.len() == 11
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
    })?;
    match source_platform(content.platform.as_deref(), None) {
        Some("youtube_shorts") => Some(format!("https://www.youtube.com/shorts/{id}")),
        Some("youtube") => Some(format!("https://www.youtube.com/watch?v={id}")),
        _ => None,
    }
}

/// `SOURCE_PLATFORM_META[platform].label`.
fn platform_label(platform: Option<&str>) -> &'static str {
    match platform {
        Some("youtube") => "YouTube",
        Some("youtube_shorts") => "YouTube Shorts",
        Some("tiktok") => "TikTok",
        Some("instagram") => "Instagram",
        Some("community") => "커뮤니티",
        Some(_) => "기타",
        None => "영상",
    }
}

/// The related videos section: `selectRelatedVideos` happens in the caller.
pub fn related_videos(contents: &[&MediaContent], title: &str) -> Markup {
    if contents.is_empty() {
        return html! {};
    }
    let (initial, extra) = contents.split_at(contents.len().min(INITIAL_RELATED));
    let embed_of = |content: &MediaContent| {
        embed(&Embed {
            content: Some(content),
            fallback_source_url: None,
            fallback_reason: None,
            embedding_allowed: true,
            title,
            representative: false,
            category: None,
            origin_year: None,
        })
    };
    html! {
        section aria-labelledby="related-social-embeds" class="space-y-3" {
            h2 id="related-social-embeds" class="text-lg font-bold" { "관련 영상" }
            p class="text-sm text-muted" {
                "검수된 공개 사용 예시 " (crate::pages::about::grouped(contents.len())) "개예요. 원본 단정이 아니며, 권리·맥락은 출처에서 확인하세요."
            }
            div class="grid gap-4" {
                @for content in initial { (embed_of(content)) }
            }
            @if !extra.is_empty() {
                details class="group rounded-xl border border-border bg-surface-2" data-related-extra {
                    summary aria-controls="related-videos-extra" class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden" {
                        span { "관련 영상 " (crate::pages::about::grouped(extra.len())) "개 더 보기" }
                        span aria-hidden="true" class="text-muted transition-transform group-open:rotate-180" { "▾" }
                    }
                    div id="related-videos-extra" class="grid gap-4 border-t border-border p-4" {
                        @for (index, content) in extra.iter().enumerate() {
                            @if let Some(url) = related_source_url(content) {
                                a href=(url) target="_blank" rel="noopener noreferrer" class="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold hover:border-accent/50 hover:text-accent-text" data-related-index=(index) {
                                    span { (platform_label(source_platform(content.platform.as_deref(), content.url.as_deref()))) " 관련 영상 " (index + INITIAL_RELATED + 1) }
                                    span aria-hidden="true" { "↗" }
                                }
                            }
                        }
                    }
                    template data-related-embeds {
                        @for content in extra { div data-related-embed { (embed_of(content)) } }
                    }
                }
            }
        }
    }
}

/// `relatedVideoIdentity`: one playable video, whatever row holds it.
fn related_identity(content: &MediaContent) -> Option<String> {
    if !matches!(content.kind.as_deref(), Some("video" | "embed")) {
        return None;
    }
    let content_id = MediaContent::truthy(&content.content_id)?;
    let normalized = content.url.as_deref().and_then(normalize_source_url);
    if content.url.is_some()
        && normalized
            .as_ref()
            .is_none_or(|n| n.external_id != content_id)
    {
        return None;
    }
    let platform = normalized
        .as_ref()
        .map(|n| n.platform)
        .or_else(|| source_platform(content.platform.as_deref(), content.url.as_deref()));
    let youtube_id = content_id.len() == 11
        && content_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'));
    match platform {
        Some("youtube" | "youtube_shorts") if youtube_id => Some(format!("youtube:{content_id}")),
        Some(platform @ ("tiktok" | "instagram"))
            if meme_card::social_preview(&[content.card()]).is_some() =>
        {
            Some(match (platform, &normalized) {
                ("instagram", Some(normalized)) => {
                    format!("instagram:{}", normalized.canonical_url)
                }
                _ => format!("{platform}:{content_id}"),
            })
        }
        _ => None,
    }
}

/// `selectRelatedVideos(delivery.embeddableContents, representative)`.
pub fn select_related<'a>(
    embeddable: &[&'a MediaContent],
    representative: Option<&MediaContent>,
) -> Vec<&'a MediaContent> {
    let representative_identity = representative.and_then(related_identity);
    let mut seen = std::collections::HashSet::new();
    embeddable
        .iter()
        .copied()
        .filter(|content| {
            if representative.is_some_and(|rep| rep.id == content.id) {
                return false;
            }
            let Some(identity) = related_identity(content) else {
                return false;
            };
            Some(&identity) != representative_identity.as_ref() && seen.insert(identity)
        })
        .collect()
}

/// `canonicalShareImageUrl`: a path of this site, or an https URL on one of
/// its hosts.
fn canonical_share_image(value: &str, site_hosts: &[&str]) -> Option<String> {
    let trimmed = js::trim(value);
    if trimmed.is_empty() || trimmed.starts_with("data:") || trimmed.starts_with("blob:") {
        return None;
    }
    if trimmed.starts_with('/') {
        if trimmed.starts_with("//") || trimmed.contains("..") || trimmed.contains('\\') {
            return None;
        }
        let path = trimmed.split('#').next().unwrap_or_default();
        return (!path.contains("ytimg")).then(|| path.to_owned());
    }
    let url = Url::parse(trimmed).ok()?;
    let host = url.host_str()?.to_lowercase();
    let ip = host.split('.').count() == 4
        && host.split('.').all(|part| {
            !part.is_empty() && part.len() <= 3 && part.bytes().all(|b| b.is_ascii_digit())
        });
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || ip
        || host.contains(':')
        || host == "localhost"
        || host.ends_with(".local")
        || !site_hosts.contains(&host.as_str())
    {
        return None;
    }
    let search = url.query().map(|q| format!("?{q}")).unwrap_or_default();
    Some(format!(
        "{}{}{search}",
        url.origin().ascii_serialization(),
        url.path()
    ))
}

/// `canonicalYoutubeThumbnailUrl`.
fn canonical_youtube_thumbnail(value: &str) -> Option<String> {
    let url = Url::parse(js::trim(value)).ok()?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
        || url.host_str()?.to_lowercase() != "i.ytimg.com"
    {
        return None;
    }
    let parts: Vec<&str> = url.path().split('/').collect();
    let valid = parts.len() == 4
        && parts[1] == "vi"
        && parts[2].len() == 11
        && parts[2]
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
        && parts[3].strip_suffix(".jpg").is_some_and(|name| {
            !name.is_empty()
                && name
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
        });
    if !valid {
        return None;
    }
    let search = url.query().map(|q| format!("?{q}")).unwrap_or_default();
    Some(format!("https://i.ytimg.com{}{search}", url.path()))
}

/// `representativeImageUrl`: the image the share card shows, and when it was
/// stored, for the share card's `?v`. `site_host` is the host of
/// `NEXT_PUBLIC_SITE_URL`.
pub fn share_photo(
    representative: Option<&MediaContent>,
    embedding_allowed: bool,
    lookup_ok: bool,
    site_host: &str,
) -> Option<(String, Option<String>)> {
    let content = representative.filter(|_| lookup_ok && embedding_allowed)?;
    if matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    ) || content.moderation_status.as_deref() != Some("approved")
    {
        return None;
    }
    let thumb = content
        .thumbnail_url
        .as_deref()
        .map(js::trim)
        .filter(|t| !t.is_empty());
    let has_url = content
        .url
        .as_deref()
        .is_some_and(|url| !js::trim(url).is_empty());
    let platform = source_platform(content.platform.as_deref(), content.url.as_deref());
    let created = content.created_at.clone();
    if has_url
        && matches!(
            platform,
            Some("youtube" | "youtube_shorts" | "instagram" | "tiktok")
        )
    {
        return meme_card::video_preview(&[content.card()]).map(|url| (url, created));
    }
    let hosts = ["catchmeme.com", "www.catchmeme.com", site_host];
    let owned = (!has_url)
        .then(|| project_image(thumb))
        .flatten()
        .filter(|path| canonical_share_image(path, &hosts).is_some());
    let art = (!has_url)
        .then(|| meme_card::owned_art_path(thumb))
        .flatten()
        .map(|path| format!("{path}?w=1200"));
    let poster = has_url
        .then(|| {
            thumb.and_then(|thumb| {
                canonical_share_image(thumb, &hosts).or_else(|| canonical_youtube_thumbnail(thumb))
            })
        })
        .flatten();
    owned.or(art).or(poster).map(|url| (url, created))
}
