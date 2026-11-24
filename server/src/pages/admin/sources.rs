//! `GET /admin/sources` (`app/(default)/admin/sources/page.tsx`): the SNS
//! source intake form, the acquisition recovery panel, and the pending media
//! candidates (30 a page) with `SourceReviewCard`. The intake and retry call
//! `POST /api/admin/source-ingestions` as the React components do; the review
//! calls `routes/admin/sources.rs` (`ui/admin.js`).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, PreEscaped, html};
use serde_json::Value;
use time::{OffsetDateTime, UtcOffset};

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::{DbIdentity, IdentityOptions};

const PAGE_SIZE: i64 = 30;

struct Candidate {
    meme_id: String,
    title: String,
    origin_year: Option<i32>,
    source_work_year: Option<i32>,
    korea_viral_year: Option<i32>,
    source: Value,
}

struct Recovery {
    key: String,
    source_id: Option<String>,
    platform: String,
    url: Option<String>,
    attempts: f64,
    next_retry_at: Option<String>,
    code: String,
    retryable: bool,
    last_attempted_at: String,
}

const PLATFORMS: [&str; 4] = ["youtube", "youtube_shorts", "tiktok", "instagram"];
const CODES: [&str; 6] = ["invalid_url", "missing_meme", "provider_transient", "provider_uncertain", "metadata_mismatch", "db_failure"];

/// `recoveryDtos`: the rows of the expected shape; anything else is dropped.
fn recoveries(value: &Value) -> Option<Vec<Recovery>> {
    let rows = value.as_array()?;
    Some(
        rows.iter()
            .filter_map(|row| {
                let text = |key: &str| row.get(key).and_then(Value::as_str).map(str::to_owned);
                let platform = text("platform").filter(|p| PLATFORMS.contains(&p.as_str()))?;
                let code = text("last_error_code").filter(|c| CODES.contains(&c.as_str()))?;
                Some(Recovery {
                    key: text("source_key")?,
                    source_id: text("source_id"),
                    platform,
                    url: text("canonical_url"),
                    attempts: row.get("attempt_count").and_then(Value::as_f64)?,
                    next_retry_at: text("next_retry_at"),
                    code,
                    retryable: row.get("last_error_retryable").and_then(Value::as_bool)?,
                    last_attempted_at: text("last_attempted_at")?,
                })
            })
            .collect(),
    )
}

async fn load(state: &AppState, user: &SessionUser, page: i64) -> Result<(Vec<Candidate>, i64, Vec<(String, String, String)>, Result<Vec<Recovery>, String>), sqlx::Error> {
    let identity = user.db_identity();
    let from = (page - 1) * PAGE_SIZE;
    let (rows, count, memes) = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let rows: Vec<(String, String, Option<i32>, Option<i32>, Option<i32>, String)> = sqlx::query_as(
                    "select mm.meme_id::text, m.title, m.origin_year, m.source_work_year, m.korea_viral_year, \
                       json_build_object('id', s.id, 'platform', s.platform, 'external_id', s.external_id, 'canonical_url', s.canonical_url, 'title', s.title, \
                         'channel_name', s.channel_name, 'platform_published_at', s.platform_published_at, 'duration_seconds', s.duration_seconds, \
                         'public_status', s.public_status, 'embeddable', s.embeddable, 'license_code', s.license_code, 'thumbnail_url', s.thumbnail_url, 'removed_at', s.removed_at)::text \
                     from public.meme_media mm join public.memes m on m.id = mm.meme_id join public.media_sources s on s.id = mm.source_id \
                     where mm.review_state = 'pending' order by mm.created_at asc offset $1 limit $2",
                )
                .bind(from)
                .bind(PAGE_SIZE)
                .fetch_all(&mut *tx)
                .await?;
                let count: i64 = sqlx::query_scalar("select count(*) from public.meme_media where review_state = 'pending'").fetch_one(&mut *tx).await?;
                let memes: Vec<(String, String, String)> =
                    sqlx::query_as("select id::text, title, short_id from public.memes order by updated_at desc limit 200").fetch_all(&mut *tx).await?;
                Ok::<_, sqlx::Error>((rows, count, memes))
            })
        })
        .await?;
    let candidates = rows
        .into_iter()
        .map(|(meme_id, title, origin_year, source_work_year, korea_viral_year, source)| Candidate {
            meme_id,
            title,
            origin_year,
            source_work_year,
            korea_viral_year,
            source: serde_json::from_str(&source).unwrap_or(Value::Null),
        })
        .collect();
    let recovery = state
        .db
        .with_identity(&DbIdentity::service_role(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, Option<String>>(
                    "select coalesce(json_agg(r), '[]'::json)::text from public.list_active_source_acquisition_recovery() r",
                )
                .fetch_one(tx)
                .await
            })
        })
        .await
        .map_err(|_| "source_recovery_query_failed".to_owned())
        .and_then(|text| {
            text.and_then(|text| serde_json::from_str::<Value>(&text).ok())
                .and_then(|value| recoveries(&value))
                .ok_or_else(|| "source_recovery_query_invalid".to_owned())
        });
    Ok((candidates, count, memes, recovery))
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let user = match super::require_operator(&state, request.headers(), request.uri().path(), request.uri().query()).await {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    // `Math.max(1, Number(page ?? "1") || 1)`.
    let raw = url::form_urlencoded::parse(request.uri().query().unwrap_or_default().as_bytes())
        .find(|(key, _)| key == "page")
        .map(|(_, value)| value.into_owned());
    let number = raw.as_deref().map_or(Some(1.0), crate::storage::signing::js_number).filter(|n| *n != 0.0).unwrap_or(1.0);
    let page = if number.is_finite() { number.max(1.0) } else if number > 0.0 { f64::MAX } else { 1.0 };
    let main = if page.fract() != 0.0 || page > 1e9 {
        // A page that is not a whole number reads an empty range in Next.
        match load(&state, &user, i64::MAX / PAGE_SIZE / 2).await {
            Ok((_, count, memes, recovery)) => view(page, &[], count, &memes, &recovery),
            Err(_) => shell::error_boundary(),
        }
    } else {
        match load(&state, &user, page as i64).await {
            Ok((candidates, count, memes, recovery)) => view(page, &candidates, count, &memes, &recovery),
            Err(error) => {
                tracing::warn!(%error, "sources failed");
                shell::error_boundary()
            }
        }
    };
    super::screen(&state, Root::Site, "출처 검수", "/admin/sources", main)
}

fn view(page: f64, candidates: &[Candidate], count: i64, memes: &[(String, String, String)], recovery: &Result<Vec<Recovery>, String>) -> Markup {
    let total_pages = ((count + PAGE_SIZE - 1) / PAGE_SIZE).max(1);
    let page_text = crate::routes::js_json::number(page);
    html! {
        div class="space-y-6" {
            div {
                h1 class="text-2xl font-bold" { "출처 검수" }
                p class="mt-1 text-sm text-muted" { "수집 파이프라인이 찾은 후보예요. 원본 파일은 저장하지 않고 공식 임베드 또는 링크만 게시합니다. 승인 전에 공식 채널 여부와 연도를 반드시 확인하세요." }
            }
            (ingestion(memes))
            (recovery_panel(recovery, memes))
            p class="text-sm text-muted" { "대기 중 " strong class="text-foreground" { (format::count(count)) } "건" }
            @if candidates.is_empty() {
                div class="rounded-xl border border-border bg-surface p-8 text-center text-muted" { "대기 중인 출처 후보가 없어요." }
            } @else {
                ul class="space-y-4" {
                    @for candidate in candidates {
                        li {
                            div class="mb-2 flex flex-wrap items-baseline gap-2 text-sm" {
                                a href=(format!("/admin/memes/{}", candidate.meme_id)) class="font-semibold hover:text-accent" { (candidate.title) }
                                span class="text-muted" {
                                    "밈 연도 " (year(candidate.origin_year)) " · 원작 " (year(candidate.source_work_year)) " · 국내 유행 " (year(candidate.korea_viral_year))
                                }
                            }
                            (review_card(candidate))
                        }
                    }
                }
            }
            @if total_pages > 1 {
                nav class="flex items-center gap-3 text-sm" aria-label="페이지 이동" {
                    @if page > 1.0 { a href=(format!("/admin/sources?page={}", crate::routes::js_json::number(page - 1.0))) class="text-accent hover:underline" { "← 이전" } }
                    span class="text-muted" { (page_text) " / " (total_pages) }
                    @if page < total_pages as f64 { a href=(format!("/admin/sources?page={}", crate::routes::js_json::number(page + 1.0))) class="text-accent hover:underline" { "다음 →" } }
                }
            }
        }
    }
}

fn year(value: Option<i32>) -> String {
    value.map_or_else(|| "?".to_owned(), |year| year.to_string())
}

fn meme_options(memes: &[(String, String, String)]) -> Markup {
    html! {
        option value="" selected { "밈을 선택하세요" }
        @for (id, title, short_id) in memes { option value=(id) { (title) " (" (short_id) ")" } }
    }
}

/// `SourceIngestionForm`.
fn ingestion(memes: &[(String, String, String)]) -> Markup {
    html! {
        section class="rounded-xl border border-border bg-surface p-5" aria-labelledby="source-ingestion-heading" data-admin-controls="source-ingestion" {
            div {
                h2 id="source-ingestion-heading" class="text-lg font-semibold" { "SNS 출처 수집" }
                p class="mt-1 text-sm text-muted" { "지원하는 SNS URL을 기존 밈에 연결하면 정규화·중복 확인 후 검수 대기열에 추가합니다." }
            }
            form class="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)_auto] lg:items-end" {
                label class="block min-w-0 overflow-hidden" style="width:100%" {
                    span class="mb-1 block text-base font-medium" { "SNS URL" }
                    input type="url" placeholder="https://www.youtube.com/watch?v=…" required autocomplete="url" class="min-h-11 w-full max-w-full rounded-lg border border-border bg-background px-3 text-base" value="" data-admin-field="url";
                }
                label class="block min-w-0 overflow-hidden" style="width:100%" {
                    span class="mb-1 block text-base font-medium" { "연결할 밈" }
                    select required style="width:100%;max-width:100%;min-width:0" class="min-h-11 min-w-0 w-full max-w-full appearance-none rounded-lg border border-border bg-background px-3 text-base" data-admin-field="targetMemeId" { (meme_options(memes)) }
                }
                button type="submit" disabled[memes.is_empty()] class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" { "검수 후보 만들기" }
            }
            @if memes.is_empty() {
                p role="status" class="mt-3 text-sm text-muted" { "연결할 밈이 없어 출처를 수집할 수 없어요." }
            }
        }
    }
}

/// `toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })` in
/// the server's zone (UTC): `2026. 11. 24. 오후 1:07`.
fn utc_medium_short(value: Option<&str>) -> String {
    let Some(value) = value else { return "없음".to_owned() };
    let Some(at) = format::parse_timestamp(value) else { return "확인할 수 없음".to_owned() };
    let local = at.to_offset(UtcOffset::UTC);
    let (period, hour) = format::twelve_hour(local.hour());
    format!("{}. {}. {}. {period} {hour}:{:02}", local.year(), u8::from(local.month()), local.day(), local.minute())
}

fn error_label(code: &str) -> &'static str {
    match code {
        "provider_transient" => "제공자 일시 오류",
        "provider_uncertain" => "제공자 결과 불확실",
        "invalid_url" => "URL 형식 오류",
        "missing_meme" => "연결할 밈 없음",
        "metadata_mismatch" => "메타데이터 불일치",
        "db_failure" => "저장 오류",
        _ => "수집 오류",
    }
}

/// `SourceRecoveryPanel`.
fn recovery_panel(recovery: &Result<Vec<Recovery>, String>, memes: &[(String, String, String)]) -> Markup {
    let now = OffsetDateTime::now_utc();
    html! {
        section class="rounded-xl border border-border bg-surface p-5" aria-labelledby="source-recovery-heading" data-admin-controls="source-recovery" {
            div {
                h2 id="source-recovery-heading" class="text-lg font-semibold" { "출처 수집 복구 상태" }
                p class="mt-1 text-sm leading-relaxed text-muted" { "자동 재시도 예약과 마지막 오류를 보여줘요. 이 상태는 출처 승인이나 원본 확인을 뜻하지 않아요." }
            }
            @match recovery {
                Err(message) => div role="alert" class="mt-4 rounded-lg bg-safety-red-bg p-4 text-sm text-safety-red" {
                    p class="font-semibold" { "복구 상태를 불러오지 못했어요." }
                    p class="mt-1" { (message) }
                },
                Ok(entries) if entries.is_empty() => p class="mt-4 rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted" { "현재 기록된 복구 대상이 없어요." },
                Ok(entries) => ul class="mt-4 space-y-3" { @for entry in entries { (recovery_item(entry, memes, now)) } },
            }
        }
    }
}

fn recovery_item(entry: &Recovery, memes: &[(String, String, String)], now: OffsetDateTime) -> Markup {
    let state = match (entry.retryable, entry.next_retry_at.as_deref().and_then(format::parse_timestamp)) {
        (true, Some(at)) if at <= now => "due",
        (true, Some(_)) => "deferred",
        _ => "permanent",
    };
    let can_retry = state != "deferred" && entry.url.is_some();
    html! {
        li class="rounded-lg border border-border bg-surface-2 p-4" data-admin-recovery=(entry.key) data-admin-url=[entry.url.as_deref()] data-admin-state=(state) {
            div class="flex flex-wrap items-start justify-between gap-3" {
                div class="min-w-0" {
                    p class="font-semibold" { (entry.platform) " · " (error_label(&entry.code)) }
                    p class="mt-1 break-all text-sm text-muted" { (entry.url.as_deref().unwrap_or(&entry.key)) }
                }
                span class="rounded-full bg-background px-3 py-1 text-sm font-semibold" {
                    (match state { "due" => "재시도 시점 도래", "deferred" => "재시도 예약됨", _ => "자동 재시도 없음" })
                }
            }
            dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2" {
                div { dt class="text-muted" { "시도 횟수" } dd { (crate::routes::js_json::number(entry.attempts)) "회" } }
                div { dt class="text-muted" { "마지막 시도" } dd { (utc_medium_short(Some(&entry.last_attempted_at))) } }
                div { dt class="text-muted" { "다음 재시도 시각" } dd { @match &entry.next_retry_at { Some(at) => (utc_medium_short(Some(at))), None => "예약 없음" } } }
                div { dt class="text-muted" { "source_id 연결" } dd { (if entry.source_id.is_some() { "있음" } else { "없음" }) } }
            }
            @if state == "deferred" {
                p class="mt-3 text-sm text-muted" { "다음 시각은 복구 기록의 예약값이에요. source_id가 없는 기록을 스케줄러가 자동으로 연결하거나 공개하지는 않아요." }
            }
            @if state == "permanent" {
                p class="mt-3 text-sm text-safety-yellow" { "영구 오류 또는 결과 불확실 상태라 자동 재시도하지 않아요. URL과 연결할 밈을 운영자가 확인한 뒤 수동 재검토할 수 있어요." }
            }
            @if can_retry {
                div class="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" {
                    label class="block min-w-0 overflow-hidden text-sm" style="width:100%" {
                        span class="mb-1 block font-medium" { "재시도 후 연결할 밈" }
                        select style="width:100%;max-width:100%;min-width:0" class="min-h-11 min-w-0 w-full max-w-full appearance-none rounded-lg border border-border bg-background px-3 text-base" { (meme_options(memes)) }
                    }
                    button type="button" class="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" { (if state == "permanent" { "수동 재검토" } else { "수동 재시도" }) }
                }
            }
        }
    }
}

const PLAY: &str = r#"<path d="M8 5.5v13l11-6.5z"></path>"#;

fn platform_label(platform: &str) -> Option<&'static str> {
    Some(match platform {
        "youtube" => "YouTube",
        "youtube_shorts" => "YouTube Shorts",
        "tiktok" => "TikTok",
        "instagram" => "Instagram",
        "broadcast_archive" => "방송 아카이브",
        "public_archive" => "공공 아카이브",
        "web" => "웹",
        _ => return None,
    })
}

/// `embedUrlFor` of lib/sources/url.ts.
fn embed_url(platform: &str, external_id: &str, canonical_url: &str) -> String {
    match platform {
        "youtube" | "youtube_shorts" => format!("https://www.youtube-nocookie.com/embed/{external_id}?rel=0"),
        "tiktok" => format!("https://www.tiktok.com/player/v1/{external_id}?description=1&music_info=1"),
        _ => {
            let kind = url::Url::parse(canonical_url)
                .ok()
                .and_then(|url| {
                    let path = url.path().to_owned();
                    ["p", "reel", "tv"].into_iter().find(|kind| path.starts_with(&format!("/{kind}/"))).map(str::to_owned)
                })
                .unwrap_or_else(|| "reel".to_owned());
            format!("https://www.instagram.com/{kind}/{external_id}/embed/captioned/")
        }
    }
}

/// `SourceReviewCard`: `ui/admin.js` swaps in the player and sends the review.
fn review_card(candidate: &Candidate) -> Markup {
    let source = &candidate.source;
    let text = |key: &str| source.get(key).and_then(Value::as_str);
    let platform = text("platform").unwrap_or_default();
    let external = text("external_id");
    let embeddable = source.get("embeddable").and_then(Value::as_bool);
    let can_embed = PLATFORMS.contains(&platform) && external.is_some_and(|id| !id.is_empty()) && embeddable != Some(false);
    let vertical = ["youtube_shorts", "tiktok", "instagram"].contains(&platform);
    let preview = if vertical { "mx-auto aspect-[9/16] w-full max-w-[320px]" } else { "aspect-video w-full" };
    let published = text("platform_published_at").and_then(format::parse_timestamp);
    let published_year = published.map(|at| at.to_offset(UtcOffset::UTC).year());
    let conflict = match (published_year, candidate.origin_year) {
        (Some(published), Some(origin)) => published > origin,
        _ => false,
    };
    let duration = source.get("duration_seconds").and_then(Value::as_i64).map(|s| format!("{}:{:02}", s / 60, s % 60));
    let label = platform_label(platform);
    let canonical = text("canonical_url").unwrap_or_default();
    let body = serde_json::json!({ "memeId": candidate.meme_id, "sourceId": text("id") }).to_string();
    html! {
        div class="rounded-xl border border-border bg-surface p-4" data-admin-controls="source-review" data-admin-body=(body)
            data-admin-embed=[can_embed.then(|| embed_url(platform, external.unwrap_or_default(), canonical))]
            data-admin-embed-title=(text("title").map_or_else(|| format!("{} 출처 영상", candidate.title), str::to_owned)) {
            div class="flex flex-wrap items-center gap-2 text-xs text-muted" {
                span class="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-foreground" { (label.unwrap_or(platform)) }
                @if let Some(status) = text("public_status").filter(|s| !s.is_empty()) { span { "공개 상태 " (status) } }
                @if let Some(embed) = embeddable {
                    span class=(if embed { "text-safety-green" } else { "text-safety-red" }) { "임베드 " (if embed { "가능" } else { "불가" }) }
                }
                @if let Some(license) = text("license_code").filter(|s| !s.is_empty()) { span { "라이선스 " (license) } }
                @if let Some(duration) = &duration { span { (duration) } }
                @if let Some(at) = published { span { "업로드 " (format::kst_date(at)) } }
            }
            div class="mt-3 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]" {
                div {
                    button type="button" disabled[!can_embed] class=(format!("{preview} group relative flex items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 text-sm text-muted hover:opacity-90 disabled:cursor-not-allowed")) data-admin-preview data-admin-preview-class=(preview) {
                        @if let Some(thumbnail) = text("thumbnail_url").filter(|s| !s.is_empty()) {
                            img src=(thumbnail) alt="" loading="lazy" class="absolute inset-0 h-full w-full object-cover";
                        }
                        @if can_embed {
                            span class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white transition-colors group-hover:bg-black/45" {
                                span class="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 shadow-lg" {
                                    svg viewBox="0 0 24 24" class="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true" { (PreEscaped(PLAY)) }
                                }
                                span class="rounded-full bg-black/70 px-3 py-1 font-semibold" { (label.unwrap_or("SNS")) " 영상 재생" }
                            }
                        } @else {
                            span class="relative rounded-full bg-background/85 px-3 py-1" { "임베드 미리보기를 사용할 수 없어요" }
                        }
                    }
                    a href=(canonical) target="_blank" rel="noopener noreferrer" class="mt-2 block truncate text-xs text-accent hover:underline" { (canonical) }
                }
                div class="space-y-3" {
                    div {
                        p class="font-semibold" { (text("title").unwrap_or("(제목 없음)")) }
                        @if let Some(channel) = text("channel_name").filter(|s| !s.is_empty()) { p class="text-sm text-muted" { (channel) } }
                    }
                    @if conflict {
                        p class="rounded-lg bg-safety-yellow/10 px-3 py-2 text-sm text-safety-yellow" {
                            "업로드 연도(" (published_year.unwrap_or_default()) ")가 밈 발생 연도(" (candidate.origin_year.unwrap_or_default()) ")보다 늦어요. 원본이 아니라 사용 예시·2차 자료일 가능성이 높습니다."
                        }
                    }
                    div class="grid gap-2 sm:grid-cols-2" {
                        label class="text-sm" {
                            span class="mb-1 block text-muted" { "출처 역할" }
                            select class="w-full rounded-lg border border-border bg-background px-3 py-2" data-admin-field="sourceRole" {
                                @for (value, name) in [("original", "원본"), ("official_reupload", "공식 재업로드"), ("earliest_known", "최초 확인 출처"), ("secondary_reference", "2차 참고 자료"), ("usage_example", "사용 예시")] {
                                    option value=(value) selected[value == "usage_example"] { (name) }
                                }
                            }
                        }
                        label class="text-sm" {
                            span class="mb-1 block text-muted" { "권리 근거" }
                            select class="w-full rounded-lg border border-border bg-background px-3 py-2" data-admin-field="rightsBasis" {
                                @for (value, name) in [("official_embed", "공식 임베드"), ("creator_permission", "창작자 허가"), ("creative_commons", "크리에이티브 커먼즈"), ("public_data", "공공 데이터"), ("link_only", "링크만 허용"), ("unknown", "권리 미확인"), ("blocked", "저작권 위험 차단")] {
                                    option value=(value) selected[value == "official_embed"] { (name) }
                                }
                            }
                        }
                    }
                    input type="text" placeholder="검수 메모 (반려 시 필수)" maxlength="500" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value="" data-admin-field="note";
                    div class="flex gap-2" {
                        button type="button" class="rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50" data-admin-decision="approve" { "승인" }
                        button type="button" class="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-safety-red hover:bg-surface-2 disabled:opacity-50" data-admin-decision="reject" { "반려" }
                    }
                }
            }
        }
    }
}
