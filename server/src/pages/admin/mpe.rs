//! `GET /admin/mpe` (`app/(default)/admin/mpe/page.tsx`): the upload form
//! (`MpeUploadForm`, which `ui/admin-mpe.js` runs against `/api/mpe/uploads`
//! and `/api/admin/mpe-candidates`) and the first hundred candidates with
//! their job counts.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use sqlx::Row;

use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;

/// `STATUS_LABEL`, the raw status otherwise.
pub fn status_label(status: &str) -> &str {
    match status {
        "FACT_CHECKING" => "사실 검수",
        "RIGHTS_CHECKING" => "권리 검수",
        "PUBLISH" => "공개 결정",
        "APPROVED" => "공개 승인",
        "LIMITED" => "제한 공개",
        "REJECTED" => "반려",
        other => other,
    }
}

/// `Math.round(value * 100)`.
pub fn percent(value: f64) -> i64 {
    (value * 100.0 + 0.5).floor() as i64
}

struct Candidate {
    id: String,
    ingestion: String,
    title: String,
    meme_type: String,
    status: String,
    confidence: Option<f64>,
    mime: Option<String>,
    platform: Option<String>,
    source_title: Option<String>,
}

async fn load(
    state: &AppState,
    user: &SessionUser,
) -> Result<(Vec<Candidate>, Vec<(String, String)>), sqlx::Error> {
    let identity = user.db_identity();
    let candidates: Vec<Candidate> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query(
                    "select c.id::text, c.ingestion_id::text, c.title, c.meme_type, c.review_status, c.overall_confidence::float8, i.mime_type, s.platform, s.title
                     from public.meme_candidates c left join public.media_ingestions i on i.id = c.ingestion_id left join public.media_sources s on s.id = i.source_id
                     order by c.created_at asc limit 100",
                )
                .fetch_all(tx)
                .await
            })
        })
        .await?
        .iter()
        .map(|row| -> Result<Candidate, sqlx::Error> {
            Ok(Candidate {
                id: row.try_get(0)?,
                ingestion: row.try_get(1)?,
                title: row.try_get(2)?,
                meme_type: row.try_get(3)?,
                status: row.try_get(4)?,
                confidence: row.try_get(5)?,
                mime: row.try_get(6)?,
                platform: row.try_get(7)?,
                source_title: row.try_get(8)?,
            })
        })
        .collect::<Result<_, _>>()?;
    let mut ids: Vec<String> = candidates
        .iter()
        .map(|candidate| candidate.ingestion.clone())
        .collect();
    ids.dedup();
    if ids.is_empty() {
        return Ok((candidates, Vec::new()));
    }
    let jobs = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as::<_, (String, String)>("select ingestion_id::text, status from public.processing_jobs where ingestion_id = any($1::uuid[])")
                    .bind(ids)
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    Ok((candidates, jobs))
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
        Ok((candidates, jobs)) => view(&candidates, &jobs),
        Err(error) => {
            tracing::warn!(%error, "admin mpe failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, "MPE 검수 큐", "/admin/mpe", main)
}

/// Each status's count for an ingestion, in the order the statuses first come.
fn job_counts<'a>(jobs: &'a [(String, String)], ingestion: &str) -> Vec<(&'a str, usize)> {
    let mut counts: Vec<(&str, usize)> = Vec::new();
    for (_, status) in jobs.iter().filter(|(of, _)| of == ingestion) {
        match counts.iter_mut().find(|(seen, _)| seen == status) {
            Some(entry) => entry.1 += 1,
            None => counts.push((status, 1)),
        }
    }
    counts
}

fn view(candidates: &[Candidate], jobs: &[(String, String)]) -> Markup {
    html! {
        div class="space-y-6" {
            div {
                h1 class="text-2xl font-bold" { "MPE 검수 큐" }
                p class="mt-1 text-sm text-muted" { "근거가 연결된 멀티모달 초안을 사실 → 권리 → 공개 순서로 검수합니다." }
            }
            (upload_form())
            @if candidates.is_empty() {
                div class="rounded-xl border border-border bg-surface p-8 text-center text-muted" { "검수할 MPE 후보가 없어요." }
            } @else {
                ul class="space-y-3" {
                    @for candidate in candidates {
                        @let counts = job_counts(jobs, &candidate.ingestion);
                        @let jobs_text = counts.iter().map(|(status, count)| format!("{status} {count}")).collect::<Vec<_>>().join(" · ");
                        li {
                            a href=(format!("/admin/mpe/{}", candidate.id)) class="block rounded-xl border border-border bg-surface p-5 hover:border-accent" {
                                div class="flex flex-wrap items-start justify-between gap-3" {
                                    div {
                                        h2 class="font-semibold" { (candidate.title) }
                                        p class="mt-1 text-sm text-muted" {
                                            (candidate.meme_type) " · " (candidate.platform.as_deref().or(candidate.mime.as_deref()).unwrap_or("미디어 없음"))
                                            @if let Some(title) = candidate.source_title.as_deref().filter(|title| !title.is_empty()) { (format!(" · {title}")) }
                                        }
                                    }
                                    span class="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent" { (status_label(&candidate.status)) }
                                }
                                p class="mt-3 text-sm text-muted" {
                                    "작업 " (if jobs_text.is_empty() { "없음".to_owned() } else { jobs_text })
                                    @if let Some(confidence) = candidate.confidence { (format!(" · 자동 분석 참고값 {}%", percent(confidence))) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// `MpeUploadForm` before a file is chosen.
fn upload_form() -> Markup {
    html! {
        section class="rounded-xl border border-border bg-surface p-5" data-admin-controls="mpe-upload" {
            h2 class="text-lg font-semibold" { "권한 있는 미디어 직접 업로드" }
            p class="mt-1 text-sm text-muted" { "이미지·영상은 20MB 이하만 접수하며 원본은 24시간 후 삭제됩니다. 처리 작업 완료 후 후보 제목과 유형을 정해 후보를 생성하세요." }
            form class="mt-4 space-y-4" {
                label class="block" {
                    span class="mb-1 block text-sm font-medium" { "미디어 파일" }
                    input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" class="block min-h-11 w-full rounded-lg border border-border bg-background p-2 text-sm";
                }
                label class="flex min-h-11 items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm" {
                    input type="checkbox" class="mt-1 h-5 w-5";
                    span { "이 파일을 직접 제작했거나 OCR·STT·프레임 분석을 수행할 권한이 있습니다." }
                }
                button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:opacity-50" { "분석 작업 접수" }
            }
        }
    }
}
