//! Operator views derived from the selected tab's reports.

use std::collections::{BTreeMap, HashMap};
use std::fmt::Write;

use maud::{Markup, html};

use super::charts::{self, CARD, dimension_label, duration, number};
use super::diagnosis::{self, Kind, MIN_PAGE_VIEWS, MIN_SESSIONS, Segment};
use super::requests::{Id, NEXT_ACTIONS, SEARCH_STEPS, TOP};
use super::{Data, Period, Reason, Row, Rows, Tab, date, reason_text};

const MIN_OUTBOUND_CLICKS: u64 = 30;
const GRID: &str = "grid min-w-0 items-start gap-5 xl:grid-cols-2";

pub(super) fn render(data: &Data, tab: Tab) -> Markup {
    match tab {
        Tab::Acquisition => acquisition(data),
        Tab::Behaviour => behaviour(data),
        Tab::Dropoff => dropoff(data),
        Tab::Realtime => realtime(data),
        Tab::Overview => Markup::default(),
    }
}

fn percent(rate: f64) -> String {
    format!("{:.1}%", rate * 100.0)
}

fn points(gap: f64) -> String {
    format!("{:+.1}%p", gap * 100.0)
}

fn ratio(numerator: f64, denominator: u64) -> Option<f64> {
    (denominator > 0).then(|| numerator / denominator as f64)
}

fn label(row: &Row) -> String {
    row.dimensions
        .iter()
        .map(|name| dimension_label(name))
        .collect::<Vec<_>>()
        .join(" · ")
}

fn optional(value: Option<String>) -> String {
    value.unwrap_or_else(|| "—".to_owned())
}

fn prior(current: &Row, previous: Option<&Rows>) -> Option<u64> {
    matched(current, previous).map(|row| row.count(0))
}

fn matched<'a>(current: &Row, previous: Option<&'a Rows>) -> Option<&'a Row> {
    previous?
        .rows
        .iter()
        .find(|row| row.dimensions == current.dimensions)
}

fn previous_number(current: &Row, previous: Option<&Rows>) -> String {
    optional(prior(current, previous).map(number))
}

fn table_rows(rows: &[Vec<String>]) -> Markup {
    html! {
        @for row in rows {
            tr class="border-b border-border last:border-0" {
                th scope="row" class="py-2 pr-3 text-left font-medium" { (&row[0]) }
                @for cell in &row[1..] {
                    td class="whitespace-nowrap py-2 pl-3 text-right tabular-nums" { (cell) }
                }
            }
        }
    }
}

fn table(title: &str, columns: &[&str], rows: &[Vec<String>]) -> Markup {
    html! {
        div class="ga4-table overflow-x-auto" tabindex="0" role="region" aria-label=(title) {
            table class="mt-2 w-full text-left text-sm" {
                caption class="sr-only" { (title) }
                thead class="text-xs text-muted" {
                    tr class="border-b border-border" {
                        @for (index, column) in columns.iter().enumerate() {
                            th scope="col" class=(if index == 0 { "py-2 pr-3" } else { "whitespace-nowrap py-2 pl-3 text-right" }) { (column) }
                        }
                    }
                }
                tbody { (table_rows(rows)) }
            }
        }
    }
}

fn empty() -> Markup {
    html! { p role="status" class="mt-3 text-sm text-muted" { "표시할 데이터가 없어요." } }
}

fn panel(
    data: &Data,
    id: Id,
    title: &str,
    description: &str,
    content: impl FnOnce(&Rows, Option<&Rows>) -> Markup,
) -> Markup {
    let current = match data.current(id) {
        Ok(rows) => rows,
        Err(reason) => return charts::message(title, reason_text(reason)),
    };
    let previous = data.previous(id);
    html! {
        section class=(CARD) {
            h2 class="font-bold" { (title) }
            p class="mt-1 text-xs text-muted" { (description) }
            @if !current.rows.is_empty() { (content(current, previous)) } @else { (empty()) }
            @if current.limited || previous.is_some_and(|rows| rows.limited) {
                p role="status" class="mt-3 text-xs text-muted" { "일부 행이 상위 집계 한도 또는 GA4 집계 제한으로 생략될 수 있어요." }
            }
            @if let Some(Err(reason)) = data.reports.get(&(id, Period::Previous)) {
                p role="status" class="mt-3 text-xs text-muted" { "이전 기간 · " (reason_text(*reason)) }
            }
        }
    }
}

struct Bar {
    value: f64,
    display: String,
    cells: Vec<String>,
}

impl Bar {
    fn count(name: String, value: u64, tail: impl IntoIterator<Item = String>) -> Self {
        Self {
            value: value as f64,
            display: number(value),
            cells: [name, number(value)].into_iter().chain(tail).collect(),
        }
    }
}

fn bars(title: &str, columns: &[&str], rows: Vec<Bar>, baseline: Option<f64>) -> Markup {
    if rows.is_empty() {
        return empty();
    }
    let max = baseline.map_or_else(
        || rows.iter().map(|row| row.value).fold(1.0, f64::max),
        |_| 1.0,
    );
    let height = rows.len() * 32;
    let aria = format!("{title} 막대 차트");
    let cells: Vec<_> = rows.iter().map(|row| row.cells.clone()).collect();
    html! {
        div class="ga4-bars mt-2" {
            ol aria-hidden="true" {
                @for row in &rows {
                    li { span class="truncate" title=(&row.cells[0]) { (&row.cells[0]) } }
                }
            }
            svg width="100%" height=(height) viewBox=(format!("0 0 100 {height}"))
                preserveAspectRatio="none" role="img" aria-label=(aria) {
                title { (aria) }
                @for (index, row) in rows.iter().enumerate() {
                    @let y = index * 32 + 10;
                    rect class="ga4-bar-track" x="0" y=(y) width="100" height="12" rx="1" {}
                    rect class="ga4-bar" x="0" y=(y) width=(100.0 * row.value / max) height="12" rx="1" {
                        title { (&row.cells[0]) " · " (&row.display) }
                    }
                }
                @if let Some(value) = baseline {
                    line class="ga4-latest-line" x1=(value * 100.0) x2=(value * 100.0) y1="0" y2=(height) {
                        title { "사이트 평균 " (percent(value)) }
                    }
                }
            }
            ol class="text-right font-medium tabular-nums" aria-hidden="true" {
                @for row in &rows {
                    li { (&row.display) }
                }
            }
        }
        (charts::details(title, columns, table_rows(&cells)))
    }
}

fn count_chart(data: &Data, id: Id, title: &str, description: &str, metric: &str) -> Markup {
    panel(data, id, title, description, |current, previous| {
        let live = matches!(id, Id::LivePages | Id::LiveCountries | Id::LiveDevices);
        let rows = current
            .rows
            .iter()
            .take(TOP)
            .map(|row| {
                Bar::count(
                    label(row),
                    row.count(0),
                    (!live).then(|| previous_number(row, previous)),
                )
            })
            .collect();
        let columns = [title, metric, "이전 기간"];
        bars(title, &columns[..if live { 2 } else { 3 }], rows, None)
    })
}

type Series<'a> = (&'a str, Vec<(usize, u64)>);
const PLOT_LEFT: f64 = 45.0;
const PLOT_RIGHT: f64 = 400.0;
const PLOT_BOTTOM: f64 = 111.0;
const PLOT_HEIGHT: f64 = 90.0;

fn plot(title: &str, series: &[Series<'_>], span: usize, ticks: &[(usize, String)]) -> Markup {
    let span = span.max(1);
    let x = |idx| PLOT_LEFT + idx as f64 / span as f64 * (PLOT_RIGHT - PLOT_LEFT);
    let largest = series
        .iter()
        .flat_map(|(_, points)| points.iter().map(|(_, count)| *count))
        .max()
        .unwrap_or(0);
    let step = largest.div_ceil(3).max(1);
    let y = |count| PLOT_BOTTOM - count as f64 / (step * 3) as f64 * PLOT_HEIGHT;
    html! {
        svg class="ga4-plot ga4-advanced-plot" viewBox="0 0 420 138" role="img" aria-label=(title) {
            title { (title) }
            @for level in 0..=3 {
                @let value = step * level;
                line class="ga4-gridline" x1=(PLOT_LEFT) x2=(PLOT_RIGHT) y1=(y(value)) y2=(y(value)) {}
                text x="41" y=(y(value)) dy=".34em" text-anchor="end" { (number(value)) }
            }
            @for (index, tick) in ticks {
                text x=(x(*index)) y="130" text-anchor="middle" { (tick) }
            }
            @for (index, (name, values)) in series.iter().enumerate() {
                g class="ga4-line" data-series=(index) {
                    @let mut path = String::new();
                    @let mut previous = None;
                    @for &(position, value) in values {
                        @let command = if previous == position.checked_sub(1) && previous.is_some() { 'L' } else { 'M' };
                        @let _ = write!(path, "{command}{:.2},{:.2}", x(position), y(value));
                        @let _ = previous.insert(position);
                    }
                    path d=(path) class="ga4-series" {}
                    @for &(position, value) in values {
                        circle cx=(x(position)) cy=(y(value)) r="1.8" class="ga4-point" {
                            title { (name) " · " (number(value)) }
                        }
                    }
                }
            }
        }
    }
}

fn action_label(name: &str) -> &str {
    match name {
        "search_submit" => "검색 제출",
        "search_result_click" => "검색 결과 클릭",
        "search_suggest_click" => "검색 추천 클릭",
        "search_no_result" => "결과 없음",
        "next_meme_click" => "다음 밈",
        "meme_source_opened" => "밈 출처 열기",
        "timeline_click" => "타임라인 클릭",
        "weekly_click" => "주간 밈 클릭",
        "meme_view" => "밈 상세 보기",
        "copy" => "복사",
        "share_click" => "공유 클릭",
        "quiz_start" => "퀴즈 시작",
        "quiz_complete" => "퀴즈 완료",
        "quiz_share" => "퀴즈 공유",
        "random_meme" => "랜덤 밈",
        "context_nav" => "관련 밈 탐색",
        "meme_contribution_submitted" => "밈 제보",
        _ => name,
    }
}

fn daily_counts(rows: &Rows) -> BTreeMap<&str, BTreeMap<time::Date, u64>> {
    let mut grouped = BTreeMap::<_, BTreeMap<_, _>>::new();
    for row in &rows.rows {
        if let Some(day) = date(row.name()) {
            grouped
                .entry(row.dimensions[1].as_str())
                .or_default()
                .insert(day, row.count(0));
        }
    }
    grouped
}

fn event_counts(rows: &Rows) -> BTreeMap<&str, u64> {
    let mut events = BTreeMap::<_, u64>::new();
    for row in &rows.rows {
        let count = events.entry(row.dimensions[1].as_str()).or_default();
        *count = count.saturating_add(row.count(0));
    }
    events
}

fn daily_series(
    data: &Data,
    id: Id,
    title: &str,
    description: &str,
    name: fn(&str) -> &str,
) -> Markup {
    panel(data, id, title, description, |current, previous| {
        let days = daily_counts(current);
        let Some(first) = days
            .values()
            .filter_map(|values| values.keys().next())
            .min()
            .copied()
        else {
            return empty();
        };
        let last = days
            .values()
            .filter_map(|values| values.keys().next_back())
            .max()
            .copied()
            .unwrap_or(first);
        let span = (last - first).whole_days() as usize;
        let offset = |day: time::Date| (day - first).whole_days() as usize;
        let totals = event_counts(current);
        let prior = previous.map(event_counts).unwrap_or_default();
        let mut ranked: Vec<_> = totals.iter().map(|(key, total)| (*key, *total)).collect();
        ranked.sort_unstable_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));
        let series: Vec<_> = ranked
            .iter()
            .take(5)
            .map(|(key, _)| {
                (
                    name(key),
                    days[key]
                        .iter()
                        .map(|(day, value)| (offset(*day), *value))
                        .collect(),
                )
            })
            .collect();
        let ticks: Vec<_> = [0, span / 2, span]
            .into_iter()
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .map(|idx| {
                let day = first + time::Duration::days(idx as i64);
                (idx, format!("{}/{}", u8::from(day.month()), day.day()))
            })
            .collect();
        let totals: Vec<_> = ranked
            .iter()
            .map(|(key, count)| {
                vec![
                    name(key).to_owned(),
                    number(*count),
                    optional(prior.get(key).copied().map(number)),
                ]
            })
            .collect();
        let mut matrix = BTreeMap::<time::Date, HashMap<&str, u64>>::new();
        for (key, counts) in &days {
            for (day, count) in counts {
                matrix.entry(*day).or_default().insert(key, *count);
            }
        }
        let columns: Vec<_> = ["날짜"]
            .into_iter()
            .chain(ranked.iter().map(|(key, _)| name(key)))
            .collect();
        let daily: Vec<_> = matrix
            .into_iter()
            .map(|(day, values)| {
                [day.to_string()]
                    .into_iter()
                    .chain(
                        ranked
                            .iter()
                            .map(|(key, _)| optional(values.get(key).copied().map(number))),
                    )
                    .collect()
            })
            .collect();
        html! {
            ul class="ga4-legend" aria-label="차트 범례" {
                @for (index, (series_name, _)) in series.iter().enumerate() {
                    li class="ga4-line" data-series=(index) {
                        span class="ga4-swatch" aria-hidden="true" {} (series_name)
                    }
                }
            }
            (plot(title, &series, span, &ticks))
            (table(title, &["항목", "선택 기간", "이전 기간"], &totals))
            (charts::details(title, &columns, table_rows(&daily)))
        }
    })
}

fn engine(source: &str) -> usize {
    // GA4 uses plain names for most search engines, but some imports/links use domains.
    let source = source.to_ascii_lowercase();
    let url = url::Url::parse(&format!("https://{source}")).ok();
    let host = url.as_ref().and_then(url::Url::host_str).unwrap_or(&source);
    let host = host.strip_prefix("www.").unwrap_or(host);
    let components: Vec<_> = host.split('.').collect();
    let root = match components.as_slice() {
        [name]
        | [name, "com" | "net" | "kr" | "co"]
        | [name, "co" | "com", "kr" | "uk" | "jp" | "au"] => *name,
        [_, "naver", "com"] => "naver",
        [_, "daum", "net"] => "daum",
        _ => "",
    };
    match root {
        "google" => 0,
        "naver" => 1,
        "daum" => 2,
        "bing" => 3,
        _ => 4,
    }
}

fn engines(data: &Data) -> Markup {
    let title = "자연 검색 엔진";
    panel(
        data,
        Id::SearchEngines,
        title,
        "자연 검색 세션 · 반환된 소스를 검색 엔진별로 합산",
        |current, previous| {
            let group = |report: &Rows| {
                let mut counts = [None::<u64>; 5];
                for row in &report.rows {
                    let count = &mut counts[engine(row.name())];
                    *count = Some(count.unwrap_or(0).saturating_add(row.count(0)));
                }
                counts
            };
            let old = previous.map(group).unwrap_or_default();
            let counts = group(current);
            let rows = ["Google", "네이버", "다음", "Bing", "기타"]
                .iter()
                .zip(counts)
                .zip(old)
                .filter_map(|((&name, count), previous)| {
                    Some(Bar::count(
                        name.to_owned(),
                        count?,
                        [optional(previous.map(number))],
                    ))
                })
                .collect();
            bars(title, &["검색 엔진", "세션", "이전 세션"], rows, None)
        },
    )
}

fn sources(data: &Data) -> Markup {
    let title = "세션 소스 / 매체";
    panel(
        data,
        Id::Sources,
        title,
        "세션 상위 10개 · 참여 시간은 세션당 · 주요 이벤트율은 GA4 속성 설정 기준",
        |current, previous| {
            let values = current
                .rows
                .iter()
                .take(TOP)
                .map(|row| {
                    vec![
                        label(row),
                        number(row.count(1)),
                        number(row.count(0)),
                        previous_number(row, previous),
                        percent(row.metrics[2]),
                        optional(ratio(row.metrics[3], row.count(0)).map(duration)),
                        percent(row.metrics[4]),
                    ]
                })
                .collect::<Vec<_>>();
            table(
                title,
                &[
                    "소스 / 매체",
                    "활성 사용자",
                    "세션",
                    "이전 세션",
                    "참여율",
                    "평균 참여",
                    "주요 이벤트율",
                ],
                &values,
            )
        },
    )
}

fn source_landings(data: &Data) -> Markup {
    let title = "상위 소스별 착지 페이지";
    panel(
        data,
        Id::SourceLandings,
        title,
        "세션 상위 5개 소스 / 매체 · 반환된 행에서 각 상위 3개 경로",
        |current, previous| {
            let sources = match data.current(Id::Sources) {
                Ok(sources) => sources,
                Err(reason) => {
                    return html! { p role="status" class="mt-2 text-sm text-muted" { (reason_text(reason)) } };
                }
            };
            let list: Vec<_> = sources
                .rows
                .iter()
                .take(5)
                .flat_map(|source| {
                    current
                        .rows
                        .iter()
                        .filter(move |row| row.name() == source.name())
                        .take(3)
                })
                .map(|row| {
                    vec![
                        label(row),
                        number(row.count(0)),
                        previous_number(row, previous),
                    ]
                })
                .collect();
            if list.is_empty() {
                empty()
            } else {
                table(title, &["소스 / 매체 · 경로", "세션", "이전 세션"], &list)
            }
        },
    )
}

fn acquisition(data: &Data) -> Markup {
    html! {
        (daily_series(data, Id::ChannelTrend, "채널별 유입 추이", "일별 세션 상위 5개 채널 · 모든 집계는 표에서 확인", dimension_label))
        (sources(data))
        div class=(GRID) {
            (engines(data))
            (count_chart(data, Id::Referrals, "추천 링크 도메인", "GA4 추천 채널의 세션 소스", "세션"))
            (count_chart(data, Id::Social, "소셜 유입", "자연·유료 소셜 채널의 세션 소스", "세션"))
            (count_chart(data, Id::Campaigns, "캠페인", "세션 캠페인 · 소스 / 매체", "세션"))
            (count_chart(data, Id::FirstTouch, "첫 유입 소스", "기간 내 신규 사용자를 처음 데려온 소스 / 매체", "신규 사용자"))
            (count_chart(data, Id::Returning, "재방문 세션 소스", "이전 세션 이력이 있는 사용자의 이번 소스 / 매체", "세션"))
        }
        (source_landings(data))
    }
}

fn landing_engagement(row: &Row) -> Option<f64> {
    ratio(row.metrics[3], row.count(0))
}

fn landings(data: &Data) -> Markup {
    let title = "착지 페이지 참여";
    panel(
        data,
        Id::Landings,
        title,
        "세션의 첫 페이지 · 평균 참여 시간은 세션당",
        |current, previous| {
            let list = current
                .rows
                .iter()
                .take(TOP)
                .map(|row| {
                    vec![
                        label(row),
                        number(row.count(0)),
                        previous_number(row, previous),
                        percent(row.metrics[1]),
                        percent(row.metrics[2]),
                        optional(landing_engagement(row).map(duration)),
                        format!("{:.2}", row.metrics[4]),
                    ]
                })
                .collect::<Vec<_>>();
            table(
                title,
                &[
                    "착지 페이지",
                    "세션",
                    "이전 세션",
                    "참여율",
                    "이탈률",
                    "평균 참여",
                    "조회 / 세션",
                ],
                &list,
            )
        },
    )
}

fn funnel(data: &Data) -> Markup {
    let title = "세션과 주요 행동";
    let (totals, events) = match (data.current(Id::Totals), data.current(Id::Actions)) {
        (Ok(totals), Ok(events)) => (totals, events),
        (Err(reason), _) | (_, Err(reason)) => return charts::message(title, reason_text(reason)),
    };
    let sessions = totals.rows.first().map(|row| row.count(2));
    let events = event_counts(events);
    let prior_sessions = data
        .previous(Id::Totals)
        .and_then(|rows| rows.rows.first())
        .map(|row| row.count(2));
    let prior_events = data
        .previous(Id::Actions)
        .map(event_counts)
        .unwrap_or_default();
    let mut bars_data = Vec::new();
    if let Some(sessions) = sessions {
        bars_data.push(Bar::count(
            "방문 세션".to_owned(),
            sessions,
            [
                "세션".to_owned(),
                optional(prior_sessions.map(number)),
                "—".to_owned(),
            ],
        ));
    }
    let stages = ["meme_view", "copy", "share_click"];
    let missing: Vec<_> = stages
        .into_iter()
        .filter(|event| !events.contains_key(event))
        .map(action_label)
        .collect();
    for name in stages {
        if let Some(&count) = events.get(name) {
            bars_data.push(Bar::count(
                action_label(name).to_owned(),
                count,
                [
                    "이벤트".to_owned(),
                    optional(prior_events.get(name).copied().map(number)),
                    optional(
                        sessions
                            .and_then(|sessions| ratio(count as f64 * 100.0, sessions))
                            .map(|count| format!("{count:.1}회")),
                    ),
                ],
            ));
        }
    }
    html! {
        section class=(CARD) {
            h2 class="font-bold" { (title) }
            p class="mt-1 text-xs text-muted" { "행동 단계는 이벤트 수로 근사해요. 같은 세션의 반복 행동이 포함되며 방문 → 상세 보기 → 복사·공유 순서는 확인할 수 없어요." }
            (bars(title, &["단계", "건수", "집계 단위", "이전 건수", "100세션당"], bars_data, None))
            @if !missing.is_empty() {
                p class="mt-2 text-xs text-muted" { "선택 기간 집계 없음 · " (missing.join(", ")) }
            }
            @if let Some(reason) = [Id::Totals, Id::Actions].iter().find_map(|id| data.get(*id, Period::Previous).err()) {
                p role="status" class="mt-3 text-xs text-muted" { "이전 기간 · " (reason_text(reason)) }
            }
        }
    }
}

fn scroll_reach(data: &Data) -> Markup {
    let title = "페이지별 90% 스크롤";
    panel(
        data,
        Id::Scroll,
        title,
        "GA4 향상된 측정 · 페이지 조회 대비 scroll 이벤트 비율(근사)",
        |current, previous| {
            let group = |report: &Rows| {
                let mut counts = BTreeMap::<String, (Option<u64>, Option<u64>)>::new();
                for row in &report.rows {
                    let entry = counts.entry(row.name().to_owned()).or_default();
                    match row.dimensions[1].as_str() {
                        "page_view" => entry.0 = Some(row.count(0)),
                        "scroll" => entry.1 = Some(row.count(0)),
                        _ => {}
                    }
                }
                counts
            };
            let mut rows: Vec<_> = group(current)
                .into_iter()
                .filter(|(_, (_, scroll))| scroll.is_some())
                .collect();
            rows.sort_by(|a, b| b.1.1.cmp(&a.1.1).then_with(|| a.0.cmp(&b.0)));
            let prior = previous.map(group).unwrap_or_default();
            let rows = rows
                .into_iter()
                .take(TOP)
                .filter_map(|(path, (views, scroll))| {
                    let scroll = scroll?;
                    let old = prior.get(&path).and_then(|counts| counts.1);
                    Some(Bar::count(
                        path,
                        scroll,
                        [
                            optional(views.map(number)),
                            optional(
                                views
                                    .and_then(|views| ratio(scroll as f64, views))
                                    .map(percent),
                            ),
                            optional(old.map(number)),
                        ],
                    ))
                })
                .collect();
            bars(
                title,
                &["페이지", "스크롤", "조회", "조회 대비", "이전 스크롤"],
                rows,
                None,
            )
        },
    )
}

fn event_count(rows: &Rows, name: &str) -> Option<u64> {
    rows.rows
        .iter()
        .find(|row| row.name() == name)
        .map(|row| row.count(0))
}

fn search_counts(rows: &Rows) -> Option<(u64, u64)> {
    Some((
        event_count(rows, "search_submit")?,
        event_count(rows, "search_no_result")?,
    ))
}

fn event_bars(title: &str, names: &[&str], current: &Rows, previous: Option<&Rows>) -> Markup {
    let rows = names
        .iter()
        .filter_map(|name| {
            let count = event_count(current, name)?;
            let old = previous.and_then(|rows| event_count(rows, name));
            Some(Bar::count(
                action_label(name).to_owned(),
                count,
                [optional(old.map(number))],
            ))
        })
        .collect();
    bars(title, &["행동", "이벤트", "이전 기간"], rows, None)
}

fn search_funnel(data: &Data) -> Markup {
    let title = "사이트 검색 퍼널";
    panel(
        data,
        Id::SearchSteps,
        title,
        "기간의 이벤트 횟수로 근사해요. 추천 클릭은 검색 제출 전에 발생할 수 있어요.",
        |current, previous| {
            let rate = |rows: &Rows| {
                let (submits, misses) = search_counts(rows)?;
                diagnosis::search_no_result_rate(submits, misses)
            };
            html! {
                p class="mt-3 text-sm text-muted" {
                    "검색 결과 없음 비율 "
                    strong class="text-lg text-foreground tabular-nums" { (optional(rate(current).map(percent))) }
                    @if let Some(old) = previous.and_then(rate) {
                        " · 이전 " (percent(old))
                    }
                }
                (event_bars(title, &SEARCH_STEPS, current, previous))
            }
        },
    )
}

fn next_actions(data: &Data) -> Markup {
    let title = "밈 콘텐츠 다음 행동";
    panel(
        data,
        Id::NextActions,
        title,
        "속성 전체의 이벤트 횟수 · 상세 조회 후의 세션 순서는 집계에 포함되지 않아요.",
        |current, previous| event_bars(title, &NEXT_ACTIONS, current, previous),
    )
}

fn behaviour(data: &Data) -> Markup {
    html! {
        (search_funnel(data))
        div class=(GRID) {
            (funnel(data))
            (next_actions(data))
        }
        (landings(data))
        (daily_series(data, Id::Actions, "주요 행동 추이", "일별 이벤트 횟수 상위 5개 · 모든 집계는 표에서 확인", action_label))
        (daily_series(data, Id::KeyEvents, "GA4 주요 이벤트 추이", "속성에서 주요 이벤트로 지정한 이벤트의 일별 집계 · 상위 5개", action_label))
        div class=(GRID) {
            (count_chart(data, Id::SiteSearch, "사이트 검색어", "GA4 검색 결과 보기 이벤트 · 상위 10개", "검색 결과 보기"))
            (scroll_reach(data))
        }
    }
}

fn lost_landings(data: &Data) -> Markup {
    let title = "이탈 세션이 많은 착지 페이지";
    let explanation = format!("세션 {MIN_SESSIONS}회 이상 · 세션 × 이탈률(반올림) · 상위 10개");
    panel(
        data,
        Id::Landings,
        title,
        &explanation,
        |current, previous| {
            let mut rows: Vec<_> = current
                .rows
                .iter()
                .filter(|row| row.count(0) >= MIN_SESSIONS)
                .map(|row| (diagnosis::lost(row.count(0), row.metrics[2]), row))
                .collect();
            rows.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name().cmp(b.1.name())));
            let entries = rows
                .into_iter()
                .take(TOP)
                .map(|(lost, row)| {
                    let old = matched(row, previous)
                        .map(|row| diagnosis::lost(row.count(0), row.metrics[2]));
                    Bar::count(
                        label(row),
                        lost,
                        [
                            number(row.count(0)),
                            percent(row.metrics[2]),
                            optional(landing_engagement(row).map(duration)),
                            optional(old.map(number)),
                        ],
                    )
                })
                .collect();
            bars(
                title,
                &[
                    "착지 페이지",
                    "이탈 세션",
                    "세션",
                    "이탈률",
                    "평균 참여",
                    "이전 이탈",
                ],
                entries,
                None,
            )
        },
    )
}

fn page_engagement(data: &Data) -> Markup {
    let title = "평균 참여 시간이 짧은 페이지";
    let explanation =
        format!("조회 {MIN_PAGE_VIEWS}회 이상 · 페이지에서 발생한 총 참여 시간 ÷ 활성 사용자");
    panel(
        data,
        Id::PageEngagement,
        title,
        &explanation,
        |current, previous| {
            let average = |row: &Row| ratio(row.metrics[2], row.count(1));
            let mut rows: Vec<_> = current
                .rows
                .iter()
                .filter(|row| row.count(0) >= MIN_PAGE_VIEWS)
                .filter_map(|row| Some((average(row)?, row)))
                .collect();
            rows.sort_by(|a, b| a.0.total_cmp(&b.0).then_with(|| a.1.name().cmp(b.1.name())));
            let entries = rows
                .into_iter()
                .take(TOP)
                .map(|(seconds, row)| Bar {
                    value: seconds,
                    display: duration(seconds),
                    cells: vec![
                        label(row),
                        duration(seconds),
                        number(row.count(0)),
                        number(row.count(1)),
                        optional(matched(row, previous).and_then(average).map(duration)),
                    ],
                })
                .collect();
            bars(
                title,
                &["페이지", "평균 참여", "조회", "활성 사용자", "이전 평균"],
                entries,
                None,
            )
        },
    )
}

const BOUNCE_PANELS: [(Id, Kind, usize, &str); 5] = [
    (Id::BounceDevice, Kind::Device, 1, "기기별 이탈률"),
    (Id::BounceOs, Kind::OperatingSystem, 1, "운영체제별 이탈률"),
    (Id::BounceBrowser, Kind::Browser, 1, "브라우저별 이탈률"),
    (
        Id::BounceEnvironment,
        Kind::Environment,
        1,
        "기기·브라우저별 이탈률",
    ),
    (Id::BounceSource, Kind::Source, 1, "소스 / 매체별 이탈률"),
];

fn site_bounce(data: &Data) -> Result<Option<&Row>, Reason> {
    Ok(data
        .current(Id::SiteBounce)?
        .rows
        .first()
        .filter(|row| row.count(0) > 0))
}

fn diagnosis_panel(data: &Data) -> Markup {
    let title = "이탈 원인 진단";
    let baseline = site_bounce(data);
    let site_rate = baseline.ok().flatten().map(|site| site.metrics[1]);
    let search = data
        .current(Id::SearchSteps)
        .ok()
        .filter(|rows| !rows.thresholded && !rows.limited)
        .and_then(search_counts)
        .and_then(|(submits, misses)| {
            Some((
                submits,
                misses,
                diagnosis::diagnose_search(submits, misses)?,
            ))
        });
    let previous = data
        .previous(Id::SiteBounce)
        .and_then(|rows| rows.rows.first())
        .filter(|row| row.count(0) > 0);
    let mut contexts = BOUNCE_PANELS
        .into_iter()
        .map(|(id, kind, index, _)| (id, kind, index))
        .chain([(Id::Landings, Kind::Landing, 2)]);
    let findings = site_rate
        .map(|site_rate| {
            diagnosis::diagnose(
                site_rate,
                contexts.clone().flat_map(|(id, kind, index)| {
                    data.current(id).ok().into_iter().flat_map(move |rows| {
                        rows.rows.iter().map(move |row| Segment {
                            name: label(row),
                            kind,
                            sessions: row.count(0),
                            bounce: row.metrics[index],
                            engagement_seconds: (kind == Kind::Landing)
                                .then(|| landing_engagement(row))
                                .flatten(),
                        })
                    })
                }),
            )
        })
        .unwrap_or_default();
    html! {
        section class=(CARD) {
            h2 class="font-bold" { (title) }
            p class="mt-1 text-xs text-muted" { "GA4 집계에서 관찰된 신호 · 한 세션이 여러 항목에 포함될 수 있어요." }
            @match baseline {
                Ok(Some(site)) => {
                    @let rate = site.metrics[1];
                    div class="my-3 flex flex-wrap items-baseline gap-x-3 gap-y-1" {
                        span class="text-sm text-muted" { "사이트 평균 이탈률" }
                        strong class="text-2xl font-bold tabular-nums" { (percent(rate)) }
                        span class="text-xs text-muted tabular-nums" { (number(site.count(0))) "세션" }
                        @if let Some(previous) = previous {
                            span class="text-xs text-muted tabular-nums" { "이전 " (percent(previous.metrics[1])) " · " (points(rate - previous.metrics[1])) }
                        }
                    }
                }
                Ok(None) => p role="status" class="mt-2 text-sm text-muted" { "사이트 평균 이탈률을 계산할 세션 데이터가 없어요." },
                Err(reason) => p role="status" class="mt-2 text-sm text-muted" { "사이트 평균 이탈률 · " (reason_text(reason)) },
            }
            @if let Err(reason) = data.get(Id::SiteBounce, Period::Previous) {
                p role="status" class="mt-2 text-sm text-muted" { "이전 기간 · " (reason_text(reason)) }
            }
            @if contexts.any(|(id, _, _)| data.current(id).is_err()) {
                p role="status" class="mt-2 text-sm text-muted" { "조회 가능한 항목에서 진단했어요. 하단에서 항목별 조회 상태를 확인하세요." }
            }
            @if findings.is_empty() && search.is_none() {
                p role="status" class="mt-2 text-sm text-muted" { "표본이 충분한 집계에서 진단 기준에 해당하는 항목이 없어요." }
            } @else {
                ul class="ga4-findings" {
                    @if let Some((submits, misses, rate)) = search {
                        li {
                            div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" {
                                h3 class="font-semibold" { "결과 없는 검색이 많아요" }
                                strong class="text-sm text-accent-text tabular-nums" { (percent(rate)) " 결과 없음" }
                            }
                            p class="mt-1 text-sm text-muted tabular-nums" {
                                "검색 제출 " (number(submits)) "건 중 " (number(misses)) "건 · 이벤트 기준"
                            }
                            p class="mt-1 text-sm" { "검색 색인과 유사어를 점검하고 결과가 없을 때 대체 검색어를 제안하세요." }
                        }
                    }
                    @for finding in findings.iter().take(diagnosis::MAX_FINDINGS - usize::from(search.is_some())) {
                        @let segment = &finding.segment;
                        li {
                            div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" {
                                h3 class="font-semibold" { (segment.kind.label()) " · " (&segment.name) }
                                strong class="text-sm text-accent-text tabular-nums" { "약 " (number(segment.lost())) " 이탈 세션" }
                            }
                            p class="mt-1 text-sm text-muted tabular-nums" {
                                (number(segment.sessions)) "세션 중 이탈률 " (percent(segment.bounce))
                                " · 사이트 평균 대비 " (points(segment.bounce - site_rate.unwrap_or_default()))
                                @if finding.short_engagement {
                                    " · 세션당 평균 참여 " (format!("{:.1}초", segment.engagement_seconds.unwrap_or_default()))
                                }
                            }
                            p class="mt-1 text-sm" { (segment.kind.action()) }
                        }
                    }
                }
            }
        }
    }
}

fn bounce_panel(data: &Data, id: Id, metric: usize, title: &str) -> Markup {
    let baseline = site_bounce(data).ok().flatten().map(|row| row.metrics[1]);
    let description = format!(
        "세션 {MIN_SESSIONS}회 이상 · 세션 상위 10개{}",
        baseline
            .map(|rate| format!(" · 점선은 사이트 평균 {}", percent(rate)))
            .unwrap_or_default()
    );
    panel(data, id, title, &description, |current, previous| {
        let rows = current
            .rows
            .iter()
            .filter(|row| row.count(0) >= MIN_SESSIONS)
            .take(TOP)
            .map(|row| {
                let rate = row.metrics[metric];
                Bar {
                    value: rate,
                    display: percent(rate),
                    cells: vec![
                        label(row),
                        percent(rate),
                        number(row.count(0)),
                        optional(baseline.map(|baseline| points(rate - baseline))),
                        optional(matched(row, previous).map(|old| percent(old.metrics[metric]))),
                    ],
                }
            })
            .collect();
        bars(
            title,
            &["분류", "이탈률", "세션", "사이트 평균 대비", "이전 이탈률"],
            rows,
            baseline,
        )
    })
}

fn referrer_label(value: &str) -> String {
    if value.is_empty() || value == "(not set)" {
        return "리퍼러 없음".to_owned();
    }
    let Ok(url) = url::Url::parse(value) else {
        return "알 수 없는 리퍼러".to_owned();
    };
    if !matches!(url.scheme(), "http" | "https") {
        return "알 수 없는 리퍼러".to_owned();
    }
    url.host_str()
        .map(|host| format!("{host}{}", url.path()))
        .unwrap_or_else(|| "알 수 없는 리퍼러".to_owned())
}

fn missing_referrers(data: &Data) -> Markup {
    let title = "404 이전 페이지";
    panel(
        data,
        Id::MissingReferrers,
        title,
        "404 조회 직전 리퍼러 · 도메인과 경로 표시",
        |current, previous| {
            let group = |rows: &Rows| {
                let mut counts = HashMap::<String, u64>::new();
                for row in &rows.rows {
                    let count = counts.entry(referrer_label(row.name())).or_default();
                    *count = count.saturating_add(row.count(0));
                }
                counts
            };
            let old = previous.map(group).unwrap_or_default();
            let mut ranked: Vec<_> = group(current).into_iter().collect();
            ranked.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
            let rows = ranked
                .into_iter()
                .map(|(name, views)| {
                    let previous = optional(old.get(&name).copied().map(number));
                    Bar::count(name, views, [previous])
                })
                .collect();
            bars(title, &["이전 페이지", "404 조회", "이전 기간"], rows, None)
        },
    )
}

fn outbound(data: &Data) -> Markup {
    let title = "외부 사이트 클릭";
    panel(
        data,
        Id::Outbound,
        title,
        "GA4 향상된 측정 · 외부 링크 도메인별 클릭",
        |current, previous| {
            let total = current
                .rows
                .iter()
                .map(|row| row.count(0))
                .fold(0u64, u64::saturating_add);
            let rows = current
                .rows
                .iter()
                .map(|row| Bar::count(label(row), row.count(0), [previous_number(row, previous)]))
                .collect();
            html! {
                @if !current.limited && !current.thresholded && total < MIN_OUTBOUND_CLICKS {
                    p role="status" class="mt-2 text-xs text-muted" { "표본 적음 · 집계된 클릭 " (number(total)) "건" }
                }
                (bars(title, &["도메인", "클릭", "이전 기간"], rows, None))
            }
        },
    )
}

fn dropoff(data: &Data) -> Markup {
    html! {
        (diagnosis_panel(data))
        div class=(GRID) {
            (search_funnel(data))
            (count_chart(data, Id::NoResultTerms, "결과 없는 검색어", "결과 없음 이벤트에 GA4 검색어가 수집된 경우 표시", "결과 없음"))
        }
        div class=(GRID) {
            (lost_landings(data))
            (page_engagement(data))
            @for (id, _, metric, title) in BOUNCE_PANELS {
                (bounce_panel(data, id, metric, title))
            }
            (count_chart(data, Id::MissingPaths, "404 페이지 경로", "GA4 태그가 있는 404 문서의 조회 · 사이트 공통 404에는 GA4 태그가 없어요.", "404 조회"))
            (missing_referrers(data))
            (outbound(data))
        }
    }
}

fn realtime(data: &Data) -> Markup {
    html! {
        (panel(data, Id::LiveTotal, "최근 30분 활성 사용자", "30분 전체의 순 사용자 · 분별 수치를 합산하지 않아요.", |rows, _| {
            html! { p class="mt-2 text-4xl font-bold tabular-nums" { (number(rows.rows[0].count(0))) span class="ml-1 text-base font-normal text-muted" { "명" } } }
        }))
        (panel(data, Id::LiveMinutes, "분별 활성 사용자", "현재 분의 집계는 진행 중이에요.", |current, _| {
            let mut values: Vec<_> = current.rows.iter().filter_map(|row| {
                let minute = row.name().parse::<usize>().ok()?;
                Some((29 - minute, row.count(0)))
            }).collect();
            values.sort_unstable();
            let rows: Vec<_> = values.iter().map(|(i, count)| vec![
                if *i == 29 { "현재 분".to_owned() } else { format!("{}분 전", 29 - i) }, number(*count),
            ]).collect();
            html! {
                (plot("분별 활성 사용자", &[("활성 사용자", values)], 29,
                    &[(0, "29분 전".to_owned()), (14, "15분 전".to_owned()), (29, "현재 분".to_owned())]))
                (charts::details("분별 활성 사용자", &["시각", "활성 사용자"], table_rows(&rows)))
            }
        }))
        div class=(GRID) {
            (count_chart(data, Id::LivePages, "활동이 있는 페이지", "최근 30분 동안 활동한 페이지 제목 · 한 사용자가 여러 페이지에 표시될 수 있어요.", "활성 사용자"))
            (count_chart(data, Id::LiveCountries, "실시간 국가", "최근 30분 · 상위 10개", "활성 사용자"))
            (count_chart(data, Id::LiveDevices, "실시간 기기", "최근 30분 · 기기 유형", "활성 사용자"))
        }
    }
}
