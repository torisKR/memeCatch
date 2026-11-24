//! `GET /admin/memes` (`app/(default)/admin/memes/page.tsx`): the hundred
//! most recently updated memes, or the quality queue of public memes without
//! a source (`focus=unsourced`, by trend), filtered by title, status and
//! house-original origin.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use sqlx::Row;

use super::badges::{self, MODERATION_STATUSES};
use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::routes::public::js;

const UNSOURCED: &str = "unsourced";
const HOUSE_ORIGINAL: &str = "house_original";
const LIST_LIMIT: i64 = 100;
/// `ADMIN_UNSOURCED_OVERFETCH` and `ADMIN_UNSOURCED_LIMIT`.
const OVERFETCH: i64 = 300;
const QUEUE_LIMIT: usize = 100;

struct Meme {
    id: String,
    title: String,
    moderation_status: String,
    safety_level: String,
    lifecycle_status: String,
    trend_score: f64,
    origin_kind: Option<String>,
    sources: Vec<Option<String>>,
}

struct Filters<'a> {
    q: &'a str,
    status: Option<&'a str>,
    origin: Option<&'a str>,
    queue: bool,
}

async fn load(
    state: &AppState,
    user: &SessionUser,
    filters: &Filters<'_>,
) -> Result<Vec<Meme>, sqlx::Error> {
    let q = js::trim(filters.q);
    let mut sql = String::from(
        "select m.id::text, m.title, m.moderation_status::text, m.safety_level::text, m.lifecycle_status::text, m.trend_score::float8, m.origin_kind, \
         array(select s.source_url from public.meme_sources s where s.meme_id = m.id) as sources \
         from public.memes m where true",
    );
    if filters.queue {
        sql.push_str(" and m.moderation_status in ('approved', 'limited')");
    }
    let mut binds: Vec<String> = Vec::new();
    let mut bind = |sql: &mut String, clause: &str, value: String| {
        binds.push(value);
        sql.push_str(&clause.replace("$n", &format!("${}", binds.len())));
    };
    if !q.is_empty() {
        bind(&mut sql, " and m.title ilike $n", format!("%{q}%"));
    }
    if let Some(status) = filters.status {
        bind(
            &mut sql,
            " and m.moderation_status = $n::public.moderation_status",
            status.to_owned(),
        );
    }
    if let Some(origin) = filters.origin {
        bind(&mut sql, " and m.origin_kind = $n", origin.to_owned());
    }
    if filters.queue {
        sql.push_str(&format!(" order by m.trend_score desc limit {OVERFETCH}"));
    } else {
        sql.push_str(&format!(" order by m.updated_at desc limit {LIST_LIMIT}"));
    }
    let rows = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let mut query = sqlx::query(sqlx::AssertSqlSafe(sql));
                for bind in binds {
                    query = query.bind(bind);
                }
                query.fetch_all(tx).await
            })
        })
        .await?;
    rows.iter()
        .map(|row| {
            Ok(Meme {
                id: row.try_get(0)?,
                title: row.try_get(1)?,
                moderation_status: row.try_get(2)?,
                safety_level: row.try_get(3)?,
                lifecycle_status: row.try_get(4)?,
                trend_score: row.try_get(5)?,
                origin_kind: row.try_get(6)?,
                sources: row.try_get(7)?,
            })
        })
        .collect()
}

/// `rankUnsourcedQualityQueue`: the memes without a source URL that is not
/// blank (JavaScript's `trim`), by trend, then id.
fn rank(memes: Vec<Meme>) -> Vec<Meme> {
    let mut unsourced: Vec<Meme> = memes
        .into_iter()
        .filter(|meme| {
            !meme
                .sources
                .iter()
                .any(|url| !js::trim(url.as_deref().unwrap_or_default()).is_empty())
        })
        .collect();
    unsourced.sort_by(|a, b| {
        b.trend_score
            .partial_cmp(&a.trend_score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.id.cmp(&b.id))
    });
    unsourced.truncate(QUEUE_LIMIT);
    unsourced
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
    let query = crate::routes::request::query_pairs(request.uri());
    let q = super::param(&query, "q").unwrap_or_default();
    let status = super::param(&query, "status").unwrap_or_default();
    let queue = super::param(&query, "focus").as_deref() == Some(UNSOURCED);
    let origin = (super::param(&query, "origin").as_deref() == Some(HOUSE_ORIGINAL))
        .then_some(HOUSE_ORIGINAL);
    let filters = Filters {
        q: &q,
        status: MODERATION_STATUSES
            .contains(&status.as_str())
            .then_some(status.as_str()),
        origin,
        queue,
    };
    let main = match load(&state, &user, &filters).await {
        Ok(memes) => {
            let memes = if queue { rank(memes) } else { memes };
            view(
                &memes,
                &filters,
                &q,
                &super::values(&query, "status"),
                &status,
            )
        }
        Err(error) => {
            tracing::warn!(%error, "admin memes failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, "밈 관리", "/admin/memes", main)
}

/// `adminMemeListEmptyState`: title, body and the optional action.
fn empty_state(
    filters: &Filters<'_>,
) -> (
    &'static str,
    &'static str,
    Option<(&'static str, &'static str)>,
) {
    if filters.origin.is_some() {
        (
            "자체 제작 항목이 없어요",
            "밈캐치가 만든 사전 행만 여기에 모입니다. 인터넷 밈 카탈로그와 섞지 않습니다.",
            Some(("/admin/memes/new", "자체 제작 등록")),
        )
    } else if filters.queue {
        (
            "조건에 맞는 밈이 없어요",
            "무출처 공개 문서가 없거나, 검색어·상태 필터를 바꿔 보세요.",
            None,
        )
    } else {
        (
            "조건에 맞는 밈이 없어요",
            "검색어나 상태 필터를 바꿔 보세요.",
            None,
        )
    }
}

const SELECT: &str = "min-h-11 rounded-lg border border-border bg-surface px-3 text-base";

fn view(memes: &[Meme], filters: &Filters<'_>, q: &str, statuses: &[&str], status: &str) -> Markup {
    html! {
        div class="space-y-6" {
            div class="flex flex-wrap items-end justify-between gap-3" {
                h1 class="text-2xl font-bold" { "밈 관리" }
                div class="flex flex-wrap gap-2" {
                    a href="/admin/memes/catalog/new" class="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-4 text-base font-semibold text-white" { "외부 밈 정식 등록" }
                    a href="/admin/memes/new" class="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 text-base font-semibold" { "자체 제작 등록" }
                }
            }
            @if filters.queue {
                p class="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm leading-relaxed" { "공개 문서 중 근거 출처 URL이 없는 항목을 트렌드 점수 순으로 보여 줍니다. 데이터는 읽기만 하며 자동 공개하지 않습니다." }
            }
            form method="GET" class="flex flex-wrap items-end gap-3" {
                label class="block grow sm:max-w-xs" {
                    span class="mb-1 block text-base font-medium" { "검색" }
                    input type="search" name="q" placeholder="제목으로 검색" class="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base" value=(q);
                }
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "검수 상태" }
                    select name="status" class=(SELECT) {
                        option value="" selected[super::selects(statuses, status, "")] { "전체" }
                        @for value in MODERATION_STATUSES {
                            option value=(value) selected[super::selects(statuses, status, value)] { (badges::moderation(value).0) }
                        }
                    }
                }
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "품질 큐" }
                    select name="focus" class=(SELECT) {
                        option value="" selected[!filters.queue] { "최근 수정" }
                        option value=(UNSOURCED) selected[filters.queue] { "무출처 공개 문서" }
                    }
                }
                label class="block" {
                    span class="mb-1 block text-base font-medium" { "출처 구분" }
                    select name="origin" class=(SELECT) {
                        option value="" selected[filters.origin.is_none()] { "전체" }
                        option value=(HOUSE_ORIGINAL) selected[filters.origin.is_some()] { "자체 제작" }
                    }
                }
                button type="submit" class="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white" { "적용" }
            }
            @if memes.is_empty() {
                @let (title, body, action) = empty_state(filters);
                div class="rounded-xl border border-border bg-surface p-10 text-center" {
                    p class="text-lg font-semibold" { (title) }
                    p class="mt-1 text-base text-muted" { (body) }
                    @if let Some((href, label)) = action {
                        a href=(href) class="mt-4 inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-4 text-base font-semibold text-white" { (label) }
                    }
                }
            } @else {
                div class="overflow-x-auto rounded-xl border border-border bg-surface" {
                    table class="w-full min-w-[720px] text-left text-base" {
                        thead {
                            tr class="border-b border-border text-muted" {
                                @for heading in ["제목", "검수 상태", "신호등", "생명주기", "트렌드 점수"] {
                                    th class="px-4 py-3 font-medium" { (heading) }
                                }
                            }
                        }
                        tbody {
                            @for meme in memes {
                                tr class="border-b border-border last:border-b-0 hover:bg-surface-2" {
                                    td class="px-4 py-3" {
                                        div class="flex flex-wrap items-center gap-2" {
                                            a href=(format!("/admin/memes/{}", meme.id)) class="flex min-h-11 items-center font-semibold text-accent-text underline-offset-2 hover:underline" { (meme.title) }
                                            (badges::origin_kind_badge(meme.origin_kind.as_deref()))
                                        }
                                    }
                                    td class="px-4 py-3" { (badges::moderation_badge(&meme.moderation_status)) }
                                    td class="px-4 py-3" { (badges::safety_badge(&meme.safety_level)) }
                                    td class="px-4 py-3" { (badges::lifecycle(&meme.lifecycle_status)) }
                                    td class="px-4 py-3 tabular-nums" { (format::to_fixed(meme.trend_score, 2)) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
