//! `GET /slang` (`app/(default)/slang/page.tsx`): the dictionary of phrases
//! by era, sixty indexable phrases each, and a fifth panel of the risky ones
//! (components/slang-dictionary.tsx).
//!
//! Next serves this page from ISR and never reads `?era=`: every panel is in
//! the document and the first is shown; the tab of `?era=` is chosen in the
//! browser. `ui/slang.js` does that here, and switches tabs without a reload
//! as Next's client router does.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};

use super::document::{self, Head, ShareImage};
use super::meme_card::{self, CardMeme};
use super::{html_cached, json_ld, path_and_query};
use crate::AppState;
use crate::db::Db;
use crate::routes::public::js;

const TITLE: &str = "줄임말·유행어 사전";
/// `revalidate = 3600`, as Next sends it for the cached page.
const CACHE: &str = "s-maxage=3600, stale-while-revalidate=31532400";
/// `TERMS_PER_ERA`.
const TERMS_PER_ERA: usize = 60;
/// `SCHEMA_TERMS_PER_ERA`.
const SCHEMA_TERMS_PER_ERA: usize = 20;
// Every phrase of an era is read and the indexable ones kept, as the query
// with the discovery index's ids does. Next reads at most 50,000 memes.
const SCAN: usize = 50_000;
const BASE_DESCRIPTION: &str = "요즘 애들이 쓰는 신조어부터 1990년대 하이루 세대의 유행어까지 — 연대별로 넘겨 보며 한 줄 뜻과 사용 안전 신호등을 확인하는 줄임말·유행어 사전.";
const RISKY_DESCRIPTION: &str = "지금 쓰면 위험하거나 맥락 주의가 필요한 말만 모았어요. 표제어를 누르면 상세에서 ‘이 판정의 근거’를 확인할 수 있어요.";
// `ERA_DEFS`: key, label, range, years, explore link.
const ERAS: [(&str, &str, &str, i32, i32, &str); 4] = [
    (
        "now",
        "요즘",
        "2020~",
        2020,
        2029,
        "/explore?category=meme_term&year=2020s",
    ),
    (
        "2010s",
        "2010년대",
        "2010~19",
        2010,
        2019,
        "/explore?category=meme_term&year=2010s",
    ),
    (
        "2000s",
        "2000년대",
        "2000~09",
        2000,
        2009,
        "/explore?category=meme_term&year=2000s",
    ),
    (
        "1990s",
        "1990년대",
        "1990~99",
        1990,
        1999,
        "/explore?category=meme_term",
    ),
];
const TAB_CURRENT: &str = "hover-glow-flame border-flame-500 bg-accent-strong text-white";
const TAB_IDLE: &str = "border-border bg-surface text-muted hover:border-accent hover:text-accent";

/// `SlangEra`.
struct Era {
    key: &'static str,
    label: &'static str,
    range: &'static str,
    explore: &'static str,
    description: Option<&'static str>,
    terms: Vec<CardMeme>,
}

async fn phrases(db: &Db, condition: String, order: &str) -> Vec<CardMeme> {
    let condition = format!(
        "m.category = 'phrase' and m.moderation_status in ('approved', 'limited') and {condition}"
    );
    meme_card::indexable(db, &condition, order, SCAN, TERMS_PER_ERA, Vec::new())
        .await
        .inspect_err(|error| tracing::warn!(%error, "slang read failed"))
        .unwrap_or_default()
}

/// `pickShowcase`: a short title among the first five, or the first.
fn showcase(era: &Era) -> Option<&str> {
    era.terms
        .iter()
        .take(5)
        .find(|term| js::utf16_len(&term.title) <= 10)
        .or_else(|| era.terms.first())
        .map(|term| term.title.as_str())
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let db = &state.db;
    let reads = ERAS.map(|(_, _, _, from, to, _)| {
        phrases(
            db,
            format!("m.origin_year >= {from} and m.origin_year <= {to}"),
            "m.trend_score desc, m.id desc",
        )
    });
    let [now, tens, noughts, nineties] = reads;
    let (now, tens, noughts, nineties, mut risky) = tokio::join!(
        now,
        tens,
        noughts,
        nineties,
        phrases(
            db,
            "m.safety_level in ('red', 'yellow')".to_owned(),
            "m.trend_score desc, m.id desc"
        ),
    );
    // Red first; within a level the trend order stays (a stable sort).
    risky.sort_by_key(|term| term.safety_level != Some(super::labels::SafetyLevel::Red));
    let eras: Vec<Era> = ERAS
        .iter()
        .zip([now, tens, noughts, nineties])
        .map(|((key, label, range, _, _, explore), terms)| Era {
            key,
            label,
            range,
            explore,
            description: None,
            terms,
        })
        .collect();

    let parts: Vec<String> = eras
        .iter()
        .rev()
        .filter_map(|era| Some(format!("{} {}", era.label, showcase(era)?)))
        .collect();
    let description = if parts.len() >= 2 {
        format!(
            "{}까지 — 연대별 한 줄 뜻과 사용 안전 신호등으로 정리한 줄임말·유행어 사전.",
            parts.join(", ")
        )
    } else {
        BASE_DESCRIPTION.to_owned()
    };
    let then_term = showcase(&eras[3]).unwrap_or("하이루").to_owned();
    let now_term = showcase(&eras[0]).unwrap_or("럭키비키").to_owned();
    let has_terms = eras.iter().any(|era| !era.terms.is_empty());
    let schema: Vec<(String, String, String)> = eras
        .iter()
        .flat_map(|era| era.terms.iter().take(SCHEMA_TERMS_PER_ERA))
        .map(|term| (term.title.clone(), term.summary.clone(), term.path()))
        .collect();

    let mut panels = eras;
    if !risky.is_empty() {
        panels.push(Era {
            key: "risky",
            label: "주의·위험",
            range: "",
            explore: "",
            description: Some(RISKY_DESCRIPTION),
            terms: risky,
        });
    }

    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(description),
        canonical: Some("/slang".to_owned()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" data-ads=[site.ads_client()] {
            @if !schema.is_empty() { (json_ld::slang_term_set(site, &schema)) }
            h1 class="page-title" { (TITLE) }
            p class="page-lede" { "지금 쓰는 줄임말과 예전에 유행했던 말을 연대별로 모았어요. 1990년대 PC통신 인사말부터 2000년대 싸이월드 감성 문구, 2010년대 급식체, 그리고 요즘 SNS와 숏폼에서 도는 신조어까지 — 표제어마다 한 줄 뜻과 함께 지금 써도 되는지 신호등으로 알려줘요." }
            p class="hover-glow-flame mt-4 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2 text-sm font-medium text-muted" {
                span aria-hidden="true" class="text-accent" {
                    svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {
                        path d="M17 3l4 4-4 4" {}
                        path d="M21 7H8a4 4 0 0 0-4 4" {}
                        path d="M7 21l-4-4 4-4" {}
                        path d="M3 17h13a4 4 0 0 0 4-4" {}
                    }
                }
                span {
                    "그때는 " b class="font-bold text-foreground" { "“" (then_term) "”" }
                    ", 지금은 " b class="font-bold text-foreground" { "“" (now_term) "”" }
                }
            }
            @if has_terms {
                (dictionary(&panels))
            } @else {
                div class="mt-8 rounded-2xl border border-border bg-surface p-8 text-center" {
                    p class="text-lg font-bold" { "사전을 아직 준비 중이에요" }
                    p class="mt-1.5 text-base text-muted" { "유행어가 검수를 통과하면 이 페이지가 채워져요. 잠시 후 다시 들러 주세요." }
                }
            }
        }
    };
    let document = document::page(site, &head, path_and_query(&request), main);
    html_cached(StatusCode::OK, CACHE, document)
}

/// `SlangDictionary` with the first panel shown, as Next's shell has it.
fn dictionary(eras: &[Era]) -> Markup {
    html! {
        div class="mt-6" data-slang data-tab-current=(TAB_CURRENT) data-tab-idle=(TAB_IDLE) {
            nav aria-label="연대 선택" class="glass-panel -mx-4 flex gap-2 overflow-x-auto rounded-2xl px-4 py-2 sm:mx-0 sm:flex-wrap sm:px-3" {
                @for era in eras {
                    @let current = era.key == "now";
                    a href=(if era.key == "now" { "/slang".to_owned() } else { format!("/slang?era={}", era.key) }) aria-current=[current.then_some("page")] class={"inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97] " (if current { TAB_CURRENT } else { TAB_IDLE })} data-era-tab=(era.key) {
                        (era.label)
                        @if !era.range.is_empty() {
                            span class={"text-xs font-medium tabular-nums " @if current { "text-white/90" }} { (era.range) }
                        }
                    }
                }
            }
            @for era in eras {
                @let id = format!("slang-era-{}", era.key);
                section hidden[era.key != "now"] aria-labelledby=(id) class="mt-6" data-era=(era.key) {
                    div class="flex items-baseline justify-between gap-3" {
                        h2 id=(id) class="flex items-center gap-2 text-xl font-bold tracking-tight" {
                            @if era.key == "risky" {
                                span aria-hidden="true" class="signal-live h-2 w-2 shrink-0 rounded-full bg-safety-red" {}
                            }
                            (era.label) " 유행어"
                        }
                        @if !era.terms.is_empty() {
                            p class="shrink-0 text-sm text-muted" { (if era.key == "risky" { "위험 우선" } else { "많이 본 순" }) " · " (era.terms.len()) "개" }
                        }
                    }
                    @if let Some(description) = era.description {
                        p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted" { (description) }
                    }
                    @if era.terms.is_empty() {
                        div class="mt-4 rounded-2xl border border-border bg-surface p-8 text-center" {
                            p class="text-lg font-bold" { "아직 채워지는 중이에요" }
                            p class="mt-1.5 text-base text-muted" { "이 연대의 유행어가 검수를 통과하면 여기에 올라와요." }
                        }
                    } @else {
                        ul class="mt-2 grid grid-cols-1 gap-x-10 lg:grid-cols-2" {
                            @for term in &era.terms {
                                li class="border-b border-border" {
                                    a class="group flex min-h-11 flex-col justify-center gap-0.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href=(term.path()) {
                                        span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" {
                                            span class="font-bold leading-snug underline decoration-transparent underline-offset-4 transition-[color,text-decoration-color,text-underline-offset] group-hover:text-accent group-hover:decoration-flame-500 group-hover:underline-offset-2" { (term.title) }
                                            @if let Some(year) = term.origin_year {
                                                span class="rounded-full border border-border px-2 py-0.5 text-xs font-medium tabular-nums text-muted" { (year) }
                                            }
                                            @if let Some(level) = term.safety_level { (meme_card::safety_badge(level)) }
                                        }
                                        span class="truncate text-sm text-muted" { (term.summary) }
                                    }
                                }
                            }
                        }
                    }
                    @if !era.explore.is_empty() {
                        a class="mt-5 inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-5 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97]" href=(era.explore) {
                            "탐색에서 더 보기 " span aria-hidden="true" { "→" }
                        }
                    }
                }
            }
        }
    }
}
