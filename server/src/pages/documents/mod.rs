//! Batch B1: the static documents (`docs/axum-migration/UI-PLAN.md`). Next
//! prerenders each at build time, so they carry `Cache-Control:
//! s-maxage=31536000`, as Next's do. Route ids `page-contact`,
//! `page-editorial`, `page-guides`, `page-guide`, `page-privacy`, `page-terms`,
//! `page-offline`, `page-missing-meme` and (B2) `page-originals`.

pub mod contact;
pub mod editorial;
pub mod guides;
pub mod originals;
pub mod privacy;
pub mod terms;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, ShareImage, Site};
use super::{html_cached, not_found, path_and_query};
use crate::AppState;

/// `Cache-Control` of a page Next prerendered at build time.
pub const PRERENDERED_PAGE_CACHE: &str = "s-maxage=31536000";

/// The head of a page that sets `koreanPageShare`: its canonical, its share
/// card with the site image, and the four alternate locales when asked.
fn korean_share(
    site: &Site,
    title: &str,
    description: &str,
    path: &str,
    alternate_locales: bool,
) -> Head {
    Head {
        title: title.to_owned(),
        description: Some(description.to_owned()),
        canonical: Some(path.to_owned()),
        image: Some(ShareImage::site_default(site)),
        alternate_locales,
        ..Head::default()
    }
}

/// A prerendered Korean page with the frame around it.
fn respond(state: &AppState, request: &Request, head: Head, main: Markup) -> Response {
    let document = document::page(&state.pages.site, &head, path_and_query(request), main);
    html_cached(StatusCode::OK, PRERENDERED_PAGE_CACHE, document)
}

/// `GET /offline` (`app/(default)/offline/page.tsx`): the page the service
/// worker shows when a navigation fails. No share tags of its own, so the
/// layout's card.
pub async fn offline(State(state): State<AppState>, request: Request) -> Response {
    let head = Head {
        title: "오프라인".to_owned(),
        description: Some("네트워크 연결이 끊겨 있어요. 연결 후 다시 시도해 주세요.".to_owned()),
        robots: Some("noindex, nofollow"),
        site_card: true,
        ..Head::default()
    };
    respond(&state, &request, head, offline_main())
}

/// `GET /missing-public-meme`: the rewrite target `proxy.ts` uses for a
/// missing meme, asked for directly. Next answers its 404 document, as for
/// a missing meme (`not_found.rs`).
pub async fn missing_public_meme(State(state): State<AppState>, request: Request) -> Response {
    not_found::response(&state.pages.site, path_and_query(&request))
}

fn offline_main() -> Markup {
    html! {
        main class="mx-auto flex min-h-[60dvh] max-w-site flex-col items-center justify-center px-4 py-16 text-center" {
            div class="w-full max-w-md rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm" {
                span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent" {
                    svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                        line x1="2" y1="2" x2="22" y2="22" {}
                        path d="M8.5 16.5a5 5 0 0 1 7 0" {}
                        path d="M2 8.82a15 15 0 0 1 4.17-2.65" {}
                        path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" {}
                        path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" {}
                        path d="M5 13a10 10 0 0 1 5.24-2.76" {}
                        line x1="12" y1="20" x2="12.01" y2="20" {}
                    }
                }
                h1 class="mt-5 text-2xl font-extrabold tracking-tight" { "지금은 오프라인이에요" }
                p class="mt-3 text-base leading-relaxed text-muted" { "네트워크 연결이 끊겨 페이지를 불러오지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요." }
                a href="/" class="mt-6 inline-flex items-center justify-center rounded-full bg-accent-soft px-5 py-2.5 text-sm font-semibold text-accent" { "다시 시도하기" }
            }
        }
    }
}
