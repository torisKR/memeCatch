//! `GET /weekly` (`app/(default)/weekly/page.tsx`): this week in Korea
//! (Monday to Sunday, KST): the ten hottest indexable memes, the ones
//! published this week, and how they split by category (lib/weekly.ts,
//! components/weekly-digest.tsx). A rail of fewer than three cards is not
//! shown; a failed read is an empty rail, as in `getWeeklyDigest`.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use maud::{Markup, html};
use time::format_description::well_known::Rfc3339;
use time::{Date, Duration, OffsetDateTime, Time, UtcOffset};

use super::document::{self, Head, ShareImage};
use super::meme_card::{self, CardMeme, MIN_LISTING};
use super::{html_cached, json_ld, labels, path_and_query};
use crate::AppState;
use crate::db::Db;

const TITLE: &str = "이번 주 밈 결산 — 급상승·신규 총정리";
const DESCRIPTION: &str =
    "이번 주 한국에서 급상승한 밈, 새로 등록된 밈, 카테고리 분포를 한 번에 모아봤어요.";
/// `revalidate = 3600`, as Next sends it for the cached page.
const CACHE: &str = "s-maxage=3600, stale-while-revalidate=31532400";
const KST: UtcOffset = match UtcOffset::from_hms(9, 0, 0) {
    Ok(offset) => offset,
    Err(_) => panic!("a valid offset"),
};

/// `WeekRange`.
struct Week {
    start: OffsetDateTime,
    end: OffsetDateTime,
    year: i32,
    month: u8,
    week_of_month: u8,
    is_ongoing: bool,
}

/// `getCurrentWeekRangeKST`.
fn week_of(now: OffsetDateTime) -> Week {
    let today = now.to_offset(KST);
    let days_since_monday = i64::from(today.weekday().number_days_from_monday());
    let monday = today.date() - Duration::days(days_since_monday);
    let start = monday.with_time(Time::MIDNIGHT).assume_offset(KST);
    let end = start + Duration::days(7) - Duration::milliseconds(1);
    let first =
        Date::from_calendar_date(today.year(), today.month(), 1).expect("the first of a month");
    let monday_offset = first.weekday().number_days_from_monday();
    Week {
        start,
        end,
        year: today.year(),
        month: u8::from(today.month()),
        week_of_month: (today.day() + monday_offset).div_ceil(7),
        is_ongoing: now < end,
    }
}

/// `Date.prototype.toISOString`, which the query compares with.
fn iso(at: OffsetDateTime) -> String {
    let utc = at.to_offset(UtcOffset::UTC);
    let text = utc.format(&Rfc3339).expect("a formattable time");
    // Rfc3339 drops zero milliseconds and writes `Z`; JavaScript always has three.
    let (seconds, _) = text.split_at(19);
    format!("{seconds}.{:03}Z", utc.millisecond())
}

async fn trending(db: &Db) -> Vec<CardMeme> {
    meme_card::indexable(
        db,
        "m.moderation_status = 'approved'",
        "m.trend_score desc",
        meme_card::scan_limit(10),
        10,
        Vec::new(),
    )
    .await
    .inspect_err(|error| tracing::warn!(%error, "weekly trending failed"))
    .unwrap_or_default()
}

async fn fresh(db: &Db, week: &Week) -> Vec<CardMeme> {
    meme_card::indexable(
        db,
        "m.moderation_status in ('approved', 'limited') and m.published_at >= $1::timestamptz and m.published_at <= $2::timestamptz",
        "m.published_at desc",
        meme_card::scan_limit(24),
        24,
        vec![iso(week.start), iso(week.end)],
    )
    .await
    .inspect_err(|error| tracing::warn!(%error, "weekly fresh failed"))
    .unwrap_or_default()
}

/// `buildCategoryBreakdown`: the categories of both rails without
/// duplicates, most first; a tie keeps the order they first appear in.
fn breakdown(trending: &[CardMeme], fresh: &[CardMeme]) -> Vec<(String, usize, u32)> {
    let mut seen = Vec::new();
    let mut pool: Vec<&CardMeme> = Vec::new();
    for meme in trending.iter().chain(fresh) {
        if let Some(index) = seen.iter().position(|id| *id == meme.id) {
            pool[index] = meme;
        } else {
            seen.push(meme.id.clone());
            pool.push(meme);
        }
    }
    let mut counts: Vec<(String, usize)> = Vec::new();
    for meme in &pool {
        match counts
            .iter_mut()
            .find(|(category, _)| *category == meme.category)
        {
            Some((_, count)) => *count += 1,
            None => counts.push((meme.category.clone(), 1)),
        }
    }
    let total = pool.len() as f64;
    let mut out: Vec<(String, usize, u32)> = counts
        .into_iter()
        .map(|(category, count)| {
            let percentage = (count as f64 / total * 100.0).round() as u32;
            (category, count, percentage)
        })
        .collect();
    out.sort_by(|a, b| b.1.cmp(&a.1));
    out
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let week = week_of(OffsetDateTime::now_utc());
    let (trending, fresh) = tokio::join!(trending(&state.db), fresh(&state.db, &week));
    let site = &state.pages.site;
    let head = Head {
        title: TITLE.to_owned(),
        description: Some(DESCRIPTION.to_owned()),
        canonical: Some("/weekly".to_owned()),
        image: Some(ShareImage::site_default(site)),
        ..Head::default()
    };
    let heading = format!(
        "{}년 {}월 {}주차 밈 결산",
        week.year, week.month, week.week_of_month
    );
    let schema: &[CardMeme] = if trending.len() >= MIN_LISTING {
        &trending
    } else if fresh.len() >= MIN_LISTING {
        &fresh
    } else {
        &[]
    };
    let items: Vec<(String, String)> = schema
        .iter()
        .take(10)
        .map(|m| (m.title.clone(), m.path()))
        .collect();
    let main = html! {
        main class="mx-auto max-w-site px-4 pb-14 pt-8" data-ads=[site.ads_client()] {
            @if !schema.is_empty() {
                (json_ld::collection_page(site, &heading, Some(DESCRIPTION), "/weekly", schema.len(), 0, &items))
            }
            nav aria-label="브레드크럼" class="text-sm text-muted" {
                a class="hover:text-foreground" href="/" { "밈캐치" }
                " "
                span aria-hidden="true" { "›" }
                " 주간 결산"
            }
            div class="mt-3 flex flex-wrap items-center gap-2.5" {
                h1 class="page-title" { (heading) }
                @if week.is_ongoing {
                    span class="inline-flex h-fit items-center rounded-full bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent" title="이번 주가 아직 끝나지 않아 데이터가 계속 갱신돼요" { "집계 중" }
                }
            }
            p class="page-lede" { "이번 주 밈캐치에서 급상승한 밈과 새로 등록된 밈을 자동으로 모았어요. 지금 이 순간에도 급상승 순위가 계속 바뀌고 있어서, 매시 새로 집계돼요. 지나간 유행을 놓쳤다면 여기서 한 번에 따라잡아 보세요." }
            (digest(&trending, &fresh))
            div class="mt-10 flex flex-wrap gap-3" {
                a class="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-[filter] hover:brightness-95 active:scale-[0.97]" href="/rankings" {
                    "전체 랭킹 보기 "
                    span aria-hidden="true" class="ml-1" { "→" }
                }
                a class="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-6 text-base font-semibold text-muted transition-colors hover:border-accent hover:text-accent" href="/explore" { "전체 탐색하기" }
            }
        }
    };
    let document = document::page(site, &head, path_and_query(&request), main);
    html_cached(StatusCode::OK, CACHE, document)
}

fn rail(cards: &[CardMeme], class: &str) -> Markup {
    html! {
        // `TrackedBlock`: ui/page.js reports the link followed.
        div class="mt-4" data-track="weekly_click" {
            (meme_card::grid(class, cards.iter().map(|card| meme_card::card(card, None))))
        }
    }
}

/// `WeeklyDigest`. `Reveal` fades each section in on Next; here they are
/// simply there.
fn digest(trending: &[CardMeme], fresh: &[CardMeme]) -> Markup {
    let show_trending = trending.len() >= MIN_LISTING;
    let show_fresh = fresh.len() >= MIN_LISTING;
    let categories = breakdown(trending, fresh);
    html! {
        @if show_trending || show_fresh {
            div class="mt-8 flex flex-col gap-10" {
                @if show_trending {
                    section {
                        h2 id="weekly-trending" class="text-2xl font-extrabold tracking-tight" { "지금 가장 뜨거운 밈" }
                        p class="mt-1 text-sm text-muted" { "최근 72시간 화제성 상위 " (trending.len()) "건 — 이번 주 결산과 함께 확인해요." }
                        (rail(trending, "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"))
                    }
                }
                @if show_fresh {
                    section {
                        h2 id="weekly-fresh" class="text-2xl font-extrabold tracking-tight" { "새로 등록된 밈" }
                        p class="mt-1 text-sm text-muted" { "이번 주에 새로 등록된 밈 " (fresh.len()) "건이에요." }
                        (rail(fresh, "grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6"))
                    }
                }
                @if !categories.is_empty() {
                    section {
                        h2 id="weekly-categories" class="text-2xl font-extrabold tracking-tight" { "카테고리 하이라이트" }
                        p class="mt-1 text-sm text-muted" { "이번 주 급상승·신규 밈을 카테고리별로 모아봤어요." }
                        ul class="mt-4 flex flex-col gap-2.5" {
                            @for (category, count, percentage) in &categories {
                                li class="flex items-center gap-3" {
                                    @if let Some(tag) = labels::category_tag(category, "shrink-0") { (tag) }
                                    div class="instrument-grid h-2.5 min-w-0 flex-1 overflow-hidden rounded-full" style="background-color:var(--surface-2)" role="img" aria-label=(format!("{category} 비중 {percentage}%")) {
                                        div class="h-full rounded-full" style=(format!("width:{}%;background:linear-gradient(90deg, var(--flame-400), var(--flame-600))", (*percentage).max(4))) {}
                                    }
                                    span class="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-muted" { (count) "건 · " (percentage) "%" }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(text: &str) -> OffsetDateTime {
        OffsetDateTime::parse(text, &Rfc3339).unwrap()
    }

    #[test]
    fn the_week_runs_monday_to_sunday_in_korea() {
        // Tuesday 2026-11-24 in Korea is still Monday evening in UTC.
        let week = week_of(at("2026-11-23T20:00:00Z"));
        assert_eq!(iso(week.start), "2026-11-22T15:00:00.000Z");
        assert_eq!(iso(week.end), "2026-11-29T14:59:59.999Z");
        assert_eq!((week.year, week.month, week.week_of_month), (2026, 11, 5));
        assert!(week.is_ongoing);
        // Sunday night in Korea belongs to the week that started six days before.
        let week = week_of(at("2026-11-29T14:00:00Z"));
        assert_eq!(iso(week.start), "2026-11-22T15:00:00.000Z");
        // 2026-03-01 is a Sunday: the 1st is in the first week, the 2nd in the second.
        assert_eq!(week_of(at("2026-03-01T03:00:00Z")).week_of_month, 1);
        assert_eq!(week_of(at("2026-03-02T03:00:00Z")).week_of_month, 2);
    }
}
