//! The body of the Korean meme page: `app/(default)/memes/[key]/page.tsx` from
//! the top of `<main>` through the origin section. Markup transcribed from
//! what Next renders (`scripts/html-to-maud.mjs`).
//!
//! Not rendered here, in page order: the reaction bar, the export button,
//! related videos, related memes, the same-category and same-year links, the
//! sources panel (trust note, contribution form), the sign-in invite, the
//! market passport, the evidence list, the safety rationale, the lifecycle
//! guide and the comments. `docs/axum-migration/UI-PLAN.md` lists them.

use maud::{Markup, html};

use super::sources::HOUSE_ORIGINAL_LABEL;
use super::{Fallback, MemeDocument, UsageExample};
use super::{export, house, signal_trace};
use crate::pages::content_depth::ContentDepth;
use crate::pages::i18n::Locale;
use crate::pages::labels::{Lifecycle, SafetyLevel};

const SAVED_CLASS: &str = "border-accent bg-accent-soft text-accent shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)]";
const UNSAVED_CLASS: &str = "border-border bg-surface text-foreground";

/// `SAVE_COPY` of the page's language, for `ui/save.js`.
fn save_copy() -> String {
    serde_json::to_string(Locale::korean().save()).expect("save copy serializes")
}

pub struct DetailView<'a> {
    pub meme: &'a MemeDocument,
    /// `memePathFrom(short_id, slug)`.
    pub path: &'a str,
    pub depth: &'a ContentDepth,
    pub fallback: Fallback<'a>,
    pub usage_examples: &'a [UsageExample],
    /// JSON-LD blocks, in page order.
    pub json_ld: Markup,
    /// The AdSense client, when this document may carry ads
    /// (`isAdsenseContentEligible`) and auto ads are switched on. Next
    /// renders nothing for it on the server either: the loader is added in
    /// the browser, on the live host only (`ui/page.js`).
    pub ads_client: Option<&'a str>,
    /// The sections after the origin (`sections.rs`).
    pub right_rail: Markup,
    /// `ContextNav`, from the request's query.
    pub context_nav: Markup,
}

pub fn main(view: &DetailView<'_>) -> Markup {
    let meme = view.meme;
    let usage_note = meme.usage_note.as_deref().filter(|note| !note.is_empty());
    let caution = meme.caution.as_deref().filter(|text| !text.is_empty());
    html! {
        main class="mx-auto max-w-site space-y-6 px-4 py-5 pb-14" data-meme-id=(meme.id) data-ads=[view.ads_client] {
            (view.json_ld)
            (view.context_nav)
            @if meme.moderation_status == "limited" {
                p role="status" class="flex min-h-11 items-center gap-2 rounded-xl bg-safety-yellow-bg px-4 py-2.5 text-base font-semibold text-safety-yellow" {
                    span aria-hidden="true" { "▲" }
                    "출처 확인 중 · 정보가 바뀔 수 있어요."
                }
            }
            div class="space-y-3" {
                (answer_card(meme, usage_note))
                div class="flex justify-end" {
                    button type="button" class="hover-glow-flame inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]" data-share=(view.path) data-share-title=(meme.title) {
                        svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                            circle cx="6" cy="12" r="2.5" {}
                            circle cx="17" cy="6" r="2.5" {}
                            circle cx="17" cy="18" r="2.5" {}
                            path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6" {}
                        }
                        "공유"
                    }
                    p role="status" aria-live="polite" class="sr-only" {}
                }
            }
            div class="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start lg:gap-8" {
                div class="space-y-4" {
                    section aria-label="대표 콘텐츠" {
                        @if meme.is_house_original() {
                            (house::visual(&meme.title, &meme.summary))
                        } @else {
                            (media_slot(meme, &view.fallback))
                        }
                    }
                    (export::button(&meme.short_id))
                }
                div class="mt-6 min-w-0 space-y-5 lg:mt-0" {
                    (doc_status_note(meme, view.depth))
                    @if !meme.description.is_empty() {
                        section aria-labelledby="meme-meaning" data-detail-order="meaning" {
                            h2 id="meme-meaning" class="text-lg font-bold [word-break:keep-all]" { "뜻" }
                            p data-korean-body class="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]" { (meme.description) }
                        }
                    }
                    @if usage_note.is_some() || !view.usage_examples.is_empty() {
                        section aria-labelledby=(if usage_note.is_some() { "meme-usage" } else { "usage-examples-title" }) data-detail-order="usage" class="space-y-4" {
                            @if let Some(note) = usage_note {
                                div {
                                    h2 id="meme-usage" class="text-lg font-bold [word-break:keep-all]" { "이렇게 써요" }
                                    p data-korean-body class="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]" { (note) }
                                }
                            }
                            (usage_examples(view.usage_examples, usage_note.is_none()))
                        }
                    }
                    @if let Some(caution) = caution {
                        section aria-labelledby="meme-caution" data-detail-order="caution" {
                            h2 id="meme-caution" class="text-lg font-bold [word-break:keep-all]" { "쓰면 안 되는 상황" }
                            p data-korean-body class="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]" { (caution) }
                        }
                    }
                    @if !meme.origin.is_empty() || meme.is_house_original() {
                        section aria-labelledby="meme-origin" data-detail-order="origin" {
                            h2 id="meme-origin" class="text-lg font-bold [word-break:keep-all]" {
                                (if meme.is_house_original() { "어떻게 만들었나요?" } else { "유래" })
                            }
                            @if meme.is_house_original() {
                                p class="mt-1.5 text-sm font-semibold text-foreground" { (HOUSE_ORIGINAL_LABEL) }
                            }
                            @if !meme.origin.is_empty() {
                                p data-korean-body class="mt-1.5 whitespace-pre-line text-base leading-relaxed [word-break:keep-all]" { (meme.origin) }
                            }
                        }
                    }
                    (view.right_rail)
                }
            }
        }
    }
}

/// `components/answer-card.tsx`. The entrance and the glow are CSS
/// animations (`ui/site.css`); Next starts both from an inline style that the
/// `motion` library then animates.
fn answer_card(meme: &MemeDocument, usage_note: Option<&str>) -> Markup {
    let safety = SafetyLevel::parse(&meme.safety_level);
    let lifecycle = Lifecycle::parse(&meme.lifecycle_status);
    html! {
        section aria-label="정답 카드" class="answer-card-in rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8" {
            div class="flex items-start justify-between gap-3" {
                h1 class="meme-detail-title-title min-w-0 flex-1 whitespace-normal text-3xl font-extrabold leading-[1.15] tracking-[-0.03em] md:text-5xl" { (meme.title) }
                (copy_button(&format!("{}: {}", meme.title, meme.summary), "밈 명칭 및 요약 복사", CopyStyle::Pill))
            }
            p id="meme-summary" data-korean-lead class="mt-1.5 text-lg leading-relaxed text-foreground [word-break:keep-all]" { (meme.summary) }
            @if meme.doc_class == "event" {
                p class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-safety-gray-bg px-3 py-1 text-sm font-semibold text-safety-gray" {
                    span aria-hidden="true" class="leading-none" { "◌" }
                    "밈이 아니라 인터넷 문화 사건 기록이에요"
                }
            }
            div class="relative mt-4" {
                span aria-hidden="true" class="answer-card-glow pointer-events-none absolute inset-0 rounded-2xl" style=(format!("box-shadow:0 0 24px 4px var(--safety-{})", safety.token())) {}
                p class=(format!("safety-pulse instrument-grid flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3.5 shadow-[0_0_0_1px_color-mix(in_srgb,currentColor_38%,transparent),0_0_10px_-2px_color-mix(in_srgb,currentColor_55%,transparent)] {}", safety.tone())) {
                    span aria-hidden="true" class="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] text-2xl leading-none" {
                        (safety.icon("size-6"))
                    }
                    span class="flex min-w-0 flex-col" {
                        span class="text-sm font-medium opacity-80" { "사용 안전 신호" }
                        span class="text-xl font-bold leading-tight" { (safety.label()) }
                    }
                }
            }
            @if let Some(note) = usage_note {
                p class="mt-3 line-clamp-2 text-sm leading-relaxed text-muted" {
                    strong class="text-foreground" { "사용 예" }
                    " · " (note)
                }
            }
            div class="mt-4" {
                div {
                    // `components/save-button.tsx`; `ui/save.js` swaps the two class
                    // lists and the label, and opens the frame's sign-in dialog.
                    button type="button" aria-pressed="false" class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-base font-semibold transition-colors border-border bg-surface text-foreground" data-save-meme=(meme.id) data-save-copy=(save_copy()) data-saved-class=(SAVED_CLASS) data-unsaved-class=(UNSAVED_CLASS) {
                        svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" {
                            path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4V4Z" stroke-linecap="round" stroke-linejoin="round" {}
                        }
                        "이 밈 저장하기"
                    }
                    p role="status" aria-live="polite" class="mt-1 min-h-5 text-center text-sm text-muted" {}
                }
            }
            div class="mt-5 flex items-center gap-4 border-t border-border pt-4" {
                p class="shrink-0 text-sm text-muted" {
                    "유행 단계 "
                    strong class="font-bold text-foreground" { (lifecycle.label()) }
                }
                div class="min-w-0 flex-1" {
                    (signal_trace::large(lifecycle))
                }
            }
        }
    }
}

#[derive(Clone, Copy)]
enum CopyStyle {
    Pill,
    Mini,
    MiniInBubble,
}

/// `components/copy-text-button.tsx` before a click. `site.js` copies
/// `data-copy` to the clipboard.
fn copy_button(text: &str, aria_label: &str, style: CopyStyle) -> Markup {
    const BASE: &str = "inline-flex items-center justify-center font-medium transition-all active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
    const MINI: &str = "h-7 px-2 text-[11px] rounded-md border border-border/80 bg-surface text-muted hover:text-foreground hover:border-accent/50";
    let class = match style {
        CopyStyle::Pill => format!(
            "{BASE} min-h-[36px] px-3 py-1.5 text-xs rounded-full border border-border bg-surface text-foreground shadow-xs hover:border-accent/50 hover:bg-accent/5 shrink-0 mt-0.5"
        ),
        CopyStyle::Mini => format!("{BASE} {MINI} shrink-0"),
        // Fainter until its speech bubble is hovered.
        CopyStyle::MiniInBubble => {
            format!("{BASE} {MINI} shrink-0 opacity-80 group-hover:opacity-100")
        }
    };
    html! {
        button type="button" aria-label=(aria_label) title=(aria_label) class=(class) data-copy=(text) {
            svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" {
                rect width="14" height="14" x="8" y="8" rx="2" ry="2" {}
                path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" {}
            }
            @if matches!(style, CopyStyle::Pill) {
                span class="ml-1" { "복사" }
            }
        }
    }
}

/// The fallback hero of `components/meme-embed.tsx`: what the media slot
/// shows for a document with no playable content.
fn media_slot(meme: &MemeDocument, fallback: &Fallback<'_>) -> Markup {
    let (headline, detail, link_label) = match fallback.source_url {
        Some(_) if fallback.context_source => (
            "원본 맥락은 출처에서 확인할 수 있어요.",
            "이 링크는 원본을 복제하지 않고 유래와 맥락을 설명하는 참고 출처예요.",
            "출처에서 원본 맥락 보기",
        ),
        Some(_) => (
            "원본 콘텐츠는 출처에서 볼 수 있어요.",
            "저작권 보호를 위해 원본을 복제하지 않고 링크로 연결해요.",
            "출처에서 원본 보기",
        ),
        None => (
            "원본을 아직 연결하지 못했지만, 뜻과 맥락은 여기 남아 있어요.",
            "아직 재생 가능한 원본 링크가 없는 콘텐츠예요. 아래 설명이 이 밈의 기록이에요.",
            "",
        ),
    };
    html! {
        div class="space-y-3" {
            div class="flex flex-wrap items-center gap-1.5" {
                @if let Some(category) = meme.category_label() {
                    span class="inline-flex items-center rounded-full border border-current/30 px-2.5 py-1 text-xs font-bold tracking-tight" { (category) }
                }
                @if let Some(year) = meme.origin_year {
                    span class="inline-flex items-center rounded-full border border-current/30 px-2.5 py-1 text-xs font-bold tracking-tight" { (year) "년 무렵" }
                }
            }
            div class="max-w-prose text-foreground" {
                p class="text-base font-semibold" { (headline) }
                p class="mt-1 text-sm leading-relaxed" { (detail) }
                @if let Some(url) = fallback.source_url {
                    a href=(url) target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-base font-semibold text-foreground transition-colors hover:border-accent hover:text-accent" {
                        (link_label)
                        span aria-hidden="true" { "↗" }
                    }
                }
            }
        }
    }
}

/// `components/usage-examples.tsx`. `heading` is true when the section has no
/// usage note above the examples.
fn usage_examples(examples: &[UsageExample], heading: bool) -> Markup {
    if examples.is_empty() {
        return html! {};
    }
    let cards = html! {
        div class="space-y-4" {
            @for example in examples {
                div class="rounded-xl border border-border/80 bg-surface-2/60 p-4 transition-all hover:border-border sm:p-5" {
                    div class="flex items-center justify-between gap-2 pb-3 border-b border-border/50" {
                        span class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-semibold text-foreground" {
                            span class="size-1.5 rounded-full bg-accent" {}
                            (example.situation)
                        }
                        span class="text-[11px] text-muted" { "메신저 시뮬레이션" }
                    }
                    div class="mt-3.5 space-y-3" {
                        @if example.dialogue.is_empty() {
                            div class="flex flex-col items-start" {
                                span class="mb-1 text-[11px] font-semibold text-muted px-1" { "추천 활용 예시" }
                                div class="group relative flex w-full items-center justify-between gap-3 rounded-2xl rounded-tl-xs border border-border bg-surface p-3.5 text-sm sm:text-base leading-relaxed text-foreground shadow-xs" {
                                    div class="flex items-start gap-2.5" {
                                        svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square-quote mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" {
                                            path d="M14 14a2 2 0 0 0 2-2V8h-2" {}
                                            path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" {}
                                            path d="M8 14a2 2 0 0 0 2-2V8H8" {}
                                        }
                                        p class="break-words font-medium" { (example.text) }
                                    }
                                    (copy_button(&example.text, "예문 복사", CopyStyle::Mini))
                                }
                            }
                        } @else {
                            @for line in &example.dialogue {
                                @let is_user = line.speaker == "나" || line.speaker.contains("사용자");
                                div class=(if is_user { "flex flex-col items-end" } else { "flex flex-col items-start" }) {
                                    span class="mb-1 text-[11px] font-semibold text-muted px-1" { (line.speaker) }
                                    div class=(format!("group relative flex items-center gap-2 max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm sm:text-base leading-relaxed shadow-xs {}", if is_user { "rounded-tr-xs bg-accent/15 border border-accent/40 text-foreground font-medium" } else { "rounded-tl-xs bg-surface border border-border text-foreground" })) {
                                        p class="flex-1 break-words" { (line.line) }
                                        @if is_user {
                                            (copy_button(&line.line, "밈 답변 복사", CopyStyle::MiniInBubble))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    const WRAPPER: &str =
        "rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4 shadow-xs";
    html! {
        @if heading {
            section aria-labelledby="usage-examples-title" class=(WRAPPER) {
                div class="flex items-center justify-between" {
                    div {
                        div class="flex items-center gap-2" {
                            span class="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent" {
                                svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-messages-square size-4" aria-hidden="true" {
                                    path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" {}
                                    path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" {}
                                }
                            }
                            h2 id="usage-examples-title" class="text-lg font-bold text-foreground sm:text-xl [word-break:keep-all]" { "이렇게 써요" }
                        }
                        p class="mt-1 text-xs text-muted sm:text-sm" { "메신저와 일상 대화에서 어색하지 않게 사용하는 모범 용례입니다." }
                    }
                }
                (cards)
            }
        } @else {
            div class=(WRAPPER) { (cards) }
        }
    }
}

/// `components/doc-status-note.tsx`: only on a document the depth check calls thin.
fn doc_status_note(meme: &MemeDocument, depth: &ContentDepth) -> Markup {
    if !depth.is_thin() {
        return html! {};
    }
    let missing: Vec<&str> = [
        (depth.origin_chars == 0, "유래"),
        (depth.usage_example_count == 0, "사용 예문"),
        (depth.source_count == 0, "출처"),
    ]
    .into_iter()
    .filter_map(|(absent, name)| absent.then_some(name))
    .collect();
    let anchor = if depth.usage_example_count == 0 {
        "#contribute-example"
    } else {
        "#contribute-source"
    };
    html! {
        aside aria-labelledby="doc-status-title" class="rounded-2xl border border-border bg-surface-2 p-5" {
            h2 id="doc-status-title" class="flex items-center gap-2 text-base font-bold" {
                span aria-hidden="true" { "✎" }
                " 아직 정리 중인 문서예요"
            }
            p class="mt-2 text-base leading-relaxed" {
                @if missing.is_empty() {
                    "이 문서는 아직 내용을 보강하는 중이에요."
                } @else {
                    strong class="font-semibold" { (missing.join("·")) }
                    " 확인이 끝나지 않아 이 문서는 지금까지 확인된 내용만 담고 있어요."
                }
                " 추측으로 채우지 않고, 근거를 확인한 만큼만 단계적으로 공개해요."
            }
            p class="mt-2 text-sm text-muted" {
                "「" (meme.title) "」, 실제로 써 보셨다면 알려 주세요. 검수를 거쳐 이 문서에 반영해요."
            }
            div data-track="correction_report_started" data-track-from="doc_status" data-track-short-id=(meme.short_id) {
                a href=(anchor) class="mt-3 inline-flex min-h-11 items-center rounded-xl bg-surface px-4 py-2.5 text-base font-semibold underline underline-offset-2 transition-colors hover:text-foreground" { "아는 내용 보태기" }
            }
        }
    }
}
