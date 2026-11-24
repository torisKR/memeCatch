//! `MemeEmbed` (components/meme-embed.tsx) as `AdminMemeContents` calls it:
//! a content, the meme's title and whether it is representative, with no
//! fallback URL, category, year or origin kind. What the server renders:
//! the project image or card art without a link, the YouTube player (or its
//! facade for a related video), the social player when its URL gives one
//! at once (else the loading box `ui/admin-memes.js` fills from
//! `/api/oembed`), or the note with the source link.

use maud::{Markup, html};

use crate::pages::content_depth::is_context_source_url;
use crate::pages::meme_card::owned_art_path;
use crate::routes::public::js;
use crate::routes::public::meme_delivery::{normalize_source_url, source_platform};

/// The `meme_contents` columns the editor reads.
pub struct Content {
    pub platform: Option<String>,
    pub content_id: Option<String>,
    pub url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub availability: Option<String>,
    pub caption: Option<String>,
    pub moderation: Option<String>,
    pub is_representative: bool,
}

const HERO: &str =
    "aspect-[4/3] w-full rounded-[16px] object-cover lg:aspect-auto lg:h-[420px] lg:max-h-[420px]";
const LINK: &str = "mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent";

fn truthy(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|value| !value.is_empty())
}

/// `projectOwnedImage`: a same-origin path that is not a video still.
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

/// `getSocialProvider`: the provider named by the platform or the URL.
fn social_provider(platform: Option<&str>, url: Option<&str>) -> Option<&'static str> {
    let hint = format!(
        "{} {}",
        platform.unwrap_or_default(),
        url.unwrap_or_default()
    )
    .to_lowercase();
    if hint.contains("tiktok") {
        Some("tiktok")
    } else if hint.contains("instagram") {
        Some("instagram")
    } else if hint.contains("facebook") || hint.contains("fb.watch") {
        Some("facebook")
    } else if hint.contains("threads") {
        Some("threads")
    } else {
        None
    }
}

/// `immediateSocialEmbed`: the player URL a TikTok video or an Instagram
/// post gives without asking oEmbed.
fn immediate(provider: &str, source: &str) -> Option<String> {
    let url = url::Url::parse(source).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let path = url.path();
    match (provider, url.host_str()) {
        ("tiktok", Some("www.tiktok.com")) => {
            let rest = path.strip_prefix("/@")?;
            let (user, rest) = rest.split_once('/')?;
            let id = rest.strip_prefix("video/")?;
            let id: String = id.chars().take_while(char::is_ascii_digit).collect();
            let user_ok = !user.is_empty()
                && user
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
            (user_ok && !id.is_empty()).then(|| {
                format!("https://www.tiktok.com/player/v1/{id}?description=1&music_info=1")
            })
        }
        ("instagram", Some("www.instagram.com")) => {
            let mut parts = path.trim_start_matches('/').splitn(2, '/');
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

fn provider_name(provider: &str) -> &'static str {
    match provider {
        "tiktok" => "TikTok",
        "instagram" => "Instagram",
        "facebook" => "Facebook",
        _ => "Threads",
    }
}

/// `videoPreview([content])` for a content without a `type`.
fn video_preview(content: &Content) -> Option<String> {
    if matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    ) {
        return None;
    }
    let url = truthy(&content.url)?;
    let id = truthy(&content.content_id)?;
    let source = normalize_source_url(url).filter(|source| source.external_id == id)?;
    if matches!(source.platform, "youtube" | "youtube_shorts") {
        return Some(format!(
            "https://i.ytimg.com/vi/{}/hqdefault.jpg",
            source.external_id
        ));
    }
    let thumbnail = truthy(&content.thumbnail_url)?;
    // Not reviewed as video: the editor does not read `manual_video_verified`.
    let verified = source.platform != "instagram"
        || source
            .canonical_url
            .starts_with("https://www.instagram.com/reel/")
        || source
            .canonical_url
            .starts_with("https://www.instagram.com/tv/");
    if !matches!(source.platform, "tiktok" | "instagram") || !verified {
        return None;
    }
    let path = format!(
        "/api/media/meme-thumbs/verified/{}/{}.jpg",
        source.platform, source.external_id
    );
    if thumbnail == path {
        return Some(path);
    }
    let image = url::Url::parse(thumbnail).ok()?;
    let ours = image.scheme() == "https"
        && matches!(
            image.host_str(),
            Some("catchmeme.com" | "www.catchmeme.com")
        )
        && image.username().is_empty()
        && image.password().is_none()
        && image.port().is_none()
        && image.path() == path
        && image.query().is_none()
        && image.fragment().is_none();
    ours.then_some(path)
}

fn caption(content: &Content) -> Markup {
    html! {
        @if let Some(caption) = truthy(&content.caption) {
            figcaption class="mt-2 text-sm text-muted" { (caption) }
        }
    }
}

fn art(path: &str, title: &str) -> Markup {
    let srcset = [600, 900, 1200]
        .map(|w| format!("{path}?w={w} {w}w"))
        .join(", ");
    html! {
        img src=(format!("{path}?w=1200")) srcset=(srcset) sizes="(min-width: 1024px) 640px, 100vw" width="1200" height="900" alt=(format!("{title} 상징 일러스트")) class=(HERO);
    }
}

/// `MemeEmbed({ content, title, isRepresentative })`.
pub fn meme_embed(content: &Content, title: &str) -> Markup {
    let platform = source_platform(content.platform.as_deref(), content.url.as_deref());
    let playable = !matches!(
        content.availability.as_deref(),
        Some("dead" | "region_blocked")
    );
    let source = if playable { truthy(&content.url) } else { None };
    let youtube = matches!(platform, Some("youtube" | "youtube_shorts"))
        && truthy(&content.content_id).is_some()
        && playable;
    let candidate = if playable {
        social_provider(content.platform.as_deref(), source)
    } else {
        None
    };
    let unverified_post = candidate == Some("instagram")
        && source.and_then(normalize_source_url).is_some_and(|social| {
            social.platform == "instagram"
                && social
                    .canonical_url
                    .starts_with("https://www.instagram.com/p/")
        });
    let social = if unverified_post { None } else { candidate };
    let owned = owned_art_path(content.thumbnail_url.as_deref());
    let image = project_image(content.thumbnail_url.as_deref());
    let linked = truthy(&content.url).is_some();
    html! {
        @if let (true, Some(image), None, false) = (playable, &image, &owned, linked) {
            figure {
                img src=(image) alt=(format!("{title} 대표 이미지")) class=(format!("{HERO} border border-border bg-surface-2"));
                (caption(content))
            }
        } @else if let (true, Some(owned), false) = (playable, &owned, linked) {
            figure { (art(owned, title)) (caption(content)) }
        } @else if youtube {
            figure {
                (lite_youtube(truthy(&content.content_id).unwrap_or_default(), title, content.url.as_deref().unwrap_or_default().contains("/shorts/"), content.is_representative))
                (caption(content))
            }
        } @else if let (Some(provider), Some(source)) = (social, source) {
            figure { (lite_social(provider, source, title, video_preview(content), content.is_representative)) (caption(content)) }
        } @else if let Some(source) = source {
            @let context = is_context_source_url(source);
            (note(owned.as_deref(), title, html! {
                p class="text-base font-semibold" { (if context { "원본 맥락은 출처에서 확인할 수 있어요." } else { "원본 콘텐츠는 출처에서 볼 수 있어요." }) }
                p class="mt-1 text-sm leading-relaxed" { (if context { "이 링크는 원본을 복제하지 않고 유래와 맥락을 설명하는 참고 출처예요." } else { "저작권 보호를 위해 원본을 복제하지 않고 링크로 연결해요." }) }
                a href=(super::safe_href(source)) target="_blank" rel="noopener noreferrer" class=(LINK) { (if context { "출처에서 원본 맥락 보기" } else { "출처에서 원본 보기" }) span aria-hidden="true" { "↗" } }
            }))
        } @else {
            (note(owned.as_deref(), title, html! {
                @if playable {
                    p class="text-base font-semibold" { "원본을 아직 연결하지 못했지만, 뜻과 맥락은 여기 남아 있어요." }
                    p class="mt-1 text-sm leading-relaxed" { "아직 재생 가능한 원본 링크가 없는 콘텐츠예요. 아래 설명이 이 밈의 기록이에요." }
                } @else {
                    p class="text-base font-semibold" { "원본 콘텐츠는 현재 확인할 수 없지만, 뜻과 맥락은 여기 남아 있어요." }
                    p class="mt-1 text-sm leading-relaxed" { "플랫폼에서 내려갔거나 접근할 수 없는 콘텐츠예요. 아래 설명이 이 밈의 기록이에요." }
                }
            }))
        }
    }
}

/// `PlaybackNote` without a category or year.
fn note(owned: Option<&str>, title: &str, children: Markup) -> Markup {
    html! {
        div class="space-y-3" {
            @if let Some(owned) = owned { (art(owned, title)) }
            div class="max-w-prose text-foreground" { (children) }
        }
    }
}

/// `LiteYouTube`: the player for the representative video, a facade the
/// script swaps for it on a click otherwise.
fn lite_youtube(id: &str, title: &str, short: bool, representative: bool) -> Markup {
    let id = js::encode_uri_component(id);
    let shape = if short {
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
        div class=(format!("relative max-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2 {shape}")) {
            @if representative {
                iframe src=(format!("https://www.youtube-nocookie.com/embed/{id}?rel=0")) title=(format!("{title} — {label}")) sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen="" loading="lazy" class="h-full w-full border-0" {}
            } @else {
                button type="button" aria-label=(format!("{title} 관련 영상 재생")) class="group relative block h-full w-full"
                    data-admin-youtube=(id) data-admin-youtube-title=(format!("{title} — {label}")) {
                    img src=(format!("https://i.ytimg.com/vi/{id}/hqdefault.jpg")) alt="" loading="lazy" class="h-full w-full object-cover";
                    span class="absolute inset-0 flex items-center justify-center" {
                        span class="hover-glow-flame flex h-16 w-16 items-center justify-center rounded-full bg-background/85 shadow-lg transition-transform group-hover:scale-105" {
                            svg viewBox="0 0 24 24" class="ml-1 h-7 w-7 text-accent" fill="currentColor" aria-hidden="true" { path d="M8 5.5v13l11-6.5z" {} }
                        }
                    }
                }
            }
        }
    }
}

/// `LiteSocialEmbed` as it first renders.
fn lite_social(
    provider: &str,
    source: &str,
    title: &str,
    thumbnail: Option<String>,
    representative: bool,
) -> Markup {
    let name = provider_name(provider);
    let width = if provider == "tiktok" {
        "mx-auto w-full max-w-[382px]"
    } else {
        "mx-auto w-full max-w-[540px]"
    };
    let height = match provider {
        "tiktok" => "h-[min(72svh,680px)]",
        "instagram" => "h-[min(72svh,720px)]",
        "threads" => "h-[min(72svh,700px)]",
        _ => "h-[min(68svh,600px)]",
    };
    let frame = format!("{width} {height}");
    let sandbox = if provider == "threads" {
        "allow-scripts allow-popups"
    } else {
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
    };
    let content_label = if representative {
        "대표 콘텐츠"
    } else {
        "관련 콘텐츠"
    };
    let tape = html! {
        @if provider == "tiktok" {
            div class=(format!("hover-glow-flame {width} rounded-xl border border-border bg-surface p-3 text-sm")) {
                div class="flex items-center gap-2" {
                    span class="font-bold tracking-tight" { (name) }
                    @if !representative { span class="text-muted" { "밈 사용 예시" } }
                }
                p class="mt-1.5 leading-relaxed text-muted" { "영상이 보이지 않으면 TikTok에서 직접 열어 보세요." }
                a href=(super::safe_href(source)) target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-strong px-4 font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:active:scale-100 motion-reduce:transition-none" {
                    (name) "에서 보기 " span aria-hidden="true" { "↗" }
                }
            }
        } @else {
            div class=(format!("hover-glow-flame {width} flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm")) {
                span class="font-bold tracking-tight" { (name) }
                @if !representative { span class="text-muted" { "밈 사용 예시" } }
                a href=(super::safe_href(source)) target="_blank" rel="noopener noreferrer" class="ml-auto inline-flex min-h-11 items-center font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                    "게시물 열기 " span aria-hidden="true" { "↗" }
                }
            }
        }
    };
    let iframe_class = format!("{frame} block rounded-2xl border border-border bg-white shadow-sm");
    let iframe_title = format!("{title} — {name} {content_label}");
    html! {
        div class="space-y-2" data-admin-social=(provider) data-admin-source=(source) data-admin-frame=(iframe_class) data-admin-frame-title=(iframe_title) data-admin-sandbox=(sandbox) {
            (tape)
            @if let Some(player) = immediate(provider, source) {
                iframe src=(player) title=(iframe_title) sandbox=(sandbox) allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" class=(iframe_class) {}
            } @else {
                div role="status" aria-label=(format!("{name} 콘텐츠 불러오는 중")) class=(format!("{frame} relative overflow-hidden rounded-2xl border border-border bg-surface-2")) data-admin-loading {
                    @if let Some(thumbnail) = thumbnail {
                        img src=(thumbnail) alt="" class="absolute inset-0 h-full w-full object-cover opacity-45 blur-[1px]";
                    }
                    div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {}
                    div class="absolute inset-0 animate-pulse bg-background/50 motion-reduce:animate-none" {}
                }
            }
        }
    }
}
