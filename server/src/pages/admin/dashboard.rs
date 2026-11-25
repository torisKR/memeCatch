//! `GET /admin` (`app/(default)/admin/page.tsx`) and `GET /admin/analytics`
//! (`app/(admin)/admin/analytics/page.tsx`): the operator dashboard (GA4
//! panel, `getAdminStats` of `lib/actions/admin-stats.ts`, the queue counts)
//! and the 28-day GA4 report.

use std::collections::HashMap;

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use time::{Duration, OffsetDateTime};

use super::format;
use super::ga4::{self, Mode};
use super::shell::Root;
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::public::labels;

pub async fn analytics(State(state): State<AppState>, request: Request) -> Response {
    if let Err(redirect) = super::require_operator(
        &state,
        request.headers(),
        request.uri().path(),
        request.uri().query(),
    )
    .await
    {
        return redirect;
    }
    let report = ga4::report(&state, Mode::Analytics).await;
    super::screen(
        &state,
        Root::Private,
        "GA4 리포트",
        "/admin/analytics",
        analytics_main(&report),
    )
}

pub(super) fn analytics_main(report: &ga4::Report) -> Markup {
    html! {
        div class="space-y-6" {
            div class="flex flex-wrap items-center justify-between gap-3" {
                h1 class="text-2xl font-bold" { "GA4 리포트" }
                form action="/admin/analytics" method="get" {
                    button type="submit" class="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2" { "다시 조회" }
                }
            }
            p class="text-sm text-muted" { "어제까지 최근 28일 · GA4 속성 시간대 기준" }
            (ga4::report_panel(report))
        }
    }
}

struct TopMeme {
    title: String,
    short_id: String,
    slug: String,
    views: u64,
}

/// `AdminStats`, with what the page shows of it.
#[derive(Default)]
struct Stats {
    users: u64,
    new_users_7d: u64,
    saved_memes: i64,
    community_posts: i64,
    top: Vec<TopMeme>,
}

fn service() -> (DbIdentity, IdentityOptions) {
    (DbIdentity::service_role(), IdentityOptions::default())
}

/// `getAdminStats()` as `service_role`. A failed read counts as empty, as
/// `data ?? []` and `count ?? 0` make it.
///
/// The views are read in full for the list of popular memes (PLAN B7-4).
async fn stats(state: &AppState) -> Stats {
    let (identity, options) = service();
    let now = OffsetDateTime::now_utc();
    let since = format::iso(now - Duration::days(14));
    let views: Vec<(String, String)> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                // No order: the first appearances decide the order of ties,
                // as the TypeScript's Map does.
                sqlx::query_as("select meme_id::text, session_hash from public.view_events where created_at >= $1::timestamptz limit 50000")
                    .bind(since)
                    .fetch_all(tx)
                    .await
            })
        })
        .await
        .unwrap_or_default();
    let profiles: Vec<(Option<String>,)> = state
        .db
        .with_identity(&identity, options, |tx| {
            Box::pin(async move {
                sqlx::query_as("select to_json(created_at) #>> '{}' from public.profiles")
                    .fetch_all(tx)
                    .await
            })
        })
        .await
        .unwrap_or_default();
    let count = |sql: &'static str| async move {
        state
            .db
            .with_identity(
                &DbIdentity::service_role(),
                IdentityOptions::default(),
                |tx| Box::pin(async move { sqlx::query_scalar::<_, i64>(sql).fetch_one(tx).await }),
            )
            .await
            .unwrap_or(0)
    };
    let saved_memes = count("select count(*) from public.saved_memes").await;
    let community_posts = count("select count(*) from public.community_posts").await;

    let mut order: Vec<String> = Vec::new();
    let mut by_meme: HashMap<String, u64> = HashMap::new();
    for (meme_id, _) in &views {
        let entry = by_meme.entry(meme_id.clone()).or_insert_with(|| {
            order.push(meme_id.clone());
            0
        });
        *entry += 1;
    }
    let mut ranked: Vec<(String, u64)> = order
        .into_iter()
        .map(|id| {
            let views = by_meme[&id];
            (id, views)
        })
        .collect();
    ranked.sort_by_key(|(_, views)| std::cmp::Reverse(*views));
    ranked.truncate(10);
    let mut top = Vec::new();
    if !ranked.is_empty() {
        let ids: Vec<String> = ranked.iter().map(|(id, _)| id.clone()).collect();
        let memes: Vec<(String, String, String, String)> = state
            .db
            .with_identity(&identity, options, |tx| {
                Box::pin(async move {
                    sqlx::query_as("select id::text, title, short_id, slug from public.memes where id = any($1::uuid[])")
                        .bind(ids)
                        .fetch_all(tx)
                        .await
                })
            })
            .await
            .unwrap_or_default();
        for (id, views) in ranked {
            if let Some((_, title, short_id, slug)) = memes.iter().find(|meme| meme.0 == id) {
                top.push(TopMeme {
                    title: title.clone(),
                    short_id: short_id.clone(),
                    slug: slug.clone(),
                    views,
                });
            }
        }
    }
    let week_ago = now - Duration::days(7);
    Stats {
        users: profiles.len() as u64,
        new_users_7d: profiles
            .iter()
            .filter(|(created,)| {
                created
                    .as_deref()
                    .and_then(format::parse_timestamp)
                    .is_some_and(|at| at > week_ago)
            })
            .count() as u64,
        saved_memes,
        community_posts,
        top,
    }
}

/// The queue counts and the trend batch, as the operator; a failed count is 0.
struct Queues {
    pending: i64,
    reports: i64,
    sources: i64,
    safety: i64,
    translations: i64,
    job: Option<(Option<bool>, Option<String>)>,
    views_24h: i64,
}

async fn queues(state: &AppState, user: &SessionUser) -> Queues {
    let identity = user.db_identity();
    let count = |sql: &'static str| {
        let identity = identity.clone();
        async move {
            state
                .db
                .with_identity(&identity, IdentityOptions::default(), |tx| {
                    Box::pin(async move { sqlx::query_scalar::<_, i64>(sql).fetch_one(tx).await })
                })
                .await
                .unwrap_or(0)
        }
    };
    let day_ago = format::iso(OffsetDateTime::now_utc() - Duration::hours(24));
    let (pending, reports, sources, safety, translations) = tokio::join!(
        count("select count(*) from public.meme_submissions where status = 'pending'"),
        count("select count(*) from public.reports where status = 'open'"),
        count("select count(*) from public.meme_media where review_state = 'pending'"),
        count("select count(*) from public.safety_review_queue where status = 'pending'"),
        count("select count(*) from public.meme_translations where status = 'machine'"),
    );
    let job: Option<(Option<bool>, Option<String>)> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as("select ok, to_json(started_at) #>> '{}' from public.job_runs where job_name = 'compute_trend_scores' order by started_at desc limit 1")
                    .fetch_optional(tx)
                    .await
            })
        })
        .await
        .ok()
        .flatten();
    let (service, options) = service();
    let views_24h = state
        .db
        .with_identity(&service, options, |tx| {
            Box::pin(async move {
                sqlx::query_scalar::<_, i64>(
                    "select count(*) from public.view_events where created_at > $1::timestamptz",
                )
                .bind(day_ago)
                .fetch_one(tx)
                .await
            })
        })
        .await
        .unwrap_or(0);
    Queues {
        pending,
        reports,
        sources,
        safety,
        translations,
        job,
        views_24h,
    }
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
    let (stats, report) = tokio::join!(stats(&state), ga4::report(&state, Mode::Dashboard));
    let queues = queues(&state, &user).await;
    super::screen(
        &state,
        Root::Site,
        super::shell::DASHBOARD_TITLE,
        "/admin",
        view(&stats, &report, &queues),
    )
}

struct Tile {
    href: Option<&'static str>,
    label: &'static str,
    value: String,
    sub: String,
    tone: &'static str,
    icon: Option<&'static str>,
}

fn tile(href: &'static str, label: &'static str, value: String, sub: &str) -> Tile {
    Tile {
        href: Some(href),
        label,
        value,
        sub: sub.to_owned(),
        tone: "",
        icon: None,
    }
}

fn view(stats: &Stats, report: &ga4::Report, queues: &Queues) -> Markup {
    let (label, tone, icon) = match queues.job.as_ref().map(|(ok, _)| *ok) {
        None => ("기록 없음", "text-muted", "◌"),
        Some(Some(true)) => ("정상", "text-safety-green", "●"),
        Some(Some(false)) => ("실패", "text-safety-red", "✕"),
        Some(None) => ("실행 중", "text-safety-yellow", "▲"),
    };
    let started = queues
        .job
        .as_ref()
        .and_then(|(_, started)| started.as_deref())
        .filter(|s| !s.is_empty())
        .and_then(|value| format::parse_timestamp(value).map(format::kst_month_day_time));
    let tiles = [
        tile(
            "/admin/activity",
            "사용자 활동",
            "조회 분석".to_owned(),
            "사용자별 조회 콘텐츠와 일별·시간별 활동을 확인해요",
        ),
        tile(
            "/admin/submissions",
            "대기 제보",
            format!("{}건", queues.pending),
            "검토를 기다리고 있어요",
        ),
        tile(
            "/admin/reports",
            "미처리 신고",
            format!("{}건", queues.reports),
            "확인이 필요해요",
        ),
        tile(
            "/admin/sources",
            "출처 검수 대기",
            format!("{}건", queues.sources),
            "승인 전 임베드 후보예요",
        ),
        tile(
            "/admin/translations",
            "번역 검수 대기",
            format!("{}건", queues.translations),
            "AI 초안이 검수를 기다리고 있어요",
        ),
        tile(
            "/admin/radar-safety",
            "Radar 안전 검수",
            format!("{}건", queues.safety),
            "외부 신호의 등급 변경 제안이에요",
        ),
        tile(
            "/admin/growth",
            "성장 운영",
            "Top 100".to_owned(),
            "SEO 준비도와 영어 파일럿을 관리해요",
        ),
        tile(
            "/admin/memes?focus=unsourced",
            "무출처 공개 문서",
            "품질 큐".to_owned(),
            "트렌드 점수가 높은 무출처 문서부터 검수해요",
        ),
        Tile {
            href: None,
            label: "어제 배치 (trend_score)",
            value: label.to_owned(),
            sub: started.map_or_else(
                || "compute_trend_scores 실행 기록이 없어요".to_owned(),
                |time| format!("최근 실행 {time}"),
            ),
            tone,
            icon: Some(icon),
        },
        Tile {
            href: None,
            label: "최근 24시간 조회",
            value: format!("{}회", format::count(queues.views_24h)),
            sub: "view_events 기준".to_owned(),
            tone: "",
            icon: None,
        },
    ];
    html! {
        div class="space-y-6" {
            h1 class="text-2xl font-bold" { "대시보드" }
            (ga4::dashboard_panel(report))
            section aria-labelledby="today-stats" class="space-y-3" {
                h2 id="today-stats" class="text-lg font-bold" { "서비스 운영 " span class="text-sm font-normal text-muted" { "(DB 기준)" } }
                div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    (stat("전체 회원", &format::count(i64::try_from(stats.users).unwrap_or(i64::MAX)), &format!("최근 7일 신규 {}명", stats.new_users_7d)))
                }
            }
            @if !stats.top.is_empty() {
                section aria-labelledby="top-memes" class="rounded-xl border border-border bg-surface p-5" {
                    h2 id="top-memes" class="text-lg font-bold" { "최근 14일 인기 밈 · DB view_events 기준" }
                    ol class="mt-3 divide-y divide-border" {
                        @for (index, meme) in stats.top.iter().enumerate() {
                            li class="flex items-center gap-3 py-2.5" {
                                span class="w-5 shrink-0 text-center font-mono text-sm font-bold text-accent-text" { (index + 1) }
                                a href=(labels::meme_path(&meme.short_id, &meme.slug)) class="min-w-0 flex-1 truncate font-semibold hover:text-accent" { (meme.title) }
                                span class="shrink-0 tabular-nums text-sm text-muted" { (format::count(i64::try_from(meme.views).unwrap_or(i64::MAX))) "회" }
                            }
                        }
                    }
                }
            }
            div class="grid gap-4 sm:grid-cols-2" {
                (stat("저장된 밈", &format::count(stats.saved_memes), "누적"))
                (stat("커뮤니티 글", &format::count(stats.community_posts), "누적"))
            }
            h2 class="text-lg font-bold" { "운영 대기열" }
            div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                @for tile in &tiles {
                    @let card = html! {
                        div class="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5" {
                            span class="text-base text-muted" { (tile.label) }
                            span class=(format!("text-3xl font-bold {}", tile.tone)) {
                                @if let Some(icon) = tile.icon { span aria-hidden="true" class="mr-1.5 text-xl align-middle" { (icon) } }
                                (tile.value)
                            }
                            span class="text-sm text-muted" { (tile.sub) }
                        }
                    };
                    @match tile.href {
                        Some(href) => a href=(href) class="block rounded-xl hover:opacity-90" { (card) },
                        None => (card),
                    }
                }
            }
        }
    }
}

/// `StatCard` without a delta (the page passes none).
fn stat(label: &str, value: &str, sub: &str) -> Markup {
    html! {
        div class="flex h-full flex-col gap-1 rounded-xl border border-border bg-surface p-5" {
            span class="text-base text-muted" { (label) }
            span class="flex items-baseline gap-2" { span class="text-3xl font-bold tabular-nums" { (value) } }
            span class="text-sm text-muted" { (sub) }
        }
    }
}
