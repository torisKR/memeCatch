//! `MpeReviewConsole` and `MpeReviewTransparency`
//! (`components/admin/mpe-review-console.tsx`, `mpe-review-transparency.tsx`)
//! as they first render: no message, nothing pending. The `data-admin-*`
//! attributes are what `ui/admin-mpe.js` reads; a button carrying
//! `data-admin-blocked` stays disabled whatever the console does.

use maud::{Markup, html};

use super::fields::{RIGHTS_BASES, SOURCE_ROLES};
use super::format::textarea;
use super::mpe::{percent, status_label};
use super::mpe_detail::{Candidate, Data};
use crate::routes::js_json;
use crate::routes::public::js;
use crate::routes::request::{Json, property};

const REVIEW_FIELDS: [(&str, &str); 6] = [
    ("TITLE", "제목"),
    ("DEFINITION", "뜻"),
    ("MEANING", "의미"),
    ("ORIGIN", "유래"),
    ("USAGE", "사용법"),
    ("SAFETY", "안전성"),
];

const PRIMARY: &str =
    "min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50";
const RED: &str = "min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-4 font-semibold text-safety-red disabled:opacity-50";
const PLAIN: &str =
    "min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50";

/// `timecode`: `mm:ss.mmm`, `시간 없음` without a time.
fn timecode(ms: Option<f64>) -> String {
    let Some(ms) = ms else {
        return "시간 없음".to_owned();
    };
    let pad = |value: f64, width: usize| format!("{:0>width$}", js_json::number(value));
    format!(
        "{}:{}.{}",
        pad((ms / 60_000.0).floor(), 2),
        pad(((ms % 60_000.0) / 1_000.0).floor(), 2),
        pad(ms % 1_000.0, 3)
    )
}

/// `reviewNotesFromDraft`: the draft's notes on a known field with a reason.
fn review_notes(draft: &Json) -> Vec<(&'static str, &str)> {
    let entries = draft.as_object().unwrap_or_default();
    let Some(Json::Array(notes)) = property(entries, "reviewNotes") else {
        return Vec::new();
    };
    notes
        .iter()
        .filter_map(|note| {
            let note = note.as_object()?;
            let field = property(note, "field").and_then(Json::as_str).unwrap_or("");
            let reason = js::trim(
                property(note, "reason")
                    .and_then(Json::as_str)
                    .unwrap_or(""),
            );
            let (_, label) = REVIEW_FIELDS.iter().find(|(name, _)| *name == field)?;
            (!reason.is_empty()).then_some((*label, reason))
        })
        .collect()
}

fn transparency(draft: &Json, confidence: Option<f64>) -> Markup {
    let notes = review_notes(draft);
    html! {
        section class="mt-4 rounded-lg border border-safety-yellow bg-safety-yellow-bg p-4" aria-labelledby="mpe-transparency-title" {
            div class="flex flex-wrap items-baseline justify-between gap-2" {
                h3 id="mpe-transparency-title" class="font-semibold text-safety-yellow" { "자동 분석 참고 신호" }
                @match confidence {
                    None => span class="text-sm font-medium text-safety-yellow" { "참고값 없음" },
                    Some(value) => span class="stat-mono text-sm font-semibold text-safety-yellow" { (percent(value)) "%" },
                }
            }
            p class="mt-1 text-sm leading-relaxed text-foreground" { "이 값과 아래 메모는 자동 분석을 돕는 참고 정보예요. 사실 확인이나 권리 승인을 대신하지 않아요." }
            @if notes.is_empty() {
                p class="mt-3 text-sm text-muted" { "추가 보류 메모가 없어요. 그래도 운영자 사실·권리 검수는 필요해요." }
            } @else {
                ul class="mt-3 space-y-2" aria-label="자동 분석 보류 메모" {
                    @for (label, reason) in &notes {
                        li class="rounded-md bg-background/70 p-3 text-sm" {
                            strong { (label) " 확인 필요" }
                            span class="mt-1 block leading-relaxed text-muted" { (reason) }
                        }
                    }
                }
            }
        }
    }
}

fn field(label: &str, value: &str) -> Markup {
    html! { div { dt class="text-muted" { (label) } dd class="mt-1 break-words" { (value) } } }
}

fn summary(candidate: &Candidate) -> Markup {
    let media = [
        Some(candidate.mime.as_str()).filter(|mime| !mime.is_empty()),
        candidate.dimensions.as_deref(),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" · ");
    html! {
        section class="rounded-xl border border-border bg-surface p-5" {
            div class="flex flex-wrap items-center justify-between gap-3" {
                div {
                    h2 class="text-xl font-semibold" { (candidate.title) }
                    p class="mt-1 text-sm text-muted" {
                        (candidate.meme_type) " · " (status_label(&candidate.status))
                        @if let Some(confidence) = candidate.confidence { (format!(" · 자동 분석 참고값 {}%", percent(confidence))) }
                    }
                }
                span class="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent" { (candidate.mode) }
            }
            dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4" {
                (field("출처 제목", candidate.source_title.as_deref().unwrap_or("없음")))
                (field("작성자", candidate.author.as_deref().unwrap_or("없음")))
                (field("링크 상태", candidate.availability.as_deref().unwrap_or("미확인")))
                (field("미디어", if media.is_empty() { "없음" } else { &media }))
            }
            @if let Some(url) = &candidate.source_url {
                a href=(url) target="_blank" rel="noreferrer noopener" class="mt-3 inline-flex min-h-11 items-center break-all text-sm text-accent-text underline" { "공식 출처 열기" }
            }
            (transparency(&candidate.draft, candidate.confidence))
        }
    }
}

fn jobs(data: &Data) -> Markup {
    html! {
        section class="rounded-xl border border-border bg-surface p-5" {
            h2 class="text-lg font-semibold" { "처리 작업" }
            ul class="mt-3 space-y-2" {
                @for job in &data.jobs {
                    li class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm" {
                        span {
                            strong { (job.kind) } " · " (job.status) " · 시도 " (job.attempts) "회"
                            @if let Some(processor) = &job.processor { " · " (processor) }
                            @if let Some(error) = &job.error { " · " (error) }
                        }
                        @if matches!(job.status.as_str(), "failed" | "skipped" | "completed") {
                            button type="button" data-admin-reprocess=(job.id) class="min-h-11 rounded-lg border border-border bg-background px-3 font-semibold disabled:opacity-50" { "재처리" }
                        }
                    }
                }
            }
        }
    }
}

fn timeline(data: &Data) -> Markup {
    html! {
        section class="rounded-xl border border-border bg-surface p-5" {
            h2 class="text-lg font-semibold" { "ASR · OCR 타임라인" }
            ol class="mt-4 space-y-3" {
                @for segment in &data.timeline {
                    li class="border-l-2 border-accent pl-4" {
                        p class="text-xs font-semibold text-muted" {
                            (timecode(segment.start)) " · " (segment.origin)
                            @if let Some(confidence) = segment.confidence { (format!(" · {}%", percent(confidence))) }
                        }
                        p class="mt-1 whitespace-pre-wrap text-base" { (segment.text) }
                    }
                }
            }
            h3 class="mt-6 font-semibold" { "대표 프레임·산출물 참조" }
            ul class="mt-2 space-y-2 text-sm" {
                @for artifact in &data.artifacts {
                    @let time = timecode(artifact.frame_ms);
                    li class="rounded-lg bg-surface-2 p-3" {
                        @if artifact.representative { "대표 · " }
                        (artifact.kind) " · " (time)
                        @match (&artifact.signed, artifact.mime.as_deref()) {
                            (Some(url), Some(mime)) if mime.starts_with("image/") => {
                                img alt=(format!("{time} {}프레임", if artifact.representative { "대표 " } else { "" })) loading="lazy" width="640" height="360" decoding="async" data-nimg="1"
                                    class="mt-2 h-auto max-h-96 w-auto max-w-full rounded-lg border border-border object-contain" style="color:transparent" src=(url);
                            }
                            _ => code class="mt-1 block break-all text-xs text-muted" { (artifact.reference) }
                        }
                    }
                }
            }
        }
    }
}

fn matches(data: &Data) -> Markup {
    html! {
        section class="rounded-xl border border-border bg-surface p-5" {
            h2 class="text-lg font-semibold" { "유사 밈 상위 5개" }
            ol class="mt-3 space-y-2" {
                @for found in data.matches.iter().take(5) {
                    li class="flex items-center justify-between gap-3 rounded-lg bg-surface-2 p-3 text-sm" {
                        span { (found.title) " · " (found.relation) }
                        strong { (percent(found.score)) "%" }
                    }
                }
            }
        }
    }
}

fn claims(candidate: &Candidate, data: &Data) -> Markup {
    let fact = candidate.status == "FACT_CHECKING";
    html! {
        section class="rounded-xl border border-border bg-surface p-5" {
            h2 class="text-lg font-semibold" { "근거 연결 주장" }
            ul class="mt-3 space-y-3" {
                @for claim in &data.claims {
                    li class="rounded-lg bg-surface-2 p-4" {
                        p class="text-xs font-semibold text-muted" { (claim.field) " · " (claim.status) " · " (percent(claim.confidence)) "%" }
                        p class="mt-1 text-base" { (claim.text) }
                        p class="mt-2 text-xs text-muted" { "근거: " (if claim.evidence.is_empty() { "없음".to_owned() } else { claim.evidence.join(", ") }) }
                        @if fact && !claim.evidence.is_empty() && claim.status == "PENDING" {
                            div class="mt-3 flex gap-2" {
                                button type="button" data-admin-claim=(claim.id) data-admin-decision="APPROVED" class="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-3 font-semibold text-safety-green disabled:opacity-50" { "근거 승인" }
                                button type="button" data-admin-claim=(claim.id) data-admin-decision="REJECTED" class="min-h-11 rounded-lg border border-safety-red bg-safety-red-bg px-3 font-semibold text-safety-red disabled:opacity-50" { "근거 반려" }
                            }
                        }
                    }
                }
            }
        }
    }
}

fn select(label: &str, data: &str, options: &[(&str, &str)], value: Option<&str>) -> Markup {
    html! {
        label class="block" {
            span class="mb-1 block text-sm font-medium" { (label) }
            select aria-label=(label) data-admin-select=(data) class="min-h-11 w-full rounded-lg border border-border bg-background px-3" {
                option value="" selected[value.is_none()] { "선택하세요" }
                @for (option, text) in options {
                    option value=(option) selected[value == Some(*option)] { (text) }
                }
            }
        }
    }
}

fn review_button(decision: &str, class: &str, text: &str, blocked: bool) -> Markup {
    html! {
        button type="button" data-admin-review=(decision) data-admin-blocked[blocked] disabled[blocked] class=(class) { (text) }
    }
}

fn review(candidate: &Candidate, data: &Data) -> Markup {
    let unresolved = data
        .claims
        .iter()
        .any(|claim| claim.evidence.is_empty() || claim.status != "APPROVED");
    let publish_blocked = unresolved || !candidate.attested;
    let rights_ready = candidate
        .source_role
        .as_deref()
        .is_some_and(|role| !role.is_empty())
        && candidate
            .rights_basis
            .as_deref()
            .is_some_and(|basis| !basis.is_empty() && !matches!(basis, "unknown" | "blocked"));
    let stage = candidate.status.as_str();
    let draft = js_json::stringify_parsed_pretty(&candidate.draft);
    html! {
        section class="space-y-4 rounded-xl border border-border bg-surface p-5" {
            div {
                h2 class="text-lg font-semibold" { "초안 수정·검수" }
                p class="mt-1 text-sm text-muted" { "모델 " (candidate.model) " · 프롬프트 " (candidate.prompt) }
            }
            label class="block" {
                span class="mb-1 block text-sm font-medium" { "편집 초안 JSON" }
                textarea aria-label="편집 초안 JSON" data-admin-draft rows="12" class="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm" { (textarea(&draft)) }
            }
            div class="grid gap-3 rounded-lg bg-surface-2 p-4 sm:grid-cols-2" {
                (select("출처 역할", "role", &SOURCE_ROLES, candidate.source_role.as_deref()))
                (select("권리 근거", "basis", &RIGHTS_BASES, candidate.rights_basis.as_deref()))
                button type="button" data-admin-rights class="min-h-11 rounded-lg border border-border bg-background px-4 font-semibold disabled:opacity-50 sm:col-span-2" { "출처·권리 저장" }
            }
            button type="button" data-admin-revision class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 font-semibold disabled:opacity-50" { "수정 이력 저장" }
            @if !data.revisions.is_empty() {
                div {
                    h3 class="font-semibold" { "수정 전·후 이력" }
                    div class="mt-2 grid gap-3 lg:grid-cols-2" {
                        @for revision in data.revisions.iter().take(2) {
                            article class="rounded-lg bg-surface-2 p-3" {
                                p class="text-xs font-semibold text-muted" { "revision " (revision.number) " · " (revision.model) " · " (revision.prompt) }
                                pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs" { (js_json::stringify_parsed_pretty(&revision.draft)) }
                            }
                        }
                    }
                }
            }
            label class="block" {
                span class="mb-1 block text-sm font-medium" { "검수 메모" }
                textarea data-admin-reason rows="3" class="w-full rounded-lg border border-border bg-background p-3 text-base" {}
            }
            div class="flex flex-wrap gap-2" {
                @if stage == "FACT_CHECKING" { (review_button("APPROVED", PRIMARY, "사실 검수 승인", unresolved)) }
                @if stage == "RIGHTS_CHECKING" { (review_button("APPROVED", PRIMARY, "권리 검수 승인", !candidate.attested || !rights_ready)) }
                @if stage == "PUBLISH" {
                    (review_button("PUBLISHED", PRIMARY, "공개", publish_blocked || !rights_ready))
                    (review_button("LIMITED", "min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 font-semibold text-safety-yellow disabled:opacity-50", "제한 공개", publish_blocked || !rights_ready))
                }
                @if matches!(stage, "FACT_CHECKING" | "RIGHTS_CHECKING") { (review_button("CHANGES_REQUESTED", PLAIN, "수정 요청", false)) }
                @if matches!(stage, "FACT_CHECKING" | "RIGHTS_CHECKING" | "PUBLISH") { (review_button("REJECTED", RED, "반려", false)) }
            }
            @if unresolved { p class="text-sm text-safety-yellow" { "승인된 근거가 없는 주장이 있어 다음 단계를 진행할 수 없어요." } }
            @if !candidate.attested { p class="text-sm text-safety-yellow" { "권리 근거가 확인되지 않아 권리 승인·공개를 진행할 수 없어요." } }
            @if !rights_ready { p class="text-sm text-safety-yellow" { "출처 역할과 승인 가능한 권리 근거를 저장해야 권리 승인·공개를 진행할 수 있어요." } }
        }
    }
}

pub fn console(candidate: &Candidate, data: &Data) -> Markup {
    html! {
        div class="space-y-6" data-admin-controls="mpe-console" data-admin-candidate=(candidate.id) data-admin-stage=(candidate.status) data-admin-ingestion=(candidate.ingestion) {
            (summary(candidate))
            (jobs(data))
            div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" {
                (timeline(data))
                (matches(data))
            }
            (claims(candidate, data))
            (review(candidate, data))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{review_notes, timecode};
    use crate::routes::request::Json;

    #[test]
    fn timecodes_pad_minutes_seconds_and_millis() {
        assert_eq!(timecode(None), "시간 없음");
        assert_eq!(timecode(Some(61_500.0)), "01:01.500");
        assert_eq!(timecode(Some(5.0)), "00:00.005");
        assert_eq!(timecode(Some(6_000_000.0)), "100:00.000");
    }

    #[test]
    fn review_notes_keep_known_fields_with_a_reason() {
        let draft = Json::parse(r#"{"reviewNotes":[{"field":"ORIGIN","reason":" 원출처 "},{"field":"NOPE","reason":"x"},{"field":"TITLE","reason":"  "},"x"]}"#).unwrap();
        assert_eq!(review_notes(&draft), vec![("유래", "원출처")]);
    }
}
