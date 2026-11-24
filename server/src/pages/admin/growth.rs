//! `GET /admin/growth` (`app/(default)/admin/growth/page.tsx`): the growth
//! KPIs, the Top-100 SEO audit (`lib/growth/seo-readiness.ts`), the English
//! pilot slots and the interview ledger. The two forms post to
//! `routes/admin/growth.rs`, which answers with the redirect the actions make.
//!
//! Next passes the audited ids to `get_growth_seo_related_counts` as `text[]`;
//! the function takes `uuid[]`, so Next's page always fails. Here they go as
//! `uuid[]` (PLAN B7-3).

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;
use sqlx::Row;

use super::format;
use super::shell::{self, Root};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::IdentityOptions;
use crate::pages::content_depth;
use crate::routes::public::{js, labels};

const TITLE: &str = "성장 운영";
const AUDIT_LIMIT: usize = 100;
/// `MAX_CONTENT_DEPTH_SCORE` of lib/content-depth.ts.
const MAX_DEPTH_SCORE: f64 = 13.0;
const CAMPAIGN_STATES: [&str; 3] = ["ready", "in_progress", "measurement_due"];
const NO_TARGET: &str = "00000000-0000-0000-0000-000000000000";

/// `CHECK_LABELS`, in the order of `Object.keys`.
const CHECKS: [&str; 6] = [
    "고유 title",
    "고유 description",
    "canonical",
    "OG",
    "관련 링크",
    "완성도",
];
/// `STATUS_LABELS`.
pub const STATUSES: [(&str, &str); 5] = [
    ("open", "비어 있음"),
    ("assigned", "배정"),
    ("ready", "발행 준비"),
    ("published", "발행"),
    ("paused", "보류"),
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Metric {
    available: bool,
    value: Option<f64>,
    numerator: u64,
    denominator: u64,
}

#[derive(Deserialize)]
struct KpiMetrics {
    activation: Metric,
    account: Metric,
}

/// `parseGrowthKpiDashboard`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Kpi {
    period_start: Option<String>,
    period_end: Option<String>,
    metrics: KpiMetrics,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Slot {
    slot: u8,
    meme_id: Option<String>,
    status: String,
    operator_note: String,
    translation_current: bool,
    landing_path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Candidate {
    meme_id: String,
    title: String,
    english_title: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Interview {
    id: String,
    participant_reference: String,
    interviewed_at: String,
    market: String,
    segment: String,
    summary: String,
    evidence_url: Option<String>,
}

/// `parseGrowthPilotDashboard`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pilot {
    slots: Vec<Slot>,
    candidates: Vec<Candidate>,
    interview_count: u64,
    interviews: Vec<Interview>,
}

impl Pilot {
    /// The checks of the zod schema that serde's types do not make.
    fn valid(&self) -> bool {
        self.slots.iter().all(|slot| {
            (1..=20).contains(&slot.slot)
                && STATUSES.iter().any(|(status, _)| *status == slot.status)
        }) && self
            .candidates
            .iter()
            .all(|candidate| is_uuid(&candidate.meme_id))
            && self
                .interviews
                .iter()
                .all(|interview| is_uuid(&interview.id))
    }
}

/// zod 4's `z.uuid()` (RFC 9562, with the nil and max ids).
pub fn is_uuid(value: &str) -> bool {
    if value == NO_TARGET || value.eq_ignore_ascii_case("ffffffff-ffff-ffff-ffff-ffffffffffff") {
        return true;
    }
    let bytes = value.as_bytes();
    super::activity::is_guid(value)
        && (b'1'..=b'8').contains(&bytes[14])
        && matches!(bytes[19], b'8' | b'9' | b'a' | b'b' | b'A' | b'B')
}

/// A meme of the audit, with what `auditTopSeoMemes` reads.
struct AuditMeme {
    id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    trend_score: f64,
    depth: content_depth::ContentDepth,
}

/// `SeoReadinessAudit`.
struct AuditRow {
    rank: usize,
    title: String,
    path: String,
    related: i64,
    completeness: i64,
    checks: [bool; 6],
    readiness: i64,
    ready: bool,
}

/// What the page needs from the database, or the message of the error
/// boundary (`throw new Error(…)` in the page).
struct Growth {
    campaign: Option<String>,
    audit: Vec<AuditRow>,
    kpi: Kpi,
    pilot: Pilot,
}

/// `Math.round` of a non-negative value.
fn round(value: f64) -> i64 {
    (value + 0.5).floor() as i64
}

fn normalize(value: &str) -> String {
    js::trim(value).to_lowercase()
}

fn duplicates(values: impl Iterator<Item = String>) -> std::collections::HashSet<String> {
    let mut counts = std::collections::HashMap::<String, usize>::new();
    for value in values {
        *counts.entry(value).or_default() += 1;
    }
    counts
        .into_iter()
        .filter(|(_, count)| *count > 1)
        .map(|(value, _)| value)
        .collect()
}

/// `auditTopSeoMemes` with the related counts from the database.
fn audit(
    mut memes: Vec<AuditMeme>,
    targets: Option<&[String]>,
    related: &[(String, i64)],
) -> Vec<AuditRow> {
    match targets {
        Some(targets) => {
            memes.retain(|meme| targets.contains(&meme.id));
            memes.sort_by_key(|meme| targets.iter().position(|id| *id == meme.id));
        }
        None => memes.sort_by(|left, right| {
            right
                .trend_score
                .partial_cmp(&left.trend_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| left.id.cmp(&right.id))
        }),
    }
    memes.truncate(AUDIT_LIMIT);
    let titles: Vec<String> = memes
        .iter()
        .map(|meme| format!("{} 뜻", meme.title))
        .collect();
    let descriptions: Vec<String> = memes
        .iter()
        .map(|meme| {
            format!(
                "{} 뜻과 유래 — {}. 지금 써도 되는지 사용 안전 신호등까지 확인하세요.",
                meme.title, meme.summary
            )
        })
        .collect();
    let paths: Vec<String> = memes
        .iter()
        .map(|meme| labels::meme_path(&meme.short_id, &meme.slug))
        .collect();
    let duplicate_titles = duplicates(titles.iter().map(|title| normalize(title)));
    let duplicate_descriptions = duplicates(
        descriptions
            .iter()
            .map(|description| normalize(description)),
    );
    let duplicate_paths = duplicates(paths.iter().cloned());
    memes
        .iter()
        .enumerate()
        .map(|(index, meme)| {
            let (title, description, path) = (&titles[index], &descriptions[index], &paths[index]);
            let related = related
                .iter()
                .find(|(id, _)| *id == meme.id)
                .map_or(0, |(_, count)| *count);
            let unique_title = !duplicate_titles.contains(&normalize(title));
            let unique_description = !duplicate_descriptions.contains(&normalize(description));
            let unique_path = !duplicate_paths.contains(path);
            let checks = [
                js::utf16_len(js::trim(&meme.title)) >= 2 && unique_title,
                js::utf16_len(js::trim(&meme.summary)) >= 10 && unique_description,
                !js::trim(&meme.short_id).is_empty()
                    && !js::trim(&meme.slug).is_empty()
                    && unique_path,
                !title.is_empty()
                    && !description.is_empty()
                    && path.starts_with("/memes/")
                    && unique_title
                    && unique_description
                    && unique_path,
                related > 0,
                meme.depth.is_indexable(),
            ];
            let passed = checks.iter().filter(|check| **check).count();
            AuditRow {
                rank: index + 1,
                title: meme.title.clone(),
                path: path.clone(),
                related,
                completeness: round(f64::from(meme.depth.score) / MAX_DEPTH_SCORE * 100.0),
                checks,
                readiness: round(passed as f64 / checks.len() as f64 * 100.0),
                ready: passed == checks.len(),
            }
        })
        .collect()
}

const MEME_SQL: &str = "select m.id::text as id, m.short_id, m.slug, m.title, m.summary, m.trend_score::float8 as trend_score, ";

async fn load(state: &AppState, user: &SessionUser) -> Result<Growth, String> {
    let identity = user.db_identity();
    let run = |label: &'static str| {
        move |error: sqlx::Error| format!("{label}: {}", crate::routes::admin::db_message(&error))
    };
    let campaign: Option<String> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar("select id::text from public.seo_campaigns where state = any($1::text[]) order by created_at desc limit 1")
                    .bind(CAMPAIGN_STATES.map(str::to_owned).to_vec())
                    .fetch_optional(tx)
                    .await
            })
        })
        .await
        .map_err(run("SEO 캠페인을 확인하지 못했어요"))?;
    let targets: Option<Vec<String>> = match &campaign {
        None => None,
        Some(id) => {
            let id = id.clone();
            Some(
                state
                    .db
                    .with_identity(&identity, IdentityOptions::default(), |tx| {
                        Box::pin(async move {
                            sqlx::query_scalar(
                                "select meme_id::text from public.seo_campaign_items where campaign_id = $1::uuid and bucket = 'target' order by batch asc, created_at asc, id asc limit 100",
                            )
                            .bind(id)
                            .fetch_all(tx)
                            .await
                        })
                    })
                    .await
                    .map_err(run("SEO 캠페인 대상을 불러오지 못했어요"))?,
            )
        }
    };
    let where_ids = match (&campaign, &targets) {
        (Some(_), Some(ids)) if !ids.is_empty() => "and m.id = any($1::uuid[])".to_owned(),
        (Some(_), _) => format!("and m.id = '{NO_TARGET}'::uuid"),
        (None, _) => "order by m.trend_score desc, m.id asc limit 100".to_owned(),
    };
    let sql = format!(
        "{MEME_SQL}{} from public.memes m where m.moderation_status in ('approved', 'limited') {where_ids}",
        content_depth::DEPTH_COLUMNS
    );
    let bind = targets.clone().unwrap_or_default();
    let rows = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let query = sqlx::query(sqlx::AssertSqlSafe(sql));
                let query = if bind.is_empty() {
                    query
                } else {
                    query.bind(bind)
                };
                query.fetch_all(tx).await
            })
        })
        .await
        .map_err(run("Top-100 SEO 데이터를 불러오지 못했어요"))?;
    let mut memes = Vec::with_capacity(rows.len());
    for row in &rows {
        let text = |name: &str| {
            row.try_get::<Option<String>, _>(name)
                .ok()
                .flatten()
                .unwrap_or_default()
        };
        memes.push(AuditMeme {
            id: text("id"),
            short_id: text("short_id"),
            slug: text("slug"),
            title: text("title"),
            summary: text("summary"),
            trend_score: row
                .try_get::<Option<f64>, _>("trend_score")
                .ok()
                .flatten()
                .unwrap_or(0.0),
            depth: content_depth::row_depth(row).map_err(|error| error.to_string())?,
        });
    }
    let rpc = |name: &'static str, label: &'static str| {
        let identity = identity.clone();
        async move {
            state
                .db
                .with_identity(&identity, IdentityOptions::default(), |tx| {
                    Box::pin(async move {
                        sqlx::query_scalar::<_, String>(sqlx::AssertSqlSafe(format!(
                            "select public.{name}()::text"
                        )))
                        .fetch_one(tx)
                        .await
                    })
                })
                .await
                .map_err(|error| format!("{label}: {}", crate::routes::admin::db_message(&error)))
        }
    };
    let (pilot, kpi) = tokio::join!(
        rpc(
            "get_growth_pilot_dashboard",
            "영문 파일럿 데이터를 불러오지 못했어요"
        ),
        rpc("get_growth_kpi_dashboard", "성장 KPI를 불러오지 못했어요"),
    );
    let (pilot, kpi) = (pilot?, kpi?);
    let ids: Vec<String> = memes.iter().map(|meme| meme.id.clone()).collect();
    let related: Vec<(String, i64)> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_as("select meme_id::text, related_count::int8 from public.get_growth_seo_related_counts(p_meme_ids => $1::uuid[])")
                    .bind(ids)
                    .fetch_all(tx)
                    .await
            })
        })
        .await
        .map_err(run("SEO 관련 링크를 검사하지 못했어요"))?;
    let pilot: Pilot = serde_json::from_str(&pilot)
        .ok()
        .filter(Pilot::valid)
        .ok_or_else(|| "invalid_pilot_dashboard".to_owned())?;
    let kpi: Kpi = serde_json::from_str(&kpi).map_err(|_| "invalid_kpi_dashboard".to_owned())?;
    let audit = audit(memes, campaign.as_ref().and(targets.as_deref()), &related);
    Ok(Growth {
        campaign,
        audit,
        kpi,
        pilot,
    })
}

fn notice(query: Option<&str>, key: &str) -> Option<String> {
    let values: Vec<String> = url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
        .filter(|(name, _)| name == key)
        .map(|(_, value)| value.into_owned())
        .collect();
    let joined = values.concat();
    (!joined.is_empty()).then_some(joined)
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let query = request.uri().query();
    let user = match super::require_operator(&state, request.headers(), request.uri().path(), query)
        .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let main = match load(&state, &user).await {
        Ok(growth) => view(&growth, notice(query, "saved"), notice(query, "error")),
        Err(error) => {
            tracing::warn!(error, "growth page failed");
            shell::error_boundary()
        }
    };
    super::screen(&state, Root::Site, TITLE, "/admin/growth", main)
}

fn date_time(value: &str) -> String {
    format::parse_timestamp(value)
        .map_or_else(|| "Invalid Date".to_owned(), format::kst_medium_short)
}

fn metric_card(label: &str, value: &str) -> Markup {
    html! {
        div class="rounded-xl border border-border bg-surface p-4" {
            div class="text-sm text-muted" { (label) }
            div class="mt-1 text-2xl font-bold tabular-nums" { (value) }
        }
    }
}

fn kpi_card(label: &str, target: &str, good: f64, below: &str, metric: &Metric) -> Markup {
    let value = metric.value.filter(|_| metric.available);
    let (state_below, message) = match value {
        None => (false, "insufficient data"),
        Some(value) if value >= good => (false, "초기 목표 범위입니다."),
        Some(_) => (true, below),
    };
    html! {
        article class="rounded-xl border border-border bg-surface p-4" {
            div class="flex items-start justify-between gap-3" {
                h3 class="font-semibold" { (label) }
                span class="text-xs text-muted" { "목표 " (target) }
            }
            div class="mt-2 text-2xl font-bold tabular-nums" {
                @match value { Some(value) => (format!("{value}%")), None => "insufficient data" }
            }
            @if metric.available {
                p class="mt-1 text-xs text-muted" { (metric.numerator) " / " (metric.denominator) }
            }
            p class=(if state_below { "mt-3 text-sm text-danger" } else { "mt-3 text-sm text-muted" }) { (message) }
        }
    }
}

fn view(growth: &Growth, saved: Option<String>, error: Option<String>) -> Markup {
    let ready = growth.audit.iter().filter(|row| row.ready).count();
    let audited = growth.audit.len();
    let completion = if audited == 0 {
        0
    } else {
        round(ready as f64 / audited as f64 * 100.0)
    };
    let gap = AUDIT_LIMIT.saturating_sub(audited);
    let pilot = &growth.pilot;
    let assigned = pilot
        .slots
        .iter()
        .filter(|slot| slot.meme_id.is_some())
        .count();
    let pilot_ready = pilot
        .slots
        .iter()
        .filter(|slot| {
            slot.translation_current && (slot.status == "ready" || slot.status == "published")
        })
        .count();
    let published = pilot
        .slots
        .iter()
        .filter(|slot| slot.translation_current && slot.status == "published")
        .count();
    let stale = pilot
        .slots
        .iter()
        .filter(|slot| slot.meme_id.is_some() && !slot.translation_current)
        .count();
    let interviews = pilot.interview_count;
    let gate_met = interviews >= 10;
    let complete = published == 20 && gate_met;
    html! {
        div class="space-y-10" {
            header {
                h1 class="text-2xl font-bold" { (TITLE) }
                p class="mt-1 text-sm text-muted" { "Top-100 검색 랜딩 준비도와 영어 파일럿의 실제 진행 상태를 한곳에서 확인합니다." }
            }
            @if let Some(error) = &error {
                p role="alert" class="rounded-xl border border-danger p-3 text-sm text-danger" { (error) }
            }
            @if let Some(saved) = &saved {
                p role="status" class="rounded-xl border border-border bg-surface p-3 text-sm" { (saved) }
            }
            section class="space-y-4" aria-labelledby="growth-kpi-heading" {
                div {
                    h2 id="growth-kpi-heading" class="text-xl font-bold" { "성장 KPI 판단판" }
                    p class="mt-1 text-sm text-muted" { "최신 내구성 baseline과 이벤트 원장만 사용합니다. 아래 상태는 기획서 임계값에 따른 운영 참고이며 제품·가격·유입을 자동으로 변경하지 않습니다." }
                    @if let (Some(start), Some(end)) = (growth.kpi.period_start.as_deref().filter(|s| !s.is_empty()), growth.kpi.period_end.as_deref().filter(|s| !s.is_empty())) {
                        p class="mt-1 text-xs text-muted" { "집계 기간 " (date_time(start)) " ~ " (date_time(end)) }
                    }
                }
                div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3" {
                    (kpi_card("활성화", "8% 이상", 8.0, "상세 첫 화면의 가치 전달을 점검하세요.", &growth.kpi.metrics.activation))
                    (kpi_card("계정 전환", "35% 이상", 35.0, "로그인 전환 마찰을 점검하세요.", &growth.kpi.metrics.account))
                }
                p class="text-xs text-muted" { "계정 전환은 저장 의도와 동일 세션의 후속 인증 이벤트가 모두 확인된 경우만 집계합니다. 재구매·월 복사는 장기 커버리지와 적격 유료 코호트가 없으면 계산하지 않습니다." }
            }
            section class="space-y-4" aria-labelledby="seo-audit-heading" {
                div {
                    h2 id="seo-audit-heading" class="text-xl font-bold" { "Top-100 SEO 준비도" }
                    p class="mt-1 text-sm text-muted" {
                        @match &growth.campaign {
                            Some(id) => (format!("{id} 캠페인의 대상 URL을 캠페인 순서로 감사합니다.")),
                            None => "활성 SEO 캠페인이 없어 트렌드 점수 상위 URL을 감사합니다.",
                        }
                        " title, description, canonical, OG, 전체 공개 코퍼스의 관련 링크, 콘텐츠 완성도를 동일한 규칙으로 다시 계산합니다."
                    }
                }
                div class="grid gap-3 sm:grid-cols-4" {
                    (metric_card("감사 대상", &format!("{audited}/100")))
                    (metric_card("준비 완료", &ready.to_string()))
                    (metric_card("보완 필요", &(audited - ready).to_string()))
                    (metric_card("완료율", &format!("{completion}%")))
                }
                @if gap > 0 {
                    p role="alert" class="rounded-xl border border-danger p-3 text-sm text-danger" { "Top-100 감사 대상이 " (gap) "개 부족합니다. 콘텐츠 또는 SEO 캠페인 대상 데이터를 채우기 전에는 완료로 볼 수 없습니다." }
                }
                div class="overflow-x-auto rounded-xl border border-border bg-surface" {
                    table class="min-w-full text-left text-sm" {
                        thead class="border-b border-border bg-surface-2 text-muted" {
                            tr { @for label in ["순위", "밈", "준비도", "완성도", "점검"] { th class="px-3 py-2" { (label) } } }
                        }
                        tbody class="divide-y divide-border" {
                            @for row in &growth.audit {
                                tr {
                                    td class="px-3 py-3 tabular-nums" { (row.rank) }
                                    td class="px-3 py-3" {
                                        a href=(row.path) class="font-medium text-accent-text underline" { (row.title) }
                                        div class="mt-0.5 text-xs text-muted" { "관련 후보 " (row.related) "개" }
                                    }
                                    td class="px-3 py-3 font-semibold tabular-nums" { (row.readiness) "%" }
                                    td class="px-3 py-3 tabular-nums" { (row.completeness) "%" }
                                    td class="px-3 py-3" {
                                        div class="flex min-w-72 flex-wrap gap-1.5" {
                                            @for (label, passed) in CHECKS.iter().zip(row.checks) {
                                                span class=(if passed { "rounded-full px-2 py-0.5 text-xs bg-surface-2 text-foreground" } else { "rounded-full px-2 py-0.5 text-xs border border-danger text-danger" }) { (label) }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            section class="space-y-4" aria-labelledby="english-pilot-heading" {
                div {
                    h2 id="english-pilot-heading" class="text-xl font-bold" { "영어 파일럿" }
                    p class="mt-1 text-sm text-muted" { "최신 원문 기준으로 검수 완료된 영어 번역만 배정할 수 있습니다. 슬롯 생성은 운영 준비 상태이며 실제 인터뷰나 사용자 반응을 뜻하지 않습니다." }
                }
                div class="grid gap-3 sm:grid-cols-5" {
                    (metric_card("랜딩 슬롯", &format!("{assigned}/20")))
                    (metric_card("발행 준비", &pilot_ready.to_string()))
                    (metric_card("발행", &format!("{published}/20")))
                    (metric_card("실제 인터뷰", &format!("{interviews}/10")))
                    (metric_card("파일럿 완료", if complete { "완료" } else { "미완료" }))
                }
                @if stale > 0 {
                    p role="alert" class="rounded-xl border border-danger p-3 text-sm text-danger" { "원문 변경 또는 필수 영문 본문 누락으로 무효화된 슬롯이 " (stale) "개 있습니다." }
                }
                p role="status" class=(if gate_met { "rounded-xl border p-4 text-sm font-medium border-border bg-surface" } else { "rounded-xl border p-4 text-sm font-medium border-danger text-danger" }) {
                    "외부 검증 게이트: 실제 해외 사용자 인터뷰 10건이 필요합니다. 현재 " (interviews) "건이며, 기록이 없는 인터뷰는 완료로 계산하지 않습니다."
                }
                div class="grid gap-3 lg:grid-cols-2" {
                    @for slot in &pilot.slots { (slot_form(slot, &pilot.candidates)) }
                }
            }
            (interview_section(&pilot.interviews))
        }
    }
}

fn slot_form(slot: &Slot, candidates: &[Candidate]) -> Markup {
    let selected = slot.meme_id.as_deref().unwrap_or("");
    html! {
        form class="space-y-3 rounded-xl border border-border bg-surface p-4" action="/_axum/admin/growth-slot" method="post" {
            input type="hidden" name="slot" value=(slot.slot);
            div class="flex items-center justify-between gap-3" {
                h3 class="font-semibold" { "슬롯 " (slot.slot) }
                @if let Some(path) = slot.landing_path.as_deref().filter(|path| !path.is_empty()) {
                    a href=(path) class="text-sm text-accent-text underline" { "랜딩 보기" }
                }
            }
            @if slot.meme_id.as_deref().is_some_and(|id| !id.is_empty()) && !slot.translation_current {
                p role="alert" class="text-sm text-danger" { "이 슬롯의 영문 랜딩은 현재 공개 요건을 충족하지 않습니다." }
            }
            label class="block text-sm font-medium" {
                "영문 랜딩"
                select name="memeId" class="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3" {
                    option value="" selected[selected.is_empty()] { "선택 안 함" }
                    @for candidate in candidates {
                        option value=(candidate.meme_id) selected[candidate.meme_id == selected] { (candidate.english_title) " · " (candidate.title) }
                    }
                }
            }
            label class="block text-sm font-medium" {
                "상태"
                select name="status" class="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3" {
                    @for (status, label) in STATUSES {
                        option value=(status) selected[status == slot.status] { (label) }
                    }
                }
            }
            label class="block text-sm font-medium" {
                "운영 메모"
                textarea name="operatorNote" maxlength="1000" rows="2" class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" { (slot.operator_note) }
            }
            button class="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white" { "슬롯 저장" }
        }
    }
}

fn field(label: &str, name: &str, kind: &str, placeholder: Option<&str>) -> Markup {
    html! {
        label class="block text-sm font-medium" {
            (label)
            input name=(name) type=(kind) required[name != "evidenceUrl"] placeholder=[placeholder] class="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3";
        }
    }
}

fn interview_section(interviews: &[Interview]) -> Markup {
    html! {
        section class="space-y-4" aria-labelledby="interview-ledger-heading" {
            div {
                h2 id="interview-ledger-heading" class="text-xl font-bold" { "실제 인터뷰 원장" }
                p class="mt-1 text-sm text-muted" { "실제로 진행한 인터뷰만 익명 참가자 참조값과 근거를 남겨 기록합니다. 초기 데이터는 없습니다." }
            }
            form class="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2" action="/_axum/admin/growth-interview" method="post" {
                (field("참가자 참조값", "participantReference", "text", Some("예: interview-2026-001")))
                (field("인터뷰 시각", "interviewedAt", "datetime-local", None))
                (field("시장", "market", "text", Some("예: United States")))
                (field("사용자군", "segment", "text", Some("예: K-content creator")))
                label class="block text-sm font-medium sm:col-span-2" {
                    "확인한 내용"
                    textarea name="summary" required minlength="20" maxlength="4000" rows="4" class="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="사용자가 실제로 말한 문제, 현재 대안, 결제 의향을 사실대로 기록하세요." {}
                }
                (field("근거 URL (선택)", "evidenceUrl", "url", Some("https://…")))
                div class="flex items-end" {
                    button class="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white" { "실제 인터뷰 기록" }
                }
            }
            @if interviews.is_empty() {
                p class="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted" { "기록된 실제 인터뷰가 없습니다." }
            } @else {
                ol class="space-y-3" {
                    @for interview in interviews {
                        li class="rounded-xl border border-border bg-surface p-4" {
                            div class="flex flex-wrap justify-between gap-2 text-sm" {
                                strong { (interview.participant_reference) }
                                time datetime=(interview.interviewed_at) { (date_time(&interview.interviewed_at)) }
                            }
                            p class="mt-1 text-sm text-muted" { (interview.market) " · " (interview.segment) }
                            p class="mt-3 whitespace-pre-wrap text-sm" { (interview.summary) }
                            @if let Some(url) = interview.evidence_url.as_deref().filter(|url| !url.is_empty()) {
                                a href=(url) class="mt-2 inline-block text-sm text-accent-text underline" { "인터뷰 근거 열기" }
                            }
                        }
                    }
                }
            }
        }
    }
}
