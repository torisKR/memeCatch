//! `GET /admin/submissions` (`app/(default)/admin/submissions/page.tsx`): the
//! contributions to existing memes (`ContributionReview`) and the queue of
//! new meme submissions, the ones over 48 hours first.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use time::{Duration, OffsetDateTime};

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::public::labels;

const OVERDUE: Duration = Duration::hours(48);

/// `isSubmissionOverdue`.
pub fn is_overdue(created_at: &str, now: OffsetDateTime) -> bool {
    format::parse_timestamp(created_at).is_some_and(|at| now - at > OVERDUE)
}

/// `SUBMISSION_STATUS[status].user`.
pub fn status_label(status: &str) -> &'static str {
    match status {
        "pending" => "접수됨 — 24~48시간 내 검토돼요",
        "reviewing" => "검수 중",
        "approved" => "등록 완료!",
        "rejected" => "반려됨",
        _ => "",
    }
}

/// `OverdueBadge`.
pub fn overdue_badge() -> Markup {
    html! {
        span class="inline-flex items-center gap-1 rounded-full bg-safety-red-bg px-2.5 py-0.5 text-sm font-semibold text-safety-red" {
            span aria-hidden="true" { "▲" } "48시간 초과"
        }
    }
}

struct Submission {
    id: String,
    name: String,
    seen_at: Option<String>,
    source_url: Option<String>,
    status: String,
    dup_of: Option<String>,
    dup_title: Option<String>,
    created_at: String,
}

struct Contribution {
    id: String,
    kind: String,
    source_url: Option<String>,
    note: Option<String>,
    situation: Option<String>,
    text: Option<String>,
    credit_public: bool,
    created_at: String,
    meme: Option<(String, String, String)>,
    contributor: Option<String>,
}

type SubmissionRow = (
    String,
    String,
    Option<String>,
    Option<String>,
    String,
    Option<String>,
    Option<String>,
    String,
);
type ContributionRow = (
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<bool>,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

async fn submissions(state: &AppState, user: &SessionUser) -> Result<Vec<Submission>, sqlx::Error> {
    let rows: Vec<SubmissionRow> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select s.id::text, s.name, s.seen_at, s.source_url, s.status::text, s.dup_of::text, d.title, to_json(s.created_at) #>> '{}' \
                     from public.meme_submissions s left join public.memes d on d.id = s.dup_of \
                     where s.status in ('pending', 'reviewing') order by s.created_at asc",
                )
                .fetch_all(tx)
                .await
            })
        })
        .await?;
    Ok(rows
        .into_iter()
        .map(
            |(id, name, seen_at, source_url, status, dup_of, dup_title, created_at)| Submission {
                id,
                name,
                seen_at,
                source_url,
                status,
                dup_of,
                dup_title,
                created_at,
            },
        )
        .collect())
}

async fn contributions(state: &AppState, user: &SessionUser) -> Result<Vec<Contribution>, String> {
    let rows: Vec<ContributionRow> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select c.id::text, c.kind, c.source_url, c.note, c.example_situation, c.example_text, c.credit_public, to_json(c.created_at) #>> '{}', \
                       m.title, m.short_id, m.slug, p.nickname \
                     from public.meme_contributions c left join public.memes m on m.id = c.meme_id left join public.profiles p on p.id = c.contributor_id \
                     where c.status in ('pending', 'reviewing') order by c.created_at asc limit 100",
                )
                .fetch_all(tx)
                .await
            })
        })
        .await
        .map_err(|error| crate::routes::admin::db_message(&error))?;
    Ok(rows
        .into_iter()
        .map(
            |(
                id,
                kind,
                source_url,
                note,
                situation,
                text,
                credit,
                created_at,
                title,
                short_id,
                slug,
                contributor,
            )| Contribution {
                id,
                kind,
                source_url,
                note,
                situation,
                text,
                credit_public: credit == Some(true),
                created_at,
                meme: match (title, short_id, slug) {
                    (Some(title), Some(short_id), Some(slug)) => Some((title, short_id, slug)),
                    _ => None,
                },
                contributor,
            },
        )
        .collect())
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
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
    let main = match submissions(&state, &user).await {
        Err(error) => {
            tracing::warn!(%error, "submissions failed");
            shell::error_boundary()
        }
        Ok(mut list) => {
            let contributions = contributions(&state, &user).await;
            let now = OffsetDateTime::now_utc();
            // The overdue ones first; within each, the oldest first.
            list.sort_by_key(|submission| !is_overdue(&submission.created_at, now));
            view(&list, &contributions, now)
        }
    };
    super::screen(&state, Root::Site, "제보 큐", "/admin/submissions", main)
}

fn created(value: &str) -> String {
    format::parse_timestamp(value)
        .map_or_else(|| "Invalid Date".to_owned(), format::kst_month_day_time)
}

fn view(
    list: &[Submission],
    contributions: &Result<Vec<Contribution>, String>,
    now: OffsetDateTime,
) -> Markup {
    html! {
        div class="space-y-6" {
            div {
                h1 class="text-2xl font-bold" { "제보 큐" }
                p class="mt-1 text-base text-muted" { "접수 순서대로 검토해요. 48시간이 지난 제보가 먼저 보여요." }
            }
            section aria-labelledby="contribution-queue" class="space-y-3" {
                div {
                    h2 id="contribution-queue" class="text-xl font-bold" {
                        "문서 보강 제보 "
                        @if let Ok(items) = contributions { @if !items.is_empty() { span class="text-muted" { (items.len()) } } }
                    }
                    p class="mt-1 text-base text-muted" { "밈 상세에서 받은 출처 링크·사용 예문이에요. 승인하면 새 밈을 만들지 않고 그 밈 문서에 바로 붙어요." }
                }
                @match contributions {
                    Err(message) => p class="rounded-xl border border-border bg-surface-2 p-4 text-base text-muted" { "보강 제보를 불러오지 못했어요. (" (message) ")" },
                    Ok(items) if items.is_empty() => p class="rounded-xl border border-border bg-surface p-4 text-base text-muted" { "대기 중인 보강 제보가 없어요." },
                    Ok(items) => ul class="space-y-3" { @for item in items { li { (contribution(item)) } } },
                }
            }
            h2 class="text-xl font-bold" { "새 밈 제보" }
            @if list.is_empty() {
                div class="rounded-xl border border-border bg-surface p-10 text-center" {
                    p class="text-lg font-semibold" { "대기 중인 제보가 없어요" }
                    p class="mt-1 text-base text-muted" { "새 제보가 들어오면 여기에 표시돼요." }
                }
            } @else {
                ul class="space-y-3" {
                    @for submission in list { li { (queue_item(submission, now)) } }
                }
            }
        }
    }
}

fn queue_item(submission: &Submission, now: OffsetDateTime) -> Markup {
    html! {
        a href=(format!("/admin/submissions/{}", submission.id)) class="flex min-h-11 flex-col gap-2 rounded-xl border border-border bg-surface p-4 hover:border-accent sm:flex-row sm:items-center sm:justify-between" {
            div class="min-w-0" {
                div class="flex flex-wrap items-center gap-2" {
                    span class="text-lg font-semibold" { (submission.name) }
                    @if is_overdue(&submission.created_at, now) { (overdue_badge()) }
                    @if submission.dup_of.is_some() {
                        span class="inline-flex items-center rounded-full bg-safety-yellow-bg px-2.5 py-0.5 text-sm font-semibold text-safety-yellow" {
                            "중복 의심" @if let Some(title) = &submission.dup_title { ": " (title) }
                        }
                    }
                }
                p class="mt-1 truncate text-base text-muted" {
                    @match submission.seen_at.as_deref().filter(|seen| !seen.is_empty()) {
                        Some(seen) => { "본 곳: " (seen) },
                        None => "본 곳 미기재",
                    }
                    @if let Some(url) = submission.source_url.as_deref().filter(|url| !url.is_empty()) { " · " (url) }
                }
            }
            div class="flex shrink-0 items-center gap-3 text-base text-muted" {
                @if submission.status == "reviewing" {
                    span class="font-medium text-accent" { (status_label(&submission.status)) }
                } @else {
                    span { (status_label(&submission.status)) }
                }
                span { (created(&submission.created_at)) }
            }
        }
    }
}

const INPUT: &str =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";

/// `ContributionReview` (`ui/admin.js` runs it).
fn contribution(item: &Contribution) -> Markup {
    let source = item.kind != "example";
    let title = item
        .meme
        .as_ref()
        .map_or("(삭제된 밈)", |(title, ..)| title.as_str());
    html! {
        article class="space-y-3 rounded-xl border border-border bg-surface p-4" data-admin-controls="contribution" data-admin-contribution=(item.id) data-admin-kind=(if source { "source" } else { "example" }) {
            div class="flex flex-wrap items-center gap-2" {
                span class="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold" { (if source { "출처 링크" } else { "사용 예문" }) }
                @match &item.meme {
                    Some((_, short_id, slug)) => a href=(labels::meme_path(short_id, slug)) target="_blank" rel="noreferrer" class="text-lg font-semibold underline" { (title) },
                    None => span class="text-lg font-semibold" { (title) },
                }
                span class="text-sm text-muted" {
                    (item.contributor.as_deref().unwrap_or("탈퇴한 사용자"))
                    (if item.credit_public { " · 이름 공개 동의" } else { " · 이름 비공개" })
                    " · " (created(&item.created_at))
                }
            }
            @if source {
                div class="space-y-2" {
                    a href=(item.source_url.as_deref().map_or("#", super::safe_href)) target="_blank" rel="noreferrer noopener" class="block break-all text-base text-accent-text underline" { (item.source_url.as_deref().unwrap_or("")) }
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "자료 제목 (공개 출처 목록에 표시, 비우면 링크만)" }
                        input maxlength="300" class=(INPUT) value=(item.note.as_deref().unwrap_or("")) data-admin-field="sourceTitle";
                    }
                }
            } @else {
                div class="grid gap-3 lg:grid-cols-2" {
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "상황" }
                        input maxlength="120" class=(INPUT) value=(item.situation.as_deref().unwrap_or("")) data-admin-field="situation";
                    }
                    label class="block" {
                        span class="mb-1 block text-sm font-medium" { "예문" }
                        textarea rows="2" maxlength="500" class=(INPUT) data-admin-field="text" { (format::textarea(item.text.as_deref().unwrap_or(""))) }
                    }
                }
            }
            template data-admin-reject {
                label class="block" {
                    span class="mb-1 block text-sm font-medium" { "반려 사유 (필수, 제보자에게 보여요)" }
                    input maxlength="500" class=(INPUT) value="" data-admin-field="rejectReason";
                }
            }
            div class="flex flex-wrap gap-2" data-admin-buttons {
                button type="button" class="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50" data-admin-approve { "승인 → 문서에 반영" }
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:opacity-50" data-admin-open-reject { "반려" }
            }
            template data-admin-reject-buttons {
                button type="button" class="min-h-11 rounded-lg bg-safety-red px-4 text-base font-semibold text-background disabled:opacity-50" disabled data-admin-reject-submit { "반려하기" }
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold" data-admin-cancel { "취소" }
            }
        }
    }
}
