use std::fmt::Write;

use maud::{Markup, html};

use super::{Daily, Ranked, Ready, Totals, format};

const USERS: &str = "활성 사용자";
const VIEWS: &str = "페이지·화면 조회";
const CARD: &str = "min-w-0 rounded-xl border border-border bg-surface p-4 md:p-5";
type DailyMetric = fn(&Daily) -> u64;

const SERIES: [(&str, &str, DailyMetric); 2] = [
    (USERS, "ga4-users", |row| row.users),
    (VIEWS, "ga4-views", |row| row.views),
];

fn number(value: u64) -> String {
    format::count(i64::try_from(value).unwrap_or(i64::MAX))
}

fn duration(seconds: f64) -> String {
    let seconds = seconds.round() as u64;
    if seconds < 60 {
        format!("{}초", number(seconds))
    } else {
        format!("{}분 {}초", number(seconds / 60), seconds % 60)
    }
}

pub(super) fn tiles(ready: &Ready) -> Markup {
    let counts = |totals: Totals| {
        [
            totals.active_users,
            totals.new_users,
            totals.sessions,
            totals.views,
        ]
    };
    let current = ready.totals.map(counts);
    let previous = ready.previous.map(counts);
    html! {
        section aria-label="최근 28일 주요 지표" {
            dl class="ga4-kpis grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-5" {
                @for (index, label) in [USERS, "신규 사용자", "세션", VIEWS].into_iter().enumerate() {
                    @let value = current.map(|counts| counts[index]);
                    (tile(label, value.map(number), value.map(|value| value as f64), previous.map(|counts| counts[index] as f64)))
                }
                @let engagement = ready.totals.and_then(Totals::average_engagement);
                (tile("평균 참여 시간", engagement.map(duration), engagement, ready.previous.and_then(Totals::average_engagement)))
            }
        }
    }
}

fn tile(label: &str, value: Option<String>, current: Option<f64>, previous: Option<f64>) -> Markup {
    let change = current.zip(previous).and_then(|(current, previous)| {
        (previous > 0.0).then(|| (current / previous - 1.0) * 100.0)
    });
    html! {
        div class="rounded-xl border border-border bg-surface p-3 md:p-4" {
            dt class="text-xs font-medium text-muted sm:text-sm" {
                (label)
                @if label == "평균 참여 시간" { span class="sr-only" { " (활성 사용자당)" } }
            }
            dd class="mt-1 text-xl font-bold tabular-nums sm:text-2xl" {
                (value.as_deref().unwrap_or("—"))
            }
            dd class="mt-1 text-xs tabular-nums text-muted" {
                @if let Some(change) = change {
                    @let magnitude = (change.abs() * 10.0).round() as u64;
                    @let (sign, tone) = if magnitude == 0 { ("", "text-muted") } else if change > 0.0 { ("+", "text-safety-green") } else { ("−", "text-safety-red") };
                    span class=(tone) { (sign) (number(magnitude / 10)) "." (magnitude % 10) "%" }
                    " · 이전 28일 대비"
                } @else {
                    "비교 데이터 없음"
                }
            }
        }
    }
}

fn details(title: &str, columns: &[&str], rows: Markup) -> Markup {
    html! {
        details class="ga4-details mt-3 border-t border-border pt-3 text-sm" {
            summary class="cursor-pointer text-muted hover:text-foreground" {
                "데이터 표 보기" span class="sr-only" { " · " (title) }
            }
            div class="overflow-x-auto" {
                table class="mt-2 w-full text-left text-sm" {
                    caption class="sr-only" { (title) }
                    thead {
                        tr class="border-b border-border" {
                            @for (index, label) in columns.iter().enumerate() {
                                th scope="col" class=(if index == 0 { "py-2 pr-2" } else { "whitespace-nowrap py-2 pl-2 text-right" }) { (label) }
                            }
                        }
                    }
                    tbody { (rows) }
                }
            }
        }
    }
}

const PLOT_LEFT: f64 = 63.0;
const PLOT_RIGHT: f64 = 403.0;

fn x(date: time::Date, first: time::Date, span: i64) -> f64 {
    PLOT_LEFT + (PLOT_RIGHT - PLOT_LEFT) * (date - first).whole_days() as f64 / span as f64
}

fn y(value: u64, step: u64) -> f64 {
    112.0 - 93.0 * value as f64 / (step * 3) as f64
}

/// Use human-readable ticks and a zero baseline shared by both series.
fn tick_step(max: u64) -> u64 {
    let step = max.div_ceil(3).max(1);
    let scale = 10_u64.pow(step.ilog10());
    [1, 2, 5, 10]
        .into_iter()
        .map(|factor| factor * scale)
        .find(|tick| *tick >= step)
        .unwrap_or(step)
}

fn line(daily: &[Daily], first: time::Date, span: i64, step: u64, metric: DailyMetric) -> String {
    let mut path = String::new();
    let mut previous = None;
    for row in daily {
        let draw = if previous.is_some_and(|date| row.date.previous_day() == Some(date)) {
            'L'
        } else {
            'M'
        };
        let _ = write!(
            path,
            "{draw}{:.1} {:.1} ",
            x(row.date, first, span),
            y(metric(row), step)
        );
        previous = Some(row.date);
    }
    path
}

pub(super) fn trend(daily: &[Daily], compact: bool) -> Markup {
    let title = "일별 방문 추이";
    let heading = html! {
        @if compact {
            h3 class="font-bold" { (title) }
        } @else {
            h2 class="font-bold" { (title) }
        }
    };
    let Some((first, latest)) = daily.first().zip(daily.last()) else {
        return html! { section class=(CARD) { (heading) p class="mt-2 text-sm text-muted" { "일별 데이터가 없어요." } } };
    };
    let first = first.date;
    let span = (latest.date - first).whole_days().max(1);
    let step = tick_step(
        daily
            .iter()
            .map(|row| row.users.max(row.views))
            .max()
            .unwrap_or(0),
    );
    let aria = format!(
        "{title} · 최신 집계 {} · 활성 사용자 {}명 · 페이지·화면 조회 {}회",
        latest.date,
        number(latest.users),
        number(latest.views)
    );
    let ticks = [
        0,
        span / 3,
        span * 2 / 3,
        (latest.date - first).whole_days(),
    ];
    let mut previous_tick = None;
    html! {
        section class=(CARD) {
            div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" {
                (heading)
                p class="text-xs text-muted" { "최근 28일 · 어제까지" }
            }
            div class=(if compact { "ga4-trend ga4-trend-compact" } else { "ga4-trend" }) {
                div class="ga4-trend-latest" {
                    p class="text-xs text-muted" { "최신 집계 · " (latest.date) }
                    dl class="flex flex-wrap gap-x-5 gap-y-2 xl:gap-x-3" {
                        @for (label, color, metric) in SERIES {
                            div {
                                dt class="flex items-center gap-2 text-xs text-muted" {
                                    span class=(format!("ga4-swatch {color}")) aria-hidden="true" {}
                                    (label)
                                }
                                dd class="ml-5 text-lg font-bold tabular-nums" { (number(metric(latest))) }
                            }
                        }
                    }
                }
                svg class="ga4-plot" viewBox="0 0 426 154" role="img" aria-label=(aria) {
                    title { (aria) }
                    text x="0" y="13" { "명 / 회" }
                    @for tick in 0..=3 {
                        @let value = tick * step;
                        @let height = y(value, step);
                        line x1=(PLOT_LEFT) x2=(PLOT_RIGHT) y1=(height) y2=(height) class="ga4-gridline" {}
                        text x="56" y=(height) dy=".34em" text-anchor="end" { (number(value)) }
                    }
                    @let latest_x = x(latest.date, first, span);
                    line x1=(latest_x) x2=(latest_x) y1="19" y2="112" class="ga4-latest-line" {}
                    @for (label, color, metric) in SERIES {
                        path class=(format!("ga4-series {color}")) d=(line(daily, first, span, step, metric)) {}
                        @for row in daily {
                            @let current = row.date == latest.date;
                            circle class=(format!("ga4-point {color}")) cx=(x(row.date, first, span)) cy=(y(metric(row), step)) r=(if current { 4.4 } else { 1.55 }) {
                                title { (row.date) " · " (label) " " (number(metric(row))) }
                            }
                        }
                    }
                    @for offset in ticks {
                        @if previous_tick != Some(offset) {
                            @let date = first + time::Duration::days(offset);
                            text x=(x(date, first, span)) y="131" text-anchor="middle" {
                                (u8::from(date.month())) "/" (date.day())
                            }
                            @let _ = previous_tick.insert(offset);
                        }
                    }
                    text x="403" y="148" text-anchor="end" { "날짜" }
                }
            }
            @if (latest.date - first).whole_days() + 1 > daily.len() as i64 {
                p class="mt-1 text-xs text-muted" { "집계가 없는 날짜는 빈 구간으로 표시해요." }
            }
            (details(title, &["날짜", USERS, VIEWS], html! {
                @for row in daily {
                    tr class="border-b border-border last:border-0" {
                        th scope="row" class="whitespace-nowrap py-2 pr-2 font-normal" { (row.date) }
                        td class="text-right tabular-nums" { (number(row.users)) }
                        td class="text-right tabular-nums" { (number(row.views)) }
                    }
                }
            }))
        }
    }
}

fn dimension_label(name: &str) -> &str {
    match name {
        "" | "(not set)" => "미분류",
        "(other)" => "기타",
        "mobile" => "모바일",
        "desktop" => "데스크톱",
        "tablet" => "태블릿",
        "smart tv" => "스마트 TV",
        "Organic Search" => "자연 검색",
        "Direct" => "직접 방문",
        "Referral" => "추천 링크",
        "Organic Social" => "자연 소셜",
        "Organic Video" => "자연 동영상",
        "Paid Search" => "유료 검색",
        "Paid Social" => "유료 소셜",
        "Unassigned" => "미분류",
        "South Korea" => "대한민국",
        "United States" => "미국",
        "Japan" => "일본",
        _ => name,
    }
}

fn rank_label(row: &Ranked) -> &str {
    if row.path.is_none() {
        dimension_label(&row.name)
    } else if row.name.is_empty() || row.name == "(not set)" {
        "제목 없음"
    } else {
        &row.name
    }
}

pub(super) fn bars(title: &str, metric: &str, rows: &[Ranked], context: &str) -> Markup {
    let pages = rows.iter().any(|row| row.path.is_some());
    let row_height = if pages { 45 } else { 32 };
    let height = rows.len() * row_height;
    let max = rows.iter().map(|row| row.value).max().unwrap_or(0).max(1);
    let aria = format!("{title} · {metric} 막대 차트");
    html! {
        section class=(CARD) {
            h2 class="font-bold" { (title) }
            p class="mt-1 text-xs text-muted" { (metric) " · " (context) }
            @if rows.is_empty() {
                p class="mt-3 text-sm text-muted" { "반환된 데이터가 없어요." }
            } @else {
                div class=(if pages { "ga4-bars ga4-bars-pages" } else { "ga4-bars" }) {
                    ol aria-hidden="true" {
                        @for row in rows {
                            li {
                                span class="truncate" title=(rank_label(row)) { (rank_label(row)) }
                                @if let Some(path) = &row.path {
                                    span class="truncate text-xs text-muted" title=(path) { (path) }
                                }
                            }
                        }
                    }
                    svg width="100%" height=(height) viewBox=(format!("0 0 100 {height}")) preserveAspectRatio="none" role="img" aria-label=(aria) {
                        title { (aria) }
                        @for (index, row) in rows.iter().enumerate() {
                            @let y = index * row_height + (row_height - 12) / 2;
                            rect class="ga4-bar-track" x="0" y=(y) width="100" height="12" rx="1" {}
                            rect class="ga4-bar" x="0" y=(y) width=(100.0 * row.value as f64 / max as f64) height="12" rx="1" {
                                title { (rank_label(row)) " · " (number(row.value)) }
                            }
                        }
                    }
                    ol class="text-right font-medium tabular-nums" aria-hidden="true" {
                        @for row in rows {
                            li { (number(row.value)) }
                        }
                    }
                }
                (details(title, &[if pages { "페이지" } else { title }, metric], html! {
                    @for row in rows {
                        tr class="border-b border-border last:border-0" {
                            th scope="row" class="break-all py-2 pr-2 font-normal" {
                                (rank_label(row))
                                @if let Some(path) = &row.path { span class="block text-xs text-muted" { (path) } }
                            }
                            td class="text-right tabular-nums" { (number(row.value)) }
                        }
                    }
                }))
            }
        }
    }
}
