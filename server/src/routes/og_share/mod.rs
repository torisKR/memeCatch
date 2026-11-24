//! The per-meme share cards (`lib/legacy-korean-meme-opengraph.tsx` and
//! `lib/legacy-locale-meme-opengraph.tsx`, both through
//! `respondWithShareCard` of `lib/meme-share-card.tsx`):
//!
//! | id | route |
//! | --- | --- |
//! | `og-meme` | `GET /memes/{key}/opengraph-image-k2cx9c` |
//! | `og-meme-locale` | `GET /{en,ja,zh,zh-tw}/memes/{key}/opengraph-image` |
//! | `meme-export` | `GET /memes/{key}/export` (`export.rs`) |
//!
//! No card (a missing meme, an untranslated one, a blank title) is the
//! locale's default card with `public, max-age=0, must-revalidate`; a drawn
//! card is a PNG, or the app's JPEG when the PNG is over 1 MB, with that
//! header when it shows a photo and `no-store` when not; a card that fails
//! is the default card with `no-store`. `HEAD` gets the same headers.
//!
//! A key that does not decode (a `%` that is not an escape) is a 404; text
//! a bundled font lacks gets the default card; a photo over the decode
//! budget or not decodable here is left out of the card. Other methods get
//! 405. The document locale is in `Content-Language`.

mod content;
mod export;
mod load;
pub mod photo_ref;

use std::sync::Arc;

use axum::Router;
use axum::body::Bytes;
use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use time::OffsetDateTime;

use self::content::ShareContent;
use self::load::PhotoClient;
use self::photo_ref::SiteHosts;
use super::Routes;
use super::og::Prerendered;
use crate::AppState;
use crate::og::photo::Prepared;
use crate::og::share_card::Locale;
use crate::og::{Renderer, ShareImage};
use crate::routes::request::decode_uri_component;

const KOREAN_SUFFIX: &str = "/opengraph-image-k2cx9c";
const LOCALE_SUFFIX: &str = "/opengraph-image";
const SEO_LOCALES: [Locale; 4] = [Locale::En, Locale::Ja, Locale::Zh, Locale::ZhTw];
/// `ogImageCacheControl()` in production.
const STANDARD: &str = "public, max-age=0, must-revalidate";
/// `SHARE_CARD_FALLBACK_CACHE_CONTROL`.
const SHORT: &str = "no-store";

struct Share {
    renderer: Renderer,
    defaults: Arc<Prerendered>,
    client: PhotoClient,
    hosts: SiteHosts,
}

pub fn router(
    state: &AppState,
    renderer: Renderer,
    defaults: Arc<Prerendered>,
) -> Router<AppState> {
    let client = match PhotoClient::new(state.config.og_test_origin.as_deref()) {
        Ok(client) => client,
        Err(error) => {
            tracing::error!(%error, "share cards are not served");
            return Router::new();
        }
    };
    let share = Arc::new(Share {
        renderer,
        defaults,
        client,
        hosts: SiteHosts::new(&state.config.site_url),
    });
    let korean = share.clone();
    let exporter = share.renderer.clone();
    let paths: Vec<String> = SEO_LOCALES
        .iter()
        .map(|l| format!("/{}/memes/{{key}}{LOCALE_SUFFIX}", l.code()))
        .collect();
    Routes::new(state)
        .add(
            "og-meme",
            &format!("/memes/{{key}}{KOREAN_SUFFIX}"),
            get(move |state: State<AppState>, request: Request| {
                korean_route(state, korean.clone(), request)
            }),
        )
        .add(
            "meme-export",
            "/memes/{key}/export",
            get(move |state: State<AppState>, request: Request| {
                export::export(state, exporter.clone(), request)
            }),
        )
        .add_all(
            "og-meme-locale",
            &paths,
            get(move |state: State<AppState>, request: Request| {
                locale_route(state, share.clone(), request)
            }),
        )
        .build()
}

/// `getDocumentLanguage`.
fn language(locale: Locale) -> &'static str {
    match locale {
        Locale::Zh => "zh-Hans",
        Locale::ZhTw => "zh-Hant",
        other => other.code(),
    }
}

/// The `[key]` segment, percent-decoded; `None` for one that does not decode.
fn key_param(path: &str, prefix: &str, suffix: &str) -> Option<String> {
    let raw = path.strip_prefix(prefix)?.strip_suffix(suffix)?;
    if raw.contains('%') {
        decode_uri_component(raw)
    } else {
        Some(raw.to_owned())
    }
}

fn now_ms() -> i64 {
    (OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as i64
}

fn image(body: Bytes, content_type: &'static str, cache: &'static str, locale: Locale) -> Response {
    let mut response =
        ([(CONTENT_TYPE, content_type), (CACHE_CONTROL, cache)], body).into_response();
    response
        .headers_mut()
        .insert(CONTENT_LANGUAGE, HeaderValue::from_static(language(locale)));
    response
}

/// `defaultCard(locale, kind)`.
async fn default_card(share: &Share, locale: Locale, cache: &'static str) -> Response {
    match share.defaults.png(locale.code()).await {
        Ok(body) => image(body, "image/png", cache, locale),
        Err(error) => {
            tracing::error!(%error, "default card render failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                [
                    (CONTENT_TYPE, "text/plain; charset=utf-8"),
                    (CACHE_CONTROL, "no-store"),
                ],
                "Internal Server Error",
            )
                .into_response()
        }
    }
}

/// `respondWithShareCard(locale, card)`.
async fn respond(
    state: State<AppState>,
    share: &Share,
    request: Request,
    locale: Locale,
    content: Option<ShareContent>,
) -> Response {
    let Some(ShareContent { card, photo }) = content else {
        return default_card(share, locale, STANDARD).await;
    };
    let prepared = match photo {
        Some(url) => load::photo(&state, &share.client, &share.renderer, &url, &share.hosts).await,
        None => Prepared::None,
    };
    let raster = match prepared {
        Prepared::Photo(raster) => Some(raster),
        Prepared::None => None,
        Prepared::Unsupported(reason) => {
            tracing::info!(
                reason,
                path = request.uri().path(),
                "share card photo not decoded: drawn without it"
            );
            None
        }
    };
    match share.renderer.share(card, raster).await {
        ShareImage::Image {
            body,
            content_type,
            photo,
        } => image(
            Bytes::from(body),
            content_type,
            if photo { STANDARD } else { SHORT },
            locale,
        ),
        ShareImage::Unsupported(reason) => {
            tracing::info!(
                reason,
                path = request.uri().path(),
                "share card not laid out: the default card"
            );
            default_card(share, locale, SHORT).await
        }
        ShareImage::Failed => default_card(share, locale, SHORT).await,
    }
}

async fn korean_route(state: State<AppState>, share: Arc<Share>, request: Request) -> Response {
    let Some(key) = key_param(request.uri().path(), "/memes/", KOREAN_SUFFIX) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let content = content::korean(&state.db, &key, &share.hosts, now_ms()).await;
    respond(state, &share, request, Locale::Ko, content).await
}

async fn locale_route(state: State<AppState>, share: Arc<Share>, request: Request) -> Response {
    let path = request.uri().path().to_owned();
    let Some((locale, key)) = SEO_LOCALES.iter().find_map(|locale| {
        let prefix = format!("/{}/memes/", locale.code());
        key_param(&path, &prefix, LOCALE_SUFFIX).map(|key| (*locale, key))
    }) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match content::translated(&state.db, &key, locale, &share.hosts, now_ms()).await {
        Ok(content) => respond(state, &share, request, locale, content).await,
        Err(error) => {
            tracing::warn!(%error, "translated share card read failed");
            default_card(&share, locale, SHORT).await
        }
    }
}
