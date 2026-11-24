//! `lib/sources/url.ts`: a final public source URL in its canonical form.

use url::Url;

use crate::oembed::target::{
    id_run, is_host, is_youtube_id, search_param, shorts_or_embed, tiktok_id,
};
use crate::routes::public::js;

/// `MediaSourcePlatform`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Platform {
    Youtube,
    YoutubeShorts,
    Tiktok,
    Instagram,
}

impl Platform {
    pub const ALL: [Self; 4] = [
        Self::Youtube,
        Self::YoutubeShorts,
        Self::Tiktok,
        Self::Instagram,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Youtube => "youtube",
            Self::YoutubeShorts => "youtube_shorts",
            Self::Tiktok => "tiktok",
            Self::Instagram => "instagram",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        Self::ALL
            .into_iter()
            .find(|platform| platform.as_str() == text)
    }

    /// `isYouTubePlatform`.
    pub fn is_youtube(self) -> bool {
        matches!(self, Self::Youtube | Self::YoutubeShorts)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Normalized {
    pub platform: Platform,
    pub external_id: String,
    pub canonical_url: String,
}

/// `normalizeSourceUrl(rawUrl)`.
pub fn normalize_source_url(raw_url: &str) -> Option<Normalized> {
    if raw_url.is_empty() || raw_url.encode_utf16().count() > 2_048 {
        return None;
    }
    let url = Url::parse(raw_url.trim_matches(js::is_space)).ok()?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let hostname = url.host_str().unwrap_or_default().to_ascii_lowercase();
    if is_host(&hostname, "youtube.com") || is_host(&hostname, "youtu.be") {
        return youtube(&url, is_host(&hostname, "youtu.be"));
    }
    if is_host(&hostname, "tiktok.com") {
        return tiktok(&url);
    }
    if is_host(&hostname, "instagram.com") {
        return instagram(url.path());
    }
    None
}

fn youtube(url: &Url, short_link: bool) -> Option<Normalized> {
    let id = if short_link {
        url.path()
            .split('/')
            .find(|segment| !segment.is_empty())
            .map(str::to_owned)
    } else {
        shorts_or_embed(url.path()).or_else(|| search_param(url, "v"))
    }
    .filter(|id| is_youtube_id(id))?;
    let shorts = url.path().starts_with("/shorts/");
    Some(Normalized {
        platform: if shorts {
            Platform::YoutubeShorts
        } else {
            Platform::Youtube
        },
        canonical_url: if shorts {
            format!("https://www.youtube.com/shorts/{id}")
        } else {
            format!("https://www.youtube.com/watch?v={id}")
        },
        external_id: id,
    })
}

/// `/\/video\/(\d+)/` then `^\d{10,25}$`; the path without trailing slashes.
fn tiktok(url: &Url) -> Option<Normalized> {
    let id = tiktok_id(url).filter(|id| (10..=25).contains(&id.len()))?;
    Some(Normalized {
        platform: Platform::Tiktok,
        external_id: id,
        canonical_url: format!("https://www.tiktok.com{}", url.path().trim_end_matches('/')),
    })
}

/// `/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/` with a code of 5 to 80.
fn instagram(path: &str) -> Option<Normalized> {
    let (kind, rest) = path.strip_prefix('/')?.split_once('/')?;
    let code = id_run(rest);
    let after = &rest[code.len()..];
    let whole = matches!(kind, "p" | "reel" | "tv") && (after.is_empty() || after == "/");
    if !whole || !(5..=80).contains(&code.len()) {
        return None;
    }
    Some(Normalized {
        platform: Platform::Instagram,
        external_id: code.to_owned(),
        canonical_url: format!("https://www.instagram.com/{kind}/{code}/"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canonical(raw: &str) -> Option<(&'static str, String, String)> {
        normalize_source_url(raw).map(|n| (n.platform.as_str(), n.external_id, n.canonical_url))
    }

    #[test]
    fn urls_normalize_as_in_the_typescript() {
        let id = "dQw4w9WgXcQ";
        assert_eq!(
            canonical(&format!(" \u{a0}https://youtu.be/{id}?t=3 ")),
            Some((
                "youtube",
                id.into(),
                format!("https://www.youtube.com/watch?v={id}")
            ))
        );
        // A youtu.be path under /shorts/ is not a Short: the ID is "shorts".
        assert_eq!(canonical(&format!("https://youtu.be/shorts/{id}")), None);
        assert_eq!(
            canonical(&format!("https://m.youtube.com/shorts/{id}?feature=x")),
            Some((
                "youtube_shorts",
                id.into(),
                format!("https://www.youtube.com/shorts/{id}")
            ))
        );
        assert_eq!(
            canonical("https://www.tiktok.com/@a.b/video/7312345678901234567//"),
            Some((
                "tiktok",
                "7312345678901234567".into(),
                "https://www.tiktok.com/@a.b/video/7312345678901234567".into()
            ))
        );
        assert_eq!(canonical("https://www.tiktok.com/@a/video/123456789"), None);
        assert_eq!(canonical("https://vt.tiktok.com/ZS123/"), None);
        assert_eq!(
            canonical("https://instagram.com/reel/Cx_1-a"),
            Some((
                "instagram",
                "Cx_1-a".into(),
                "https://www.instagram.com/reel/Cx_1-a/".into()
            ))
        );
        assert_eq!(canonical("https://www.instagram.com/p/Cx1ab/x"), None);
        assert_eq!(canonical("https://www.instagram.com/p/Cx1a/"), None);
        assert_eq!(canonical("http://www.instagram.com/p/Cx1ab/"), None);
        assert_eq!(canonical("https://www.facebook.com/watch?v=1"), None);
    }
}
