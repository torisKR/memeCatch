//! The metadata files of `app/`, which Next prerenders into routes:
//!
//! | id | route |
//! | --- | --- |
//! | `app-icons` | `/favicon.ico`, `/icon.svg`, `/apple-icon.png` (`app/favicon.ico` etc.) |
//! | `web-manifest` | `/manifest.webmanifest` (`app/manifest.ts`) |
//!
//! The icons are copies of the `app/` files in `assets/app/` (a test checks
//! they are the same bytes). Next sends them with the `next.config.ts`
//! `Cache-Control` of their extension.

use axum::Router;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE};
use axum::response::IntoResponse;
use axum::routing::get;

use super::Routes;
use crate::{AppState, next_rules};

const FAVICON: &[u8] = include_bytes!("../../assets/app/favicon.ico");
const ICON: &[u8] = include_bytes!("../../assets/app/icon.svg");
const APPLE_ICON: &[u8] = include_bytes!("../../assets/app/apple-icon.png");

/// `JSON.stringify(manifest())`, as Next serves it.
const MANIFEST: &str = r##"{"name":"밈캐치 — 그 밈, 3초 안에 알려드려요","short_name":"밈캐치","description":"요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지 알려드려요.","lang":"ko","dir":"ltr","start_url":"/","scope":"/","display":"standalone","orientation":"portrait","theme_color":"#ff5c38","background_color":"#fdfcfa","categories":["entertainment","education","social"],"icons":[{"src":"/icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"/icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"/icons/icon-maskable-192.png","sizes":"192x192","type":"image/png","purpose":"maskable"},{"src":"/icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}"##;

fn icon(path: &'static str, content_type: &'static str, bytes: &'static [u8]) -> impl IntoResponse {
    let cache = next_rules::config_cache_control(path).expect("an image extension");
    (
        [(CACHE_CONTROL, cache), (CONTENT_TYPE, content_type)],
        bytes,
    )
}

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add(
            "app-icons",
            "/favicon.ico",
            get(|| async { icon("/favicon.ico", "image/x-icon", FAVICON) }),
        )
        .add(
            "app-icons",
            "/icon.svg",
            get(|| async { icon("/icon.svg", "image/svg+xml", ICON) }),
        )
        .add(
            "app-icons",
            "/apple-icon.png",
            get(|| async { icon("/apple-icon.png", "image/png", APPLE_ICON) }),
        )
        .add(
            "web-manifest",
            "/manifest.webmanifest",
            get(|| async {
                (
                    [
                        (CACHE_CONTROL, "public, max-age=0, must-revalidate"),
                        (CONTENT_TYPE, "application/manifest+json"),
                    ],
                    MANIFEST,
                )
            }),
        )
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_manifest_is_valid_json() {
        let value: serde_json::Value = serde_json::from_str(MANIFEST).unwrap();
        assert_eq!(value["start_url"], "/");
    }
}
