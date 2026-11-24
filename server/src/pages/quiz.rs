//! `GET /quiz` and `GET /quiz/r/{token}` (`app/(default)/quiz/page.tsx`,
//! `app/(default)/quiz/r/[token]/page.tsx`, `components/quiz-app.tsx`).
//!
//! The page renders the start screen: the three modes, or a friend's
//! challenge decoded from the token (`decodeQuizShareToken`). The quiz
//! itself is `ui/quiz.js` (its own bundle, with `lib/quiz.ts`,
//! `lib/quiz-share.ts` and `lib/quiz-card.ts`) over `/api/quiz`. The screens
//! only the browser shows are templates here.
//!
//! A token that does not decode is the not-found document, `noindex`
//! (`PLAN.md` B2-3, C3-6).

use std::sync::LazyLock;

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;
use serde_json::json;

use super::document::{self, Head, ShareImage};
use super::{html, html_cached, path_and_query};
use crate::AppState;

const TITLE: &str = "밈력고사 — 내 밈력은 몇 점?";
const DESCRIPTION: &str = "밈캐치 사전 4,000여 개 밈에서 매번 새로 출제되는 10문항 밈 지식 퀴즈. 요즘 밈·추억 밈 모드로 풀고, 등급과 나의 밈 감성 연대까지 확인해 보세요.";
/// A static page's `Cache-Control`.
const STATIC_CACHE: &str = "s-maxage=31536000";
/// `QUIZ_SIZE`.
const QUIZ_SIZE: usize = 10;
const SHORT_ID_LENGTH: usize = 8;
const HEADER_LENGTH: usize = 4;

/// `MODES` of the start screen.
const MODES: [(&str, &str, &str); 3] = [
    ("all", "전체", "1990년대부터 지금까지 골고루"),
    ("now", "요즘 밈만", "2020년 이후 등장한 밈"),
    ("retro", "추억 밈만", "2009년 이전 그 시절 밈"),
];

#[derive(Deserialize)]
struct Grade {
    from: u32,
    label: String,
    comment: String,
}

/// `server/i18n/quiz.json`: `gradeForScore`'s five grades and
/// `QUIZ_MODE_LABEL`.
#[derive(Deserialize)]
struct QuizCopy {
    grades: Vec<Grade>,
    modes: std::collections::HashMap<String, String>,
}

static COPY: LazyLock<QuizCopy> = LazyLock::new(|| {
    serde_json::from_str(include_str!("../../i18n/quiz.json")).expect("quiz.json")
});

/// `gradeForScore(correct, total)`.
fn grade(correct: usize, total: usize) -> &'static Grade {
    let percent = if total > 0 {
        correct as f64 / total as f64 * 100.0
    } else {
        0.0
    };
    COPY.grades
        .iter()
        .find(|grade| percent >= f64::from(grade.from))
        .expect("a grade from 0")
}

/// `QuizShareResult`.
struct Result {
    token: String,
    mode: &'static str,
    short_ids: Vec<String>,
    correct: Vec<bool>,
    score: usize,
}

/// `decodeQuizShareToken`.
fn decode(raw: &str) -> Option<Result> {
    let token = crate::routes::public::js::trim(raw);
    if !token.is_ascii() || token.len() < HEADER_LENGTH + SHORT_ID_LENGTH {
        return None;
    }
    let mode = match &token[..1] {
        "a" => "all",
        "n" => "now",
        "r" => "retro",
        _ => return None,
    };
    let mask_hex = &token[1..HEADER_LENGTH];
    if !mask_hex
        .bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return None;
    }
    let body = &token[HEADER_LENGTH..];
    if !body.len().is_multiple_of(SHORT_ID_LENGTH) {
        return None;
    }
    let total = body.len() / SHORT_ID_LENGTH;
    if !(1..=QUIZ_SIZE).contains(&total) {
        return None;
    }
    let short_ids: Vec<String> = (0..total)
        .map(|i| body[i * SHORT_ID_LENGTH..(i + 1) * SHORT_ID_LENGTH].to_owned())
        .collect();
    let valid = |id: &String| {
        id.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
    };
    if !short_ids.iter().all(valid) {
        return None;
    }
    let unique: std::collections::HashSet<&String> = short_ids.iter().collect();
    if unique.len() != short_ids.len() {
        return None;
    }
    let mask = u32::from_str_radix(mask_hex, 16).ok()?;
    if mask >= 1 << total {
        return None;
    }
    let correct: Vec<bool> = (0..total).map(|i| mask & (1 << i) != 0).collect();
    let score = correct.iter().filter(|ok| **ok).count();
    Some(Result {
        token: token.to_owned(),
        mode,
        short_ids,
        correct,
        score,
    })
}

fn mode_label(mode: &str) -> &str {
    COPY.modes.get(mode).map_or(mode, String::as_str)
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/quiz".to_owned()),
        image: Some(ShareImage::site_default(site)),
        script: Some("quiz"),
        ..Head::default()
    };
    let main = html! {
        main class="ink-grid mx-auto max-w-site px-4 pb-14 pt-8" data-quiz=(json!({ "challenge": null })) data-site-url=(site.url) {
            h1 class="page-title" { "밈력고사, 내 밈력은 몇 점?" }
            p class="page-lede" { "밈 사전 데이터로 자동 출제되는 밈 지식 퀴즈예요. 제목만 보고 진짜 뜻을 맞혀 보세요." }
            (start_screen())
            (templates())
        }
    };
    html_cached(
        StatusCode::OK,
        STATIC_CACHE,
        document::page(site, &head, path_and_query(&request), main),
    )
}

/// `/quiz/r/{token}`.
pub async fn result(State(state): State<AppState>, request: Request) -> Response {
    let token = request
        .uri()
        .path()
        .strip_prefix("/quiz/r/")
        .unwrap_or_default();
    // The segment is decoded first; an escape that is no UTF-8 decodes to no
    // token.
    let token = percent_encoding::percent_decode_str(token)
        .decode_utf8()
        .unwrap_or_default();
    // The 404 document with the page's own title, as `/community/{id}`'s
    // (`PLAN.md` B6-22, C3-6).
    let Some(result) = decode(&token) else {
        return super::not_found::response_titled(
            &state.pages.site,
            path_and_query(&request),
            "결과를 찾을 수 없어요",
            "noindex",
        );
    };
    let total = result.short_ids.len();
    let grade = grade(result.score, total);
    let site = &state.pages.site;
    let title = format!("밈력고사 {}/{}점 · {}", result.score, total, grade.label);
    let path = format!("/quiz/r/{}", result.token);
    let head = Head {
        title: title.clone(),
        description: Some(format!(
            "친구의 밈력은 {}점! 같은 {}문항({} 모드)으로 내 점수 이겨보기.",
            result.score,
            total,
            mode_label(result.mode)
        )),
        robots: Some("noindex, follow"),
        canonical: Some(path),
        image: Some(ShareImage {
            url: site.absolute(&format!("/og/quiz/{}", result.token)),
            mime: None,
            alt: format!(
                "밈력고사 결과 {}/{}점, {}",
                result.score, total, grade.label
            ),
        }),
        script: Some("quiz"),
        ..Head::default()
    };
    let challenge = json!({
        "mode": result.mode,
        "shortIds": result.short_ids,
        "correct": result.correct,
        "score": result.score,
        "total": total,
        "gradeLabel": grade.label,
        "gradeComment": grade.comment,
    });
    let main = html! {
        main class="ink-grid mx-auto max-w-5xl px-4 pb-14 pt-8" data-quiz=(json!({ "challenge": challenge })) data-site-url=(site.url) {
            p class="text-sm font-semibold text-accent-strong" { "밈력고사" }
            h1 class="mt-1 text-2xl font-extrabold sm:text-3xl" { "친구의 밈력은 " (result.score) "점!" }
            p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base" { "같은 문제를 풀고 누가 더 밈잘알인지 겨뤄 보세요." }
            (challenge_screen(&result, total, grade))
            (templates())
        }
    };
    html(
        StatusCode::OK,
        document::page(site, &head, path_and_query(&request), main),
    )
}

const PILL: &str = "inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PILL_OUTLINE: &str = "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 font-semibold transition-colors hover:border-accent hover:text-accent";

fn grid() -> Markup {
    html! { div aria-hidden="true" class="instrument-grid pointer-events-none absolute inset-0" {} }
}

/// `StartScreen`.
fn start_screen() -> Markup {
    html! {
        section aria-label="밈력고사 시작" class="mt-6" data-quiz-screen="start" {
            div class="edge-signal relative overflow-hidden rounded-3xl p-5 shadow-sm sm:p-8" {
                (grid())
                p class="text-sm font-semibold text-accent-strong" { "10문항 스피드 퀴즈" }
                h2 class="mt-1 text-2xl font-extrabold sm:text-3xl" { "범위를 골라 바로 시작하세요" }
                p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base" {
                    "밈캐치 사전에 실제로 등록된 밈에서 매번 새로 출제돼요. 제목을 보고 진짜 뜻을 골라 보세요 — 다 풀면 등급과 당신의 밈 감성 연대가 나옵니다."
                }
                div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3" {
                    @for (index, (key, label, desc)) in MODES.iter().enumerate() {
                        @let first = index == 0;
                        button type="button" data-quiz-mode=(key) class={"group flex min-h-11 flex-col items-start gap-0.5 rounded-2xl p-4 text-left transition-[border-color,transform,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] " (if first { "border-2 border-accent-strong bg-accent-soft/60 shadow-sm hover:shadow-md" } else { "border border-border bg-surface-2 hover:border-accent" })} {
                            span class="flex w-full items-center justify-between gap-2 font-bold" {
                                (label)
                                svg viewBox="0 0 24 24" aria-hidden="true" class={"h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 " (if first { "text-accent-strong" } else { "text-muted" })} fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" {
                                    path d="M5 12h13M13 6l6 6-6 6" {}
                                }
                            }
                            span class="text-sm text-muted" { (desc) }
                            @if first {
                                span class="mt-1 rounded-full bg-accent-strong px-2 py-0.5 text-[11px] font-bold text-white" { "추천" }
                            }
                        }
                    }
                }
                p class="mt-4 hidden text-xs text-muted sm:block" { "키보드 1~4로도 답할 수 있어요." }
            }
        }
    }
}

/// `ScoreBars`.
fn score_bars(correct: &[bool], label: &str) -> Markup {
    html! {
        ol aria-label=(label) class="mx-auto mt-4 flex max-w-xs justify-center gap-1.5" {
            @for (index, ok) in correct.iter().enumerate() {
                li aria-label=(format!("{}번 {}", index + 1, if *ok { "정답" } else { "오답" })) class={"h-2 flex-1 rounded-full " (if *ok { "bg-(--signal-cyan)" } else { "bg-surface-2" })} {}
            }
        }
    }
}

/// `ChallengeStartScreen`.
fn challenge_screen(result: &Result, total: usize, grade: &Grade) -> Markup {
    html! {
        section aria-label="친구의 밈력고사 결과" class="mt-6" data-quiz-screen="challenge" {
            div class="edge-signal relative overflow-hidden rounded-3xl p-5 text-center shadow-sm sm:p-8" {
                (grid())
                p class="text-sm font-semibold text-accent-strong" { "친구가 보낸 도전장 · " (mode_label(result.mode)) " 모드" }
                p class="mt-2 text-5xl font-extrabold tabular-nums" {
                    span class="stat-mono text-(--signal-cyan)" style="filter:drop-shadow(0 0 14px var(--signal-cyan))" { (result.score) }
                    span class="text-2xl font-bold text-muted" { "/" (total) }
                }
                p class="mt-3 inline-flex items-center rounded-full bg-accent-soft px-4 py-1.5 text-base font-bold text-accent-strong" { (grade.label) }
                p class="mt-2 text-sm text-muted sm:text-base" { (grade.comment) }
                (score_bars(&result.correct, "친구의 문항별 정답"))
                p class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted sm:text-base" { "친구가 푼 것과 같은 " (total) "문항이 그대로 나와요. 몇 점이면 이길 수 있을까요?" }
                div class="mt-5 flex flex-wrap items-center justify-center gap-2" {
                    button type="button" class=(PILL) data-quiz-action="challenge" { "내 점수 이겨보기" }
                    button type="button" class=(PILL_OUTLINE) data-quiz-action="skip" { "새 문제로 풀기" }
                }
            }
        }
    }
}

const CARD: &str = "rounded-3xl border border-border bg-surface p-8 text-center shadow-sm";

/// The screens only the browser shows, for `ui/quiz.js`: it fills the
/// `data-slot` parts.
fn templates() -> Markup {
    html! {
        template data-quiz-template="start" { (start_screen()) }
        template data-quiz-template="loading" {
            section aria-busy="true" class="mt-6" aria-label="문제 출제 중" {
                div class=(CARD) {
                    p role="status" class="font-semibold" { "사전에서 문제를 뽑고 있어요…" }
                    p class="mt-1 text-sm text-muted" { "매번 다른 10문항이 출제됩니다." }
                }
            }
        }
        template data-quiz-template="error" {
            section class="mt-6" aria-label="출제 실패" {
                div class=(CARD) {
                    p role="status" class="font-semibold" { "문제를 불러오지 못했어요." }
                    p class="mt-1 text-sm text-muted" { "잠시 후 다시 시도해 주세요." }
                    button type="button" class="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 font-bold text-white transition-transform active:scale-[0.97]" data-quiz-action="retry" { "다시 시도" }
                    button type="button" class="ml-2 mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 font-semibold transition-colors hover:border-accent hover:text-accent" data-quiz-action="skip" { "새 문제로 풀기" }
                }
            }
        }
        template data-quiz-template="question" {
            section class="mt-6" {
                div class="flex items-center gap-3" {
                    div role="progressbar" aria-valuemin="0" aria-label="퀴즈 진행도" class="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" {
                        div class="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style="background:linear-gradient(90deg, var(--flame-400), var(--flame-600))" data-slot="bar" {}
                    }
                    p class="shrink-0 text-sm font-semibold tabular-nums text-muted" data-slot="count" {}
                }
                div class="mt-4 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6" {
                    h2 class="text-lg font-bold leading-snug sm:text-xl" data-slot="question" {}
                    ol class="mt-4 space-y-2.5" data-slot="options" {}
                    div class="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3" {
                        p role="status" class="text-sm font-semibold" data-slot="feedback" { span class="sr-only" { "보기를 선택해 주세요" } }
                    }
                }
            }
        }
        template data-quiz-template="option" {
            li {
                button type="button" class="flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base" {
                    span aria-hidden="true" class="grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold" {}
                    span class="min-w-0 flex-1" {}
                }
            }
        }
        template data-quiz-template="check" {
            svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" { path d="m5 12.5 5 5L19 7" {} }
        }
        template data-quiz-template="cross" {
            svg viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true" { path d="M6 6l12 12M18 6 6 18" {} }
        }
        template data-quiz-template="answered" {
            div class="flex items-center gap-2" {
                a target="_blank" class="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" data-slot="meme" { "이 밈 보러가기 " span aria-hidden="true" { "→" } }
                button type="button" class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-quiz-action="next" {}
            }
        }
        template data-quiz-template="result" {
            section aria-label="밈력고사 결과" class="mt-6" {
                div class="rounded-3xl border border-border bg-surface p-5 text-center shadow-sm sm:p-8" data-slot="card" {
                    p class="text-sm font-semibold text-muted" { "나의 밈력" }
                    p class="mt-1 text-5xl font-extrabold tabular-nums" {
                        span class="stat-mono text-(--signal-cyan)" style="filter:drop-shadow(0 0 14px var(--signal-cyan))" data-slot="score" {}
                        span class="text-2xl font-bold text-muted" data-slot="total" {}
                    }
                    p class="mt-3 inline-flex items-center rounded-full bg-accent-soft px-4 py-1.5 text-base font-bold text-accent-strong" data-slot="grade" {}
                    p class="mt-2 text-sm text-muted sm:text-base" data-slot="comment" {}
                    p class="mt-1 text-sm font-semibold sm:text-base" data-slot="era" {}
                    p role="status" class="mx-auto mt-4 max-w-md rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold sm:text-base" data-slot="versus" {}
                    div class="mt-5 flex flex-wrap items-center justify-center gap-2" {
                        button type="button" class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-strong px-5 font-bold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-quiz-action="image" {
                            svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                                rect width="18" height="18" x="3" y="3" rx="3" ry="3" {}
                                circle cx="8.5" cy="8.5" r="1.5" {}
                                path d="m21 15-5-5L5 21" {}
                            }
                            span data-slot="image-label" { "성적표 이미지 저장 (인스타/카톡)" }
                        }
                        button type="button" class="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-5 font-semibold transition-colors hover:border-accent hover:text-accent" data-quiz-action="share" {
                            svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {
                                circle cx="6" cy="12" r="2.5" {}
                                circle cx="17" cy="6" r="2.5" {}
                                circle cx="17" cy="18" r="2.5" {}
                                path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6" {}
                            }
                            span data-slot="share-label" { "결과 링크 공유" }
                        }
                        button type="button" class=(PILL_OUTLINE) data-quiz-action="retry" data-slot="retry" {}
                        button type="button" class=(PILL_OUTLINE) data-quiz-action="change" { "모드 변경" }
                    }
                    p class="mt-3 text-sm font-semibold text-safety-green" data-slot="notice" {}
                }
                div class="mt-5" data-slot="wrong" {
                    h3 class="text-lg font-bold" { "틀린 밈 복습하기" }
                    ul class="mt-3 space-y-2" data-slot="wrong-list" {}
                }
            }
        }
        template data-quiz-template="wrong" {
            li {
                a class="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" {
                    span class="min-w-0" {
                        span class="block font-bold" data-slot="title" {}
                        span class="mt-0.5 block text-sm text-muted" data-slot="answer" {}
                    }
                    span aria-hidden="true" class="shrink-0 text-muted" { "→" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_token_decodes_as_decode_quiz_share_token_reads_it() {
        let token = "a00120brm83m233wtsxf";
        let result = decode(token).expect("a token");
        assert_eq!(result.mode, "all");
        assert_eq!(result.short_ids, ["20brm83m", "233wtsxf"]);
        assert_eq!(result.correct, [true, false]);
        assert_eq!(result.score, 1);
        assert_eq!(grade(1, 2).label, "밈러");
        assert_eq!(grade(9, 10).label, "밈장인");
        assert_eq!(grade(0, 10).label, "밈세계 입문 환영");
        // The mask cannot name a question that is not there, ids are unique,
        // and the header is lower-case hex.
        assert!(decode("a00420brm83m233wtsxf").is_none());
        assert!(decode("a00120brm83m20brm83m").is_none());
        assert!(decode("a00F20brm83m").is_none());
        assert!(decode("x00120brm83m").is_none());
        assert!(decode("a0012").is_none());
        assert!(decode(" a00120brm83m ").is_some());
    }
}
