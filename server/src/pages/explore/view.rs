//! The markup of /explore: the title, `ExploreFilters` and `ExploreGrid`
//! in their first state. What the grid becomes later (loading, failed, the
//! "more" button, the end) is in a template `ui/explore.js` copies from.

use maud::{Markup, html};
use serde_json::json;

use super::Load;
use super::query::{
    DIFFICULTIES, DISPLAY_CATEGORIES, Filters, LIFECYCLES, MEDIA, PLATFORMS, Params, SORTS, YEARS,
    display_tokens,
};
use crate::pages::document::Site;
use crate::pages::json_ld;

/// `PAGE_SIZE` of the grid.
pub const PAGE_SIZE: usize = 24;
/// `MOBILE_CARD_CLEARANCE`.
const CARD_CLEARANCE: &str = "max-md:pb-[calc(4.5rem+4rem+1rem)]";
const CHIP_BASE: &str = "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium transition-[color,border-color,background-color] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const CHIP_OFF: &str =
    "border-border bg-surface text-muted hover:border-accent/60 hover:text-foreground";
const CHIP_ON: &str = "border-(--flame-500) bg-accent-soft font-semibold text-accent shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_25%,transparent),0_0_14px_-3px_color-mix(in_srgb,var(--flame-500)_55%,transparent)]";
const LINK: &str = "inline-flex min-h-11 items-center text-sm font-semibold text-foreground underline decoration-border decoration-2 underline-offset-4 transition-colors hover:decoration-accent";
const SELECT: &str = "rounded-sm bg-transparent font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ROUND_BUTTON: &str = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]";

pub fn page(site: &Site, body: Markup) -> Markup {
    html! {
        main class="bg-background pb-14 text-foreground" data-ads=[site.ads_client()] {
            div class="mx-auto max-w-site px-4 pt-8" {
                (json_ld::explore(site))
                div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-2" {
                    div class="min-w-0" {
                        h1 class="text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl" { "밈 탐색" }
                        p class="mt-2 max-w-xl text-base text-muted" { "검색하고, 필요한 조건만 골라 바로 결과를 확인하세요." }
                    }
                    div class="flex flex-wrap gap-x-5" {
                        a class=(LINK) href="/collections" { "테마별 모음 보기" }
                        a class=(LINK) href="/memes" { "가나다순 전체 목록" }
                    }
                }
                (body)
            }
        }
    }
}

/// The toolbar and the grid: the two elements `ui/explore.js` replaces when
/// the address changes in place.
pub fn body(
    params: &Params,
    filters: &Filters,
    load: &Load,
    cards: &[Markup],
    preview_failed: bool,
) -> Markup {
    html! {
        (toolbar(params))
        section aria-label="밈 탐색 결과" class="mt-6" data-explore-grid=(state(params, filters, load, preview_failed)) {
            (grid(load, cards, preview_failed, filters.q.as_deref()))
            (parts(filters))
        }
    }
}

/// What the grid's script starts from.
fn state(params: &Params, filters: &Filters, load: &Load, preview_failed: bool) -> String {
    let pending: Vec<&str> = if preview_failed {
        load.items
            .iter()
            .filter(|item| !item.curated)
            .map(|item| item.meme.id.as_str())
            .collect()
    } else {
        Vec::new()
    };
    let query: String = url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(params.pairs())
        .finish();
    json!({
        "query": query,
        "offset": load.scanned,
        "hasMore": load.has_more,
        "unavailable": load.unavailable,
        "pending": pending,
        "alternatives": load.alternatives,
        "q": filters.q,
    })
    .to_string()
}

/// One filter as the toolbar shows it: the raw value of the address.
struct Raw<'a> {
    display: Vec<&'static str>,
    sort: &'a str,
    platform: &'a str,
    difficulty: &'a str,
    lifecycle: &'a str,
    year: &'a str,
    media: &'a str,
    query: &'a str,
}

fn label<'a>(table: &[(&'static str, &'static str)], key: &'a str) -> &'a str {
    table
        .iter()
        .find(|(name, _)| *name == key)
        .map_or(key, |(_, label)| label)
}

/// `ExploreFilters`. Its panel opens from a template.
fn toolbar(params: &Params) -> Markup {
    let raw = Raw {
        display: display_tokens(params.all("category")),
        sort: params.first("sort").unwrap_or("trending"),
        platform: params.first("platform").unwrap_or_default(),
        difficulty: params.first("difficulty").unwrap_or_default(),
        lifecycle: params.first("lifecycle").unwrap_or_default(),
        year: params.first("year").unwrap_or_default(),
        media: params.first("media").unwrap_or_default(),
        query: params.first("q").unwrap_or_default(),
    };
    let singles = [
        raw.difficulty,
        raw.year,
        raw.media,
        raw.lifecycle,
        raw.platform,
    ];
    let count = raw.display.len() + singles.iter().filter(|value| !value.is_empty()).count();
    let any_state = count > 0 || !raw.query.is_empty() || raw.sort != "trending";
    let years: Vec<(&str, &str)> = YEARS
        .iter()
        .map(|(key, label, ..)| (*key, *label))
        .collect();
    let mut chips: Vec<(String, String)> = raw
        .display
        .iter()
        .map(|token| {
            let label = DISPLAY_CATEGORIES
                .iter()
                .find(|(key, ..)| key == token)
                .map_or(*token, |(_, label, _)| label);
            (format!("unset:category:{token}"), label.to_owned())
        })
        .collect();
    for (name, value, table) in [
        ("platform", raw.platform, &PLATFORMS[..]),
        ("difficulty", raw.difficulty, &DIFFICULTIES[..]),
        ("lifecycle", raw.lifecycle, &LIFECYCLES[..]),
        ("year", raw.year, &years[..]),
        ("media", raw.media, &MEDIA[..]),
    ] {
        if !value.is_empty() {
            chips.push((format!("unset:{name}"), label(table, value).to_owned()));
        }
    }
    html! {
        div class="mt-6 border-y border-border py-4" data-explore-filters {
            form role="search" class="relative" {
                svg viewBox="0 0 24 24" aria-hidden="true" class="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" {
                    circle cx="11" cy="11" r="7" {}
                    path d="m20 20-3.2-3.2" {}
                }
                input type="search" name="q" value=(raw.query) placeholder="밈 이름이나 뜻으로 검색" aria-label="밈 이름이나 뜻으로 검색" enterkeyhint="search" class="min-h-12 w-full rounded-xl border border-border bg-surface py-2 pl-11 pr-28 text-base text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:appearance-none";
                div class="absolute inset-y-0 right-2 flex items-center gap-1" {
                    @if !raw.query.is_empty() { (clear_button()) }
                    template data-explore-clear { (clear_button()) }
                    button type="submit" class="inline-flex h-9 items-center rounded-lg bg-accent-strong px-4 text-sm font-bold text-white shadow-[0_0_16px_-4px_color-mix(in_srgb,var(--flame-500)_60%,transparent)] transition-[filter] hover:brightness-110" { "검색" }
                }
            }
            div class="mt-3 flex flex-wrap items-center gap-2" {
                label class="glass-panel inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm" {
                    span class="text-muted" { "정렬" }
                    select aria-label="정렬 방식" class=(SELECT) data-explore-select="sort" {
                        @for (key, name) in SORTS {
                            option value=(key) selected[key == raw.sort] { (name) }
                        }
                    }
                }
                label class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm" {
                    span class="text-muted" { "출처" }
                    select aria-label="원본 플랫폼" class=(SELECT) data-explore-select="platform" {
                        @for (key, name) in PLATFORMS {
                            option value=(key) selected[key == raw.platform] { (name) }
                        }
                    }
                }
                button type="button" aria-expanded="false" aria-controls="explore-filter-panel" class={(CHIP_BASE) " " (if count > 0 { CHIP_ON } else { CHIP_OFF })} data-explore-panel-toggle {
                    "필터"
                    @if count > 0 { " " (count) }
                    span aria-hidden="true" class="ml-1 transition-transform" { "⌄" }
                }
                @if any_state {
                    button type="button" class="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-muted underline decoration-border underline-offset-4 transition-colors hover:text-accent" data-explore-action="reset" { "초기화" }
                }
            }
            @if !chips.is_empty() {
                ul aria-label="적용된 필터" class="mt-3 flex flex-wrap gap-2" {
                    @for (action, name) in &chips {
                        li {
                            button type="button" aria-label=(format!("{name} 필터 해제")) class="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold text-foreground transition-colors hover:text-accent" data-explore-action=(action) {
                                (name) " " span aria-hidden="true" { "×" }
                            }
                        }
                    }
                }
            }
            template data-explore-panel { (panel(&raw, &years)) }
        }
    }
}

fn clear_button() -> Markup {
    html! {
        button type="button" aria-label="검색어 지우기" class="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground" data-explore-action="clear:q" {
            span aria-hidden="true" { "×" }
        }
    }
}

fn chip(on: bool, action: String, text: &str) -> Markup {
    html! {
        button type="button" aria-pressed=(on) class={(CHIP_BASE) " " (if on { CHIP_ON } else { CHIP_OFF })} data-explore-action=(action) { (text) }
    }
}

fn panel(raw: &Raw<'_>, years: &[(&'static str, &'static str)]) -> Markup {
    let group = |legend: &str, name: &str, value: &str, table: &[(&'static str, &'static str)]| {
        html! {
            fieldset {
                legend class="text-sm font-bold" { (legend) }
                div class="mt-2 flex flex-wrap gap-2" {
                    @for (key, text) in table {
                        (chip(value == *key, format!("toggle:{name}:{key}"), text))
                    }
                }
            }
        }
    };
    html! {
        div id="explore-filter-panel" class="mt-4 space-y-5 border-t border-border pt-4" {
            fieldset {
                legend class="text-sm font-bold" { "카테고리" }
                div class="mt-2 flex flex-wrap gap-2" {
                    @for (key, text, _) in DISPLAY_CATEGORIES {
                        (chip(raw.display.contains(&key), format!("category:{key}"), text))
                    }
                }
            }
            div class="grid gap-5 md:grid-cols-2" {
                (group("난이도", "difficulty", raw.difficulty, &DIFFICULTIES))
                (group("생애주기", "lifecycle", raw.lifecycle, &LIFECYCLES))
                (group("연도대", "year", raw.year, years))
                (group("미디어", "media", raw.media, &MEDIA))
            }
        }
    }
}

const PANEL: &str = "glass-panel relative mt-8 overflow-hidden rounded-2xl p-8 text-center";

fn grid_texture() -> Markup {
    html! { div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {} }
}

fn retry_banner() -> Markup {
    html! {
        div role="status" class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm" data-explore-banner {
            span { "일부 영상 미리보기를 불러오지 못했어요." }
            button type="button" class="min-h-11 rounded-lg border border-border px-3 font-semibold disabled:opacity-60" data-explore-action="retry" { "미리보기 다시 불러오기" }
        }
    }
}

/// The empty grid that is still looking (`items.length === 0 && hasMore`).
fn searching() -> Markup {
    html! {
        div class=(PANEL) data-explore-searching {
            (grid_texture())
            div class="relative" {
                p class="text-xl font-bold" data-explore-searching-title { "다음 공개 밈을 계속 찾고 있어요" }
                p class="mt-1.5 text-base text-foreground" { "앞선 문서는 공개 목록 기준을 충족하지 않아 건너뛰었어요." }
                button type="button" class={(ROUND_BUTTON) " mt-5 disabled:cursor-wait disabled:opacity-60"} data-explore-action="more" { "계속 찾기" }
            }
        }
    }
}

fn empty(q: Option<&str>) -> Markup {
    let submit = match q {
        Some(name) => format!(
            "/submit?{}",
            url::form_urlencoded::Serializer::new(String::new())
                .append_pair("name", name)
                .finish()
        ),
        None => "/submit".to_owned(),
    };
    html! {
        div class=(PANEL) {
            (grid_texture())
            div class="relative" {
                img src="/brand/state-empty-search.webp" alt="" width="1024" height="768" loading="lazy" decoding="async" class="mx-auto mb-2 w-48 mix-blend-screen [mask-image:radial-gradient(closest-side,#000_55%,transparent_98%)] sm:w-56";
                p class="text-xl font-bold" { "조건에 맞는 밈이 아직 없어요" }
                p class="mt-1.5 text-base text-foreground" { "필터를 초기화하거나, 알고 있는 밈을 제보해 주세요." }
                div class="mt-5 flex flex-wrap items-center justify-center gap-2" {
                    form action="/explore" method="get" {
                        button type="submit" class="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]" { "필터 초기화" }
                    }
                    a href=(submit) rel="nofollow" class="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-6 text-base font-bold text-white active:scale-[0.97]" { "밈 제보하기" }
                }
            }
        }
    }
}

const GRID: &str = "grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6";

/// `ExploreGrid` in its first state.
fn grid(load: &Load, cards: &[Markup], preview_failed: bool, q: Option<&str>) -> Markup {
    let pending = preview_failed && load.items.iter().any(|item| !item.curated);
    html! {
        @if load.unavailable && load.items.is_empty() {
            div role="alert" class="glass-panel relative mt-8 overflow-hidden rounded-2xl p-8 text-center" {
                (grid_texture())
                div class="relative" {
                    p class="text-xl font-bold" { "밈 목록을 불러오지 못했어요" }
                    p class="mt-1.5 text-base text-foreground" { "사전 연결이 잠시 막혀 있어요. 출처 숫자는 남아 있어도, 이 목록은 연결이 돌아와야 보여요." }
                    button type="button" class={(ROUND_BUTTON) " mt-5"} data-explore-action="reload" { "다시 시도" }
                }
            }
        } @else if load.items.is_empty() && load.has_more {
            (searching())
        } @else if load.items.is_empty() {
            (empty(q))
        } @else {
            div {
                @if pending { (retry_banner()) }
                ul class={(GRID) " " (CARD_CLEARANCE)} data-explore-list {
                    @for (item, card) in load.items.iter().zip(cards) {
                        li class="min-w-0" data-explore-item=(item.meme.id) data-key=(item.key()) data-pref=(item.preference()) { (card) }
                    }
                }
                @if load.has_more {
                    div class="h-1 w-full" data-explore-sentinel {}
                } @else {
                    (end())
                }
            }
        }
    }
}

fn end() -> Markup {
    html! {
        p class="mt-8 flex items-center justify-center gap-2 text-center text-sm text-muted" aria-live="polite" {
            span aria-hidden="true" class="signal-live size-1.5 rounded-full bg-(--signal-cyan)" {}
            "끝까지 봤어요"
        }
    }
}

/// The grid's other states, for `ui/explore.js`.
fn parts(filters: &Filters) -> Markup {
    html! {
        template data-explore-parts {
            div data-part="banner" { (retry_banner()) }
            div data-part="searching" { (searching()) }
            div data-part="empty" { (empty(filters.q.as_deref())) }
            div data-part="skeleton" {
                ul class={"mt-4 " (GRID)} aria-hidden="true" {
                    @for _ in 0..6 {
                        li class="min-w-0" {
                            div class="min-w-0" {
                                div aria-hidden="true" class="shimmer instrument-grid rounded-lg aspect-[4/3] w-full rounded-[16px]" {}
                            }
                        }
                    }
                }
            }
            div data-part="more" {
                div class="mt-8 flex justify-center" {
                    button type="button" class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-6 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97] disabled:cursor-wait disabled:opacity-60" data-explore-action="more" { "밈 더 보기" }
                }
            }
            div data-part="failed" {
                div role="alert" class="glass-panel relative mt-6 overflow-hidden rounded-2xl p-6 text-center" {
                    (grid_texture())
                    div class="relative" {
                        p class="text-base font-semibold" { "더 불러오지 못했어요." }
                        button type="button" class="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]" data-explore-action="more" { "다시 시도" }
                    }
                }
            }
            div data-part="end" { (end()) }
            div data-part="sentinel" { div class="h-1 w-full" data-explore-sentinel {} }
            div data-part="list" { ul class={(GRID) " " (CARD_CLEARANCE)} data-explore-list {} }
            div data-part="pending-more" {
                button type="button" class="min-h-11 rounded-lg border border-border px-3 font-semibold disabled:opacity-60" data-explore-action="more" { "계속 찾기" }
            }
        }
    }
}
