//! `GET /admin/submissions/{id}` (`app/(default)/admin/submissions/[id]/page.tsx`):
//! one submission and `SubmissionReview` (claim, GPT draft, approve, reject),
//! which `ui/admin.js` runs against `routes/admin/submissions.rs`. The approve
//! and reject forms are `<template>`s until their button opens them, as React
//! mounts them then.

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use time::OffsetDateTime;

use super::fields::{CATEGORIES, CONTEXTS, DIFFICULTIES, SAFETY, safety_select};
use super::format::{self, KST};
use super::shell::{self, Root};
use super::submissions::{is_overdue, overdue_badge, status_label};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::admin::openai;
use crate::routes::public::labels;

const TITLE: &str = "제보 검토";

struct Submission {
    id: String,
    name: String,
    seen_at: Option<String>,
    source_url: Option<String>,
    description: Option<String>,
    attachment_path: Option<String>,
    guess_reason: Option<String>,
    tags: Vec<String>,
    status: String,
    reject_reason: Option<String>,
    dup_of: Option<String>,
    claimed_by: Option<String>,
    created_at: String,
    dup: Option<(String, String, String)>,
    submitter: Option<String>,
    claimer: Option<String>,
}

const SQL: &str = "select s.id::text, s.name, s.seen_at, s.source_url, s.description, s.attachment_path, s.guess_reason, \
    coalesce(s.tags, '{}'), s.status::text, s.reject_reason, s.dup_of::text, s.claimed_by::text, to_json(s.created_at) #>> '{}', \
    d.title, d.short_id, d.slug, sp.nickname, cp.nickname \
    from public.meme_submissions s \
    left join public.memes d on d.id = s.dup_of \
    left join public.profiles sp on sp.id = s.submitter_id \
    left join public.profiles cp on cp.id = s.claimed_by \
    where s.id = $1::uuid";

async fn load(state: &AppState, user: &SessionUser, id: &str) -> Option<Submission> {
    use sqlx::Row;
    let id = id.to_owned();
    let row = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move { sqlx::query(SQL).bind(id).fetch_optional(tx).await })
        })
        .await
        .ok()
        .flatten()?;
    let text = |index: usize| row.try_get::<Option<String>, _>(index).ok().flatten();
    Some(Submission {
        id: text(0)?,
        name: text(1)?,
        seen_at: text(2),
        source_url: text(3),
        description: text(4),
        attachment_path: text(5),
        guess_reason: text(6),
        tags: row.try_get::<Vec<String>, _>(7).ok()?,
        status: text(8)?,
        reject_reason: text(9),
        dup_of: text(10),
        claimed_by: text(11),
        created_at: text(12)?,
        dup: match (text(13), text(14), text(15)) {
            (Some(title), Some(short_id), Some(slug)) => Some((title, short_id, slug)),
            _ => None,
        },
        submitter: text(16),
        claimer: text(17),
    })
}

pub async fn page(
    State(state): State<AppState>,
    Path(id): Path<String>,
    request: Request,
) -> Response {
    let user = match super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let Some(submission) = load(&state, &user, &id).await else {
        return super::super::html(
            StatusCode::NOT_FOUND,
            shell::not_found(&state.pages.site, TITLE),
        );
    };
    let main = view(&submission, &user, openai::configured(&state));
    super::screen(&state, Root::Site, TITLE, "/admin/submissions", main)
}

/// `{ year: "numeric", month: "short", day: "numeric", hour: "2-digit",
/// minute: "2-digit", timeZone: "Asia/Seoul" }`: `2026년 11월 23일 오후 12:04`.
fn received(value: &str) -> String {
    let Some(at) = format::parse_timestamp(value) else {
        return "Invalid Date".to_owned();
    };
    let local = at.to_offset(KST);
    let (period, hour) = format::twelve_hour(local.hour());
    format!(
        "{}년 {}월 {}일 {period} {hour:02}:{:02}",
        local.year(),
        u8::from(local.month()),
        local.day(),
        local.minute()
    )
}

fn field(label: &str, value: &str) -> Markup {
    html! { div { dt class="text-muted" { (label) } dd class="mt-0.5" { (value) } } }
}

fn or_missing(value: Option<&str>) -> &str {
    value.filter(|value| !value.is_empty()).unwrap_or("미기재")
}

fn view(submission: &Submission, user: &SessionUser, has_openai_key: bool) -> Markup {
    let open = matches!(submission.status.as_str(), "pending" | "reviewing");
    let overdue = open && is_overdue(&submission.created_at, OffsetDateTime::now_utc());
    html! {
        div class="space-y-6" {
            div {
                a href="/admin/submissions" class="text-base text-muted hover:text-foreground" { "← 제보 큐로" }
                div class="mt-2 flex flex-wrap items-center gap-2" {
                    h1 class="text-2xl font-bold" { (submission.name) }
                    @if overdue { (overdue_badge()) }
                    span class="text-base text-muted" { (status_label(&submission.status)) }
                }
            }
            @if let (Some(_), Some((title, short_id, slug))) = (&submission.dup_of, &submission.dup) {
                div class="rounded-xl border border-safety-yellow bg-safety-yellow-bg p-4" {
                    p class="text-base font-semibold text-safety-yellow" { span aria-hidden="true" { "▲" } " 중복 의심 — 같은 이름의 밈이 이미 있어요" }
                    a href=(labels::meme_path(short_id, slug)) class="mt-1 inline-flex min-h-11 items-center text-base underline" { "기존 밈 보기: " (title) }
                }
            }
            section class="rounded-xl border border-border bg-surface p-5" {
                h2 class="text-lg font-semibold" { "제보 내용" }
                dl class="mt-3 grid gap-x-8 gap-y-3 text-base sm:grid-cols-2" {
                    (field("제보자", submission.submitter.as_deref().unwrap_or("탈퇴한 사용자")))
                    (field("접수 시각", &received(&submission.created_at)))
                    (field("본 곳", or_missing(submission.seen_at.as_deref())))
                    (field("담당자", submission.claimer.as_deref().unwrap_or("아직 없음")))
                    div class="sm:col-span-2" {
                        dt class="text-muted" { "출처 링크" }
                        dd class="mt-0.5 break-all" {
                            @match submission.source_url.as_deref().filter(|url| !url.is_empty()) {
                                Some(url) => a href=(super::safe_href(url)) target="_blank" rel="noreferrer noopener" class="text-accent-text underline" { (url) },
                                None => "미기재",
                            }
                        }
                    }
                    div class="sm:col-span-2" {
                        dt class="text-muted" { "설명" }
                        dd class="mt-0.5 whitespace-pre-wrap" { (or_missing(submission.description.as_deref())) }
                    }
                    @if let Some(reason) = submission.guess_reason.as_deref().filter(|reason| !reason.is_empty()) {
                        div class="sm:col-span-2" { dt class="text-muted" { "유행 이유 추측" } dd class="mt-0.5 whitespace-pre-wrap" { (reason) } }
                    }
                    @if let Some(path) = submission.attachment_path.as_deref().filter(|path| !path.is_empty()) {
                        div class="sm:col-span-2" {
                            dt class="text-muted" { "첨부 이미지" }
                            dd class="mt-2" {
                                a href=(format!("/api/media/{path}")) target="_blank" rel="noreferrer noopener" class="inline-block" {
                                    img src=(format!("/api/media/{path}")) alt=(format!("{} 제보 첨부 이미지", submission.name)) loading="lazy" class="max-h-80 w-auto max-w-full rounded-xl border border-border object-contain";
                                }
                            }
                        }
                    }
                    @if !submission.tags.is_empty() {
                        div class="sm:col-span-2" { dt class="text-muted" { "태그" } dd class="mt-0.5" { (submission.tags.join(", ")) } }
                    }
                    @if let Some(reason) = submission.reject_reason.as_deref().filter(|reason| !reason.is_empty()) {
                        div class="sm:col-span-2" { dt class="text-safety-red" { "반려 사유" } dd class="mt-0.5 whitespace-pre-wrap" { (reason) } }
                    }
                }
            }
            @if open {
                (review(submission, submission.claimed_by.as_deref() == Some(user.id.as_str()), has_openai_key))
            } @else {
                p class="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted" { "이미 처리된 제보예요." }
            }
        }
    }
}

const INPUT: &str =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";
const REJECT_OPTIONS: [&str; 4] = ["중복", "출처 부족", "저작권", "부적절"];

/// `SubmissionReview`.
fn review(submission: &Submission, claimed_by_me: bool, has_openai_key: bool) -> Markup {
    let legend = SAFETY
        .iter()
        .map(|(_, icon, admin, _)| format!("{icon} {admin}"))
        .collect::<Vec<_>>()
        .join(" / ");
    html! {
        section class="space-y-4 rounded-xl border border-border bg-surface p-5" data-admin-controls="submission" data-admin-submission=(submission.id) {
            h2 class="text-lg font-semibold" { "검토 처리" }
            div class="flex flex-wrap gap-2" data-admin-buttons {
                @if submission.status == "pending" {
                    button type="button" class="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50" data-admin-claim { "내가 검토하기 (claim)" }
                }
                span title=[(!has_openai_key).then_some("OPENAI_API_KEY 설정 필요")] {
                    button type="button" disabled[!has_openai_key] class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50" data-admin-draft data-admin-key=(if has_openai_key { "1" } else { "" }) { "GPT-5.6 Sol high로 검수 초안" }
                }
                button type="button" class="min-h-11 rounded-lg border px-4 text-base font-semibold disabled:opacity-50 border-border bg-surface-2" data-admin-mode="approve" { "승인 → 밈 생성" }
                button type="button" class="min-h-11 rounded-lg border px-4 text-base font-semibold disabled:opacity-50 border-border bg-surface-2" data-admin-mode="reject" { "반려" }
            }
            @if submission.status == "reviewing" && !claimed_by_me {
                p class="text-base text-muted" { "다른 운영자가 검토 중인 제보예요." }
            }
            template data-admin-form="approve" {
                form class="space-y-4 border-t border-border pt-4" {
                    div class="grid gap-4 lg:grid-cols-2" {
                        label class="block" { span class="mb-1 block text-base font-medium" { "제목" } input required class=(INPUT) value=(submission.name) data-admin-field="title"; }
                        label class="block" { span class="mb-1 block text-base font-medium" { "유행 시작 연도" } input inputmode="numeric" placeholder="예: 2025" class=(INPUT) value="" data-admin-field="originYear"; }
                    }
                    label class="block" { span class="mb-1 block text-base font-medium" { "한 줄 요약" } input required class=(INPUT) value="" data-admin-field="summary"; }
                    label class="block" { span class="mb-1 block text-base font-medium" { "설명" } textarea rows="5" class=(INPUT) data-admin-field="description" {} }
                    label class="block" { span class="mb-1 block text-base font-medium" { "유래" } textarea rows="3" class=(INPUT) data-admin-field="origin" {} }
                    div class="grid gap-4 lg:grid-cols-3" {
                        (safety_select("사용 안전 신호등", "safetyLevel", "yellow"))
                        label class="block" {
                            span class="mb-1 block text-base font-medium" { "카테고리" }
                            select class="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none min-h-11" data-admin-field="category" {
                                @for (value, label) in CATEGORIES { option value=(value) selected[value == "phrase"] { (label) } }
                            }
                        }
                        label class="block" {
                            span class="mb-1 block text-base font-medium" { "난이도" }
                            select class="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none min-h-11" data-admin-field="difficulty" {
                                @for (value, label) in DIFFICULTIES { option value=(value) selected[value == "normal"] { (label) } }
                            }
                        }
                    }
                    fieldset {
                        legend class="mb-2 text-base font-medium" { "사용 맥락별 신호등" }
                        div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                            @for (key, label, value) in CONTEXTS { (safety_select(label, &format!("usage.{key}"), value)) }
                        }
                    }
                    label class="block" { span class="mb-1 block text-base font-medium" { "태그 (쉼표로 구분)" } input class=(INPUT) value=(submission.tags.join(", ")) data-admin-field="tags"; }
                    p class="text-sm text-muted" { "승인하면 밈이 생성되고 검수 상태가 대기 → 사실 확인 → 저작권 확인 → 게시 순서로 전이돼요. (신호등 라벨: " (legend) ")" }
                    button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50" { "밈 생성 및 게시" }
                }
            }
            template data-admin-form="reject" {
                form class="space-y-4 border-t border-border pt-4" {
                    fieldset {
                        legend class="mb-2 text-base font-medium" { "반려 사유 카테고리 (필수)" }
                        div class="flex flex-wrap gap-2" {
                            @for option in REJECT_OPTIONS {
                                label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-base border-border bg-surface-2" data-admin-choice {
                                    input type="radio" name="reject-category" value=(option) class="sr-only";
                                    (option)
                                }
                            }
                        }
                    }
                    label class="block" {
                        span class="mb-1 block text-base font-medium" { "상세 사유 (필수)" }
                        textarea rows="3" required class=(INPUT) placeholder="제보자에게 전달할 사유를 적어 주세요." data-admin-field="rejectReason" {}
                    }
                    button type="submit" class="min-h-11 rounded-lg bg-safety-red px-5 text-base font-semibold text-background disabled:opacity-50" { "반려하기" }
                }
            }
        }
    }
}
