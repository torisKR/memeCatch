//! `getOEmbed` of `lib/oembed.ts`: one client for every native caller
//! (`/api/oembed`, the source refresh run, the operator's source ingestion),
//! with one cache shared by all of them (`cache.rs`). The YouTube Data API
//! calls of the refresh run go through the same HTTP client, uncached
//! (`fetch_no_store`).

mod cache;
pub mod http;
pub mod target;

use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tokio::time::Instant;
use url::Url;

use self::cache::{FetchCache, Lookup};
use self::http::{FetchError, Fetched, Http};
use self::target::{MetaEndpoint, Target, instagram_parts, oembed_error, threads_id, tiktok_id};
pub use self::target::{OEmbedError, Provider, UPSTREAM_ERROR};
use crate::config::Config;
use crate::routes::js_string::JsString;
use crate::routes::request::decode_text;

/// `AbortSignal.timeout(8_000)`.
const TIMEOUT: Duration = Duration::from_secs(8);
/// A background refresh has no signal; undici's `headersTimeout` ends it.
const REFRESH_TIMEOUT: Duration = Duration::from_secs(300);
/// `readBoundedText(response, 256 * 1024)`.
const MAX_TEXT_BYTES: usize = 256 * 1024;
const DEFAULT_GRAPH_VERSION: &str = "v25.0";
const UPSTREAM_FAILED: &str = "플랫폼에서 콘텐츠 정보를 가져오지 못했습니다.";

/// What `getOEmbed` threw.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Failure {
    OEmbed(OEmbedError),
    /// `fetch` rejected: a `TimeoutError` or `TypeError: fetch failed`.
    Fetch(FetchError),
    /// Another exception, by its `message`: `JSON.parse`'s `SyntaxError`
    /// (worded by serde_json here) or a `TypeError`.
    Error(String),
}

impl Failure {
    /// `error.message`.
    pub fn message(&self) -> &str {
        match self {
            Self::OEmbed(error) => &error.message,
            Self::Fetch(error) => error.message(),
            Self::Error(message) => message,
        }
    }
}

/// `OEmbedResult`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OEmbedResult {
    pub provider: Provider,
    pub source_url: String,
    pub embed_url: Option<String>,
    pub embed_html: Option<String>,
    pub content_id: Option<String>,
    pub provider_content_id: Option<String>,
    pub title: Option<JsString>,
    pub author_name: Option<JsString>,
}

impl OEmbedResult {
    /// `JSON.stringify(result)`.
    pub fn json(&self) -> String {
        let text = |value: Option<&str>| {
            value.map_or("null".to_owned(), |text| JsString::from(text).json())
        };
        let js = |value: Option<&JsString>| value.map_or("null".to_owned(), JsString::json);
        format!(
            r#"{{"provider":"{}","sourceUrl":{},"embedUrl":{},"embedHtml":{},"contentId":{},"providerContentId":{},"title":{},"authorName":{}}}"#,
            self.provider.as_str(),
            text(Some(&self.source_url)),
            text(self.embed_url.as_deref()),
            text(self.embed_html.as_deref()),
            text(self.content_id.as_deref()),
            text(self.provider_content_id.as_deref()),
            js(self.title.as_ref()),
            js(self.author_name.as_ref()),
        )
    }
}

#[derive(Clone)]
pub struct OEmbed(Arc<Inner>);

struct Inner {
    http: Http,
    cache: Arc<FetchCache>,
    graph_version: String,
}

impl OEmbed {
    pub fn new(config: &Config) -> Result<Self, String> {
        Self::build(
            config.oembed_test_origin.as_deref(),
            config.radar.graph_api_version.as_deref(),
        )
    }

    /// `graph_version` is `META_GRAPH_API_VERSION` as set: kept only when it
    /// looks like `v<digits>.<digits>`, else `v25.0`.
    fn build(test_origin: Option<&str>, graph_version: Option<&str>) -> Result<Self, String> {
        Ok(Self(Arc::new(Inner {
            http: Http::new(test_origin)?,
            cache: Arc::default(),
            graph_version: graph_version
                .filter(|version| is_graph_version(version))
                .unwrap_or(DEFAULT_GRAPH_VERSION)
                .to_owned(),
        })))
    }

    /// `revalidatePath("/", "layout")` as it reaches this cache.
    pub fn expire_all(&self) {
        self.0.cache.expire_all();
    }

    /// `fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeout) })`.
    pub async fn fetch_no_store(
        &self,
        url: &Url,
        timeout: Duration,
    ) -> Result<Fetched, FetchError> {
        self.0.http.get(url, true, Instant::now() + timeout).await
    }

    /// `getOEmbed(rawUrl)`.
    pub async fn get(&self, raw_url: &str) -> Result<OEmbedResult, Failure> {
        let target = target::parse_target(raw_url).map_err(Failure::OEmbed)?;
        match target.provider {
            Provider::Youtube => self.youtube(&target).await,
            Provider::Tiktok => self.tiktok(&target).await,
            _ => self.meta(&target).await,
        }
    }

    async fn youtube(&self, target: &Target) -> Result<OEmbedResult, Failure> {
        let id = target.youtube_id.clone().unwrap_or_default();
        let canonical = format!("https://www.youtube.com/watch?v={id}");
        let endpoint = endpoint(
            "https://www.youtube.com/oembed",
            &[("url", &canonical), ("format", "json")],
        );
        let data = self.read(&endpoint, target.provider).await?;
        Ok(OEmbedResult {
            provider: Provider::Youtube,
            source_url: target.source_url.clone(),
            embed_url: Some(format!("https://www.youtube-nocookie.com/embed/{id}?rel=0")),
            embed_html: None,
            content_id: Some(id),
            provider_content_id: None,
            title: safe_text(field(&data, "title")),
            author_name: safe_text(field(&data, "author_name")),
        })
    }

    async fn tiktok(&self, target: &Target) -> Result<OEmbedResult, Failure> {
        let endpoint = endpoint(
            "https://www.tiktok.com/oembed",
            &[("url", &target.source_url)],
        );
        let data = self.read(&endpoint, target.provider).await?;
        let provider_content_id = field(&data, "html")
            .and_then(Value::as_str)
            .and_then(tiktok_response_id);
        // Final TikTok URLs carry the ID; short links fall back to the HTML's.
        let id = tiktok_id(&target.url)
            .or_else(|| provider_content_id.clone())
            .ok_or_else(|| {
                Failure::OEmbed(oembed_error(
                    "TikTok 게시물 ID를 확인하지 못했습니다.",
                    UPSTREAM_ERROR,
                    502,
                ))
            })?;
        Ok(OEmbedResult {
            provider: Provider::Tiktok,
            source_url: target.source_url.clone(),
            embed_url: Some(format!(
                "https://www.tiktok.com/player/v1/{id}?description=1&music_info=1"
            )),
            embed_html: None,
            content_id: Some(id),
            provider_content_id,
            title: safe_text(field(&data, "title")),
            author_name: safe_text(field(&data, "author_name")),
        })
    }

    async fn meta(&self, target: &Target) -> Result<OEmbedResult, Failure> {
        let meta_endpoint = target.meta_endpoint.unwrap_or(MetaEndpoint::OembedPost);
        let base = if target.provider == Provider::Threads {
            "https://graph.threads.net/v1.0/oembed".to_owned()
        } else {
            format!(
                "https://graph.facebook.com/{}/{}",
                self.0.graph_version,
                meta_endpoint.as_str()
            )
        };
        let endpoint = endpoint(
            &base,
            &[
                ("url", &target.source_url),
                ("maxwidth", "658"),
                ("omitscript", "true"),
            ],
        );
        let data = self.read(&endpoint, target.provider).await?;
        let title = safe_text(field(&data, "title"));
        let author_name = safe_text(field(&data, "author_name"));
        if target.provider == Provider::Threads {
            return threads(target, &data, title, author_name);
        }
        let instagram = target.provider == Provider::Instagram;
        let parts = instagram_parts(target.url.path());
        let embed_url = match (instagram, parts) {
            (true, Some((kind, code))) => {
                format!("https://www.instagram.com/{kind}/{code}/embed/captioned/")
            }
            (true, None) => {
                return Err(Failure::OEmbed(target::oembed_error(
                    "Instagram URL을 해석하지 못했습니다.",
                    target::INVALID_URL,
                    400,
                )));
            }
            (false, _) => facebook_embed_url(
                &target.source_url,
                meta_endpoint == MetaEndpoint::OembedVideo,
            ),
        };
        Ok(OEmbedResult {
            provider: target.provider,
            source_url: target.source_url.clone(),
            embed_url: Some(embed_url),
            embed_html: None,
            content_id: parts.filter(|_| instagram).map(|(_, code)| code.to_owned()),
            provider_content_id: None,
            title,
            author_name,
        })
    }

    /// `fetch(endpoint, { next: { revalidate: 3_600 }, signal })` then
    /// `readJson(response, provider)`.
    async fn read(&self, endpoint: &Url, provider: Provider) -> Result<Value, Failure> {
        let fetched = self.cached_fetch(endpoint).await.map_err(Failure::Fetch)?;
        read_json(&fetched, provider)
    }

    async fn cached_fetch(&self, endpoint: &Url) -> Result<Fetched, FetchError> {
        // The signal is made before `fetch` waits for the cache lock.
        let deadline = Instant::now() + TIMEOUT;
        let key = endpoint.to_string();
        let lock = self.0.cache.lock(&key).await;
        match self.0.cache.get(&key) {
            Lookup::Fresh(fetched) => Ok(fetched),
            Lookup::Stale(fetched) => {
                drop(lock);
                let (inner, endpoint) = (self.0.clone(), endpoint.clone());
                tokio::spawn(async move {
                    let deadline = Instant::now() + REFRESH_TIMEOUT;
                    if let Ok(fresh) = inner.http.get(&endpoint, false, deadline).await {
                        inner.cache.put(&key, &fresh);
                    }
                });
                Ok(fetched)
            }
            Lookup::Miss => {
                let fetched = self.0.http.get(endpoint, false, deadline).await?;
                self.0.cache.put(&key, &fetched);
                Ok(fetched)
            }
        }
    }
}

/// The Threads answer: its HTML is required, whole.
fn threads(
    target: &Target,
    data: &Value,
    title: Option<JsString>,
    author_name: Option<JsString>,
) -> Result<OEmbedResult, Failure> {
    let html = field(data, "html").and_then(Value::as_str).filter(|html| {
        let units = JsString::from(*html);
        !units.trim().is_empty() && units.len() <= 50_000
    });
    let Some(html) = html else {
        return Err(Failure::OEmbed(oembed_error(
            "Threads 임베드 HTML을 확인하지 못했습니다.",
            UPSTREAM_ERROR,
            502,
        )));
    };
    Ok(OEmbedResult {
        provider: Provider::Threads,
        source_url: target.source_url.clone(),
        embed_url: None,
        embed_html: Some(html.to_owned()),
        content_id: threads_id(target.url.path()),
        provider_content_id: None,
        title,
        author_name,
    })
}

fn is_graph_version(version: &str) -> bool {
    let Some((major, minor)) = version
        .strip_prefix('v')
        .and_then(|rest| rest.split_once('.'))
    else {
        return false;
    };
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit());
    digits(major) && digits(minor)
}

/// `new URL(base)` with `searchParams.set(name, value)` for each pair.
fn endpoint(base: &str, pairs: &[(&str, &str)]) -> Url {
    let mut url = Url::parse(base).expect("a fixed endpoint");
    url.query_pairs_mut().extend_pairs(pairs);
    url
}

/// `https://www.facebook.com/plugins/<post|video>.php?href=…&show_text=true&width=658`.
fn facebook_embed_url(source_url: &str, is_video: bool) -> String {
    let page = if is_video { "video.php" } else { "post.php" };
    endpoint(
        &format!("https://www.facebook.com/plugins/{page}"),
        &[
            ("href", source_url),
            ("show_text", "true"),
            ("width", "658"),
        ],
    )
    .to_string()
}

/// `/data-video-id=["'](\d+)["']/`.
fn tiktok_response_id(html: &str) -> Option<String> {
    html.match_indices("data-video-id=").find_map(|(at, word)| {
        let rest = html[at + word.len()..].strip_prefix(['"', '\''])?;
        let end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        (end > 0 && rest[end..].starts_with(['"', '\''])).then(|| rest[..end].to_owned())
    })
}

/// `safeText(value)`: a string with text left after trimming, trimmed and
/// cut to 500 UTF-16 units.
fn safe_text(value: Option<&Value>) -> Option<JsString> {
    let trimmed = JsString::from(value?.as_str()?).trim();
    (!trimmed.is_empty()).then(|| trimmed.prefix(500))
}

/// `data.key` where `data` came from `readJson`: only objects have fields.
fn field<'a>(data: &'a Value, key: &str) -> Option<&'a Value> {
    data.as_object()?.get(key)
}

fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|n| n != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

/// `readJson(response, provider)` of `lib/oembed.ts`, except that a refusal
/// (not 2xx) is read only for its `error.message` (D2-13, PLAN.md R11): the
/// TypeScript parsed the body first, so an HTML 404 page was a `SyntaxError`
/// (502 on the route, a retry on the refresh) instead of a 404, and a body
/// that was a number or a string threw a `TypeError` on `"error" in data`.
fn read_json(fetched: &Fetched, provider: Provider) -> Result<Value, Failure> {
    let raw = bounded_text(fetched);
    let ok = (200..300).contains(&fetched.status);
    let data = if raw.is_empty() {
        Value::Null
    } else {
        match serde_json::from_str::<Value>(&raw) {
            Ok(data) => data,
            Err(error) if ok => return Err(Failure::Error(syntax_error(&raw, error.to_string()))),
            Err(_) => Value::Null,
        }
    };
    if ok && truthy(&data) {
        return Ok(data);
    }
    let error = field(&data, "error");
    let detail = error
        .and_then(|error| field(error, "message"))
        .and_then(Value::as_str);
    // Meta answers a missing Instagram post with a 400 of its own.
    let number = |key| {
        error
            .and_then(|error| field(error, key))
            .and_then(Value::as_f64)
    };
    let missing_instagram = provider == Provider::Instagram
        && fetched.status == 400
        && number("code") == Some(24.0)
        && number("error_subcode") == Some(2_207_045.0);
    let status = if fetched.status == 404 || missing_instagram {
        404
    } else {
        502
    };
    Err(Failure::OEmbed(oembed_error(
        detail.unwrap_or(UPSTREAM_FAILED),
        UPSTREAM_ERROR,
        status,
    )))
}

/// The message of `JSON.parse(text)`'s `SyntaxError` as V8 words it when
/// the text cannot start a value (an HTML error page, say): the token and up
/// to ten UTF-16 units of context on each side. Other syntax errors keep
/// `fallback`, serde_json's wording (PLAN.md, R11).
fn syntax_error(text: &str, fallback: String) -> String {
    const CONTEXT: usize = 10;
    let Some((at, token)) = text
        .char_indices()
        .find(|(_, c)| !matches!(c, ' ' | '\t' | '\n' | '\r'))
    else {
        return "Unexpected end of JSON input".to_owned();
    };
    if matches!(token, '{' | '[' | '"' | '-' | '0'..='9' | 't' | 'f' | 'n') {
        return fallback;
    }
    let units = JsString::from(text);
    let (position, length) = (text[..at].encode_utf16().count(), units.len());
    let part = |start: usize, end: usize| {
        String::from_utf16_lossy(units.slice(start, end.min(length)).units())
    };
    let shown = if length < 2 * CONTEXT + 1 {
        format!("\"{text}\"")
    } else if position < CONTEXT {
        format!("\"{}\"...", part(0, position + CONTEXT))
    } else if position < length - CONTEXT {
        format!("...\"{}\"...", part(position - CONTEXT, position + CONTEXT))
    } else {
        format!("...\"{}\"", part(position - CONTEXT, length))
    };
    format!("Unexpected token '{token}', {shown} is not valid JSON")
}

/// `readBoundedText(response, 256 KiB).catch(() => "")`.
fn bounded_text(fetched: &Fetched) -> String {
    if let Some(declared) = fetched
        .content_length
        .as_deref()
        .filter(|declared| !declared.is_empty())
    {
        let too_large = std::str::from_utf8(declared)
            .ok()
            .filter(|text| text.bytes().all(|byte| byte.is_ascii_digit()))
            .and_then(|text| text.parse::<f64>().ok())
            .is_none_or(|length| length > MAX_TEXT_BYTES as f64);
        if too_large {
            return String::new();
        }
    }
    match &fetched.body {
        Some(body) if body.len() <= MAX_TEXT_BYTES => decode_text(body),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests;
