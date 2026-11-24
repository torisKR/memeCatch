//! The sections of `HomeExperience` (components/home/home-experience.tsx)
//! below the story, as the server renders them. What they do in the
//! browser is `ui/home.js`.

use maud::{Markup, html};

use super::copy::{Copy, Curated, HOME, SIGNAL_LEVELS};
use super::{icons, keep_phrases, localized};
use crate::pages::labels::SafetyLevel;
use crate::pages::meme_card::{self, CardMeme, safety_badge};

/// One card of the deck (`HomeEntry`).
pub struct Entry {
    pub meme: CardMeme,
    pub href: String,
    pub category_label: String,
    /// The Korean title of a translated entry.
    pub original_title: Option<String>,
}

/// `TranslatedEditionHint`: nothing on the server (the page is the same for
/// every language); `ui/home.js` puts in the one that fits the visitor.
pub fn edition_hint() -> Markup {
    html! {
        @for code in ["en", "ja", "zh", "zh-tw"] {
            @let hint = &HOME.hint[code];
            @let lang = match code { "zh-tw" => "zh-Hant", "zh" => "zh-Hans", other => other };
            template data-edition-hint=(code) {
                p lang=(lang) class="mx-auto mb-4 flex w-full max-w-site flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground" {
                    span class="text-muted" { (hint.lead) }
                    a href=(localized(code, "/")) hreflang=(code) class="inline-flex min-h-11 items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                        (hint.cta) " " span aria-hidden="true" { "→" }
                    }
                }
            }
        }
    }
}

/// `keptEnding`: the last words on one line.
fn kept_ending(text: &str, ending: Option<&str>) -> Markup {
    match ending {
        Some(ending) if ending.len() < text.len() && text.ends_with(ending) => html! {
            (text[..text.len() - ending.len()]) span class="home-discovery-keep-phrase" { (ending) }
        },
        _ => html! { (text) },
    }
}

/// `HomeDiscovery`: the recent entries, their filter and the preview.
pub fn discovery(code: &str, copy: &Copy, entries: &[Entry]) -> Markup {
    let d = &copy.discovery;
    let title_id = format!("home-discovery-title-{code}");
    let scope_id = format!("home-discovery-scope-{code}");
    let search_id = format!("home-discovery-search-{code}");
    let mut categories: Vec<&str> = Vec::new();
    for entry in entries {
        if !categories.contains(&entry.category_label.as_str()) {
            categories.push(&entry.category_label);
        }
    }
    let total = entries.len().to_string();
    html! {
        section class="home-discovery-section" aria-labelledby=(title_id) data-home-discovery {
            div class="home-discovery-heading-grid" {
                div {
                    p class="home-discovery-eyebrow" { (d.eyebrow) }
                    h2 id=(title_id) class="home-discovery-title" { (keep_phrases(&d.title, d.title_phrases.as_deref(), "home-discovery-keep-phrase")) }
                }
                p class="home-discovery-description" { (d.description) }
            }
            @if entries.is_empty() {
                div class="home-discovery-empty-state" {
                    span class="home-discovery-empty-mark" aria-hidden="true" { "00" }
                    div {
                        h3 { (kept_ending(&d.empty_title, d.unbroken_ending.as_deref())) }
                        p { (d.empty_description) }
                    }
                }
            } @else {
                div class="home-discovery-tools" {
                    form class="home-discovery-search-area" role="search" aria-label=(d.search_label) action=(localized(code, "/search")) method="get" {
                        label class="home-discovery-search-label" for=(search_id) { (d.search_label) }
                        input id=(search_id) class="home-discovery-search-input" type="search" name="q" maxlength="120" value="" placeholder=(d.search_placeholder) autocomplete="off" aria-describedby=(scope_id);
                        p id=(scope_id) class="home-discovery-search-scope" { (d.search_scope) }
                        template data-discovery-archive {
                            a class="home-discovery-search-archive" href="" { " " span aria-hidden="true" { "↗" } }
                        }
                    }
                    div class="home-discovery-category-area" {
                        p class="home-discovery-category-heading" { (d.category_label) }
                        div class="home-discovery-chips" role="group" aria-label=(d.category_label) {
                            button type="button" class="home-discovery-chip" aria-pressed="true" { (d.all_categories) }
                            @for category in &categories {
                                button type="button" class="home-discovery-chip" aria-pressed="false" data-category=(category) { (category) }
                            }
                        }
                    }
                }
                p class="home-discovery-result-status" role="status" aria-live="polite" {
                    (d.result_status.replace("{visible}", &total).replace("{total}", &total))
                }
                div class="home-discovery-content-grid" {
                    ol class="home-discovery-deck" aria-label=(d.results_label) {
                        @for (index, entry) in entries.iter().enumerate() {
                            li class="min-w-0" {
                                (meme_card::card_priority(&entry.meme, Some(&entry.href), index < 2))
                            }
                        }
                    }
                    (preview(d, &entries[0], entries.len() < 2))
                }
                template data-discovery-empty {
                    div class="home-discovery-empty-state" {
                        span class="home-discovery-empty-mark" aria-hidden="true" { "00" }
                        div {
                            h3 { (kept_ending(&d.no_results_title, d.unbroken_ending.as_deref())) }
                            p { (d.no_results_description) }
                            button type="button" class="home-discovery-clear-button" { (d.clear_filters) }
                        }
                    }
                }
            }
        }
    }
}

fn preview(d: &super::copy::DiscoveryCopy, entry: &Entry, alone: bool) -> Markup {
    html! {
        aside class="home-discovery-preview" aria-label=(d.preview_label) {
            div class="home-discovery-preview-header" {
                p class="home-discovery-preview-eyebrow" { (d.preview_eyebrow) }
                span aria-hidden="true" { "01" }
            }
            h3 { (keep_phrases(&d.preview_title, d.preview_phrases.as_deref(), "home-discovery-keep-phrase")) }
            p class="home-discovery-preview-description" { (d.preview_description) }
            div class="home-discovery-preview-record" {
                span { (entry.category_label) }
                strong { (entry.meme.title) }
                @if let Some(original) = &entry.original_title {
                    span { (d.original_label) " " span lang="ko" { (original) } }
                }
            }
            a class="home-discovery-preview-link" aria-label=(format!("{}: {}", d.preview_action, entry.meme.title)) href=(entry.href) {
                (d.preview_action) " " span aria-hidden="true" { "↗" }
            }
            button type="button" class="home-discovery-next-button" disabled[alone] {
                (d.next_preview) " " span aria-hidden="true" { "→" }
            }
        }
    }
}

/// The tabs of `HomeSafetyShowcase`, with the classes of the chosen one and
/// of the others.
const SHOWCASE_TABS: [(&str, &str); 3] = [
    ("work_safe", "💼 직장 슬랙 가능"),
    ("caution_needed", "⚠️ 주의·금기 밈"),
    ("everyday", "☕ 일상·친구 대화"),
];
const TAB_BASE: &str = "min-h-[44px] rounded-xl px-3.5 py-2 transition-all active:scale-[0.98]";
const TAB_ON: &str = "bg-accent-strong text-white shadow-sm";
const TAB_OFF: &str = "text-muted hover:text-foreground";

fn showcase_memes(tab: &str) -> impl Iterator<Item = &'static Curated> {
    let tab = tab.to_owned();
    HOME.curated
        .iter()
        .filter(move |meme| match tab.as_str() {
            "work_safe" => meme.work == "green",
            "caution_needed" => matches!(meme.safety_level.as_str(), "red" | "yellow"),
            _ => meme.friends == "green",
        })
        .take(6)
}

/// `HomeSafetyShowcase`: the first tab; the others wait in templates.
pub fn showcase() -> Markup {
    html! {
        div class="space-y-6" data-showcase {
            div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" {
                div {
                    div class="inline-flex items-center gap-1.5 rounded-full border border-safety-green/30 bg-safety-green/10 px-3 py-1 text-xs font-semibold text-safety-green" {
                        (icons::shield_check("h-3.5 w-3.5"))
                        "TPO별 밈 검증 가이드"
                    }
                    h2 class="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl" { "이 밈, 지금 써도 될까? 상황별 안전 가이드" }
                    p class="mt-1 text-base leading-7 text-foreground" { "밈의 뜻만 아는 것으로는 부족합니다. 직장 동료, 단톡방, SNS 등 장소와 대상에 따른 검증된 실전 가이드를 확인하세요." }
                }
                div class="flex pb-1 sm:pb-0 scrollbar-none h-rail" {
                    div class="inline-flex shrink-0 rounded-2xl border border-border bg-surface-2 p-1 text-xs font-semibold shadow-xs" {
                        @for (index, (tab, label)) in SHOWCASE_TABS.iter().enumerate() {
                            button type="button" class={(TAB_BASE) " " (if index == 0 { TAB_ON } else { TAB_OFF })} data-showcase-tab=(tab) { (label) }
                        }
                    }
                }
            }
            div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-showcase-grid {
                @for meme in showcase_memes("work_safe") { (showcase_card(meme)) }
            }
            @for (tab, _) in SHOWCASE_TABS {
                template data-showcase-panel=(tab) {
                    @for meme in showcase_memes(tab) { (showcase_card(meme)) }
                }
            }
        }
    }
}

fn showcase_card(meme: &Curated) -> Markup {
    let (speaker, line) = meme
        .dialogue
        .as_ref()
        .map_or(("실전 대사", meme.summary.as_str()), |d| {
            (d.speaker.as_str(), d.line.as_str())
        });
    let work_safe = meme.work == "green";
    html! {
        a data-pointer-light="" class="signal-surface group flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg active:scale-[0.99]" href=(format!("/memes/{}-{}", meme.short_id, meme.slug)) {
            div class="space-y-3" {
                div class="flex items-center justify-between" {
                    (safety_badge(SafetyLevel::parse(&meme.safety_level)))
                    span class="font-mono text-xs text-muted" { (meme.origin_year) "년 유래" }
                }
                div {
                    h3 class="text-lg font-bold text-foreground group-hover:text-accent transition-colors" { (meme.title) }
                    p class="mt-1 line-clamp-2 text-base leading-7 text-foreground" { (meme.summary) }
                }
                div class="rounded-xl border border-border/80 bg-surface-2 p-3 text-base" {
                    div class="flex items-center gap-1.5 font-semibold text-accent mb-1" {
                        (icons::message_circle("size-3"))
                        span { (speaker) }
                    }
                    p class="line-clamp-2 italic text-foreground/90 leading-relaxed" { "“" (line) "”" }
                }
            }
            div class="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs" {
                div class="flex items-center gap-2" {
                    span class="text-muted" { "직장" }
                    span class=(if work_safe { "font-bold text-safety-green" } else { "font-bold text-safety-red" }) {
                        (if work_safe { "안전 🟢" } else { "주의 🔴" })
                    }
                }
                span class="flex items-center gap-1 font-semibold text-accent group-hover:translate-x-0.5 transition-transform" {
                    "상세 가이드"
                    (icons::arrow_right("h-3.5 w-3.5"))
                }
            }
        }
    }
}

/// `indexableQuizHref`: a question's meme link is shown only when that
/// curated meme passes the index gate.
pub fn diagnostic_link_shown(href: &str) -> bool {
    HOME.curated
        .iter()
        .any(|meme| format!("/memes/{}-{}", meme.short_id, meme.slug) == href)
}

pub const OPTION_CLASS: &str = "flex min-h-[50px] w-full items-center justify-between rounded-xl border p-4 text-left text-sm transition-all sm:text-base active:scale-[0.99]";

/// `SafetyDiagnosticQuiz` at its first question, unanswered.
pub fn diagnostic() -> Markup {
    let first = &HOME.diagnostic[0];
    let total = HOME.diagnostic.len();
    html! {
        div class="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-xl sm:p-8" data-diagnostic {
            div class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" {}
            div class="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-safety-green/10 blur-3xl" {}
            div class="relative flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5" {
                div {
                    div class="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent-text" {
                        (icons::shield_check("h-4 w-4"))
                        "밈캐치 실전 진단기"
                    }
                    h3 class="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl" { "직장·일상 밈 소통 안전도 자가진단" }
                    p class="mt-1 text-sm text-muted" { "“이 상황에서 이 밈, 써도 될까?” 5가지 실제 상황을 통해 나의 밈 감각과 안전도를 테스트해 보세요." }
                }
                div class="flex items-center gap-2 font-mono text-sm font-semibold text-muted" data-diagnostic-counter {
                    span class="text-accent" { "1" }
                    span { "/" }
                    span { (total) }
                }
            }
            div class="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" data-diagnostic-progress {
                div class="h-full bg-accent transition-all duration-300 ease-out" style="width:0%" {}
            }
            div class="relative mt-6 space-y-6" data-diagnostic-body {
                div class="space-y-2" {
                    div class="inline-block rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground" { (first.situation) }
                    h4 class="text-lg font-bold leading-snug text-foreground sm:text-xl" { (first.scenario) }
                    div class="flex items-center gap-2 pt-1 text-sm text-muted" {
                        span { "판별 대상 밈:" }
                        span class="font-semibold text-foreground underline decoration-accent/50 underline-offset-4" { (first.target_meme) }
                    }
                }
                div class="grid gap-3" {
                    @for option in &first.options {
                        button type="button" class={(OPTION_CLASS) " border-border bg-surface-2 hover:border-accent/40 text-foreground"} {
                            span class="flex-1 pr-3 leading-relaxed" { (option.label) }
                        }
                    }
                }
            }
            // The icons an answer brings, which the script copies.
            template data-diagnostic-icons {
                (icons::circle_check("h-5 w-5 text-safety-green"))
                (icons::circle_x("h-5 w-5 text-safety-red"))
                (icons::circle_check("h-5 w-5"))
                (icons::triangle_alert("h-5 w-5"))
                (icons::copy("h-3.5 w-3.5 shrink-0 opacity-70"))
                (icons::check("h-3.5 w-3.5 shrink-0 text-safety-green"))
                (icons::arrow_right("h-3 w-3"))
                (icons::arrow_right("h-4 w-4"))
                (icons::sparkles("size-8"))
                (icons::rotate_ccw("h-4 w-4"))
            }
        }
    }
}

/// `DailyMemeQuiz` before its question arrives. `ui/home.js` fetches it.
pub fn daily_quiz() -> Markup {
    html! {
        section aria-labelledby="daily-meme-quiz-title" data-home-section="daily-quiz" data-daily-quiz="home" {
            div class="rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6" {
                div class="flex flex-wrap items-center justify-between gap-3" {
                    h2 id="daily-meme-quiz-title" class="flex items-center gap-2 text-lg font-bold sm:text-xl" {
                        span aria-hidden="true" class="inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800" { "오늘" }
                        "오늘의 밈 퀴즈"
                    }
                }
                p role="status" class="mt-4 text-sm text-muted" { "오늘의 문제를 가져오고 있어요…" }
            }
        }
    }
}

const SIGNAL_TONE: [(&str, &str); 4] = [
    ("green", "bg-safety-green-bg text-safety-green"),
    ("yellow", "bg-safety-yellow-bg text-safety-yellow"),
    ("gray", "bg-safety-gray-bg text-safety-gray"),
    ("red", "bg-safety-red-bg text-safety-red"),
];

/// `SafetySignalGuide` (components/safety-legend.tsx). No script: `<details>`.
pub fn signals(copy: &Copy) -> Markup {
    let s = &copy.signals;
    html! {
        section aria-labelledby="safety-signal-guide-title" class="rounded-2xl border border-border bg-surface px-5 py-7 shadow-sm sm:px-7 sm:py-8" {
            p class="text-sm font-bold text-accent-text" { (s.eyebrow) }
            h2 id="safety-signal-guide-title" class="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl" { (s.title) }
            p class="mt-3 max-w-2xl text-base leading-7 text-foreground" { (s.description) }
            ol class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" {
                @for level in SIGNAL_LEVELS {
                    @let item = &s.levels[level];
                    @let tone = SIGNAL_TONE.iter().find(|(l, _)| *l == level).map_or("", |(_, t)| *t);
                    li {
                        details class="group h-full rounded-xl border border-border bg-surface-2 open:bg-surface" {
                            summary tabindex="0" class="cursor-pointer list-none rounded-xl px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden" {
                                span class="flex items-start gap-3" {
                                    span aria-hidden="true" class={"grid size-10 shrink-0 place-items-center rounded-xl " (tone)} {
                                        (SafetyLevel::parse(level).icon("size-6"))
                                    }
                                    span class="min-w-0 flex-1" {
                                        span class="block font-bold text-foreground" { (item.label) }
                                        span class="mt-1 block text-base leading-6 text-foreground" { (item.summary) }
                                        span class="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-foreground" {
                                            (icons::chevron_down("size-4 transition-transform group-open:rotate-180"))
                                            span class="group-open:hidden" { (s.expand) }
                                            span class="hidden group-open:!inline" { (s.collapse) }
                                        }
                                    }
                                }
                            }
                            p class="px-4 pb-4 text-base leading-7 text-foreground" { (item.detail) }
                        }
                    }
                }
            }
            p class="mt-5 max-w-3xl text-base leading-7 text-foreground" { (s.disclaimer) }
        }
    }
}

/// The pathways section of `HomeExperience`.
pub fn pathways(code: &str, copy: &Copy) -> Markup {
    let p = &copy.home.pathways;
    let title_id = format!("home-pathways-title-{code}");
    html! {
        section id="home-pathways" data-home-section="pathways" aria-labelledby=(title_id) class="home-web3-pathways-section home-web3-anchor-target" {
            div class="home-web3-section-inner" {
                header class="home-web3-pathways-header" {
                    h2 id=(title_id) class="home-web3-section-title" { (p.title) }
                    p class="home-web3-section-description" { (p.description) }
                }
                div class="home-web3-pathway-grid" {
                    a href="/community" class="home-web3-pathway-card home-web3-community-card" {
                        span aria-hidden="true" class="home-web3-community-motif" {}
                        span class="home-web3-card-top" {
                            (icons::messages_square("home-web3-card-icon"))
                            span class="home-web3-card-mark" { (copy.web3.pathways.community_mark) }
                        }
                        span class="home-web3-card-body" {
                            span class="home-web3-card-title" { (p.community.title) }
                            span class="home-web3-card-description" { (p.community.description) }
                            span class="home-web3-card-action" { (p.community.action) (icons::arrow_right("home-web3-button-icon")) }
                        }
                    }
                }
                div class="home-web3-contribution-bar" {
                    p { (p.contribution_label) }
                    div class="home-web3-contribution-links" {
                        a href="/community/new" class="home-web3-contribution-link" { (p.community.create_action) }
                        a href="/submit" rel="nofollow" class="home-web3-contribution-link" { (p.submit_action) }
                        @if code == "ko" {
                            a href="/originals" class="home-web3-contribution-link" { "오리지널 보러 가기" }
                            a href="/submit" rel="nofollow" class="home-web3-contribution-link" { "밈 올리기" }
                        }
                    }
                }
            }
        }
    }
}

/// The editorial trust aside of `HomeExperience`.
pub fn trust(code: &str, copy: &Copy) -> Markup {
    let t = &copy.home.trust;
    let title_id = format!("home-trust-title-{code}");
    html! {
        aside id="home-editorial" data-home-section="editorial-trust" aria-labelledby=(title_id) class="home-web3-editorial-trust home-web3-anchor-target" {
            div class="home-web3-trust-grid" {
                div class="home-web3-trust-copy" {
                    h2 id=(title_id) class="home-web3-trust-title" { (keep_phrases(&t.title, t.title_phrases.as_deref(), "home-web3-keep-phrase")) }
                    p class="home-web3-trust-description" { (t.description) }
                    nav aria-label=(t.eyebrow) {
                        ul class="home-web3-trust-links" {
                            @for link in &t.links {
                                li { a href=(link.href) class="home-web3-trust-link" { (link.label) } }
                            }
                        }
                    }
                }
            }
        }
    }
}
