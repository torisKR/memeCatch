//! `GET /rankings` (`app/rankings/page.tsx`): the live board (today, this
//! week, comeback, as CSS radio tabs with no script), its fallback list, the
//! newest published memes, or the notice when nothing can be read
//! (`components/rankings-unavailable.tsx`). The board is
//! `loadKoreanRankings` of `routes/public/rankings.rs`, kept 60 seconds and
//! shared with `/llms.txt` as Next shares its module variable.

use std::collections::HashMap;
use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;

use super::document::{self, Head, ShareImage};
use super::i18n::Locale;
use super::labels::{Lifecycle, SafetyLevel};
use super::{DYNAMIC_PAGE_CACHE, html_in, json_ld, path_and_query};
use crate::AppState;
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::labels::meme_path;
use crate::routes::public::rankings::{RankedMeme, Rankings};

const DESCRIPTION: &str =
    "밈캐치 안에서 오늘 급상승한 밈, 이번 주 많이 본 밈, 다시 뜨는 추억 밈을 모았어요.";
/// `FALLBACK_COPY.ko` of lib/rankings-fallback-copy.ts.
const FALLBACK_GUIDANCE: &str = "순위를 잠시 불러오지 못했어요. 잠시 후 다시 확인해 주세요.";
const FALLBACK_EXPLORE: &str = "밈 사전 보기";
const TAB_CLASS: &str = "inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full border border-border bg-surface px-3 text-center text-base font-medium text-muted transition-colors";

/// `RANKING_METHODS`: period and formula of each tab.
const METHODS: [(&str, &str, &str); 3] = [
    (
        "today",
        "최근 3일",
        "조회·댓글·반응·저장을 로그 정규화해 합산하고 신고는 감점해요. 최근 48시간에 올라온 밈에는 가산점이 붙어요.",
    ),
    (
        "weekly",
        "최근 7일",
        "기간 안의 조회 수만 단순 합산해요. 다른 반응은 반영하지 않아요.",
    ),
    (
        "comeback",
        "최근 3일",
        "공개된 지 90일이 넘었는데 지금 다시 점수가 오른 밈만 모아요. 점수 산식은 급상승과 같아요.",
    ),
];

#[derive(Deserialize)]
struct Image {
    url: String,
    alt: String,
}

/// One prefix of `/{locale}/rankings`: `rankingsFallbackCopy`,
/// `rankingsExploreHref` and `ogDefaultImageDescriptor`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocaleCopy {
    title: String,
    guidance: String,
    explore: String,
    explore_href: String,
    image: Image,
}

/// By prefix (`RANKINGS_LOCALE_PREFIXES`): `server/i18n/locale-rankings.json`.
static LOCALES: LazyLock<HashMap<String, LocaleCopy>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/locale-rankings.json"))
        .expect("locale-rankings.json")
});

/// The paths `next.config.ts` rewrites to `/locale-rankings/{locale}`.
pub fn locale_paths() -> Vec<String> {
    let mut paths: Vec<String> = LOCALES
        .keys()
        .map(|code| format!("/{code}/rankings"))
        .collect();
    paths.sort();
    paths
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    render(&state, path_and_query(&request).to_owned(), None).await
}

/// `GET /{locale}/rankings` (app/locale-rankings/[locale]): the same board in
/// the frame of that language, out of the index, its canonical the Korean
/// page.
pub async fn localized(State(state): State<AppState>, request: Request) -> Response {
    let code = request
        .uri()
        .path()
        .trim_start_matches('/')
        .split('/')
        .next()
        .unwrap_or_default();
    let Some((code, copy)) = LOCALES.get_key_value(code) else {
        return crate::proxy::forward(State(state), request).await;
    };
    let target = path_and_query(&request).to_owned();
    render(&state, target, Some((code.as_str(), copy))).await
}

fn locale_head(site: &document::Site, code: &str, copy: &LocaleCopy) -> Head {
    Head {
        title: copy.title.clone(),
        robots: Some("noindex, follow"),
        canonical: Some("/rankings".to_owned()),
        share_url: Some(format!("/{code}/rankings")),
        image: Some(ShareImage {
            url: site.absolute(&copy.image.url),
            mime: Some("image/png"),
            alt: copy.image.alt.clone(),
        }),
        title_absolute: true,
        shared_root: true,
        ..Head::default()
    }
}

async fn render(
    state: &AppState,
    target: String,
    locale: Option<(&str, &'static LocaleCopy)>,
) -> Response {
    let rankings = state.pages.rankings.rankings(&state.db, now_ms()).await;
    let site = &state.pages.site;
    let (head, main) = match &rankings {
        Rankings::Live {
            fallback,
            today,
            comeback,
        } => {
            let title = "밈캐치 내 급상승";
            (
                locale.map_or_else(
                    || live_head(site, title, DESCRIPTION),
                    |(code, copy)| locale_head(site, code, copy),
                ),
                live(
                    fallback.as_deref(),
                    today,
                    comeback,
                    state.config.community_enabled,
                    site,
                ),
            )
        }
        Rankings::Published(memes) => {
            let title = "이번 주 많이 본 밈";
            (
                locale.map_or_else(
                    || live_head(site, title, "공개된 밈 기록에서 최근 글을 모았어요."),
                    |(code, copy)| locale_head(site, code, copy),
                ),
                published(memes, site),
            )
        }
        Rankings::Unavailable | Rankings::Outage if locale.is_some() => {
            let (code, copy) = locale.expect("a locale");
            let head = Head {
                title: copy.title.clone(),
                description: Some(copy.guidance.clone()),
                robots: Some("noindex, follow"),
                title_absolute: true,
                shared_root: true,
                file_card: true,
                ..Head::default()
            };
            let locale = Locale::get(code).expect("a rankings prefix is a locale");
            (
                head,
                unavailable(
                    locale,
                    &copy.title,
                    &copy.guidance,
                    &copy.explore,
                    &copy.explore_href,
                ),
            )
        }
        Rankings::Unavailable | Rankings::Outage => {
            let title = super::i18n::Locale::korean().messages().rankings.clone();
            let head = Head {
                title: title.clone(),
                description: Some(FALLBACK_GUIDANCE.to_owned()),
                robots: Some("noindex, follow"),
                canonical: Some("/rankings".to_owned()),
                image: Some(ShareImage::site_default(site)),
                alternate_locales: true,
                title_absolute: true,
                ..Head::default()
            };
            (
                head,
                unavailable(
                    Locale::korean(),
                    &title,
                    FALLBACK_GUIDANCE,
                    FALLBACK_EXPLORE,
                    "/explore",
                ),
            )
        }
    };
    let frame = locale
        .and_then(|(code, _)| Locale::get(code))
        .unwrap_or_else(Locale::korean);
    html_in(
        StatusCode::OK,
        DYNAMIC_PAGE_CACHE,
        frame.info().lang.as_str(),
        document::page_in(site, &head, &target, main, frame),
    )
}

fn live_head(site: &document::Site, title: &str, description: &str) -> Head {
    Head {
        title: title.to_owned(),
        description: Some(description.to_owned()),
        canonical: Some("/rankings".to_owned()),
        image: Some(ShareImage::site_default(site)),
        alternate_locales: true,
        title_absolute: true,
        ..Head::default()
    }
}

/// `RankingsJsonLd` of the first ten.
fn schema(site: &document::Site, memes: &[RankedMeme]) -> Markup {
    let items: Vec<(String, String)> = memes
        .iter()
        .take(10)
        .map(|meme| (meme.title.clone(), meme_path(&meme.short_id, &meme.slug)))
        .collect();
    json_ld::rankings(site, &items)
}

fn live(
    fallback: Option<&[RankedMeme]>,
    today: &[RankedMeme],
    comeback: &[RankedMeme],
    community_enabled: bool,
    site: &document::Site,
) -> Markup {
    let for_schema = fallback.unwrap_or(today);
    html! {
        main class="mx-auto max-w-site px-4 py-6" data-ads=[site.ads_client()] {
            @if !for_schema.is_empty() { (schema(site, for_schema)) }
            h1 class="page-title" { "밈캐치 내 급상승" }
            p class="page-lede" { "밈캐치 내부 조회·반응 신호를 기준으로 모았어요." }
            @if !community_enabled {
                div role="status" class="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-4 py-3" {
                    span class="rounded-full bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent" { "베타" }
                    p class="text-base text-muted" { "밈캐치 안에서 모은 조회·저장 신호예요. 표본이 적어 순위는 참고용이에요." }
                }
            }
            @if let Some(fallback) = fallback {
                section aria-label="에디토리얼 픽" class="mt-6" {
                    div class="rounded-2xl border border-border bg-surface-2 p-5 text-center" {
                        p class="text-base font-semibold" { "아직 집계 전이에요 — 큐레이션으로 만나보세요" }
                        p class="mt-1 text-base text-muted" { "순위가 쌓이는 동안, 새로 등록된 밈을 골라 담았어요." }
                    }
                    @if fallback.is_empty() {
                        p class="mt-6 rounded-xl bg-surface-2 p-6 text-center text-base text-muted" { "등록된 밈이 아직 없어요. 곧 채워질 거예요!" }
                    } @else {
                        ol class="mt-4 grid gap-2 lg:grid-cols-2 lg:gap-x-8" {
                            @for (index, meme) in fallback.iter().enumerate() { (rank_item(meme, index + 1)) }
                        }
                    }
                }
            } @else {
                div class="mt-8" {
                    input type="radio" name="rank-tab" id="rank-tab-today" class="peer/today sr-only" checked;
                    input type="radio" name="rank-tab" id="rank-tab-week" class="peer/week sr-only";
                    input type="radio" name="rank-tab" id="rank-tab-again" class="peer/again sr-only";
                    div class="flex gap-2" {
                        label for="rank-tab-today" class={(TAB_CLASS) " peer-checked/today:border-flame-500/70 peer-checked/today:bg-flame-500/10 peer-checked/today:font-semibold peer-checked/today:text-accent peer-checked/today:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"} { "오늘의 급상승" }
                        label for="rank-tab-week" class={(TAB_CLASS) " peer-checked/week:border-flame-500/70 peer-checked/week:bg-flame-500/10 peer-checked/week:font-semibold peer-checked/week:text-accent peer-checked/week:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"} { "이번 주 많이 본" }
                        label for="rank-tab-again" class={(TAB_CLASS) " peer-checked/again:border-flame-500/70 peer-checked/again:bg-flame-500/10 peer-checked/again:font-semibold peer-checked/again:text-accent peer-checked/again:shadow-[inset_0_-2px_0_0_var(--flame-500),0_0_16px_-4px_var(--flame-500)]"} { "다시 뜨는" }
                    }
                    (tab("오늘의 급상승", "mt-4 hidden peer-checked/today:block", "today", today, "오늘 급상승한 밈이 아직 없어요."))
                    (tab("이번 주 많이 본", "mt-4 hidden peer-checked/week:block", "weekly", &[], "이번 주 조회 집계가 아직 없어요. 내일 다시 확인해 보세요."))
                    (tab("다시 뜨는", "mt-4 hidden peer-checked/again:block", "comeback", comeback, "다시 뜨는 추억 밈이 아직 없어요."))
                }
            }
        }
    }
}

/// `class` is written out whole at each call: Tailwind finds its variants
/// only in literal class names.
fn tab(label: &str, class: &str, method: &str, memes: &[RankedMeme], empty: &str) -> Markup {
    html! {
        section aria-label=(label) class=(class) {
            (method_note(method))
            @if memes.is_empty() {
                p class="rounded-xl bg-surface-2 p-6 text-center text-base text-muted" { (empty) }
            } @else {
                ol class="grid gap-2 lg:grid-cols-2 lg:gap-x-8" {
                    @for (index, meme) in memes.iter().enumerate() { (rank_item(meme, index + 1)) }
                }
            }
        }
    }
}

/// `MethodNote`. No rollup date is read, and the top weekly views are 0, so
/// the low-sample warning always shows (`isLowSample(0)`).
fn method_note(method: &str) -> Markup {
    let (_, period, formula) = METHODS
        .iter()
        .find(|(key, ..)| *key == method)
        .expect("a ranking method");
    html! {
        div class="mb-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted" {
            p { span class="font-semibold text-foreground" { "집계 기간 " (period) } }
            p class="mt-1" { (formula) }
            p class="mt-2 flex items-start gap-1.5 font-medium text-foreground" {
                span aria-hidden="true" { "▲" }
                span { "표본 적음 — 기간 내 조회가 적어 순위 차이가 크지 않아요. 정확한 등수보다 어떤 밈이 올라왔는지를 봐 주세요." }
            }
        }
    }
}

/// `SAFETY_LEVELS[level].icon`.
fn safety_icon(level: SafetyLevel) -> &'static str {
    match level {
        SafetyLevel::Green => "●",
        SafetyLevel::Yellow => "▲",
        SafetyLevel::Gray => "◌",
        SafetyLevel::Red => "✕",
    }
}

/// `LIFECYCLE_STATUS[status].token`.
fn lifecycle_token(status: &str) -> &'static str {
    match status {
        "rising" => "life-rising",
        "cooling" => "life-cooling",
        "archived" => "life-archived",
        _ => "life-active",
    }
}

/// `RankItem`.
fn rank_item(meme: &RankedMeme, rank: usize) -> Markup {
    let safety = SafetyLevel::parse(&meme.safety_level);
    let top = rank <= 3;
    html! {
        li class="min-w-0" {
            a href=(meme_path(&meme.short_id, &meme.slug)) class={"flex min-h-11 items-start gap-3 rounded-2xl p-4 transition-colors " (if top { "edge-signal" } else { "border border-border bg-surface hover:border-accent/40 hover:bg-surface-2" })} {
                span aria-hidden="true" class={"stat-mono w-7 shrink-0 pt-0.5 text-lg font-bold " (if top { "text-accent" } else { "text-muted" })} { (rank) }
                span class="sr-only" { (rank) "위" }
                span class="min-w-0 flex-1" {
                    span class="block truncate text-base font-semibold" { (meme.title) }
                    @if let Some(summary) = meme.summary.as_deref().filter(|summary| !summary.is_empty()) {
                        span class="mt-0.5 block truncate text-base text-muted" { (summary) }
                    }
                    span class="mt-1.5 flex flex-wrap items-center gap-2" {
                        span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium" style=(format!("color:var(--safety-{0});background-color:var(--safety-{0}-bg)", safety.token())) {
                            span aria-hidden="true" { (safety_icon(safety)) }
                            (safety.label())
                        }
                        span class="inline-flex items-center gap-1 text-sm font-medium" style=(format!("color:var(--{})", lifecycle_token(&meme.lifecycle_status))) {
                            svg class={"h-3.5 w-3.5 " @if meme.lifecycle_status == "rising" { "flame-rising" }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {
                                path d="M12 2c.6 3-0.6 4.7-2 6.3C8.5 10 7 11.7 7 14.5A5.3 5.3 0 0 0 12.3 20 5.7 5.7 0 0 0 18 14.2c0-2.6-1.3-4.4-2.6-5.9-.4 1-.9 1.7-1.8 2.2.2-3.2-.4-6.3-1.6-8.5Z" {}
                            }
                            (Lifecycle::parse(&meme.lifecycle_status).label())
                        }
                    }
                }
            }
        }
    }
}

/// `PublishedWeeklyList`.
fn published(memes: &[RankedMeme], site: &document::Site) -> Markup {
    html! {
        main class="mx-auto max-w-site px-4 py-6" data-ads=[site.ads_client()] {
            (schema(site, memes))
            h1 class="page-title" { "이번 주 많이 본 밈" }
            p class="page-lede" { "공개된 밈 기록에서 최근 글을 모았어요." }
            ol class="mt-6 grid gap-2 lg:grid-cols-2 lg:gap-x-8" {
                @for (index, meme) in memes.iter().enumerate() { (rank_item(meme, index + 1)) }
            }
        }
    }
}

/// `RankingsUnavailable` in Korean.
/// `RankingsUnavailable` in the language of `locale`.
fn unavailable(locale: Locale, title: &str, guidance: &str, explore: &str, href: &str) -> Markup {
    let info = locale.info();
    let align = if info.dir == "rtl" {
        "text-right"
    } else {
        "text-start"
    };
    html! {
        main lang=(info.lang) dir=(info.dir) class={"mx-auto max-w-site px-4 py-6 " (align)} {
            h1 class="text-2xl font-bold" { (title) }
            p class="mt-3 max-w-2xl text-base leading-relaxed text-muted" { (guidance) }
            div class="mt-6 flex justify-start" {
                a href=(href) class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white" { (explore) }
            }
        }
    }
}
