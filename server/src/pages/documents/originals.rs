//! `GET /originals` (`app/(default)/originals/page.tsx`): the list of the
//! site's own illustrated memes, and `GET /originals/edition/{slug}`
//! (`components/originals-editorial/original-edition-content.tsx`), one of
//! them with its copy-link and save-card buttons (`ui/originals.js`). The
//! editions are `lib/editorial-originals.ts` itself, exported to
//! `i18n/originals.json` by `scripts/build-i18n.mjs`.

use std::sync::LazyLock;

use axum::extract::{Path, Request, State};
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use serde::Deserialize;

use super::{korean_share, respond};
use crate::pages::document::Head;
use crate::{AppState, proxy};

const ORIGINALS_JSON: &str = include_str!("../../../i18n/originals.json");
const TITLE: &str = "오리지널 밈";
const DESCRIPTION: &str = "밈캐치가 직접 만든 일러스트와 이야기.";

/// `EditorialOriginal`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Edition {
    pub slug: String,
    pub title: String,
    pub caption: String,
    pub summary: String,
    pub situation: String,
    pub alternate_caption: String,
    pub image: String,
    pub image_alt: String,
}

pub static EDITIONS: LazyLock<Vec<Edition>> =
    LazyLock::new(|| serde_json::from_str(ORIGINALS_JSON).expect("i18n/originals.json parses"));

/// `editorialOriginalPath(slug)`.
pub fn edition_path(slug: &str) -> String {
    format!("/originals/edition/{slug}")
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let head = korean_share(&state.pages.site, TITLE, DESCRIPTION, "/originals", true);
    let main = html! {
        main class="mx-auto w-full max-w-3xl bg-[#f3f2ed] px-4 py-12 text-[#18181a]" {
            p class="text-sm font-bold tracking-wide text-[#a52b13]" { "MEMECATCH ORIGINALS" }
            h1 class="mt-3 text-4xl font-black tracking-tight text-balance [word-break:keep-all]" { "우리가 직접 만든 밈을 한곳에서" }
            ul class="mt-8 grid gap-3" {
                @for edition in EDITIONS.iter() {
                    li {
                        a class="block rounded-2xl border border-[#18181a] bg-[#fffaf4] p-4 text-base leading-7" href=(edition_path(&edition.slug)) {
                            span class="block font-black" { (edition.title) }
                            span class="mt-1 block" { (edition.summary) }
                        }
                    }
                }
            }
        }
    };
    respond(&state, &request, head, main)
}

// `next/image` with `width={1024}` and `sizes`: the widths of Next's default
// `deviceSizes` and `imageSizes` it writes into `srcset`. Next keeps serving
// `/_next/image`.
const IMAGE_WIDTHS: [u32; 9] = [384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];
const ARROW_LEFT: &str = r#"<path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>"#;
const ARROW_RIGHT: &str = r#"<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>"#;
const COPY: &str = r#"<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>"#;
const CHECK: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;
const DOWNLOAD: &str = r#"<path d="M12 15V3"></path><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="m7 10 5 5 5-5"></path>"#;

fn icon(name: &str, paths: &'static str) -> Markup {
    html! {
        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class=(format!("lucide lucide-{name}")) aria-hidden="true" { (PreEscaped(paths)) }
    }
}

fn optimized(image: &str, width: u32) -> String {
    format!(
        "/_next/image?url={}&w={width}&q=75",
        crate::routes::public::js::encode_uri_component(image)
    )
}

/// One edition, or Next's 404 for a slug that is not one.
pub async fn edition(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    request: Request,
) -> Response {
    let Some(index) = EDITIONS.iter().position(|edition| edition.slug == slug) else {
        return proxy::forward(State(state), request).await;
    };
    let edition = &EDITIONS[index];
    // `nextEditorialOriginal`: the one after, the first after the last.
    let next = &EDITIONS[(index + 1) % EDITIONS.len()];
    let path = edition_path(&edition.slug);
    let site = &state.pages.site;
    let head = Head {
        article: true,
        ..korean_share(site, &edition.title, &edition.summary, &path, false)
    };
    let main = edition_main(edition, next, &site.absolute(&path));
    respond(&state, &request, head, main)
}

fn edition_main(edition: &Edition, next: &Edition, share_url: &str) -> Markup {
    let srcset = IMAGE_WIDTHS
        .iter()
        .map(|width| format!("{} {width}w", optimized(&edition.image, *width)))
        .collect::<Vec<_>>()
        .join(", ");
    html! {
        main class="original-edition-page" data-edition-image=(edition.image) data-edition-caption=(edition.caption) data-edition-slug=(edition.slug) data-share-url=(share_url) {
            div class="original-edition-inner" {
                a class="original-edition-back" href="/originals" { (icon("arrow-left", ARROW_LEFT)) " 오리지널 목록" }
                div class="original-edition-layout" {
                    div class="original-edition-artwork" lang="ko" {
                        img alt=(edition.image_alt) loading="lazy" width="1024" height="1024" decoding="async" data-nimg="1" style="color:transparent" sizes="(max-width: 800px) 100vw, 55vw" srcset=(srcset) src=(optimized(&edition.image, 3840));
                    }
                    article class="original-edition-article" {
                        p class="original-edition-kicker" { "MEMECATCH ORIGINAL" }
                        p class="original-edition-language-note" { "제목과 문구, 작품 이야기는 창작 당시의 한국어 원문입니다." }
                        h1 lang="ko" { (edition.title) }
                        p class="original-edition-caption" lang="ko" { (edition.caption) }
                        p class="original-edition-summary" lang="ko" { (edition.summary) }
                        div class="original-edition-note" {
                            strong { "이럴 때 생각나요" }
                            p lang="ko" { (edition.situation) }
                        }
                        div class="original-edition-note" {
                            strong { "다른 한 줄" }
                            p lang="ko" { (edition.alternate_caption) }
                        }
                        div class="original-edition-actions" {
                            button type="button" class="original-edition-secondary-button" data-copy-link { (icon("copy", COPY)) "작품 링크 복사" }
                            button type="button" class="original-edition-button" aria-describedby="edition-status" data-save-card { (icon("download", DOWNLOAD)) "문구 포함 카드 저장" }
                            a class="original-edition-download" href=(edition.image) download { (icon("download", DOWNLOAD)) " 그림만 저장" }
                            p id="edition-status" class="original-edition-status" role="status" data-edition-status { "한국어 원문 캡션과 출처가 포함된 PNG로 저장됩니다." }
                        }
                        p class="original-edition-credit" { "밈캐치에서 직접 만든 오리지널 일러스트와 문구입니다." }
                    }
                }
                a class="original-edition-next" href=(edition_path(&next.slug)) {
                    span { "다음 오리지널" }
                    strong lang="ko" { (next.title) }
                    (icon("arrow-right", ARROW_RIGHT))
                }
                // The two icons `ui/originals.js` swaps into the copy button.
                template data-icon="check" { (icon("check", CHECK)) }
                template data-icon="copy" { (icon("copy", COPY)) }
            }
        }
    }
}
