//! `parseOEmbedTarget` of `lib/oembed.ts` and the URL tests it uses. The
//! TypeScript's regular expressions are written out as plain matching here
//! (each function names the expression it stands for).

use url::Url;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Provider {
    Youtube,
    Tiktok,
    Instagram,
    Facebook,
    Threads,
}

impl Provider {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Youtube => "youtube",
            Self::Tiktok => "tiktok",
            Self::Instagram => "instagram",
            Self::Facebook => "facebook",
            Self::Threads => "threads",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MetaEndpoint {
    InstagramOembed,
    OembedPost,
    OembedVideo,
    ThreadsOembed,
}

impl MetaEndpoint {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InstagramOembed => "instagram_oembed",
            Self::OembedPost => "oembed_post",
            Self::OembedVideo => "oembed_video",
            Self::ThreadsOembed => "threads_oembed",
        }
    }
}

/// `ProviderTarget`, with the parsed URL kept beside its text.
#[derive(Clone, Debug)]
pub struct Target {
    pub provider: Provider,
    pub source_url: String,
    pub url: Url,
    pub youtube_id: Option<String>,
    pub meta_endpoint: Option<MetaEndpoint>,
}

/// `OEmbedError`: the message, the code and the HTTP status.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OEmbedError {
    pub message: String,
    pub code: &'static str,
    pub status: u16,
}

pub const INVALID_URL: &str = "INVALID_URL";
pub const UNSUPPORTED_PROVIDER: &str = "UNSUPPORTED_PROVIDER";
pub const UPSTREAM_ERROR: &str = "UPSTREAM_ERROR";

pub fn oembed_error(message: &str, code: &'static str, status: u16) -> OEmbedError {
    OEmbedError {
        message: message.to_owned(),
        code,
        status,
    }
}

fn invalid(message: &str) -> OEmbedError {
    oembed_error(message, INVALID_URL, 400)
}

/// `hostname === domain || hostname.endsWith(".domain")`.
pub fn is_host(hostname: &str, domain: &str) -> bool {
    hostname == domain
        || hostname
            .strip_suffix(domain)
            .is_some_and(|rest| rest.ends_with('.'))
}

/// `isSupportedOEmbedUrl` of lib/oembed.ts: a URL of a provider this client
/// can ask (the submit action checks such a link before it stores it).
pub fn is_supported_url(raw_url: &str) -> bool {
    let Ok(url) = Url::parse(raw_url) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    host == "fb.watch"
        || [
            "youtube.com",
            "youtu.be",
            "tiktok.com",
            "instagram.com",
            "facebook.com",
            "threads.net",
            "threads.com",
        ]
        .iter()
        .any(|domain| is_host(&host, domain))
}

fn is_id_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_' || c == '-'
}

/// The leading run of `[A-Za-z0-9_-]` in `text`.
pub fn id_run(text: &str) -> &str {
    let end = text.find(|c: char| !is_id_char(c)).unwrap_or(text.len());
    &text[..end]
}

/// `/\/video\/(\d+)/` on the path: the digits after the first `/video/`
/// that has any.
pub fn tiktok_id(url: &Url) -> Option<String> {
    let path = url.path();
    path.match_indices("/video/").find_map(|(at, _)| {
        let rest = &path[at + "/video/".len()..];
        let end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        (end > 0).then(|| rest[..end].to_owned())
    })
}

/// The first `v` of the query, decoded as `URLSearchParams` decodes it.
pub fn search_param(url: &Url, name: &str) -> Option<String> {
    url.query_pairs()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.into_owned())
}

pub fn is_youtube_id(candidate: &str) -> bool {
    candidate.len() == 11 && candidate.chars().all(is_id_char)
}

/// `getYouTubeId`: the first path segment of `youtu.be`, else
/// `/^\/(?:shorts|embed)\/([^/?]+)/`, else `?v=`; an 11-character ID.
pub fn youtube_id(url: &Url) -> Option<String> {
    let hostname = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let candidate = if is_host(&hostname, "youtu.be") {
        url.path()
            .split('/')
            .find(|segment| !segment.is_empty())
            .map(str::to_owned)
    } else {
        shorts_or_embed(url.path()).or_else(|| search_param(url, "v"))
    };
    candidate.filter(|candidate| is_youtube_id(candidate))
}

/// `/^\/(?:shorts|embed)\/([^/?]+)/`.
pub fn shorts_or_embed(path: &str) -> Option<String> {
    let rest = path
        .strip_prefix("/shorts/")
        .or_else(|| path.strip_prefix("/embed/"))?;
    let end = rest.find(['/', '?']).unwrap_or(rest.len());
    (end > 0).then(|| rest[..end].to_owned())
}

/// `/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/`: the kind and the code.
pub fn instagram_parts(path: &str) -> Option<(&str, &str)> {
    let rest = path.strip_prefix('/')?;
    let (kind, rest) = rest.split_once('/')?;
    let code = id_run(rest);
    (matches!(kind, "p" | "reel" | "tv") && !code.is_empty()).then_some((kind, code))
}

/// `/^\/(?:@[^/]+\/post|t)\/[A-Za-z0-9_-]+\/?/`.
fn is_threads_post(path: &str) -> bool {
    let code = if let Some(rest) = path.strip_prefix("/t/") {
        rest
    } else if let Some(rest) = path.strip_prefix("/@") {
        let Some((user, rest)) = rest.split_once('/') else {
            return false;
        };
        match rest.strip_prefix("post/") {
            Some(code) if !user.is_empty() => code,
            _ => return false,
        }
    } else {
        return false;
    };
    !id_run(code).is_empty()
}

/// `/\/(?:post|t)\/([A-Za-z0-9_-]+)/`: the leftmost match anywhere.
pub fn threads_id(path: &str) -> Option<String> {
    (0..path.len())
        .filter(|at| path.is_char_boundary(*at))
        .find_map(|at| {
            let rest = &path[at..];
            let code = rest
                .strip_prefix("/post/")
                .or_else(|| rest.strip_prefix("/t/"))?;
            let code = id_run(code);
            (!code.is_empty()).then(|| code.to_owned())
        })
}

/// `/\/(?:watch|videos?|reel)(?:\/|$)/`.
fn is_facebook_video_path(path: &str) -> bool {
    ["/watch", "/video", "/videos", "/reel"].iter().any(|word| {
        path.match_indices(word).any(|(at, _)| {
            let after = &path[at + word.len()..];
            after.is_empty() || after.starts_with('/')
        })
    })
}

/// `parseOEmbedTarget(rawUrl)`.
pub fn parse_target(raw_url: &str) -> Result<Target, OEmbedError> {
    const REQUIRED: &str = "올바른 콘텐츠 URL이 필요합니다.";
    if raw_url.is_empty() || raw_url.encode_utf16().count() > 2_048 {
        return Err(invalid(REQUIRED));
    }
    let mut url = Url::parse(raw_url).map_err(|_| invalid(REQUIRED))?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
        return Err(invalid("HTTPS 콘텐츠 URL만 사용할 수 있습니다."));
    }
    url.set_fragment(None);
    let source_url = url.to_string();
    let hostname = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let target = |provider, youtube_id, meta_endpoint| Target {
        provider,
        source_url: source_url.clone(),
        url: url.clone(),
        youtube_id,
        meta_endpoint,
    };

    if is_host(&hostname, "youtube.com") || is_host(&hostname, "youtu.be") {
        let id = youtube_id(&url)
            .ok_or_else(|| invalid("YouTube 영상 또는 Shorts URL을 확인해 주세요."))?;
        return Ok(target(Provider::Youtube, Some(id), None));
    }
    if is_host(&hostname, "tiktok.com") {
        return Ok(target(Provider::Tiktok, None, None));
    }
    if is_host(&hostname, "instagram.com") {
        if instagram_parts(url.path()).is_none() {
            return Err(invalid(
                "Instagram 게시물 또는 릴스 URL만 임베드할 수 있습니다.",
            ));
        }
        return Ok(target(
            Provider::Instagram,
            None,
            Some(MetaEndpoint::InstagramOembed),
        ));
    }
    if is_host(&hostname, "threads.net") || is_host(&hostname, "threads.com") {
        if !is_threads_post(url.path()) {
            return Err(invalid("Threads 공개 게시물 URL만 임베드할 수 있습니다."));
        }
        return Ok(target(
            Provider::Threads,
            None,
            Some(MetaEndpoint::ThreadsOembed),
        ));
    }
    if is_host(&hostname, "facebook.com") || hostname == "fb.watch" {
        let is_video = hostname == "fb.watch"
            || is_facebook_video_path(url.path())
            || url.query_pairs().any(|(key, _)| key == "v");
        let endpoint = if is_video {
            MetaEndpoint::OembedVideo
        } else {
            MetaEndpoint::OembedPost
        };
        return Ok(target(Provider::Facebook, None, Some(endpoint)));
    }
    Err(oembed_error(
        "YouTube, TikTok, Instagram, Facebook 또는 Threads 콘텐츠만 지원합니다.",
        UNSUPPORTED_PROVIDER,
        400,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    type Parsed = (Provider, String, Option<String>, Option<&'static str>);

    fn parsed(raw: &str) -> Result<Parsed, String> {
        parse_target(raw)
            .map(|target| {
                (
                    target.provider,
                    target.source_url,
                    target.youtube_id,
                    target.meta_endpoint.map(MetaEndpoint::as_str),
                )
            })
            .map_err(|error| format!("{} {} {}", error.status, error.code, error.message))
    }

    #[test]
    fn targets_are_read_as_the_typescript_reads_them() {
        let ok = |raw: &str| parsed(raw).expect(raw);
        assert_eq!(
            ok("https://youtu.be/dQw4w9WgXcQ?t=1#x"),
            (
                Provider::Youtube,
                "https://youtu.be/dQw4w9WgXcQ?t=1".to_owned(),
                Some("dQw4w9WgXcQ".to_owned()),
                None
            )
        );
        assert_eq!(
            ok("https://m.YouTube.com/shorts/dQw4w9WgXcQ/x")
                .2
                .as_deref(),
            Some("dQw4w9WgXcQ")
        );
        assert_eq!(
            ok("https://www.youtube.com/watch?a=1&v=dQw4w9WgXcQ&v=x")
                .2
                .as_deref(),
            Some("dQw4w9WgXcQ")
        );
        // A /shorts/ match that is not an ID does not fall back to ?v=.
        assert!(parsed("https://youtube.com/shorts/abc?v=dQw4w9WgXcQ").is_err());
        assert_eq!(ok("https://vm.tiktok.com/ZS123/").0, Provider::Tiktok);
        assert_eq!(
            ok("https://www.instagram.com/reel/Cx_1-a/?igsh=1").3,
            Some("instagram_oembed")
        );
        assert_eq!(
            ok("https://www.threads.net/@a.b/post/Cx1").3,
            Some("threads_oembed")
        );
        assert_eq!(ok("https://threads.com/t/Cx1").0, Provider::Threads);
        assert_eq!(
            ok("https://www.facebook.com/x/videos/1").3,
            Some("oembed_video")
        );
        assert_eq!(
            ok("https://www.facebook.com/watch?v=1").3,
            Some("oembed_video")
        );
        assert_eq!(ok("https://fb.watch/abc").3, Some("oembed_video"));
        assert_eq!(
            ok("https://www.facebook.com/x/posts/1").3,
            Some("oembed_post")
        );
        assert_eq!(
            ok("https://www.facebook.com/reels/1").3,
            Some("oembed_post")
        );

        let refused = |raw: &str| parsed(raw).expect_err(raw);
        assert!(refused("").starts_with("400 INVALID_URL"));
        assert!(
            refused(&format!("https://youtu.be/{}", "a".repeat(2_040)))
                .starts_with("400 INVALID_URL")
        );
        assert!(refused("http://youtu.be/dQw4w9WgXcQ").contains("HTTPS"));
        assert!(refused("https://u:p@youtu.be/dQw4w9WgXcQ").contains("HTTPS"));
        assert!(refused("https://www.instagram.com/stories/x/").contains("Instagram"));
        assert!(refused("https://www.threads.net/@/post/x").contains("Threads"));
        assert!(
            refused("https://notyoutube.com/watch?v=dQw4w9WgXcQ")
                .starts_with("400 UNSUPPORTED_PROVIDER")
        );
    }

    #[test]
    fn ids_are_found_where_the_expressions_find_them() {
        let url = |raw: &str| Url::parse(raw).expect("url");
        assert_eq!(
            tiktok_id(&url("https://t.com/video/x/video/123?a")).as_deref(),
            Some("123")
        );
        assert_eq!(tiktok_id(&url("https://t.com/@a/video/")), None);
        assert_eq!(threads_id("/@a/post/Cx_1/t/y").as_deref(), Some("Cx_1"));
        assert_eq!(threads_id("/t/!/post/ok").as_deref(), Some("ok"));
        assert_eq!(instagram_parts("/tv/AB-c_/"), Some(("tv", "AB-c_")));
        assert_eq!(instagram_parts("/p/"), None);
    }
}
