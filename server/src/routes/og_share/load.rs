//! The photo's bytes (`loadSharePhoto` in `lib/meme-share-photo.ts`):
//!
//! - an `i.ytimg.com` still: `maxresdefault`, `sddefault`, then `hqdefault`
//!   of the same video, the first that prepares into a photo;
//! - a site path (or an absolute URL of the site, taken as its path): Next
//!   reads it from its `public/` directory or fetches it from `SITE_URL`,
//!   which in production is this server. Card art and rehosted thumbnails
//!   (`/api/media/meme-card-art/…`, `/api/media/meme-thumbs/…`) are read
//!   from storage under the key the media route reads; on the local
//!   backend an object not in this server's directory, and every other
//!   path, is asked of Next, which serves its own files.
//!
//! As `fetchPreparedPhoto` does: 1.5 s for the whole fetch, a 200 only (no
//! redirect is followed), at most 8 MB; anything else is no photo.

use std::time::Duration;

use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use futures_util::StreamExt;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use percent_encoding::percent_decode_str;

use super::photo_ref::{SiteHosts, canonical_share_image_url, youtube_candidates};
use crate::AppState;
use crate::og::Renderer;
use crate::og::photo::{MAX_BYTES, Prepared};

/// `SHARE_PHOTO_TIMEOUT_MS`.
const TIMEOUT: Duration = Duration::from_millis(1500);
const PUBLIC_MEDIA: [&str; 2] = ["meme-thumbs/", "meme-card-art/"];

#[derive(Clone)]
pub struct PhotoClient {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    /// `AXUM_TEST_OG_ORIGIN`: where requests for `i.ytimg.com` go in tests,
    /// under `/i.ytimg.com/<path>`.
    test_origin: Option<String>,
}

impl PhotoClient {
    pub fn new(test_origin: Option<&str>) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.enforce_http(false);
        http.set_connect_timeout(Some(TIMEOUT));
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for share photos: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            test_origin: test_origin.map(|origin| origin.trim_end_matches('/').to_owned()),
        })
    }

    /// `fetchPreparedPhoto`'s request and `readBoundedBody`.
    async fn get(&self, uri: String) -> Option<Vec<u8>> {
        let request = Request::builder()
            .method(Method::GET)
            .uri(uri)
            .header("accept", "*/*")
            .header("accept-language", "*")
            .header("sec-fetch-mode", "cors")
            .header("user-agent", "node")
            .body(Body::empty())
            .ok()?;
        let read = async {
            let response = self.client.request(request).await.ok()?;
            if response.status() != StatusCode::OK {
                return None;
            }
            let declared = response
                .headers()
                .get("content-length")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.trim().parse::<u64>().ok());
            if declared.is_some_and(|length| length > MAX_BYTES as u64) {
                return None;
            }
            read_bounded(Body::new(response.into_body())).await
        };
        tokio::time::timeout(TIMEOUT, read).await.ok().flatten()
    }

    fn youtube_uri(&self, url: &str) -> String {
        match (&self.test_origin, url.strip_prefix("https://")) {
            (Some(origin), Some(rest)) => format!("{origin}/{rest}"),
            _ => url.to_owned(),
        }
    }
}

/// The body, `None` past `MAX_BYTES` or on a broken stream.
async fn read_bounded(body: Body) -> Option<Vec<u8>> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.ok()?;
        if bytes.len() + chunk.len() > MAX_BYTES {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    Some(bytes)
}

/// The storage key of a public media path, as the media route reads it.
fn public_media_key(path: &str) -> Option<(String, String)> {
    let rest = path.strip_prefix("/api/media/")?;
    let segments: Option<Vec<String>> = rest
        .split('/')
        .map(|segment| {
            let decoded = percent_decode_str(segment).decode_utf8().ok()?;
            (!decoded.is_empty()).then(|| decoded.into_owned())
        })
        .collect();
    let key = segments?.join("/");
    let typed = key.rsplit_once('.').is_some_and(|(_, ext)| {
        ["gif", "jpeg", "jpg", "mp4", "png", "webm", "webp"]
            .contains(&ext.to_ascii_lowercase().as_str())
    });
    let public = PUBLIC_MEDIA.iter().any(|prefix| key.starts_with(prefix));
    if !typed || !public || key.contains("..") {
        return None;
    }
    let (bucket, name) = key.split_once('/')?;
    Some((bucket.to_owned(), name.to_owned()))
}

/// The bytes a site path answers with.
async fn site(state: &AppState, client: &PhotoClient, path_and_query: &str) -> Option<Vec<u8>> {
    let path = path_and_query.split('?').next().unwrap_or_default();
    if let Some((bucket, name)) = public_media_key(path) {
        let opened = tokio::time::timeout(TIMEOUT, state.storage.open_media_object(&bucket, &name))
            .await
            .ok()?;
        match opened {
            Ok(Some(object)) => {
                return tokio::time::timeout(TIMEOUT, read_bounded(object.body))
                    .await
                    .ok()
                    .flatten();
            }
            Ok(None) | Err(_) if !state.storage.is_local() => return None,
            _ => {}
        }
    }
    let upstream = format!("http://{}{path_and_query}", state.config.upstream);
    client.get(upstream).await
}

/// `loadSharePhoto(url)` with `prepareSharePhoto`, each prepare on the
/// renderer's blocking pool.
pub async fn photo(
    state: &AppState,
    client: &PhotoClient,
    renderer: &Renderer,
    url: &str,
    hosts: &SiteHosts,
) -> Prepared {
    if let Some(ladder) = youtube_candidates(url) {
        for candidate in ladder {
            let Some(bytes) = client.get(client.youtube_uri(&candidate)).await else {
                continue;
            };
            match renderer.prepare(bytes).await {
                Prepared::None => continue,
                found => return found,
            }
        }
        return Prepared::None;
    }
    let Some(canonical) = canonical_share_image_url(Some(url), hosts) else {
        return Prepared::None;
    };
    let path = if canonical.starts_with('/') {
        canonical
    } else {
        match url::Url::parse(&canonical) {
            Ok(parsed) => format!(
                "{}{}",
                parsed.path(),
                parsed.query().map(|q| format!("?{q}")).unwrap_or_default()
            ),
            Err(_) => return Prepared::None,
        }
    };
    match site(state, client, &path).await {
        Some(bytes) => renderer.prepare(bytes).await,
        None => Prepared::None,
    }
}
