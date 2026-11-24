//! `GET /admin/activity` (`app/(admin)/admin/activity/page.tsx`): what was
//! viewed and when, from `get_admin_activity_dashboard`, with the filters of
//! `lib/admin-activity.ts` and the tables of
//! `components/admin/activity-dashboard.tsx`.

use axum::extract::{Request, State};
use axum::response::Response;
use maud::{Markup, html};
use serde::Deserialize;
use time::{Date, Duration, OffsetDateTime};

use super::format::{self, KST};
use super::shell::Root;
use crate::AppState;
use crate::db::IdentityOptions;
use crate::routes::public::{js, labels};

const TITLE: &str = "사용자 활동";
const INVALID: &str = "조회 조건을 확인해 주세요. 오늘까지 최대 31일, 유효한 사용자 ID와 페이지 번호를 선택할 수 있습니다.";
const UNAVAILABLE: &str = "활동 데이터를 불러오지 못했습니다. 관리자 권한과 DB 마이그레이션 상태를 확인한 뒤 다시 조회해 주세요.";
const PAGE_MAX: u32 = 10_000;
const CELL: &str = "px-3 py-3 text-left align-top";
const INPUT: &str =
    "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm";
const LINK: &str = "inline-flex min-h-11 items-center text-accent underline underline-offset-4";

/// `ActivityFilters`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Filters {
    pub from: String,
    pub to: String,
    pub hour_date: String,
    pub user_id: String,
    pub users_page: u32,
    pub views_page: u32,
}

/// `kstToday`.
fn kst_today(now: OffsetDateTime) -> String {
    iso_date(now.to_offset(KST).date())
}

fn iso_date(date: Date) -> String {
    format!(
        "{:04}-{:02}-{:02}",
        date.year(),
        u8::from(date.month()),
        date.day()
    )
}

/// `z.iso.date()`: `YYYY-MM-DD` naming a day that exists.
fn parse_iso_date(value: &str) -> Option<Date> {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }
    let digits = |range: std::ops::Range<usize>| {
        bytes[range.clone()]
            .iter()
            .all(u8::is_ascii_digit)
            .then(|| value[range].parse::<u32>().ok())
            .flatten()
    };
    let (year, month, day) = (digits(0..4)?, digits(5..7)?, digits(8..10)?);
    let month = time::Month::try_from(u8::try_from(month).ok()?).ok()?;
    Date::from_calendar_date(i32::try_from(year).ok()?, month, u8::try_from(day).ok()?).ok()
}

/// `z.guid()`: 8-4-4-4-12 hex digits.
pub fn is_guid(value: &str) -> bool {
    let groups: Vec<&str> = value.split('-').collect();
    groups.len() == 5
        && groups
            .iter()
            .zip([8, 4, 4, 4, 12])
            .all(|(group, len)| group.len() == len && group.bytes().all(|b| b.is_ascii_hexdigit()))
}

/// `^[1-9]\d{0,4}$`.
fn page_number(value: &str) -> Option<u32> {
    let bytes = value.as_bytes();
    (!bytes.is_empty()
        && bytes.len() <= 5
        && bytes[0] != b'0'
        && bytes.iter().all(u8::is_ascii_digit))
    .then(|| value.parse().ok())
    .flatten()
}

/// One search parameter as Next's `searchParams` holds it: absent, one
/// string, or several (an array, which no field of the schema accepts).
enum Param<'a> {
    Absent,
    One(&'a str),
    Many,
}

fn param<'a>(pairs: &'a [(String, String)], key: &str) -> Param<'a> {
    let mut values = pairs.iter().filter(|(name, _)| name == key);
    match (values.next(), values.next()) {
        (None, _) => Param::Absent,
        (Some((_, value)), None) => Param::One(value),
        (Some(_), Some(_)) => Param::Many,
    }
}

/// `parseActivityFilters`: the filters, today in KST, and the input error.
pub fn parse_filters(
    query: Option<&str>,
    now: OffsetDateTime,
) -> (Filters, String, Option<&'static str>) {
    let pairs: Vec<(String, String)> =
        url::form_urlencoded::parse(query.unwrap_or_default().as_bytes())
            .map(|(key, value)| (key.into_owned(), value.into_owned()))
            .collect();
    let today = kst_today(now);
    let to = match param(&pairs, "to") {
        Param::One(value) if parse_iso_date(value).is_some() => value.to_owned(),
        _ => today.clone(),
    };
    let to_date = parse_iso_date(&to).unwrap_or(Date::MIN);
    let from = iso_date(to_date - Duration::days(6));
    let defaults = Filters {
        from: from.clone(),
        to: to.clone(),
        hour_date: to.clone(),
        user_id: String::new(),
        users_page: 1,
        views_page: 1,
    };
    let invalid = |defaults: Filters| (defaults, today.clone(), Some(INVALID));
    let date = |key: &str, default: &str| match param(&pairs, key) {
        Param::Absent => Some(default.to_owned()),
        Param::One(value) => parse_iso_date(value).map(|_| value.to_owned()),
        Param::Many => None,
    };
    let page = |key: &str| match param(&pairs, key) {
        Param::Absent => Some(1),
        Param::One(value) => page_number(value),
        Param::Many => None,
    };
    let user_id = match param(&pairs, "userId") {
        Param::Absent => Some(String::new()),
        Param::One(value) if value.is_empty() || is_guid(value) => Some(value.to_owned()),
        _ => None,
    };
    let (
        Some(from),
        Some(to_value),
        Some(hour_date),
        Some(user_id),
        Some(users_page),
        Some(views_page),
    ) = (
        date("from", &from),
        date("to", &today),
        date("hourDate", &to),
        user_id,
        page("usersPage"),
        page("viewsPage"),
    )
    else {
        return invalid(defaults);
    };
    let filters = Filters {
        from,
        to: to_value,
        hour_date,
        user_id,
        users_page,
        views_page,
    };
    let (Some(start), Some(end)) = (parse_iso_date(&filters.from), parse_iso_date(&filters.to))
    else {
        return invalid(defaults);
    };
    let days = (end - start).whole_days();
    // The dates are all `YYYY-MM-DD`, so comparing the strings compares the days.
    if !(0..=30).contains(&days)
        || filters.to > today
        || filters.hour_date < filters.from
        || filters.hour_date > filters.to
        || filters.users_page > PAGE_MAX
        || filters.views_page > PAGE_MAX
    {
        return invalid(defaults);
    }
    (filters, today, None)
}

/// `activityHref`.
pub fn href(filters: &Filters, anchor: &str) -> String {
    let mut params = url::form_urlencoded::Serializer::new(String::new());
    params.append_pair("from", &filters.from);
    params.append_pair("to", &filters.to);
    params.append_pair("hourDate", &filters.hour_date);
    if !filters.user_id.is_empty() {
        params.append_pair("userId", &filters.user_id);
    }
    if filters.users_page > 1 {
        params.append_pair("usersPage", &filters.users_page.to_string());
    }
    if filters.views_page > 1 {
        params.append_pair("viewsPage", &filters.views_page.to_string());
    }
    let anchor = if anchor.is_empty() {
        String::new()
    } else {
        format!("#{anchor}")
    };
    format!("/admin/activity?{}{anchor}", params.finish())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Metrics {
    views: u64,
    active_users: u64,
    anonymous_sessions: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Range {
    from: String,
    to: String,
    hour_date: String,
}

#[derive(Deserialize)]
struct Day {
    date: String,
    #[serde(flatten)]
    metrics: Metrics,
}

#[derive(Deserialize)]
struct Hour {
    hour: u64,
    #[serde(flatten)]
    metrics: Metrics,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserRow {
    id: String,
    nickname: Option<String>,
    views: u64,
    last_seen_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Users {
    total: u64,
    page: u64,
    page_size: u64,
    items: Vec<UserRow>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewRow {
    id: String,
    event_at: String,
    user_id: Option<String>,
    nickname: Option<String>,
    meme_id: Option<String>,
    title: Option<String>,
    short_id: Option<String>,
    slug: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Views {
    total: u64,
    page: u64,
    page_size: u64,
    items: Vec<ViewRow>,
}

/// `AdminActivity`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Activity {
    generated_at: String,
    range: Range,
    summary: Metrics,
    daily: Vec<Day>,
    hourly: Vec<Hour>,
    users: Users,
    views: Views,
}

fn is_timestamp(value: &str) -> bool {
    value.contains('T') && format::parse_timestamp(value).is_some()
}

/// The checks of `adminActivitySchema` that serde's types do not make.
fn valid(activity: &Activity) -> bool {
    let dates = [
        &activity.range.from,
        &activity.range.to,
        &activity.range.hour_date,
    ];
    is_timestamp(&activity.generated_at)
        && dates.iter().all(|date| parse_iso_date(date).is_some())
        && activity.daily.len() <= 31
        && activity
            .daily
            .iter()
            .all(|day| parse_iso_date(&day.date).is_some())
        && activity.hourly.len() == 24
        && activity.hourly.iter().all(|hour| hour.hour <= 23)
        && activity.users.page >= 1
        && activity.users.page_size == 25
        && activity.users.items.len() <= 25
        && activity
            .users
            .items
            .iter()
            .all(|user| is_guid(&user.id) && user.last_seen_at.as_deref().is_none_or(is_timestamp))
        && activity.views.page >= 1
        && activity.views.page_size == 50
        && activity.views.items.len() <= 50
        && activity.views.items.iter().all(|view| {
            is_guid(&view.id)
                && is_timestamp(&view.event_at)
                && view.user_id.as_deref().is_none_or(is_guid)
                && view.meme_id.as_deref().is_none_or(is_guid)
        })
}

/// `db.rpc("get_admin_activity_dashboard", …)` as the operator.
async fn load(
    state: &AppState,
    user: &crate::auth::SessionUser,
    filters: &Filters,
) -> Option<Activity> {
    let filters = filters.clone();
    let result: Result<Option<String>, sqlx::Error> = state
        .db
        .with_identity(&user.db_identity(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                // `p_user_id: undefined` leaves the argument out.
                let sql = if filters.user_id.is_empty() {
                    "select public.get_admin_activity_dashboard(p_from => $1::date, p_to => $2::date, p_hour_date => $3::date, p_users_page => $4, p_views_page => $5)::text"
                } else {
                    "select public.get_admin_activity_dashboard(p_from => $1::date, p_to => $2::date, p_hour_date => $3::date, p_users_page => $4, p_views_page => $5, p_user_id => $6::uuid)::text"
                };
                let mut query = sqlx::query_scalar(sql)
                    .bind(filters.from)
                    .bind(filters.to)
                    .bind(filters.hour_date)
                    .bind(i32::try_from(filters.users_page).unwrap_or(1))
                    .bind(i32::try_from(filters.views_page).unwrap_or(1));
                if !filters.user_id.is_empty() {
                    query = query.bind(filters.user_id);
                }
                query.fetch_one(tx).await
            })
        })
        .await;
    let value = match result {
        Ok(Some(value)) => value,
        Ok(None) => return None,
        Err(error) => {
            tracing::warn!(%error, "activity dashboard failed");
            return None;
        }
    };
    serde_json::from_str::<Activity>(&value).ok().filter(valid)
}

pub async fn page(State(state): State<AppState>, request: Request) -> Response {
    let query = request.uri().query();
    let user = match super::require_operator(&state, request.headers(), request.uri().path(), query)
        .await
    {
        Ok(user) => user,
        Err(redirect) => return redirect,
    };
    let (filters, today, input_error) = parse_filters(query, OffsetDateTime::now_utc());
    let (data, error) = match input_error {
        Some(error) => (None, Some(error)),
        None => match load(&state, &user, &filters).await {
            Some(data) => (Some(data), None),
            None => (None, Some(UNAVAILABLE)),
        },
    };
    let main = dashboard(data.as_ref(), &filters, &today, error);
    super::screen(&state, Root::Private, TITLE, "/admin/activity", main)
}

fn date_time(value: Option<&str>) -> String {
    value
        .and_then(format::parse_timestamp)
        .map_or_else(|| "기록 없음".to_owned(), format::kst_date_time_h23)
}

fn number(value: u64) -> String {
    format::count(i64::try_from(value).unwrap_or(i64::MAX))
}

fn with(filters: &Filters, change: impl FnOnce(&mut Filters)) -> Filters {
    let mut next = filters.clone();
    change(&mut next);
    next
}

fn dashboard(
    data: Option<&Activity>,
    filters: &Filters,
    today: &str,
    error: Option<&str>,
) -> Markup {
    html! {
        div class="mx-auto max-w-7xl space-y-6" {
            header {
                p class="text-sm font-medium text-accent" { "관리자 전용 · 한국 시간 (KST)" }
                h1 class="mt-1 text-2xl font-bold" { (TITLE) }
                p class="mt-2 text-sm text-muted" { "어떤 콘텐츠를 보고, 언제 방문하는지 확인하세요." }
            }
            form aria-label="활동 조회 조건" class="rounded-xl border border-border bg-surface p-4" action="/admin/activity" method="get" {
                div class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                    label class="text-sm font-medium" { "시작일" input class=(INPUT) type="date" max=(today) required name="from" value=(filters.from); }
                    label class="text-sm font-medium" { "종료일" input class=(INPUT) type="date" max=(today) required name="to" value=(filters.to); }
                    label class="text-sm font-medium" { "사용자 ID (선택)" input class=(INPUT) placeholder="목록에서 선택 또는 UUID 입력" autocomplete="off" name="userId" value=(filters.user_id); }
                    button class="min-h-11 rounded-lg bg-accent-strong px-4 font-semibold text-white" type="submit" { "조회하기" }
                }
                div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" {
                    a class=(LINK) href="/admin/activity" { "조건 초기화" }
                    p class="text-muted" { "최대 31일 · 일별 날짜를 누르면 해당 날짜의 시간별 활동을 확인합니다." }
                }
            }
            @if let Some(error) = error {
                p role="alert" class="rounded-xl border border-safety-red/40 bg-surface p-4 text-safety-red" { (error) }
            }
            @if let (Some(data), None) = (data, error) {
                (report(data, filters))
            }
            aside class="rounded-xl bg-surface-2 p-4 text-sm leading-relaxed text-muted" aria-label="집계 기준" {
                "기존 클라이언트 활동 이벤트 기준입니다. 밈 조회는 같은 세션·콘텐츠의 분 단위 중복이 제거되며, 차단된 추적이나 전송 실패는 포함되지 않습니다. 활성 사용자는 조회 외 활동도 포함합니다. 익명 세션은 실제 사람 수가 아니며 로그인 계정 수와 합산하지 않습니다. 삭제된 계정의 기록은 익명으로 남을 수 있습니다. 이메일·IP·검색어·세션 식별자는 표시하지 않습니다."
            }
        }
    }
}

fn report(data: &Activity, filters: &Filters) -> Markup {
    let metrics = [
        (
            "기록된 밈 조회",
            data.summary.views,
            "회",
            "선택 기간 · 중복 제거된 조회 이벤트",
        ),
        (
            "활성 로그인 사용자",
            data.summary.active_users,
            "명",
            "선택 기간 · 활동 계정 중복 제거",
        ),
        (
            "익명 방문 세션",
            data.summary.anonymous_sessions,
            "개",
            "선택 기간 · 사람 수와 다릅니다",
        ),
    ];
    let daily: Vec<Bucket> = data
        .daily
        .iter()
        .map(|day| Bucket {
            label: day.date.clone(),
            metrics: &day.metrics,
            href: Some(href(
                &with(filters, |next| next.hour_date.clone_from(&day.date)),
                "hourly-activity",
            )),
            selected: day.date == filters.hour_date,
        })
        .collect();
    let hourly: Vec<Bucket> = data
        .hourly
        .iter()
        .map(|hour| Bucket {
            label: format!("{:02}:00–{:02}:59", hour.hour, hour.hour),
            metrics: &hour.metrics,
            href: None,
            selected: false,
        })
        .collect();
    html! {
        div class="flex flex-wrap items-center justify-between gap-2 text-sm text-muted" {
            p {
                (data.range.from) " ~ " (data.range.to) " · 전체 활동"
                @if !filters.user_id.is_empty() {
                    span class="ml-2 break-all" { "· 선택 계정 " (filters.user_id) }
                }
            }
            p { "집계 시각 " (date_time(Some(&data.generated_at))) }
        }
        section aria-label="활동 요약" class="grid gap-3 sm:grid-cols-3" {
            @for (label, value, unit, note) in metrics {
                div class="rounded-xl border border-border bg-surface p-4" {
                    h2 class="text-sm font-medium text-muted" { (label) }
                    p class="mt-2 text-3xl font-bold tabular-nums" { (number(value)) span class="ml-1 text-base font-normal text-muted" { (unit) } }
                    p class="mt-2 text-xs text-muted" { (note) }
                }
            }
        }
        div class="grid gap-4 xl:grid-cols-2" {
            (bucket_table("일별 활동", "daily-activity", &daily))
            (bucket_table(&format!("시간별 활동 · {}", data.range.hour_date), "hourly-activity", &hourly))
        }
        (users_section(&data.users, filters))
        (views_section(&data.views, filters))
    }
}

fn users_section(users: &Users, filters: &Filters) -> Markup {
    let reset_pages = |next: &mut Filters| {
        next.users_page = 1;
        next.views_page = 1;
    };
    html! {
        section id="activity-users" aria-labelledby="users-heading" class="scroll-mt-6 rounded-xl border border-border bg-surface" {
            div class="p-4" {
                h2 id="users-heading" class="text-lg font-bold" { "사용자별 활동 " span class="text-sm font-normal text-muted" { (number(users.total)) "명" } }
                p class="mt-1 text-sm text-muted" { "기간 내 활동한 로그인 계정입니다. 익명 세션은 특정 계정과 연결하지 않습니다." }
            }
            div class="overflow-x-auto" {
                table class="w-full min-w-[640px] text-sm" {
                    caption class="sr-only" { "사용자별 선택 기간 활동" }
                    thead class="border-y border-border bg-surface-2 text-muted" {
                        tr { @for label in ["사용자", "밈 조회", "최근 활동 (KST)", "상세"] { th scope="col" class=(CELL) { (label) } } }
                    }
                    tbody class="divide-y divide-border" {
                        @for user in &users.items {
                            @let short = user.id.get(..8).unwrap_or(&user.id);
                            @let name = user.nickname.as_deref().filter(|name| !name.is_empty());
                            tr {
                                td class=(CELL) { span class="font-medium" { (name.unwrap_or("닉네임 없음")) } span class="mt-1 block font-mono text-xs text-muted" { (short) } }
                                td class="px-3 py-3 text-left align-top tabular-nums" { (number(user.views)) "회" }
                                td class=(CELL) { (date_time(user.last_seen_at.as_deref())) }
                                td class=(CELL) {
                                    div class="flex gap-4 whitespace-nowrap" {
                                        a class=(LINK) href=(href(&with(filters, |next| { next.user_id.clone_from(&user.id); reset_pages(next); }), "activity-views")) aria-label=(format!("{} 조회 내역", name.unwrap_or(short))) { "조회 내역" }
                                        a class=(LINK) href=(format!("/admin/users/{}", user.id)) { "계정 관리" }
                                    }
                                }
                            }
                        }
                        @if users.items.is_empty() {
                            tr { td colspan="4" class="px-4 py-8 text-center text-muted" { "이 조건에 해당하는 사용자 기록이 없습니다." } }
                        }
                    }
                }
            }
            (pagination(users.total, users.page, users.page_size, Field::Users, filters, "activity-users", "사용자"))
        }
    }
}

fn views_section(views: &Views, filters: &Filters) -> Markup {
    let for_user = |user_id: &str| {
        href(
            &with(filters, |next| {
                user_id.clone_into(&mut next.user_id);
                next.users_page = 1;
                next.views_page = 1;
            }),
            "activity-views",
        )
    };
    html! {
        section id="activity-views" aria-labelledby="views-heading" class="scroll-mt-6 rounded-xl border border-border bg-surface" {
            div class="flex flex-wrap items-center justify-between gap-2 p-4" {
                h2 id="views-heading" class="text-lg font-bold" { "최근 조회 콘텐츠 " span class="text-sm font-normal text-muted" { (number(views.total)) "건" } }
                @if !filters.user_id.is_empty() {
                    a class=(LINK) href=(for_user("")) { "사용자 선택 해제" }
                }
            }
            div class="overflow-x-auto" {
                table class="w-full min-w-[520px] text-sm" {
                    caption class="sr-only" { "선택 조건의 최신 밈 조회 이벤트" }
                    thead class="border-y border-border bg-surface-2 text-muted" {
                        tr { @for label in ["조회 시각 (KST)", "사용자", "조회한 콘텐츠"] { th scope="col" class=(CELL) { (label) } } }
                    }
                    tbody class="divide-y divide-border" {
                        @for view in &views.items {
                            tr {
                                td class="px-3 py-3 text-left align-top whitespace-nowrap tabular-nums" { (date_time(Some(&view.event_at))) }
                                td class=(CELL) {
                                    @if let Some(user_id) = view.user_id.as_deref().filter(|id| !id.is_empty()) {
                                        a class=(LINK) href=(for_user(user_id)) {
                                            @match view.nickname.as_deref().filter(|name| !name.is_empty()) {
                                                Some(name) => (name),
                                                None => { "계정 " (user_id.get(..8).unwrap_or(user_id)) },
                                            }
                                        }
                                    } @else {
                                        span class="text-muted" { "익명 / 삭제된 계정" }
                                    }
                                }
                                td class=(CELL) {
                                    @match (view.short_id.as_deref().filter(|id| !id.is_empty()), view.slug.as_deref().filter(|slug| !slug.is_empty())) {
                                        (Some(short_id), Some(slug)) => a class=(LINK) href=(labels::meme_path(&js::encode_uri_component(short_id), slug)) { (view.title.as_deref().filter(|title| !title.is_empty()).unwrap_or("제목 없음")) },
                                        _ => span class="text-muted" { "삭제되었거나 연결되지 않은 콘텐츠" },
                                    }
                                }
                            }
                        }
                        @if views.items.is_empty() {
                            tr { td colspan="3" class="px-4 py-8 text-center text-muted" { "이 조건에 기록된 밈 조회가 없습니다." } }
                        }
                    }
                }
            }
            (pagination(views.total, views.page, views.page_size, Field::Views, filters, "activity-views", "조회 내역"))
        }
    }
}

struct Bucket<'a> {
    label: String,
    metrics: &'a Metrics,
    href: Option<String>,
    selected: bool,
}

/// `BucketTable`: the bar is the share of the busiest row's active users.
fn bucket_table(title: &str, id: &str, rows: &[Bucket]) -> Markup {
    let max = rows
        .iter()
        .map(|row| row.metrics.active_users)
        .max()
        .unwrap_or(0)
        .max(1);
    html! {
        section aria-labelledby=(format!("{id}-heading")) id=(id) class="min-w-0 scroll-mt-6 rounded-xl border border-border bg-surface" {
            h2 id=(format!("{id}-heading")) class="p-4 text-lg font-bold" { (title) }
            div class="max-h-96 overflow-auto" {
                table class="w-full min-w-[380px] text-sm tabular-nums" {
                    caption class="sr-only" { (title) " · 로그인 사용자와 익명 세션은 각각 중복 제거" }
                    thead class="sticky top-0 bg-surface-2 text-muted" {
                        tr { @for label in ["한국 시간", "활성 계정 (명)", "익명 (세션)", "밈 조회 (회)"] { th scope="col" class="px-3 py-3 text-left align-top whitespace-nowrap" { (label) } } }
                    }
                    tbody class="divide-y divide-border" {
                        @for row in rows {
                            @let width = row.metrics.active_users as f64 / max as f64 * 100.0;
                            tr class=(if row.selected { "bg-accent-soft" } else { "" }) {
                                th scope="row" class="px-3 py-3 text-left align-top whitespace-nowrap font-normal" {
                                    @if let Some(href) = &row.href {
                                        a class="text-accent underline underline-offset-4" aria-current=[row.selected.then_some("date")] href=(href) { (row.label) }
                                    } @else {
                                        (row.label)
                                    }
                                }
                                td class=(CELL) { (number(row.metrics.active_users)) div aria-hidden="true" class="mt-1 h-1 rounded bg-accent-strong/70" style=(format!("width:{width}%")) {} }
                                td class=(CELL) { (number(row.metrics.anonymous_sessions)) }
                                td class=(CELL) { (number(row.metrics.views)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

#[derive(Clone, Copy)]
enum Field {
    Users,
    Views,
}

fn pagination(
    total: u64,
    page: u64,
    size: u64,
    field: Field,
    filters: &Filters,
    anchor: &str,
    label: &str,
) -> Markup {
    let pages = total.div_ceil(size.max(1)).max(1);
    let at = |page: u64| {
        let page = u32::try_from(page).unwrap_or(u32::MAX);
        href(
            &with(filters, |next| match field {
                Field::Users => next.users_page = page,
                Field::Views => next.views_page = page,
            }),
            anchor,
        )
    };
    html! {
        nav aria-label=(format!("{label} 페이지")) class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm" {
            span class="text-muted" { (number(page)) " / " (number(pages)) " 페이지 · " (size) "개씩" }
            div class="flex gap-5" {
                @if page > 1 {
                    a class=(LINK) href=(at((page - 1).min(pages))) aria-label=(format!("{label} 이전 페이지")) { "이전" }
                }
                @if page < pages && page < u64::from(PAGE_MAX) {
                    a class=(LINK) href=(at(page + 1)) aria-label=(format!("{label} 다음 페이지")) { "다음" }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> OffsetDateTime {
        format::parse_timestamp("2026-11-24T03:00:00Z").expect("now")
    }

    #[test]
    fn filters_default_to_the_last_seven_days_in_kst() {
        let (filters, today, error) = parse_filters(None, now());
        assert_eq!(today, "2026-11-24");
        assert_eq!(error, None);
        assert_eq!(
            (
                filters.from.as_str(),
                filters.to.as_str(),
                filters.hour_date.as_str()
            ),
            ("2026-11-18", "2026-11-24", "2026-11-24")
        );
        let (filters, _, error) = parse_filters(Some("to=2026-02-03"), now());
        assert_eq!(error, None);
        assert_eq!(
            (filters.from.as_str(), filters.hour_date.as_str()),
            ("2026-01-28", "2026-02-03")
        );
    }

    #[test]
    fn bad_filters_fall_back_with_the_message() {
        for query in [
            "from=2026-10-01&to=2026-11-24",
            "to=2026-11-25",
            "from=2026-02-30",
            "userId=nope",
            "usersPage=0",
            "usersPage=100000",
            "viewsPage=10001",
            "from=2026-11-20&from=2026-11-21",
            "hourDate=2026-11-10",
        ] {
            let (filters, _, error) = parse_filters(Some(query), now());
            assert_eq!(error, Some(INVALID), "{query}");
            assert_eq!(filters.users_page, 1, "{query}");
        }
        // An invalid `to` is ignored for the defaults but fails the parse.
        let (filters, _, error) = parse_filters(Some("to=x"), now());
        assert_eq!((error, filters.to.as_str()), (Some(INVALID), "2026-11-24"));
    }

    #[test]
    fn links_carry_only_what_differs_from_the_defaults() {
        let (filters, _, _) = parse_filters(None, now());
        assert_eq!(
            href(&filters, ""),
            "/admin/activity?from=2026-11-18&to=2026-11-24&hourDate=2026-11-24"
        );
        let next = with(&filters, |next| {
            next.user_id = "00000000-0000-4000-8000-000000000001".to_owned();
            next.views_page = 2;
        });
        assert_eq!(
            href(&next, "activity-views"),
            "/admin/activity?from=2026-11-18&to=2026-11-24&hourDate=2026-11-24&userId=00000000-0000-4000-8000-000000000001&viewsPage=2#activity-views"
        );
    }
}
