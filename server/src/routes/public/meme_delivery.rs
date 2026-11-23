//! The part of `lib/meme-delivery.ts` that `POST /api/explore/previews`
//! needs: which content of a meme is its preview, and whether the reviewed
//! media ledger allows embedding it. With it, `lib/sources/url.ts`
//! (`normalizeSourceUrl`), `lib/source-platform.ts`
//! (`sourcePlatformFromReference`) and `isRenderableContent`.
//!
//! This decides whether third-party media is shown, so it is held to the
//! TypeScript case by case: `tests/fixtures/preview_delivery.json` is written
//! by `parity/preview-fixture.mjs` from the real `resolveMemeDelivery`.
//!
//! Left out because the route never reads them: the source links, the
//! fallback URL and the fallback reason of `MemeDelivery`.

use serde::{Deserialize, Serialize};
use url::Url;

use super::{js, js_date};

/// `SOURCE_STATUS_MAX_AGE_MS`.
const SOURCE_STATUS_MAX_AGE_MS: i64 = 86_400_000;
const SOURCE_PLATFORMS: [&str; 7] = [
    "youtube",
    "youtube_shorts",
    "tiktok",
    "instagram",
    "broadcast_archive",
    "public_archive",
    "web",
];
const RIGHTS: [&str; 7] = [
    "official_embed",
    "creator_permission",
    "creative_commons",
    "public_data",
    "link_only",
    "unknown",
    "blocked",
];
const REVIEWS: [&str; 4] = ["pending", "approved", "rejected", "removed"];
const PUBLIC_STATUSES: [&str; 4] = ["public", "unlisted", "private", "unknown"];
const AVAILABILITIES: [&str; 4] = ["live", "dead", "region_blocked", "unchecked"];

/// One `meme_contents` row as the route selects it. The field order is the
/// select list, which is the key order of the JSON the route answers with.
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize)]
pub struct PreviewContent {
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub thumbnail_url: Option<String>,
    pub is_representative: Option<bool>,
    pub platform: Option<String>,
    pub url: Option<String>,
    pub content_id: Option<String>,
    pub availability: Option<String>,
    pub moderation_status: Option<String>,
    pub manual_video_verified: Option<bool>,
}

/// `ReviewedMediaSource`: a `meme_media` row with its `media_sources` row.
#[derive(Clone, Debug, Deserialize)]
pub struct ReviewedMediaSource {
    pub review_state: String,
    pub rights_basis: String,
    pub platform: String,
    pub external_id: Option<String>,
    pub canonical_url: String,
    pub embeddable: Option<bool>,
    pub public_status: Option<String>,
    pub removed_at: Option<String>,
    pub last_checked_at: Option<String>,
}

impl ReviewedMediaSource {
    /// `isValidReviewedMediaSource`, for the fields a typed row can get wrong.
    pub fn is_valid(&self) -> bool {
        SOURCE_PLATFORMS.contains(&self.platform.as_str())
            && REVIEWS.contains(&self.review_state.as_str())
            && RIGHTS.contains(&self.rights_basis.as_str())
            && self
                .public_status
                .as_deref()
                .is_none_or(|status| PUBLIC_STATUSES.contains(&status))
    }
}

/// `NormalizedSourceUrl`.
#[derive(Debug, PartialEq)]
struct Normalized {
    platform: &'static str,
    external_id: String,
    canonical_url: String,
}

/// A JavaScript truthy string: present and not empty.
fn truthy(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

fn is_host(host: &str, domain: &str) -> bool {
    host == domain
        || host
            .strip_suffix(domain)
            .is_some_and(|rest| rest.ends_with('.'))
}

fn is_word(bytes: &[u8]) -> bool {
    bytes
        .iter()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

/// `/^[A-Za-z0-9_-]{11}$/`.
fn is_youtube_id(id: &str) -> bool {
    id.len() == 11 && is_word(id.as_bytes())
}

/// `normalizeYoutube`.
fn normalize_youtube(url: &Url, host: &str) -> Option<Normalized> {
    let path = url.path();
    let video_id = if is_host(host, "youtu.be") {
        path.split('/')
            .find(|segment| !segment.is_empty())?
            .to_owned()
    } else {
        // `/^\/(?:shorts|embed)\/([^/?]+)/`, else the `v` parameter.
        let from_path = ["/shorts/", "/embed/"]
            .iter()
            .find_map(|prefix| path.strip_prefix(prefix))
            .map(|rest| rest.split(['/', '?']).next().unwrap_or_default())
            .filter(|id| !id.is_empty());
        match from_path {
            Some(id) => id.to_owned(),
            None => url
                .query_pairs()
                .find(|(name, _)| name == "v")?
                .1
                .into_owned(),
        }
    };
    if !is_youtube_id(&video_id) {
        return None;
    }
    let is_short = path.starts_with("/shorts/");
    Some(Normalized {
        platform: if is_short {
            "youtube_shorts"
        } else {
            "youtube"
        },
        canonical_url: if is_short {
            format!("https://www.youtube.com/shorts/{video_id}")
        } else {
            format!("https://www.youtube.com/watch?v={video_id}")
        },
        external_id: video_id,
    })
}

/// The capture of `/\/video\/(\d+)/`: the digits after the first `/video/`
/// that is followed by one. Two markers can share a slash (`/video/video/1`).
fn tiktok_video_id(path: &str) -> Option<&str> {
    const MARKER: &str = "/video/";
    let mut from = 0;
    while let Some(found) = path[from..].find(MARKER) {
        let rest = &path[from + found + MARKER.len()..];
        let digits = rest.bytes().take_while(u8::is_ascii_digit).count();
        if digits > 0 {
            return Some(&rest[..digits]);
        }
        from += found + 1;
    }
    None
}

/// `normalizeTiktok`.
fn normalize_tiktok(url: &Url) -> Option<Normalized> {
    let path = url.path();
    let video_id = tiktok_video_id(path)?;
    if !(10..=25).contains(&video_id.len()) {
        return None;
    }
    Some(Normalized {
        platform: "tiktok",
        external_id: video_id.to_owned(),
        canonical_url: format!("https://www.tiktok.com{}", path.trim_end_matches('/')),
    })
}

/// `normalizeInstagram`: `/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/`.
fn normalize_instagram(url: &Url) -> Option<Normalized> {
    let path = url.path();
    let (kind, rest) = ["p", "reel", "tv"].iter().find_map(|kind| {
        let rest = path
            .strip_prefix('/')?
            .strip_prefix(kind)?
            .strip_prefix('/')?;
        Some((*kind, rest))
    })?;
    let code = rest.strip_suffix('/').unwrap_or(rest);
    if !(5..=80).contains(&code.len()) || !is_word(code.as_bytes()) {
        return None;
    }
    Some(Normalized {
        platform: "instagram",
        external_id: code.to_owned(),
        canonical_url: format!("https://www.instagram.com/{kind}/{code}/"),
    })
}

/// `normalizeSourceUrl`: the final public URL of a supported platform in its
/// canonical form. Short links and anything else are `None`.
fn normalize_source_url(raw: &str) -> Option<Normalized> {
    if raw.is_empty() || js::utf16_len(raw) > 2_048 {
        return None;
    }
    let url = Url::parse(js::trim(raw)).ok()?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some_and(|p| !p.is_empty())
    {
        return None;
    }
    let host = url.host_str()?.to_lowercase();
    if is_host(&host, "youtube.com") || is_host(&host, "youtu.be") {
        return normalize_youtube(&url, &host);
    }
    if is_host(&host, "tiktok.com") {
        return normalize_tiktok(&url);
    }
    if is_host(&host, "instagram.com") {
        return normalize_instagram(&url);
    }
    None
}

/// `sourcePlatformFromReference({ platform, url })`.
fn source_platform(platform: Option<&str>, url: Option<&str>) -> Option<&'static str> {
    if let Some(normalized) = url
        .filter(|url| !url.is_empty())
        .and_then(normalize_source_url)
    {
        return Some(normalized.platform);
    }
    let value = format!(
        "{} {}",
        platform.unwrap_or_default(),
        url.unwrap_or_default()
    )
    .to_lowercase();
    let has = |needle: &str| value.contains(needle);
    Some(
        if has("youtube shorts") || has("youtube.com/shorts/") || has("youtu.be/shorts/") {
            "youtube_shorts"
        } else if has("youtube") || has("youtu.be") {
            "youtube"
        } else if has("tiktok") || has("틱톡") {
            "tiktok"
        } else if has("instagram") || has("인스타") {
            "instagram"
        } else if has("community") || has("커뮤니티") || has("디시") || has("dcinside") {
            "community"
        } else if !js::trim(&value).is_empty() {
            "other"
        } else {
            return None;
        },
    )
}

/// `mediaPlatformIdentity`.
fn platform_identity(platform: &str) -> &str {
    if platform == "youtube_shorts" {
        "youtube"
    } else {
        platform
    }
}

impl PreviewContent {
    fn normalized_url(&self) -> Option<Normalized> {
        truthy(&self.url).and_then(normalize_source_url)
    }

    fn platform(&self) -> Option<&'static str> {
        source_platform(self.platform.as_deref(), self.url.as_deref())
    }

    /// `isRenderableContent`.
    fn is_renderable(&self) -> bool {
        !matches!(
            self.availability.as_deref(),
            Some("dead" | "region_blocked")
        ) && self.moderation_status.as_deref() == Some("approved")
    }

    fn is_video(&self) -> bool {
        matches!(self.kind.as_deref(), Some("video" | "embed"))
    }

    /// An Instagram post (`/p/`) nobody confirmed to be a video.
    fn is_unverified_instagram_post(&self, normalized: Option<&Normalized>) -> bool {
        normalized.is_some_and(|source| {
            source.platform == "instagram" && source.canonical_url.contains("/p/")
        }) && self.manual_video_verified != Some(true)
    }

    /// `videoIdentity`.
    fn video_identity(&self) -> Option<String> {
        if self.kind.is_some() && !self.is_video() {
            return None;
        }
        let content_id = truthy(&self.content_id)?;
        let source = self.normalized_url();
        if truthy(&self.url).is_some()
            && source
                .as_ref()
                .is_none_or(|source| source.external_id != content_id)
        {
            return None;
        }
        let platform = source
            .as_ref()
            .map(|source| source.platform)
            .or_else(|| self.platform());
        if matches!(platform, Some("youtube" | "youtube_shorts")) {
            return is_youtube_id(content_id).then(|| format!("youtube:{content_id}"));
        }
        let source = source?;
        match source.platform {
            "instagram" => {
                (!self.is_unverified_instagram_post(Some(&source))).then_some(source.canonical_url)
            }
            "tiktok" => Some(format!("tiktok:{}", source.external_id)),
            _ => None,
        }
    }
}

/// `SourcePolicy.access`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Access {
    Default,
    LinkOnly,
    Suppressed,
}

/// `hasFreshStatus`.
fn has_fresh_status(source: &ReviewedMediaSource, now_ms: i64) -> bool {
    truthy(&source.last_checked_at)
        .and_then(js_date::parse_ms)
        .is_some_and(|checked| checked <= now_ms && now_ms - checked <= SOURCE_STATUS_MAX_AGE_MS)
}

/// `policyForReviewedSource`.
fn policy_for_source(source: &ReviewedMediaSource, now_ms: i64) -> Access {
    let unsafe_rights = matches!(source.rights_basis.as_str(), "unknown" | "blocked");
    if !source.is_valid() || source.review_state != "approved" || unsafe_rights {
        return Access::Suppressed;
    }
    let not_public = matches!(
        source.public_status.as_deref(),
        Some("private" | "unlisted")
    );
    if truthy(&source.removed_at).is_some() || not_public {
        return Access::Suppressed;
    }
    if source.rights_basis == "link_only" {
        return Access::LinkOnly;
    }
    if source.embeddable != Some(false) {
        return Access::Default;
    }
    let is_youtube = matches!(source.platform.as_str(), "youtube" | "youtube_shorts");
    if is_youtube
        && source.public_status.as_deref() == Some("public")
        && has_fresh_status(source, now_ms)
    {
        return Access::LinkOnly;
    }
    Access::Suppressed
}

/// The check `exactReviewedMediaSources` makes of one source, given what it
/// derived from the content. `None` when no source can be exact.
struct ExactMatch<'a> {
    content_id: &'a str,
    platform: &'static str,
    canonical_url: Option<String>,
}

impl<'a> ExactMatch<'a> {
    fn of(content: &'a PreviewContent) -> Option<Self> {
        let content_url = content
            .url
            .as_deref()
            .map(js::trim)
            .filter(|url| !url.is_empty());
        let content_id = truthy(&content.content_id)?;
        let normalized = content_url.and_then(normalize_source_url);
        let platform = source_platform(content.platform.as_deref(), content_url)?;
        let refused = match (content_url, &normalized) {
            (Some(_), None) => true,
            (_, Some(normalized)) => normalized.external_id != content_id,
            (None, None) => platform_identity(platform) != "youtube" || !is_youtube_id(content_id),
        };
        (!refused).then(|| Self {
            content_id,
            platform,
            canonical_url: normalized.map(|normalized| normalized.canonical_url),
        })
    }

    fn is_exact(&self, source: &ReviewedMediaSource) -> bool {
        let identity = platform_identity(&source.platform);
        if identity != platform_identity(self.platform)
            || source.external_id.as_deref() != Some(self.content_id)
        {
            return false;
        }
        let Some(normalized) = normalize_source_url(&source.canonical_url) else {
            return false;
        };
        if Some(normalized.external_id.as_str()) != source.external_id.as_deref()
            || platform_identity(normalized.platform) != identity
        {
            return false;
        }
        identity == "youtube"
            || source.platform == "tiktok"
            || self.canonical_url.as_deref() == Some(normalized.canonical_url.as_str())
    }
}

/// What one matching ledger row says about a content (the `flatMap` of
/// `sourcePolicy`). `None`: the row neither approves nor blocks it.
fn policy_of_match(
    content: &PreviewContent,
    normalized_content: Option<&Normalized>,
    exact: Option<&ExactMatch<'_>>,
    source: &ReviewedMediaSource,
    now_ms: i64,
) -> Option<Access> {
    let policy = policy_for_source(source, now_ms);
    if policy == Access::Suppressed || exact.is_some_and(|exact| exact.is_exact(source)) {
        return Some(policy);
    }
    // The same Instagram shortcode under another path (`/p/` or `/reel/`).
    let source_url = normalize_source_url(&source.canonical_url);
    let same_instagram_post = normalized_content.is_some_and(|c| c.platform == "instagram")
        && source_url.as_ref().is_some_and(|url| {
            url.platform == "instagram"
                && Some(url.external_id.as_str()) == source.external_id.as_deref()
                && Some(url.external_id.as_str()) == content.content_id.as_deref()
        });
    if same_instagram_post && policy == Access::LinkOnly {
        return Some(policy);
    }
    let other_path = source_url.map(|url| url.canonical_url)
        != normalized_content.map(|content| content.canonical_url.clone());
    if same_instagram_post && other_path {
        return None;
    }
    Some(Access::Suppressed)
}

/// `sourcePolicy`.
fn source_policy(content: &PreviewContent, sources: &[ReviewedMediaSource], now_ms: i64) -> Access {
    let unknown_availability = content
        .availability
        .as_deref()
        .is_some_and(|status| !AVAILABILITIES.contains(&status));
    if sources.iter().any(|source| !source.is_valid()) || unknown_availability {
        return Access::Suppressed;
    }
    let normalized_content = content.normalized_url();
    let content_id = truthy(&content.content_id);
    if let (Some(normalized), Some(content_id)) = (&normalized_content, content_id)
        && normalized.external_id != content_id
    {
        return Access::Suppressed;
    }
    let (Some(content_id), Some(platform)) = (content_id, content.platform()) else {
        return Access::Default;
    };
    let identity = platform_identity(platform);
    let matches = |source: &&ReviewedMediaSource| {
        let same_platform = platform_identity(&source.platform) == identity;
        let canonical_matches = normalize_source_url(&source.canonical_url).is_some_and(|url| {
            platform_identity(url.platform) == identity && url.external_id == content_id
        });
        (same_platform && source.external_id.as_deref() == Some(content_id)) || canonical_matches
    };
    let exact = ExactMatch::of(content);
    let policies: Vec<Access> = sources
        .iter()
        .filter(matches)
        .filter_map(|source| {
            policy_of_match(
                content,
                normalized_content.as_ref(),
                exact.as_ref(),
                source,
                now_ms,
            )
        })
        .collect();
    if policies.contains(&Access::Suppressed) {
        Access::Suppressed
    } else if policies.contains(&Access::LinkOnly) {
        Access::LinkOnly
    } else {
        Access::Default
    }
}

/// `selectRepresentative`: the index (into `contents`) of the content shown,
/// among the ones in `renderable`. `None` when there is none or the choice is
/// ambiguous.
fn select_representative(contents: &[PreviewContent], renderable: &[usize]) -> Option<usize> {
    let representatives: Vec<usize> = renderable
        .iter()
        .copied()
        .filter(|index| contents[*index].is_representative == Some(true))
        .collect();
    let pool = if representatives.is_empty() {
        renderable
    } else {
        &representatives
    };
    let videos: Vec<(usize, String)> = pool
        .iter()
        .filter_map(|index| Some((*index, contents[*index].video_identity()?)))
        .collect();
    let unknown_videos = pool
        .iter()
        .map(|index| &contents[*index])
        .filter(|content| {
            content.is_video()
                && content.video_identity().is_none()
                && !content.is_unverified_instagram_post(content.normalized_url().as_ref())
        })
        .count();
    let several_identities = videos.iter().any(|(_, identity)| *identity != videos[0].1);
    if several_identities
        || (unknown_videos > 0 && videos.len() + unknown_videos > 1)
        || (representatives.len() > 1
            && !videos.is_empty()
            && videos.len() != representatives.len())
    {
        return None;
    }
    representatives
        .first()
        .or(videos.first().map(|(index, _)| index))
        .or(renderable.first())
        .copied()
}

/// What `qualifySearchPreviews` answers for one card whose ledger rows were
/// read: the index of the representative content when embedding it is
/// allowed. `now_ms` is `Date.now()`.
pub fn preview_index(
    contents: &[PreviewContent],
    sources: &[ReviewedMediaSource],
    now_ms: i64,
) -> Option<usize> {
    let policies: Vec<Access> = contents
        .iter()
        .map(|content| source_policy(content, sources, now_ms))
        .collect();
    let renderable: Vec<usize> = (0..contents.len())
        .filter(|index| policies[*index] != Access::Suppressed && contents[*index].is_renderable())
        .collect();
    select_representative(contents, &renderable)
        .filter(|index| policies[*index] != Access::LinkOnly)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Fixture {
        now: i64,
        cases: Vec<Case>,
    }

    #[derive(Deserialize)]
    struct Case {
        contents: Vec<PreviewContent>,
        sources: Vec<ReviewedMediaSource>,
        preview: i64,
    }

    #[test]
    fn every_case_answers_what_the_typescript_answered() {
        let fixture: Fixture = serde_json::from_str(include_str!(
            "../../../tests/fixtures/preview_delivery.json"
        ))
        .expect("fixture");
        assert_eq!(fixture.cases.len(), 914);

        for (number, case) in fixture.cases.iter().enumerate() {
            let preview = preview_index(&case.contents, &case.sources, fixture.now)
                .map_or(-1, |index| index as i64);

            assert_eq!(
                preview, case.preview,
                "case {number}: {:?} with {:?}",
                case.contents, case.sources
            );
        }
    }

    fn normalized(raw: &str) -> Option<(&'static str, String, String)> {
        normalize_source_url(raw).map(|n| (n.platform, n.external_id, n.canonical_url))
    }

    // Expected values are what normalizeSourceUrl of lib/sources/url.ts returns.
    #[test]
    fn urls_normalize_like_the_typescript() {
        let youtube = |id: &str| {
            Some((
                "youtube",
                id.to_owned(),
                format!("https://www.youtube.com/watch?v={id}"),
            ))
        };
        assert_eq!(
            normalized("https://youtu.be/dQw4w9WgXcQ?t=1"),
            youtube("dQw4w9WgXcQ")
        );
        assert_eq!(
            normalized("  https://M.YouTube.com/watch?x=1&v=dQw4w9WgXcQ#t  "),
            youtube("dQw4w9WgXcQ")
        );
        assert_eq!(
            normalized("https://www.youtube.com/embed/dQw4w9WgXcQ/extra"),
            youtube("dQw4w9WgXcQ")
        );
        assert_eq!(
            normalized("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
            Some((
                "youtube_shorts",
                "dQw4w9WgXcQ".to_owned(),
                "https://www.youtube.com/shorts/dQw4w9WgXcQ".to_owned()
            ))
        );
        assert_eq!(
            normalized("https://www.tiktok.com/@a/video/7301234567890123456//"),
            Some((
                "tiktok",
                "7301234567890123456".to_owned(),
                "https://www.tiktok.com/@a/video/7301234567890123456".to_owned()
            ))
        );
        assert_eq!(
            normalized("https://instagram.com/reel/CxYz12345"),
            Some((
                "instagram",
                "CxYz12345".to_owned(),
                "https://www.instagram.com/reel/CxYz12345/".to_owned()
            ))
        );
        assert_eq!(tiktok_video_id("/video/video/123/video/9"), Some("123"));
        assert_eq!(tiktok_video_id("/@a/video/x"), None);
        for refused in [
            "",
            "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://u:p@www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.youtube.com/watch?v=short",
            "https://youtu.be/shorts/dQw4w9WgXcQ",
            "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
            "https://vt.tiktok.com/ZSabc/",
            "https://www.tiktok.com/@a/video/123",
            "https://www.instagram.com/p/abc/",
            "https://www.instagram.com/reel/CxYz12345/extra",
            "not a url",
        ] {
            assert_eq!(normalized(refused), None, "{refused}");
        }
    }

    // Expected values are what sourcePlatformFromReference returns.
    #[test]
    fn a_platform_is_read_from_the_url_first_and_the_name_second() {
        for (platform, url, expected) in [
            (
                Some("web"),
                Some("https://youtu.be/dQw4w9WgXcQ"),
                Some("youtube"),
            ),
            (Some("YouTube Shorts"), None, Some("youtube_shorts")),
            (Some("틱톡"), Some(""), Some("tiktok")),
            (
                None,
                Some("https://www.instagram.com/stories/x/"),
                Some("instagram"),
            ),
            (Some("디시"), None, Some("community")),
            (Some("web"), None, Some("other")),
            (Some("  "), Some(" "), None),
            (None, None, None),
        ] {
            assert_eq!(
                source_platform(platform, url),
                expected,
                "{platform:?} {url:?}"
            );
        }
    }
}
