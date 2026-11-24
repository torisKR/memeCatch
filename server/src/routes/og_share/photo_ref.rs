//! Which still a share card shows (`representativeImageUrl` in
//! `lib/meme-share-photo.ts`, with `youtubeVideoPreview` and `videoPreview`
//! of `lib/meme-video-preview.ts`): the representative content the detail
//! page plays (`preview_index`, the previews route's port of
//! `resolveMemeDelivery`), and of it a same-origin image, owned card art
//! (`owned_art_path`, the meme card's port), a poster, the YouTube still or
//! the verified social cover.

use url::Url;

use crate::pages::meme_card::owned_art_path;
use crate::routes::public::js;
use crate::routes::public::meme_delivery::{
    PreviewContent, ReviewedMediaSource, normalize_source_url, preview_index,
};

const YOUTUBE_THUMB_HOST: &str = "i.ytimg.com";
const YOUTUBE_LADDER: [&str; 3] = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"];

/// The hosts `siteHosts()` allows: the two production names and the
/// configured site's.
pub struct SiteHosts(Vec<String>);

impl SiteHosts {
    pub fn new(site_url: &str) -> Self {
        let mut hosts = vec!["catchmeme.com".to_owned(), "www.catchmeme.com".to_owned()];
        let configured = Url::parse(site_url)
            .ok()
            .and_then(|url| url.host_str().map(str::to_lowercase));
        hosts.extend(configured);
        Self(hosts)
    }

    fn has(&self, host: &str) -> bool {
        self.0.iter().any(|known| known == host)
    }
}

/// HTTPS without credentials or a port.
fn plain_https(url: &Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
}

/// `isIpHost`: four dotted groups of digits, or a colon.
fn is_ip_host(host: &str) -> bool {
    let parts: Vec<&str> = host.split('.').collect();
    host.contains(':')
        || (parts.len() == 4
            && parts
                .iter()
                .all(|p| (1..=3).contains(&p.len()) && p.bytes().all(|b| b.is_ascii_digit())))
}

fn with_query(url: &Url) -> String {
    url.query().map(|q| format!("?{q}")).unwrap_or_default()
}

/// `canonicalShareImageUrl`: a site path (its query kept) or an absolute
/// HTTPS URL of the site.
pub fn canonical_share_image_url(value: Option<&str>, hosts: &SiteHosts) -> Option<String> {
    let trimmed = js::trim(value?);
    if trimmed.is_empty() || trimmed.starts_with("data:") || trimmed.starts_with("blob:") {
        return None;
    }
    if trimmed.starts_with('/') {
        if trimmed.starts_with("//") || trimmed.contains("..") || trimmed.contains('\\') {
            return None;
        }
        let path = trimmed.split('#').next().unwrap_or_default();
        return (path.starts_with('/') && !path.contains("ytimg")).then(|| path.to_owned());
    }
    let url = Url::parse(trimmed).ok()?;
    let host = url.host_str()?.to_lowercase();
    let refused = !plain_https(&url)
        || is_ip_host(&host)
        || host == "localhost"
        || host.ends_with(".local")
        || !hosts.has(&host);
    if refused {
        return None;
    }
    let origin = url.origin().ascii_serialization();
    Some(format!("{origin}{}{}", url.path(), with_query(&url)))
}

/// `projectOwnedPath`.
fn project_owned_path(value: Option<&str>, hosts: &SiteHosts) -> Option<String> {
    let value = value?;
    if !value.starts_with('/') || value.starts_with("//") || value.contains("..") {
        return None;
    }
    let path = value.split(['?', '#']).next().unwrap_or_default();
    let excluded = ["hqdefault", "mqdefault", "sddefault", "ytimg"]
        .iter()
        .any(|needle| path.contains(needle))
        || path.starts_with("/api/media/meme-thumbs/");
    if excluded {
        return None;
    }
    canonical_share_image_url(Some(path), hosts).map(|_| path.to_owned())
}

fn is_id_char(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_' || b == b'-'
}

/// `youtubeThumbnailVideoId`, with the parsed URL.
fn youtube_thumbnail(value: Option<&str>) -> Option<(Url, String)> {
    let url = Url::parse(js::trim(value?)).ok()?;
    if !plain_https(&url) || url.host_str()?.to_lowercase() != YOUTUBE_THUMB_HOST {
        return None;
    }
    let parts: Vec<&str> = url.path().split('/').collect();
    let file_ok = |file: &str| {
        file.strip_suffix(".jpg")
            .is_some_and(|stem| !stem.is_empty() && stem.bytes().all(is_id_char))
    };
    let valid = parts.len() == 4
        && parts[1] == "vi"
        && parts[2].len() == 11
        && parts[2].bytes().all(is_id_char)
        && file_ok(parts[3]);
    if !valid {
        return None;
    }
    let id = parts[2].to_owned();
    Some((url, id))
}

/// `youtubeThumbnailCandidates`: the larger stills of the same video, then
/// `hqdefault`.
pub fn youtube_candidates(value: &str) -> Option<Vec<String>> {
    let (_, id) = youtube_thumbnail(Some(value))?;
    Some(
        YOUTUBE_LADDER
            .iter()
            .map(|file| format!("https://{YOUTUBE_THUMB_HOST}/vi/{id}/{file}"))
            .collect(),
    )
}

/// `canonicalYoutubeThumbnailUrl`.
fn canonical_youtube_thumbnail(value: Option<&str>) -> Option<String> {
    let (url, _) = youtube_thumbnail(value)?;
    Some(format!(
        "https://{YOUTUBE_THUMB_HOST}{}{}",
        url.path(),
        with_query(&url)
    ))
}

fn truthy(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

/// `representativeContent([content])` and the type check of both previews.
fn previewable(content: &PreviewContent) -> bool {
    let typed = content
        .kind
        .as_deref()
        .is_none_or(|kind| kind.is_empty() || kind == "video" || kind == "embed");
    content.is_renderable() && typed
}

/// `youtubeVideoPreview([content])`.
fn youtube_video_preview(content: &PreviewContent) -> Option<String> {
    if !previewable(content) {
        return None;
    }
    let (url, id) = (truthy(&content.url)?, truthy(&content.content_id)?);
    let source = normalize_source_url(url)?;
    let youtube = matches!(source.platform, "youtube" | "youtube_shorts");
    (youtube && source.external_id == id).then(|| {
        format!(
            "https://{YOUTUBE_THUMB_HOST}/vi/{}/hqdefault.jpg",
            source.external_id
        )
    })
}

/// `isVerifiedVideoSource`.
fn verified_video(platform: &str, canonical: &str, content: &PreviewContent) -> bool {
    platform != "instagram"
        || canonical.starts_with("https://www.instagram.com/reel/")
        || canonical.starts_with("https://www.instagram.com/tv/")
        || (canonical.starts_with("https://www.instagram.com/p/")
            && content.manual_video_verified == Some(true))
}

/// The thumbnail names the verified cover path, as itself or on the site.
fn is_cover(thumb: &str, path: &str) -> bool {
    if thumb == path {
        return true;
    }
    Url::parse(thumb).is_ok_and(|image| {
        let host = image.host_str().unwrap_or_default();
        plain_https(&image)
            && (host == "catchmeme.com" || host == "www.catchmeme.com")
            && image.path() == path
            && image.query().is_none()
            && image.fragment().is_none()
    })
}

/// `videoPreview([content])`.
fn video_preview(content: &PreviewContent) -> Option<String> {
    if let Some(youtube) = youtube_video_preview(content) {
        return Some(youtube);
    }
    if !previewable(content) {
        return None;
    }
    let url = truthy(&content.url)?;
    let id = truthy(&content.content_id)?;
    let thumb = truthy(&content.thumbnail_url)?;
    let source = normalize_source_url(url)?;
    let social = matches!(source.platform, "instagram" | "tiktok");
    if !social
        || source.external_id != id
        || !verified_video(source.platform, &source.canonical_url, content)
    {
        return None;
    }
    let path = format!(
        "/api/media/meme-thumbs/verified/{}/{}.jpg",
        source.platform, source.external_id
    );
    is_cover(thumb, &path).then_some(path)
}

/// `representativeImageUrl({ contents, reviewedMediaSources })` for a
/// ledger that was read (`ok`).
pub fn representative_image_url(
    contents: &[PreviewContent],
    sources: &[ReviewedMediaSource],
    now_ms: i64,
    hosts: &SiteHosts,
) -> Option<String> {
    let content = &contents[preview_index(contents, sources, now_ms)?];
    let thumb = content
        .thumbnail_url
        .as_deref()
        .map(js::trim)
        .filter(|t| !t.is_empty());
    let playback = content
        .url
        .as_deref()
        .is_some_and(|url| !js::trim(url).is_empty());
    let platform = content.platform();
    if playback && matches!(platform, Some("youtube" | "youtube_shorts")) {
        return youtube_video_preview(content);
    }
    if playback && matches!(platform, Some("instagram" | "tiktok")) {
        return video_preview(content);
    }
    if !playback {
        return project_owned_path(thumb, hosts)
            .or_else(|| owned_art_path(thumb).map(|art| format!("{art}?w=1200")));
    }
    let thumb = thumb?;
    canonical_share_image_url(Some(thumb), hosts)
        .or_else(|| canonical_youtube_thumbnail(Some(thumb)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hosts() -> SiteHosts {
        SiteHosts::new("https://catchmeme.com")
    }

    #[test]
    fn site_paths_keep_their_query_and_other_hosts_are_refused() {
        let h = hosts();
        let canonical = |v: &str| canonical_share_image_url(Some(v), &h);
        assert_eq!(
            canonical(" /a/b.png?x=1#y ").as_deref(),
            Some("/a/b.png?x=1")
        );
        assert_eq!(canonical("//evil/x.png"), None);
        assert_eq!(
            canonical("https://catchmeme.com/a.png?w=2").as_deref(),
            Some("https://catchmeme.com/a.png?w=2")
        );
        assert_eq!(canonical("https://example.com/a.png"), None);
        assert_eq!(canonical("https://catchmeme.com:8443/a.png"), None);
    }

    #[test]
    fn a_youtube_still_gets_the_ladder_of_its_video() {
        let ladder =
            youtube_candidates("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg").unwrap();
        assert_eq!(
            ladder[0],
            "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"
        );
        assert_eq!(
            youtube_candidates("https://i.ytimg.com/vi/short/hqdefault.jpg"),
            None
        );
    }
}
