//! The requests lib/tiktok-auth.server.ts sends TikTok: the token exchange
//! (`exchangeCode`), the profile (`fetchTikTokUser`) and the video list
//! (`importTikTokVideosAsSubmissions`), each as `fetch` sends it (method,
//! `content-type`, body; `accept: */*`) and stopped after 10 s
//! (`AbortSignal.timeout(10_000)`). With `AXUM_TEST_OAUTH_ORIGIN` they go to
//! that loopback origin instead, path and query kept.
//!
//! `Err(())` is every case where the TypeScript throws: no answer, a status
//! that is not 2xx, a body without the fields it needs, and a field of a type
//! TikTok does not send (PLAN.md A4-6).

use std::time::Duration;

use axum::body::Body;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::{Method, Request};
use serde_json::Value;

use super::super::oauth::http::{Fetched, HttpClient};
use super::super::oauth::providers::at_origin;
use crate::config::Config;
use crate::routes::public::js;

const TOKEN: &str = "https://open.tiktokapis.com/v2/oauth/token/";
const USER: &str =
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url";
/// `endpoint.searchParams.set("fields", "id,title,video_description,share_url")`.
const VIDEOS: &str =
    "https://open.tiktokapis.com/v2/video/list/?fields=id%2Ctitle%2Cvideo_description%2Cshare_url";
const TIMEOUT: Duration = Duration::from_secs(10);
/// `Number.MAX_SAFE_INTEGER`: an id up to this prints as JavaScript prints it.
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

/// `getTikTokRedirectUri()`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RedirectUri {
    Set(String),
    /// `null`: neither `TIKTOK_REDIRECT_URI` nor the site URL.
    Unset,
    /// `new URL("/auth/tiktok/callback", siteUrl)` throws: Next answers 500,
    /// so the request is Next's.
    Throws,
}

pub struct TikTok {
    pub client_key: Option<String>,
    client_secret: Option<String>,
    pub redirect_uri: RedirectUri,
    token_url: String,
    user_url: String,
    videos_url: String,
    client: HttpClient,
}

/// What `exchangeCode` returns.
pub struct Grant {
    pub access_token: String,
    pub open_id: String,
    pub scopes: Vec<String>,
}

/// A video `importTikTokVideosAsSubmissions` keeps.
#[derive(Debug, PartialEq, Eq)]
pub struct Video {
    pub source_url: String,
    pub name: String,
    pub description: String,
}

impl TikTok {
    pub fn new(config: &Config) -> Self {
        let tiktok = &config.tiktok;
        let origin = config.test_oauth_origin.as_deref();
        let redirect_uri = match (&tiktok.redirect_uri, &config.site_url_env) {
            (Some(uri), _) => RedirectUri::Set(uri.clone()),
            (None, Some(site)) if !site.is_empty() => url::Url::parse(site)
                .and_then(|site| site.join("/auth/tiktok/callback"))
                .map_or(RedirectUri::Throws, |uri| RedirectUri::Set(uri.into())),
            (None, _) => RedirectUri::Unset,
        };
        Self {
            client_key: tiktok.client_key.clone(),
            client_secret: tiktok
                .client_secret
                .as_ref()
                .map(|secret| secret.expose().to_owned()),
            redirect_uri,
            token_url: at_origin(TOKEN, origin),
            user_url: at_origin(USER, origin),
            videos_url: at_origin(VIDEOS, origin),
            client: HttpClient::new(),
        }
    }

    async fn fetch(&self, request: Request<Body>) -> Result<Fetched, ()> {
        match tokio::time::timeout(TIMEOUT, self.client.fetch(request)).await {
            Ok(Ok(fetched)) => Ok(fetched),
            Ok(Err(error)) => {
                tracing::warn!(%error, "a TikTok request failed");
                Err(())
            }
            Err(_) => {
                tracing::warn!("a TikTok request timed out");
                Err(())
            }
        }
    }

    /// `exchangeCode(code, redirectUri)`.
    pub async fn exchange(&self, code: &str, redirect_uri: &str) -> Result<Grant, ()> {
        let (Some(key), Some(secret)) = (&self.client_key, &self.client_secret) else {
            return Err(());
        };
        let form = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("client_key", key)
            .append_pair("client_secret", secret)
            .append_pair("code", code)
            .append_pair("grant_type", "authorization_code")
            .append_pair("redirect_uri", redirect_uri)
            .finish();
        let request = Request::builder()
            .method(Method::POST)
            .uri(&self.token_url)
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .header(ACCEPT, "*/*")
            .body(Body::from(form))
            .map_err(drop)?;
        let fetched = self.fetch(request).await?;
        let result = json(&fetched);
        let text = |key: &str| match result.as_ref().and_then(|result| result.get(key)) {
            Some(Value::String(text)) if !text.is_empty() => Ok(Some(text.clone())),
            None | Some(Value::Null | Value::Bool(false)) | Some(Value::String(_)) => Ok(None),
            Some(_) => Err(()),
        };
        let (Some(access_token), Some(open_id)) = (text("access_token")?, text("open_id")?) else {
            return Err(());
        };
        if !fetched.ok() {
            return Err(());
        }
        // `(result.scope ?? "").split(",").map(trim).filter(Boolean)`.
        let scopes: Vec<String> = match result.as_ref().and_then(|result| result.get("scope")) {
            None | Some(Value::Null) => Vec::new(),
            Some(Value::String(scope)) => scope
                .split(',')
                .map(js::trim)
                .filter(|scope| !scope.is_empty())
                .map(str::to_owned)
                .collect(),
            Some(_) => return Err(()),
        };
        if !scopes.iter().any(|scope| scope == "user.info.basic") {
            return Err(());
        }
        Ok(Grant {
            access_token,
            open_id,
            scopes,
        })
    }

    /// `fetchTikTokUser(accessToken, expectedOpenId)`: the trimmed display
    /// name, if TikTok gave one.
    pub async fn display_name(
        &self,
        access_token: &str,
        expected_open_id: &str,
    ) -> Result<Option<String>, ()> {
        let request = Request::builder()
            .uri(&self.user_url)
            .header(AUTHORIZATION, format!("Bearer {access_token}"))
            .header(ACCEPT, "*/*")
            .body(Body::empty())
            .map_err(drop)?;
        let fetched = self.fetch(request).await?;
        let result = json(&fetched);
        let user = result
            .as_ref()
            .and_then(|result| result.get("data"))
            .and_then(|data| data.get("user"));
        let open_id = user.and_then(|user| user.get("open_id"));
        if !fetched.ok() || open_id != Some(&Value::String(expected_open_id.to_owned())) {
            return Err(());
        }
        match user.and_then(|user| user.get("display_name")) {
            None | Some(Value::Null) => Ok(None),
            Some(Value::String(name)) => Ok(Some(js::trim(name).to_owned())),
            Some(_) => Err(()),
        }
    }

    /// The fetch and the candidates of `importTikTokVideosAsSubmissions`.
    pub async fn videos(&self, access_token: &str) -> Result<Vec<Video>, ()> {
        let request = Request::builder()
            .method(Method::POST)
            .uri(&self.videos_url)
            .header(AUTHORIZATION, format!("Bearer {access_token}"))
            .header(CONTENT_TYPE, "application/json")
            .header(ACCEPT, "*/*")
            .body(Body::from(r#"{"max_count":20}"#))
            .map_err(drop)?;
        let fetched = self.fetch(request).await?;
        let result = json(&fetched);
        let code = result
            .as_ref()
            .and_then(|result| result.get("error"))
            .and_then(|error| error.get("code"));
        let refused = code.is_some_and(|code| truthy(code) && code != "ok");
        if !fetched.ok() || refused {
            return Err(());
        }
        let videos = result
            .as_ref()
            .and_then(|result| result.get("data"))
            .and_then(|data| data.get("videos"));
        match videos {
            None | Some(Value::Null) => Ok(Vec::new()),
            Some(Value::Array(videos)) => candidates(videos),
            Some(_) => Err(()),
        }
    }
}

/// `response.json().catch(() => null)`, whatever the content type.
fn json(fetched: &Fetched) -> Option<Value> {
    serde_json::from_slice(&fetched.body).ok()
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

/// `videos.flatMap(...)`: the videos with an id and a public TikTok URL.
fn candidates(videos: &[Value]) -> Result<Vec<Video>, ()> {
    let mut kept = Vec::new();
    for video in videos {
        // `video.id` of `null` throws; of a number, string or array it is
        // `undefined`.
        let fields = match video {
            Value::Null => return Err(()),
            Value::Object(fields) => fields,
            _ => continue,
        };
        let Some(id) = fields.get("id").filter(|id| truthy(id)) else {
            continue;
        };
        let Some(Value::String(source_url)) = fields.get("share_url") else {
            continue;
        };
        if !is_public_tiktok_url(source_url) {
            continue;
        }
        let id = match id {
            Value::String(id) => id.clone(),
            Value::Number(id) => match id.as_i64() {
                Some(id) if id.abs() <= MAX_SAFE_INTEGER => id.to_string(),
                _ => return Err(()),
            },
            _ => return Err(()),
        };
        let name = trimmed(fields.get("title"), 100)?.unwrap_or(format!("TikTok 영상 {id}"));
        let description = trimmed(fields.get("video_description"), 2_000)?.unwrap_or_else(|| {
            "TikTok에서 본인 계정이 video.list 권한으로 가져온 공개 영상입니다.".to_owned()
        });
        kept.push(Video {
            source_url: source_url.clone(),
            name,
            description,
        });
    }
    Ok(kept)
}

/// `value?.trim().slice(0, max) || …`: `None` for the fallback.
fn trimmed(value: Option<&Value>, max: usize) -> Result<Option<String>, ()> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => {
            Ok(Some(slice_utf16(js::trim(text), max)).filter(|text| !text.is_empty()))
        }
        Some(_) => Err(()),
    }
}

/// `isPublicTikTokUrl(value)`.
fn is_public_tiktok_url(value: &str) -> bool {
    if value.is_empty() || js::utf16_len(value) > 500 {
        return false;
    }
    url::Url::parse(value).is_ok_and(|url| {
        url.scheme() == "https"
            && url
                .host_str()
                .is_some_and(|host| host == "tiktok.com" || host.ends_with(".tiktok.com"))
    })
}

/// `text.slice(0, max)` in UTF-16 units. A cut through a surrogate pair
/// leaves a lone surrogate, which Node writes to Postgres as U+FFFD.
pub fn slice_utf16(text: &str, max: usize) -> String {
    let mut out = String::new();
    let mut units = 0;
    for c in text.chars() {
        let width = c.len_utf16();
        if units + width > max {
            if units < max {
                out.push('\u{fffd}');
            }
            break;
        }
        out.push(c);
        units += width;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn text_is_cut_in_utf16_units() {
        // The name the Next build stored for this display name (PLAN.md A4).
        let name = js::trim("  틱톡 사용자 😀😀😀😀😀😀😀😀😀😀😀😀  ");
        assert_eq!(slice_utf16(name, 20), "틱톡 사용자 😀😀😀😀😀😀\u{fffd}");
        assert_eq!(slice_utf16("abc", 20), "abc");
        assert_eq!(slice_utf16("😀😀", 2), "😀");
        assert_eq!(slice_utf16("😀😀", 3), "😀\u{fffd}");
    }

    #[test]
    fn only_https_urls_on_tiktok_are_public() {
        for public in [
            "https://www.tiktok.com/@a/video/1",
            "https://tiktok.com/x",
            "https://M.TikTok.com/v/3",
        ] {
            assert!(is_public_tiktok_url(public), "{public}");
        }
        for not in [
            "http://www.tiktok.com/x",
            "https://tiktok.com.evil.example/",
            "https://eviltiktok.com/",
            "https://tiktok.com./x",
            "not a url",
            "",
            &format!("https://tiktok.com/{}", "a".repeat(500)),
        ] {
            assert!(!is_public_tiktok_url(not), "{not}");
        }
    }

    #[test]
    fn candidates_are_kept_as_the_import_keeps_them() {
        let videos = json!([
            {"id": "v1", "title": " t1 ", "share_url": "https://www.tiktok.com/@a/video/1"},
            {"id": "v2", "share_url": "http://www.tiktok.com/x"},
            {"id": 7, "title": "", "video_description": "  d  ", "share_url": "https://m.tiktok.com/v/3"},
            {"id": "", "share_url": "https://www.tiktok.com/4"},
            "not an object",
            {"id": "v5", "share_url": 5},
        ]);
        let kept = candidates(videos.as_array().expect("array")).expect("kept");
        let default = "TikTok에서 본인 계정이 video.list 권한으로 가져온 공개 영상입니다.";
        assert_eq!(
            kept,
            [
                Video {
                    source_url: "https://www.tiktok.com/@a/video/1".into(),
                    name: "t1".into(),
                    description: default.into(),
                },
                Video {
                    source_url: "https://m.tiktok.com/v/3".into(),
                    name: "TikTok 영상 7".into(),
                    description: "d".into(),
                },
            ]
        );
        // Where the TypeScript throws.
        assert!(candidates(&[Value::Null]).is_err());
        assert!(
            candidates(&[json!({"id": "x", "title": 1, "share_url": "https://tiktok.com/"})])
                .is_err()
        );
    }
}
