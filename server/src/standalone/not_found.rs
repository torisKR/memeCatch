//! The two 404 documents of a path no route answers.
//!
//! - `Global` (`app/global-not-found.tsx`): the not-found panel alone, no
//!   site frame, `private, no-cache, no-store, ...`.
//! - `Locale` (`app/[locale]/not-found.tsx`), for a path shaped like a
//!   locale home (`/nope`): `pages::not_found`, the same panel in the site
//!   frame, as the missing meme page. `prerendered` gives it
//!   `s-maxage=3600, ...`.
//!
//! The site's `Cache-Control` for the path wins over the prerendered one
//! (`/nope.png`, `/icons`).

use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE, VARY};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use maud::{DOCTYPE, html};

use crate::AppState;
use crate::next_rules;
use crate::pages::document::{
    GOOGLE_SITE_VERIFICATION, NAVER_SITE_VERIFICATIONS, ShareImage, Site,
};
use crate::pages::{not_found, retired};

pub(crate) const TITLE: &str = "페이지를 찾을 수 없어요 | 밈캐치";
const DESCRIPTION: &str = "요청한 밈캐치 페이지를 찾을 수 없습니다.";
// `app/opengraph-image.tsx` with the hash its URL carries.
const ROOT_SHARE_IMAGE: &str = "/opengraph-image?6d5c08465b269db5";
const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
const PRERENDERED: &str = "s-maxage=3600, stale-while-revalidate=31532400";
const PAGE_VARY: &str = "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding";

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Variant {
    Global,
    /// `[locale]`'s, prerendered when the path has one segment.
    Locale {
        prerendered: bool,
    },
}

pub fn response(state: &AppState, variant: Variant, path: &str, target: &str) -> Response {
    let site = &state.pages.site;
    let mut response = match variant {
        Variant::Global => (StatusCode::NOT_FOUND, global(site)).into_response(),
        Variant::Locale { .. } => not_found::locale_response(site, target),
    };
    let cache = match variant {
        Variant::Locale { prerendered: true } => {
            next_rules::config_cache_control(path).unwrap_or(PRERENDERED)
        }
        _ => NO_STORE,
    };
    let headers = response.headers_mut();
    headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("text/html; charset=utf-8"),
    );
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache));
    headers.insert(VARY, HeaderValue::from_static(PAGE_VARY));
    headers.remove(CONTENT_LANGUAGE);
    if next_rules::proxy_matches(path) {
        let query = target.split_once('?').map(|(_, query)| query);
        let language = retired::content_language(path, query);
        headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static(language));
    }
    state.native_headers.apply_config(headers);
    response
}

fn global(site: &Site) -> String {
    let image = ShareImage::site_default(site);
    let image_url = site.absolute(ROOT_SHARE_IMAGE);
    html! {
        (DOCTYPE)
        html lang="ko" dir="ltr" {
            head {
                meta charset="utf-8";
                meta name="viewport" content="width=device-width, initial-scale=1";
                link rel="stylesheet" href=(site.css_href);
                meta name="robots" content="noindex";
                title { (TITLE) }
                meta name="description" content=(DESCRIPTION);
                meta name="google-site-verification" content=(GOOGLE_SITE_VERIFICATION);
                @for value in NAVER_SITE_VERIFICATIONS {
                    meta name="naver-site-verification" content=(value);
                }
                @if let Some(client) = &site.adsense_client {
                    meta name="google-adsense-account" content=(client);
                }
                meta name="mobile-web-app-capable" content="yes";
                meta name="apple-mobile-web-app-title" content="MemeCatch";
                meta name="apple-mobile-web-app-status-bar-style" content="default";
                meta property="og:title" content=(TITLE);
                meta property="og:description" content=(DESCRIPTION);
                meta property="og:image" content=(image_url);
                meta property="og:image:type" content="image/png";
                meta property="og:image:width" content="1200";
                meta property="og:image:height" content="630";
                meta property="og:image:alt" content=(image.alt);
                meta name="twitter:card" content="summary_large_image";
                meta name="twitter:title" content=(TITLE);
                meta name="twitter:description" content=(DESCRIPTION);
                meta name="twitter:image" content=(image_url);
                meta name="twitter:image:alt" content=(image.alt);
                meta name="twitter:image:type" content="image/png";
                meta name="twitter:image:width" content="1200";
                meta name="twitter:image:height" content="630";
                link rel="manifest" href="/manifest.webmanifest";
                link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="16x16";
                link rel="icon" href="/icon.svg" type="image/svg+xml" sizes="any";
                link rel="apple-touch-icon" href="/apple-icon.png" type="image/png" sizes="180x180";
            }
            body class="theme-ink min-h-dvh bg-background text-foreground" {
                (not_found::main())
            }
        }
    }
    .into_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_global_document_has_the_metadata_of_global_not_found() {
        let site = Site {
            url: "https://catchmeme.com".to_owned(),
            ga_id: None,
            adsense_client: None,
            adsense_auto_ads: false,
            css_href: "/_axum/site.css".to_owned(),
            js_href: "/_axum/site.js".to_owned(),
            page_js: Vec::new(),
            page_css: Vec::new(),
        };
        let page = global(&site);
        assert!(page.contains("<title>페이지를 찾을 수 없어요 | 밈캐치</title>"));
        assert!(page.contains(r#"<meta name="robots" content="noindex">"#));
        assert!(page.contains("https://catchmeme.com/opengraph-image?6d5c08465b269db5"));
        assert!(page.contains("이 밈은... 아직 없네요"));
    }
}
