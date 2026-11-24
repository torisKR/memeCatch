//! The three radar connectors of `lib/trend/radar-platform-connectors.server.ts`
//! (X recent search, Threads keyword search, Instagram hashtag search) and the
//! `fetch` they share.
//!
//! A signal keeps what `signalInsert` stores, with the policy
//! `runRadarConnectors` puts on X and Threads (`text_mention`, `link_only`,
//! metrics `{ volume: 1 }`, no metadata) already applied.
//!
//! Provider JSON is read with JavaScript's property semantics: reading a
//! property of `null` is a `TypeError` with V8's message, of any other
//! non-object it is `undefined`.
//!
//! ponytail: a `TypeError` that calls a non-function names the expression,
//! and Next's server bundle renames variables (`value` is `a`, `body.data` of
//! the X connector `k.data`). These messages carry the names of the Next 16.3.4
//! build parity was run against; another build may rename them (PLAN.md
//! section 15, as for the saved-state emails in section 5).

use axum::body::{Body, Bytes};
use axum::http::header::{
    ACCEPT, ACCEPT_LANGUAGE, AUTHORIZATION, CACHE_CONTROL, HeaderName, PRAGMA, USER_AGENT,
};
use axum::http::{Method, Request};
use futures_util::StreamExt;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use serde_json::Value;
use url::Url;

use super::radar_text::{hashtags, normalize_text, seeds};
use crate::config::RadarConfig;
use crate::routes::js_json;

/// A provider answer larger than this is a failure here; `response.json()`
/// has no limit (PLAN.md section 15).
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;
const DEFAULT_GRAPH_VERSION: &str = "v26.0";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Platform {
    X,
    Threads,
    Instagram,
}

impl Platform {
    pub fn key(self) -> &'static str {
        match self {
            Self::X => "x",
            Self::Threads => "threads",
            Self::Instagram => "instagram",
        }
    }
}

/// A collected signal, before `normalizeRadarSignal`.
pub struct RawSignal {
    pub platform: Platform,
    pub content_id: String,
    pub canonical_url: String,
    pub query_seed: Option<String>,
    pub text: Option<String>,
    pub hashtags: Vec<String>,
    /// `publishedAt` and `observedAt` as the provider gave them.
    pub published_at: Option<Value>,
    pub observed_at: Value,
    pub language: Option<String>,
    /// `metrics` and `metadata`, as JSON objects.
    pub metrics: Value,
    pub payload: Value,
}

impl RawSignal {
    /// `signalKind` and `rightsMode`.
    pub fn kind_and_rights(&self) -> (&'static str, &'static str) {
        match self.platform {
            Platform::X | Platform::Threads => ("text_mention", "link_only"),
            Platform::Instagram => ("instagram_media", "api_metadata"),
        }
    }
}

/// The metrics `runRadarConnectors` gives every X and Threads signal.
fn text_mention_metrics() -> Value {
    serde_json::json!({ "volume": 1 })
}

/// `metrics({ likes: item.like_count ?? 0, comments: item.comments_count ?? 0 })`:
/// `{ engagement: Math.min(100, Math.log1p(likes + comments) * 15) }`, where
/// a value that is not a finite number is stored as `null`, as
/// `JSON.stringify` writes it.
///
/// ponytail: a count is read as a number (`true` is 1, `null` or missing 0).
/// A string count, which the Graph API does not send, makes JavaScript's `+`
/// concatenate; here it is `NaN`, so `null`.
fn instagram_metrics(likes: Option<&Value>, comments: Option<&Value>) -> Value {
    let count = |value: Option<&Value>| match present(value) {
        None => 0.0,
        Some(Value::Number(number)) => number.as_f64().unwrap_or(f64::NAN),
        Some(Value::Bool(flag)) => f64::from(u8::from(*flag)),
        Some(_) => f64::NAN,
    };
    let engagement = (count(likes) + count(comments)).ln_1p() * 15.0;
    let engagement = if engagement.is_nan() {
        f64::NAN
    } else {
        engagement.min(100.0)
    };
    serde_json::json!({ "engagement": number_or_null(engagement) })
}

fn number_or_null(value: f64) -> Value {
    serde_json::Number::from_f64(value).map_or(Value::Null, Value::Number)
}

pub struct Collected {
    pub signals: Vec<RawSignal>,
    /// The connector's `cursor`; `None` is `null`/`undefined`.
    pub cursor: Option<Value>,
}

/// A thrown error: its `message`.
pub type Thrown = String;

/// The connectors `createConfiguredRadarConnectors` creates, in the order of
/// `RADAR_CONNECTOR_PLATFORMS`.
pub fn configured(config: &RadarConfig) -> Vec<Platform> {
    let set = |value: Option<&str>| value.is_some_and(|value| !value.trim().is_empty());
    let secret = |value: &Option<crate::config::Secret>| set(value.as_ref().map(|s| s.expose()));
    let mut platforms = Vec::new();
    if set(config.x_terms.as_deref()) && secret(&config.x_bearer_token) {
        platforms.push(Platform::X);
    }
    if set(config.threads_terms.as_deref()) && secret(&config.threads_access_token) {
        platforms.push(Platform::Threads);
    }
    if set(config.instagram_hashtags.as_deref())
        && secret(&config.instagram_access_token)
        && set(config.instagram_user_id.as_deref())
    {
        platforms.push(Platform::Instagram);
    }
    platforms
}

#[derive(Clone)]
pub struct RadarClient {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    test_origin: Option<String>,
}

impl RadarClient {
    pub fn new(test_origin: Option<&str>) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for the radar: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            test_origin: test_origin.map(|origin| origin.trim_end_matches('/').to_owned()),
        })
    }

    /// `json(request(url, { headers: { authorization }, cache: "no-store" }))`.
    async fn get_json(&self, url: &Url, token: &str) -> Result<Value, Thrown> {
        let mut target = url.clone();
        target.set_fragment(None);
        let uri = match &self.test_origin {
            Some(origin) => format!(
                "{origin}/{}{}",
                target.host_str().unwrap_or_default(),
                &target[url::Position::BeforePath..]
            ),
            None => target.to_string(),
        };
        // undici's headers, without `accept-encoding`: this client does not
        // decompress. `cache: "no-store"` adds the last two.
        let request = Request::builder()
            .method(Method::GET)
            .uri(uri)
            .header(AUTHORIZATION, format!("Bearer {token}"))
            .header(ACCEPT, "*/*")
            .header(ACCEPT_LANGUAGE, "*")
            .header(HeaderName::from_static("sec-fetch-mode"), "cors")
            .header(USER_AGENT, "node")
            .header(CACHE_CONTROL, "no-cache")
            .header(PRAGMA, "no-cache")
            .body(Body::empty())
            .map_err(|_| "fetch failed".to_owned())?;
        let response = self.client.request(request).await.map_err(|error| {
            tracing::warn!(%error, "radar request failed");
            "fetch failed".to_owned()
        })?;
        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status().as_u16()));
        }
        let body = read_body(Body::new(response.into_body()))
            .await
            .ok_or_else(|| "terminated".to_owned())?;
        parse_json(&body)
    }
}

async fn read_body(body: Body) -> Option<Bytes> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.ok()?;
        if bytes.len() + chunk.len() > MAX_BODY_BYTES {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    Some(Bytes::from(bytes))
}

/// `response.json()`: UTF-8 without a BOM, invalid bytes replaced, then
/// `JSON.parse`. V8's message for an empty body; other syntax errors carry
/// serde_json's message (PLAN.md section 15).
fn parse_json(body: &[u8]) -> Result<Value, Thrown> {
    let body = body.strip_prefix(b"\xef\xbb\xbf").unwrap_or(body);
    let text = String::from_utf8_lossy(body);
    if text
        .trim_matches(|c| matches!(c, ' ' | '\t' | '\n' | '\r'))
        .is_empty()
    {
        return Err("Unexpected end of JSON input".to_owned());
    }
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

/// `value.key` where `value` may be `undefined` (`None`).
fn prop<'a>(value: Option<&'a Value>, key: &str) -> Result<Option<&'a Value>, Thrown> {
    match value {
        None => Err(format!(
            "Cannot read properties of undefined (reading '{key}')"
        )),
        Some(Value::Null) => Err(format!("Cannot read properties of null (reading '{key}')")),
        Some(Value::Object(map)) => Ok(map.get(key)),
        Some(_) => Ok(None),
    }
}

/// `value?.key`.
fn optional_prop<'a>(value: Option<&'a Value>, key: &str) -> Option<&'a Value> {
    match value {
        Some(Value::Object(map)) => map.get(key),
        _ => None,
    }
}

/// `value ?? fallback` for a nullish `null`.
fn present(value: Option<&Value>) -> Option<&Value> {
    value.filter(|value| !value.is_null())
}

fn truthy(value: Option<&Value>) -> bool {
    match value {
        None | Some(Value::Null) => false,
        Some(Value::Bool(flag)) => *flag,
        Some(Value::Number(number)) => number.as_f64().is_some_and(|n| n != 0.0 && !n.is_nan()),
        Some(Value::String(text)) => !text.is_empty(),
        Some(_) => true,
    }
}

/// `(list ?? [])` as something `.map`/`.filter` can run on.
fn list<'a>(
    value: Option<&'a Value>,
    expression: &str,
    method: &str,
) -> Result<&'a [Value], Thrown> {
    match present(value) {
        None => Ok(&[]),
        Some(Value::Array(items)) => Ok(items),
        Some(_) => Err(format!("({expression} ?? []).{method} is not a function")),
    }
}

/// `String(value)` for a template literal.
fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_owned(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(number) => number.as_f64().map_or_else(String::new, js_json::number),
        Value::String(text) => text.clone(),
        Value::Array(items) => items
            .iter()
            .map(|item| {
                if item.is_null() {
                    String::new()
                } else {
                    js_string(item)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_owned(),
    }
}

/// `extractRadarHashtags(value)` with its `TypeError`s.
fn text_hashtags(value: Option<&Value>) -> Result<Vec<String>, Thrown> {
    match value {
        Some(Value::String(text)) => Ok(hashtags(text)),
        None => Err("Cannot read properties of undefined (reading 'normalize')".to_owned()),
        Some(Value::Null) => Err("Cannot read properties of null (reading 'normalize')".to_owned()),
        Some(_) => Err("a.normalize is not a function".to_owned()),
    }
}

fn text_of(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).map(str::to_owned)
}

/// `url.searchParams.set(name, value)` for each pair, in order.
fn with_params(mut url: Url, pairs: &[(&str, &str)]) -> Url {
    for (name, value) in pairs {
        let mut current: Vec<(String, String)> = url.query_pairs().into_owned().collect();
        match current.iter().position(|(key, _)| key == name) {
            Some(first) => {
                current[first].1 = (*value).to_owned();
                let mut index = 0;
                current.retain(|(key, _)| {
                    index += 1;
                    index - 1 == first || key != name
                });
            }
            None => current.push(((*name).to_owned(), (*value).to_owned())),
        }
        url.query_pairs_mut().clear().extend_pairs(current);
    }
    url
}

fn parse_url(text: &str) -> Result<Url, Thrown> {
    Url::parse(text).map_err(|_| "Invalid URL".to_owned())
}

/// What one connector's `collect` returns or throws.
pub async fn collect(
    client: &RadarClient,
    config: &RadarConfig,
    platform: Platform,
    cursor: Option<&str>,
    attempted_at: &str,
) -> Result<Collected, Thrown> {
    match platform {
        Platform::X => collect_x(client, config, cursor, attempted_at).await,
        Platform::Threads => collect_threads(client, config).await,
        Platform::Instagram => collect_instagram(client, config).await,
    }
}

fn required(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_owned()
}

async fn collect_x(
    client: &RadarClient,
    config: &RadarConfig,
    cursor: Option<&str>,
    attempted_at: &str,
) -> Result<Collected, Thrown> {
    let cursor_value = cursor.map(|cursor| Value::String(cursor.to_owned()));
    let terms = seeds(config.x_terms.as_deref(), 10);
    if terms.is_empty() {
        return Ok(Collected {
            signals: Vec::new(),
            cursor: cursor_value,
        });
    }
    let quoted: Vec<String> = terms.iter().map(|term| format!("\"{term}\"")).collect();
    let query = format!("({}) lang:ko -is:retweet -has:media", quoted.join(" OR "));
    let mut pairs = vec![
        ("query", query.as_str()),
        ("tweet.fields", "created_at,lang"),
        ("max_results", "25"),
    ];
    if let Some(cursor) = cursor.filter(|cursor| !cursor.is_empty()) {
        pairs.push(("since_id", cursor));
    }
    let url = with_params(
        parse_url("https://api.x.com/2/tweets/search/recent")?,
        &pairs,
    );
    let token = required(config.x_bearer_token.as_ref().map(|s| s.expose()));
    let body = client.get_json(&url, &token).await?;
    let body = Some(&body);
    let posts = list(prop(body, "data")?, "k.data", "map")?;
    let mut signals = Vec::with_capacity(posts.len());
    for post in posts {
        signals.push(x_signal(post, attempted_at)?);
    }
    let newest = present(optional_prop(optional_prop(body, "meta"), "newest_id")).cloned();
    Ok(Collected {
        signals,
        cursor: newest.or(cursor_value),
    })
}

fn x_signal(post: &Value, attempted_at: &str) -> Result<RawSignal, Thrown> {
    let post = Some(post);
    let id = prop(post, "id")?;
    let text = prop(post, "text")?;
    let hashtags = text_hashtags(text)?;
    let created_at = prop(post, "created_at")?;
    Ok(RawSignal {
        platform: Platform::X,
        content_id: id.map_or_else(|| "undefined".to_owned(), js_string),
        canonical_url: format!(
            "https://x.com/i/web/status/{}",
            id.map_or_else(|| "undefined".to_owned(), js_string)
        ),
        query_seed: None,
        text: text_of(text),
        hashtags,
        published_at: created_at.cloned(),
        observed_at: present(created_at)
            .cloned()
            .unwrap_or_else(|| Value::String(attempted_at.to_owned())),
        language: text_of(prop(post, "lang")?),
        metrics: text_mention_metrics(),
        payload: Value::Object(serde_json::Map::new()),
    })
}

async fn collect_threads(client: &RadarClient, config: &RadarConfig) -> Result<Collected, Thrown> {
    let token = required(config.threads_access_token.as_ref().map(|s| s.expose()));
    let mut signals = Vec::new();
    let (mut succeeded, mut last_error) = (0, None);
    for seed in seeds(config.threads_terms.as_deref(), 10) {
        match threads_seed(client, &token, &seed).await {
            Ok(found) => {
                signals.extend(found);
                succeeded += 1;
            }
            Err(error) => last_error = Some(error),
        }
    }
    match (succeeded, last_error) {
        (0, Some(error)) => Err(error),
        _ => Ok(Collected {
            signals,
            cursor: None,
        }),
    }
}

async fn threads_seed(
    client: &RadarClient,
    token: &str,
    seed: &str,
) -> Result<Vec<RawSignal>, Thrown> {
    let url = with_params(
        parse_url("https://graph.threads.com/v1.0/keyword_search")?,
        &[
            ("q", seed),
            ("search_type", "RECENT"),
            ("search_mode", "KEYWORD"),
            ("media_type", "TEXT"),
            ("fields", "id,text,media_type,permalink,timestamp"),
            ("limit", "100"),
        ],
    );
    let body = client.get_json(&url, token).await?;
    // `.filter(...)` over every post, then `.map(...)`.
    let mut kept = Vec::new();
    for post in list(prop(Some(&body), "data")?, "h.data", "filter")? {
        let post = Some(post);
        let kind = prop(post, "media_type")?;
        let text_kind =
            matches!(kind, Some(Value::String(kind)) if kind == "TEXT" || kind == "TEXT_POST");
        if text_kind
            && truthy(prop(post, "permalink")?)
            && truthy(prop(post, "text")?)
            && truthy(prop(post, "timestamp")?)
        {
            kept.push(post);
        }
    }
    let mut signals = Vec::with_capacity(kept.len());
    for post in kept {
        let (text, timestamp) = (prop(post, "text")?, prop(post, "timestamp")?.cloned());
        signals.push(RawSignal {
            platform: Platform::Threads,
            content_id: prop(post, "id")?.map_or_else(|| "undefined".to_owned(), js_string),
            canonical_url: prop(post, "permalink")?.map(js_string).unwrap_or_default(),
            query_seed: Some(seed.to_owned()),
            text: text_of(text),
            hashtags: text_hashtags(text)?,
            published_at: timestamp.clone(),
            observed_at: timestamp.unwrap_or(Value::Null),
            language: None,
            metrics: text_mention_metrics(),
            payload: Value::Object(serde_json::Map::new()),
        });
    }
    Ok(signals)
}

async fn collect_instagram(
    client: &RadarClient,
    config: &RadarConfig,
) -> Result<Collected, Thrown> {
    let token = required(config.instagram_access_token.as_ref().map(|s| s.expose()));
    let user_id = required(config.instagram_user_id.as_deref());
    let version = config
        .graph_api_version
        .as_deref()
        .map(str::trim)
        .filter(|version| !version.is_empty())
        .unwrap_or(DEFAULT_GRAPH_VERSION)
        .to_owned();
    let account = Account {
        client,
        token: &token,
        user_id: &user_id,
        version: &version,
    };
    let mut signals = Vec::new();
    let (mut succeeded, mut last_error) = (0, None);
    for seed in seeds(config.instagram_hashtags.as_deref(), 30) {
        match account.hashtag(&seed).await {
            Ok(found) => {
                signals.extend(found);
                succeeded += 1;
            }
            Err(error) => last_error = Some(error),
        }
    }
    match (succeeded, last_error) {
        (0, Some(error)) => Err(error),
        _ => Ok(Collected {
            signals,
            cursor: None,
        }),
    }
}

struct Account<'a> {
    client: &'a RadarClient,
    token: &'a str,
    user_id: &'a str,
    version: &'a str,
}

impl Account<'_> {
    /// One hashtag: its id, then its recent media.
    async fn hashtag(&self, seed: &str) -> Result<Vec<RawSignal>, Thrown> {
        let search = with_params(
            parse_url(&format!(
                "https://graph.facebook.com/{}/ig_hashtag_search",
                self.version
            ))?,
            &[("user_id", self.user_id), ("q", seed)],
        );
        let found = self.client.get_json(&search, self.token).await?;
        let first = match optional_prop_index(prop(Some(&found), "data")?) {
            Some(first) => optional_prop(Some(first), "id"),
            None => None,
        };
        if !truthy(first) {
            return Ok(Vec::new());
        }
        let id = js_string(first.expect("a truthy value is present"));
        let media = with_params(
            parse_url(&format!(
                "https://graph.facebook.com/{}/{id}/recent_media",
                self.version
            ))?,
            &[
                ("user_id", self.user_id),
                (
                    "fields",
                    "id,caption,media_type,permalink,timestamp,like_count,comments_count",
                ),
                ("limit", "50"),
            ],
        );
        let body = self.client.get_json(&media, self.token).await?;
        let mut kept = Vec::new();
        for item in list(prop(Some(&body), "data")?, "p.data", "filter")? {
            let item = Some(item);
            if truthy(prop(item, "permalink")?) && truthy(prop(item, "timestamp")?) {
                kept.push(item);
            }
        }
        let mut signals = Vec::with_capacity(kept.len());
        for item in kept {
            let caption = prop(item, "caption")?;
            let timestamp = prop(item, "timestamp")?.cloned();
            let empty = Value::String(String::new());
            signals.push(RawSignal {
                platform: Platform::Instagram,
                content_id: prop(item, "id")?.map_or_else(|| "undefined".to_owned(), js_string),
                canonical_url: prop(item, "permalink")?.map(js_string).unwrap_or_default(),
                query_seed: Some(seed.to_owned()),
                text: text_of(caption),
                hashtags: text_hashtags(Some(present(caption).unwrap_or(&empty)))?,
                published_at: timestamp.clone(),
                observed_at: timestamp.unwrap_or(Value::Null),
                language: None,
                metrics: instagram_metrics(prop(item, "like_count")?, prop(item, "comments_count")?),
                payload: serde_json::json!({
                    "media_type": present(prop(item, "media_type")?).cloned().unwrap_or(Value::Null),
                }),
            });
        }
        Ok(signals)
    }
}

/// `value?.[0]` for `search.data`.
fn optional_prop_index(value: Option<&Value>) -> Option<&Value> {
    match value {
        Some(Value::Array(items)) => items.first(),
        Some(Value::Object(map)) => map.get("0"),
        _ => None,
    }
}

/// The text `normalizeRadarSignal` hashes, for the signal insert.
pub fn normalized_text(signal: &RawSignal) -> String {
    normalize_text(signal.text.as_deref().unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_params_set_replaces_or_appends() {
        let url = Url::parse("https://a.example/p?q=1&x=2&q=3").expect("a URL");
        let url = with_params(url, &[("q", "a b"), ("y", "(\"t\") OR ,")]);
        assert_eq!(
            url.as_str(),
            "https://a.example/p?q=a+b&x=2&y=%28%22t%22%29+OR+%2C"
        );
    }

    #[test]
    fn json_reads_like_response_json() {
        assert_eq!(parse_json(b"").unwrap_err(), "Unexpected end of JSON input");
        assert_eq!(
            parse_json(b" \n").unwrap_err(),
            "Unexpected end of JSON input"
        );
        assert_eq!(
            parse_json(b"\xef\xbb\xbf{\"a\":1}").expect("json"),
            serde_json::json!({ "a": 1 })
        );
    }

    #[test]
    fn properties_read_as_javascript_does() {
        let null = Value::Null;
        assert_eq!(
            prop(Some(&null), "data").unwrap_err(),
            "Cannot read properties of null (reading 'data')"
        );
        assert_eq!(
            prop(Some(&Value::Bool(true)), "data").expect("undefined"),
            None
        );
        assert_eq!(
            js_string(&serde_json::json!([1, null, "a", [2.5]])),
            "1,,a,2.5"
        );
        assert!(!truthy(Some(&serde_json::json!(0))));
        assert!(truthy(Some(&serde_json::json!([]))));
    }
}
