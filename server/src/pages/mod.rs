//! Pages this server renders itself, as finished HTML (Maud templates), in
//! place of a React server render. `docs/axum-migration/UI-PLAN.md` explains
//! the choice and lists what each page still leaves to Next.
//!
//! Route ids: `page-about`, `page-meme` and `page-assets` (the stylesheet,
//! the script and the frame in another language). A page route is off until
//! `AXUM_PAGE_ROUTES` names it (`routes::PAGE_ROUTE_IDS`), and
//! `AXUM_DISABLED_ROUTES` still switches it off.
//!
//! Only a plain document request is answered here. Next's own client router
//! asks for the same paths with an `RSC` header and expects a React payload,
//! so while Next serves the other pages those requests stay with it.

pub mod about;
pub mod cache;
pub mod chrome;
pub mod content_depth;
pub mod document;
pub mod i18n;
pub mod json_ld;
pub mod labels;
pub mod meme_detail;
pub mod not_found;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::extract::{Path, Query, Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use maud::Markup;
use sha2::{Digest, Sha256};

use self::cache::{Keyed, Timed};
use self::chrome::Frame;
use self::document::Site;
use self::i18n::Locale;
use crate::config::Config;
use crate::routes::Routes;
use crate::routes::public::www_to_upstream;
use crate::{AppState, proxy};

/// Built by `scripts/build-ui.mjs`: the stylesheet from `ui/site.css` and
/// `app/globals.css`, the script from `ui/*.js` and the `lib/` modules it uses.
const SITE_CSS: &str = include_str!("../../assets/site.css");
const SITE_JS: &str = include_str!("../../assets/site.js");
const ASSET_PREFIX: &str = "/_axum/";

// `Cache-Control` of a page Next renders on request.
const DYNAMIC_PAGE_CACHE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
// The file name carries a hash of the content, so it never changes.
const IMMUTABLE_ASSET_CACHE: &str = "public, max-age=31536000, immutable";
// `SITEMAP_CACHE_MS` in app/sitemap.ts keeps the same count for an hour.
// Nothing tells this process about an edit, so it asks again sooner.
const INDEXABLE_COUNT_TTL: Duration = Duration::from_secs(300);
// The frame in another language for one page (`GET /_axum/frame/{locale}`).
// It changes only with a deploy, which restarts the process.
const FRAME_FRAGMENT_TTL: Duration = Duration::from_secs(3600);
// Its key carries a path from the request, so the cap bounds what any number
// of paths can hold: about 30 KB a fragment, so some 130 of them.
const FRAME_FRAGMENT_MAX_BYTES: usize = 4 * 1024 * 1024;
// A path longer than this is not a page of this site.
const FRAME_PATH_MAX: usize = 2048;

/// What every native page needs besides the database. Cheap to clone.
#[derive(Clone)]
pub struct Pages(Arc<Shared>);

pub struct Shared {
    pub site: Site,
    css_name: String,
    js_name: String,
    /// How many memes the sitemap lists (`about.rs`).
    pub(self) indexable_count: Timed<i64>,
    /// Rendered frame fragments by (locale, path and query).
    frames: Keyed<(&'static str, String), Arc<str>>,
}

impl Pages {
    pub fn new(config: &Config) -> Self {
        let css_name = format!("site.{}.css", content_hash(SITE_CSS));
        let js_name = format!("site.{}.js", content_hash(SITE_JS));
        Self(Arc::new(Shared {
            site: Site {
                url: config.site_url.clone(),
                ga_id: config.ga_id.clone(),
                adsense_client: config.adsense_client.clone(),
                adsense_auto_ads: config.adsense_auto_ads,
                css_href: format!("{ASSET_PREFIX}{css_name}"),
                js_href: format!("{ASSET_PREFIX}{js_name}"),
            },
            css_name,
            js_name,
            indexable_count: Timed::new(INDEXABLE_COUNT_TTL),
            frames: Keyed::new(FRAME_FRAGMENT_TTL, FRAME_FRAGMENT_MAX_BYTES, |body| {
                body.len()
            }),
        }))
    }
}

impl std::ops::Deref for Pages {
    type Target = Shared;

    fn deref(&self) -> &Shared {
        &self.0
    }
}

fn content_hash(content: &str) -> String {
    hex::encode(&Sha256::digest(content.as_bytes())[..8])
}

pub fn router(state: &AppState) -> Router<AppState> {
    let pages = Routes::new(state)
        .add("page-about", "/about", get(about::page))
        .add("page-meme", "/memes/{key}", get(meme_detail::page))
        .build()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            documents_only,
        ))
        // Outermost: proxy.ts answers the www host before anything else.
        .layer(middleware::from_fn_with_state(
            state.clone(),
            www_to_upstream,
        ));
    let assets = Routes::new(state)
        .add("page-assets", "/_axum/{file}", get(asset))
        .add("page-assets", "/_axum/frame/{locale}", get(frame_fragment))
        .build();
    pages.merge(assets)
}

/// A navigation or a crawler's fetch: no `RSC` header, and `Sec-Fetch-Mode`
/// absent or `navigate`. `proxy.ts` uses the same test before it looks a meme
/// up, and Next answers an `RSC` request with a React payload, not HTML.
fn is_document_request(headers: &HeaderMap) -> bool {
    !headers.contains_key("rsc")
        && headers
            .get("sec-fetch-mode")
            .is_none_or(|mode| mode.as_bytes() == b"navigate")
}

async fn documents_only(State(state): State<AppState>, request: Request, next: Next) -> Response {
    if !is_document_request(request.headers()) {
        return proxy::forward(State(state), request).await;
    }
    next.run(request).await
}

/// The request target as received: path and query, still percent-encoded.
pub fn path_and_query(request: &Request) -> &str {
    request
        .uri()
        .path_and_query()
        .map_or_else(|| request.uri().path(), |target| target.as_str())
}

#[derive(serde::Deserialize)]
struct FrameQuery {
    path: String,
}

/// The frame of the page at `?path=` in another language, for the language
/// switch (`ui/locale.js`): `chrome::fragment` as JSON.
async fn frame_fragment(
    State(state): State<AppState>,
    Path(code): Path<String>,
    Query(query): Query<FrameQuery>,
) -> Response {
    let Some(locale) = Locale::get(&code) else {
        return StatusCode::NOT_FOUND.into_response();
    };
    let path = query.path;
    if !path.starts_with('/') || path.starts_with("//") || path.len() > FRAME_PATH_MAX {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let render = || async {
        let frame = Frame {
            locale,
            path_and_query: &path,
        };
        Ok::<_, std::convert::Infallible>(Arc::from(chrome::fragment(&frame).to_string()))
    };
    let Ok(body) = state
        .pages
        .frames
        .get_or_load((locale.code(), path.clone()), render)
        .await;
    (
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        body.to_string(),
    )
        .into_response()
}

/// A rendered document with the headers Next puts on a page.
pub fn html(status: StatusCode, document: Markup) -> Response {
    (
        status,
        [
            (CONTENT_TYPE, "text/html; charset=utf-8"),
            (CONTENT_LANGUAGE, "ko"),
            (CACHE_CONTROL, DYNAMIC_PAGE_CACHE),
        ],
        document.into_string(),
    )
        .into_response()
}

async fn asset(
    State(state): State<AppState>,
    Path(file): Path<String>,
    request: Request,
) -> Response {
    let (content_type, body) = if file == state.pages.css_name {
        ("text/css; charset=utf-8", SITE_CSS)
    } else if file == state.pages.js_name {
        ("text/javascript; charset=utf-8", SITE_JS)
    } else {
        // An older or unknown name: Next answers its own 404.
        return proxy::forward(State(state), request).await;
    };
    (
        [
            (CONTENT_TYPE, content_type),
            (CACHE_CONTROL, IMMUTABLE_ASSET_CACHE),
        ],
        body,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn only_navigations_and_plain_fetches_are_document_requests() {
        let with = |name: &'static str, value: &'static str| {
            let mut headers = HeaderMap::new();
            headers.insert(name, HeaderValue::from_static(value));
            is_document_request(&headers)
        };

        assert!(is_document_request(&HeaderMap::new()));
        assert!(with("sec-fetch-mode", "navigate"));
        assert!(!with("sec-fetch-mode", "cors"));
        assert!(!with("sec-fetch-mode", "no-cors"));
        assert!(!with("rsc", "1"));
    }

    #[test]
    fn asset_names_change_with_their_content() {
        assert_eq!(content_hash("a").len(), 16);
        assert_ne!(content_hash("a"), content_hash("b"));
    }
}
