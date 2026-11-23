//! `GET /guides` and `GET /guides/{slug}` (`app/(default)/guides/`): five
//! long articles. Their text is `lib/guides.ts` itself, exported to
//! `i18n/guides.json` by `scripts/build-i18n.mjs`; only the markup is here.
//! An unknown slug is left to Next, which answers its 404.

use std::sync::LazyLock;

use axum::extract::{Path, Request, State};
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;

use super::{korean_share, respond};
use crate::{AppState, proxy};

const GUIDES_JSON: &str = include_str!("../../../i18n/guides.json");
const LIST_TITLE: &str = "가이드";
const LIST_DESCRIPTION: &str = "밈을 쓰기 전에 알아 두면 좋은 것들 — 사용 신호 읽는 법, 단톡방 점검, 한국 밈의 시대 변화, 출처 확인, 숏폼 챌린지의 권리 문제를 정리한 밈캐치 가이드입니다. 실제 밈 문서와 함께 읽어 보세요.";
const LINK: &str = "text-accent-text underline underline-offset-2";

#[derive(Deserialize)]
struct Guide {
    slug: String,
    title: String,
    description: String,
    /// YYYY-MM-DD.
    updated: String,
    intro: String,
    sections: Vec<Section>,
    sources: Vec<Source>,
}

#[derive(Deserialize)]
struct Section {
    heading: String,
    paragraphs: Vec<String>,
    links: Option<Vec<GuideLink>>,
}

#[derive(Deserialize)]
struct GuideLink {
    href: String,
    label: String,
}

#[derive(Deserialize)]
struct Source {
    title: String,
    publisher: String,
    url: String,
}

static GUIDES: LazyLock<Vec<Guide>> =
    LazyLock::new(|| serde_json::from_str(GUIDES_JSON).expect("i18n/guides.json parses"));

/// `formatDate` of the page: `2026-11-20` is `2026년 11월 20일`.
fn format_date(iso: &str) -> String {
    let parts: Vec<u32> = iso
        .split('-')
        .map(|part| part.parse().unwrap_or(0))
        .collect();
    match parts.as_slice() {
        [year, month, day] => format!("{year}년 {month}월 {day}일"),
        _ => iso.to_owned(),
    }
}

/// The list of guides.
pub async fn list(State(state): State<AppState>, request: Request) -> Response {
    let head = korean_share(
        &state.pages.site,
        LIST_TITLE,
        LIST_DESCRIPTION,
        "/guides",
        false,
    );
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" data-ads=[state.pages.site.ads_client()] {
            div class="max-w-3xl" {
                h1 class="page-title" { "밈캐치 가이드" }
                p class="page-lede" { "사전을 만들며 정리한 기준과 경험을 긴 글로 풀었습니다. 밈의 뜻을 안 다음, 실제로 쓰기 전에 읽어 두면 좋은 글들입니다." }
                ul class="mt-10 space-y-6" {
                    @for guide in GUIDES.iter() {
                        li {
                            h2 class="text-xl font-bold" {
                                a class="underline decoration-transparent underline-offset-4 hover:decoration-current" href=(format!("/guides/{}", guide.slug)) { (guide.title) }
                            }
                            p class="mt-1.5 text-base leading-relaxed text-muted" { (guide.description) }
                        }
                    }
                }
            }
        }
    };
    respond(&state, &request, head, main)
}

/// One guide, or Next's answer for a slug that is not one.
pub async fn article(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    request: Request,
) -> Response {
    let Some(guide) = GUIDES.iter().find(|guide| guide.slug == slug) else {
        return proxy::forward(State(state), request).await;
    };
    let path = format!("/guides/{}", guide.slug);
    let head = korean_share(
        &state.pages.site,
        &guide.title,
        &guide.description,
        &path,
        false,
    );
    let main = article_main(guide, state.pages.site.ads_client());
    respond(&state, &request, head, main)
}

fn article_main(guide: &Guide, ads_client: Option<&str>) -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 pb-16 pt-10" data-ads=[ads_client] {
            article class="max-w-3xl" {
                p class="text-sm" {
                    a class=(LINK) href="/guides" { "가이드" }
                }
                h1 class="page-title mt-2" { (guide.title) }
                p class="mt-2 text-sm text-muted" {
                    "최종 수정: "
                    time datetime=(guide.updated) { (format_date(&guide.updated)) }
                }
                p class="page-lede" { (guide.intro) }
                @for section in &guide.sections {
                    section class="mt-12" {
                        h2 class="text-xl font-bold" { (section.heading) }
                        @for paragraph in &section.paragraphs {
                            p class="mt-3 text-base leading-relaxed" { (paragraph) }
                        }
                        @if let Some(links) = &section.links {
                            ul class="mt-4 list-disc space-y-1.5 pl-5 text-base" {
                                @for link in links {
                                    li { a class=(LINK) href=(link.href) { (link.label) } }
                                }
                            }
                        }
                    }
                }
                @if !guide.sources.is_empty() {
                    section class="mt-12" {
                        h2 class="text-xl font-bold" { "참고한 자료" }
                        ul class="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed" {
                            @for source in &guide.sources {
                                li {
                                    a href=(source.url) target="_blank" rel="noopener noreferrer" class=(LINK) { (source.title) }
                                    " "
                                    span class="text-muted" { "— " (source.publisher) }
                                }
                            }
                        }
                    }
                }
                p class="mt-12 text-base leading-relaxed text-muted" {
                    "이 글은 밈캐치의 "
                    a class=(LINK) href="/editorial" { "편집 원칙" }
                    "을 바탕으로 썼습니다. 틀린 내용을 발견하셨다면 "
                    a class=(LINK) href="/editorial#corrections" { "정정 요청" }
                    "으로 알려 주세요."
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_five_guides_load_and_dates_read_as_the_page_writes_them() {
        assert_eq!(GUIDES.len(), 5);
        assert!(GUIDES.iter().all(|guide| !guide.sections.is_empty()));
        assert_eq!(format_date("2026-11-20"), "2026년 11월 20일");
        assert_eq!(format_date("2026-01-05"), "2026년 1월 5일");
    }
}
