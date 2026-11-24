//! `GET /admin/reports` (`app/(default)/admin/reports/page.tsx`): open
//! reports, oldest first, each with a preview of its meme, comment or
//! submission and `ReportActions` (`ui/admin.js`, `routes/admin/reports.rs`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::public::labels;

struct Report {
    id: String,
    target_type: String,
    target_id: String,
    reason: String,
    created_at: String,
    reporter: Option<String>,
}

enum Target {
    Meme {
        title: String,
        short_id: String,
        slug: String,
    },
    Discussion {
        id: String,
        body: String,
        status: String,
    },
    Submission {
        id: String,
        name: String,
    },
}

struct Loaded {
    reports: Vec<Report>,
    targets: Vec<(String, Target)>,
}

type ReportRow = (String, String, String, String, String, Option<String>);

async fn load(state: &AppState, user: &SessionUser) -> Result<Loaded, sqlx::Error> {
    let identity = user.db_identity();
    let rows: Vec<ReportRow> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as(
                    "select r.id::text, r.target_type::text, r.target_id::text, r.reason, to_json(r.created_at) #>> '{}', p.nickname \
                     from public.reports r left join public.profiles p on p.id = r.reporter_id \
                     where r.status = 'open' order by r.created_at asc",
                )
                .fetch_all(tx)
                .await
            })
        })
        .await?;
    let reports: Vec<Report> = rows
        .into_iter()
        .map(
            |(id, target_type, target_id, reason, created_at, reporter)| Report {
                id,
                target_type,
                target_id,
                reason,
                created_at,
                reporter,
            },
        )
        .collect();
    let ids = |kind: &str| -> Vec<String> {
        reports
            .iter()
            .filter(|report| report.target_type == kind)
            .map(|report| report.target_id.clone())
            .collect()
    };
    let (memes, discussions, submissions) = (ids("meme"), ids("discussion"), ids("submission"));
    // `data ?? []`: a failed read previews nothing.
    let targets = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut targets = Vec::new();
                if !memes.is_empty() {
                    let rows: Vec<(String, String, String, String)> =
                        sqlx::query_as("select id::text, title, short_id, slug from public.memes where id = any($1::uuid[])")
                            .bind(memes)
                            .fetch_all(&mut *tx)
                            .await?;
                    targets.extend(rows.into_iter().map(|(id, title, short_id, slug)| (id, Target::Meme { title, short_id, slug })));
                }
                if !discussions.is_empty() {
                    let rows: Vec<(String, String, String)> =
                        sqlx::query_as("select id::text, body, status::text from public.discussions where id = any($1::uuid[])")
                            .bind(discussions)
                            .fetch_all(&mut *tx)
                            .await?;
                    targets.extend(rows.into_iter().map(|(id, body, status)| (id.clone(), Target::Discussion { id, body, status })));
                }
                if !submissions.is_empty() {
                    let rows: Vec<(String, String)> =
                        sqlx::query_as("select id::text, name from public.meme_submissions where id = any($1::uuid[])")
                            .bind(submissions)
                            .fetch_all(&mut *tx)
                            .await?;
                    targets.extend(rows.into_iter().map(|(id, name)| (id.clone(), Target::Submission { id, name })));
                }
                Ok::<_, sqlx::Error>(targets)
            })
        })
        .await
        .unwrap_or_default();
    Ok(Loaded { reports, targets })
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
    let main = match load(&state, &user).await {
        Ok(loaded) => view(&loaded),
        Err(error) => {
            tracing::warn!(%error, "reports failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, "신고", "/admin/reports", main)
}

/// `TARGET_LABEL`.
fn target_label(kind: &str) -> &str {
    match kind {
        "meme" => "밈",
        "discussion" => "댓글",
        "submission" => "제보",
        other => other,
    }
}

fn view(loaded: &Loaded) -> Markup {
    html! {
        div class="space-y-6" {
            div {
                h1 class="text-2xl font-bold" { "신고" }
                p class="mt-1 text-base text-muted" { "미처리 신고를 확인하고 처리(resolve) 또는 기각(dismiss)해요. 댓글은 신고 5회 누적 시 자동으로 숨겨져요." }
            }
            @if loaded.reports.is_empty() {
                div class="rounded-xl border border-border bg-surface p-10 text-center" {
                    p class="text-lg font-semibold" { "미처리 신고가 없어요" }
                    p class="mt-1 text-base text-muted" { "새 신고가 들어오면 여기에 표시돼요." }
                }
            } @else {
                ul class="space-y-3" {
                    @for report in &loaded.reports { (item(report, loaded)) }
                }
            }
        }
    }
}

fn item(report: &Report, loaded: &Loaded) -> Markup {
    // Each map holds the rows of its own type, keyed by id.
    let target = loaded.targets.iter().find(|(id, target)| {
        *id == report.target_id
            && matches!(
                (target, report.target_type.as_str()),
                (Target::Meme { .. }, "meme")
                    | (Target::Discussion { .. }, "discussion")
                    | (Target::Submission { .. }, "submission")
            )
    });
    let created = format::parse_timestamp(&report.created_at)
        .map_or_else(|| "Invalid Date".to_owned(), format::kst_month_day_time);
    let discussion = match target {
        Some((_, Target::Discussion { id, status, .. })) => Some((id.as_str(), status.as_str())),
        _ => None,
    };
    html! {
        li class="space-y-3 rounded-xl border border-border bg-surface p-4" {
            div class="flex flex-wrap items-center gap-2 text-base" {
                span class="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold" { (target_label(&report.target_type)) }
                span class="text-muted" { (report.reporter.as_deref().unwrap_or("탈퇴한 사용자")) " · " (created) }
            }
            p class="text-base" { span class="font-medium" { "신고 사유:" } " " (report.reason) }
            div class="rounded-lg bg-surface-2 p-3 text-base" {
                @match target.map(|(_, target)| target) {
                    Some(Target::Meme { title, short_id, slug }) => a href=(labels::meme_path(short_id, slug)) class="text-accent-text underline" { "밈: " (title) },
                    Some(Target::Discussion { body, status, .. }) => div {
                        p class="whitespace-pre-wrap" { (body) }
                        p class="mt-1 text-sm text-muted" {
                            "현재 상태: " (match status.as_str() { "hidden" => "숨김", "deleted" => "삭제됨", _ => "공개" })
                        }
                    },
                    Some(Target::Submission { id, name }) => a href=(format!("/admin/submissions/{id}")) class="text-accent-text underline" { "제보: " (name) },
                    None => p class="text-muted" { "대상을 찾을 수 없어요 (삭제됐을 수 있어요)." },
                }
            }
            (actions(&report.id, discussion))
        }
    }
}

/// `ReportActions`.
fn actions(report_id: &str, discussion: Option<(&str, &str)>) -> Markup {
    let handle =
        |action: &str| serde_json::json!({ "reportId": report_id, "action": action }).to_string();
    let visibility = |id: &str, status: &str| {
        serde_json::json!({ "discussionId": id, "status": status }).to_string()
    };
    html! {
        div class="space-y-2" data-admin-controls="report" {
            div class="flex flex-wrap gap-2" {
                button type="button" class="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50" data-admin-action="report-handle" data-admin-body=(handle("resolved")) { "처리 완료 (resolve)" }
                button type="button" class="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:opacity-50" data-admin-action="report-handle" data-admin-body=(handle("dismissed")) { "기각 (dismiss)" }
                @if let Some((id, status)) = discussion.filter(|(_, status)| *status != "deleted") {
                    @if status == "hidden" {
                        button type="button" class="min-h-11 rounded-lg border border-safety-green bg-safety-green-bg px-4 text-base font-semibold text-safety-green disabled:opacity-50" data-admin-action="discussion-visibility" data-admin-body=(visibility(id, "visible")) { "댓글 숨김 해제" }
                    } @else {
                        button type="button" class="min-h-11 rounded-lg border border-safety-yellow bg-safety-yellow-bg px-4 text-base font-semibold text-safety-yellow disabled:opacity-50" data-admin-action="discussion-visibility" data-admin-body=(visibility(id, "hidden")) { "댓글 숨기기" }
                    }
                }
            }
        }
    }
}
