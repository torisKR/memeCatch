//! GA4 reports for the operator dashboard and analytics page.

use std::time::Duration;

use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, HeaderValue};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use maud::{Markup, html};
use rustls::SignatureScheme;
use rustls::pki_types::PrivateKeyDer;
use rustls::pki_types::pem::PemObject;
use serde_json::{Value, json};

use super::format;

mod charts;
#[cfg(test)]
mod tests;
use crate::AppState;
use crate::config::Ga4Config;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/analytics.readonly";
const DAYS: usize = 28;
const CURRENT: (&str, &str) = ("28daysAgo", "yesterday");
const PREVIOUS: (&str, &str) = ("56daysAgo", "29daysAgo");
const TOTALS: &[&str] = &[
    "activeUsers",
    "newUsers",
    "sessions",
    "screenPageViews",
    "userEngagementDuration",
];
const REQUIRED: [&str; 3] = [
    "GA4_PROPERTY_ID",
    "GA4_SERVICE_ACCOUNT_EMAIL",
    "GA4_SERVICE_ACCOUNT_PRIVATE_KEY",
];
const TIMEOUT: Duration = Duration::from_secs(10);
const BODY_LIMIT: usize = 4 * 1024 * 1024;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Analytics,
    Dashboard,
}

#[derive(Clone, Copy)]
struct Totals {
    active_users: u64,
    new_users: u64,
    sessions: u64,
    views: u64,
    engagement_seconds: f64,
}

impl Totals {
    fn average_engagement(self) -> Option<f64> {
        (self.active_users != 0).then(|| self.engagement_seconds / self.active_users as f64)
    }
}

struct Daily {
    date: time::Date,
    users: u64,
    views: u64,
}

struct Ranked {
    name: String,
    path: Option<String>,
    value: u64,
}

pub struct Ready {
    totals: Option<Totals>,
    previous: Option<Totals>,
    daily: Vec<Daily>,
    pages: Vec<Ranked>,
    channels: Vec<Ranked>,
    devices: Vec<Ranked>,
    countries: Vec<Ranked>,
    time_zone: Option<String>,
    thresholded: bool,
    fetched_at: String,
}

/// `GA4Report`.
pub enum Report {
    MissingConfig(Vec<&'static str>),
    InvalidConfig,
    Error(Reason),
    Empty,
    Ready(Box<Ready>),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reason {
    Authentication,
    Permission,
    Quota,
    Unavailable,
    InvalidResponse,
}

/// `getAdminGA4Report(mode)`, after the operator check.
pub async fn report(state: &AppState, mode: Mode) -> Report {
    let config = &state.config.ga4;
    let missing = missing(config);
    if !missing.is_empty() {
        return Report::MissingConfig(missing);
    }
    let (Some(property), Some(email), Some(key)) =
        (&config.property_id, &config.email, &config.private_key)
    else {
        return Report::MissingConfig(REQUIRED.to_vec());
    };
    if !is_property(property) || !is_service_account(email) {
        return Report::InvalidConfig;
    }
    let pem = key.expose().replace("\\n", "\n");
    let Some(signer) = signer(&pem) else {
        return Report::InvalidConfig;
    };
    match fetch(state, mode, property, email, signer.as_ref()).await {
        Ok(report) => report,
        Err(reason) => Report::Error(reason),
    }
}

fn missing(config: &Ga4Config) -> Vec<&'static str> {
    let values = [
        config.property_id.as_deref(),
        config.email.as_deref(),
        config
            .private_key
            .as_ref()
            .map(crate::config::Secret::expose),
    ];
    REQUIRED
        .iter()
        .zip(values)
        .filter(|(_, value)| {
            value.is_none_or(|value| crate::routes::public::js::trim(value).is_empty())
        })
        .map(|(name, _)| *name)
        .collect()
}

/// `^[1-9]\d*$`.
fn is_property(value: &str) -> bool {
    value
        .bytes()
        .next()
        .is_some_and(|first| (b'1'..=b'9').contains(&first))
        && value.bytes().all(|b| b.is_ascii_digit())
}

/// `^[^\s@]+@[^\s@]+\.gserviceaccount\.com$`.
fn is_service_account(value: &str) -> bool {
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    let plain =
        |part: &str| !part.is_empty() && !part.chars().any(|c| c.is_whitespace() || c == '@');
    domain
        .strip_suffix(".gserviceaccount.com")
        .is_some_and(|host| plain(local) && plain(host))
}

/// `createPrivateKey(pem)`, an RSA key of at least 2048 bits, as a signer
/// for RS256.
fn signer(pem: &str) -> Option<Box<dyn rustls::sign::Signer>> {
    let key = PrivateKeyDer::from_pem_slice(pem.as_bytes()).ok()?;
    let key = rustls::crypto::ring::sign::any_supported_type(&key).ok()?;
    if key.algorithm() != rustls::SignatureAlgorithm::RSA {
        return None;
    }
    key.choose_scheme(&[SignatureScheme::RSA_PKCS1_SHA256])
}

fn encode(value: &str) -> String {
    URL_SAFE_NO_PAD.encode(value.as_bytes())
}

/// The token request's assertion.
fn assertion(email: &str, now: i64, signer: &dyn rustls::sign::Signer) -> Option<String> {
    let header = r#"{"alg":"RS256","typ":"JWT"}"#;
    let claims = format!(
        r#"{{"iss":{},"scope":"{SCOPE}","aud":"{TOKEN_URL}","iat":{now},"exp":{}}}"#,
        Value::from(email),
        now + 3600
    );
    let unsigned = format!("{}.{}", encode(header), encode(&claims));
    let signature = signer.sign(unsigned.as_bytes()).ok()?;
    Some(format!("{unsigned}.{}", URL_SAFE_NO_PAD.encode(signature)))
}

/// `googleJson`: the parsed body of an answer in 2xx, else the reason.
async fn google_json(
    state: &AppState,
    url: &str,
    headers: &[(axum::http::HeaderName, HeaderValue)],
    body: String,
    token: bool,
) -> Result<Value, Reason> {
    let url = url::Url::parse(url).map_err(|_| Reason::Unavailable)?;
    let (status, bytes) = state
        .outbound
        .post_read(&url, headers, body, TIMEOUT, BODY_LIMIT)
        .await
        .map_err(|_| Reason::Unavailable)?;
    let code = status.as_u16();
    if !status.is_success() {
        // `redirect: "error"`: fetch throws on a redirect, which is
        // "unavailable" like any other thrown error.
        return Err(match code {
            300..=399 => Reason::Unavailable,
            429 => Reason::Quota,
            500.. => Reason::Unavailable,
            _ if token || code == 401 => Reason::Authentication,
            403 => Reason::Permission,
            _ => Reason::Unavailable,
        });
    }
    serde_json::from_slice(&bytes).map_err(|_| Reason::InvalidResponse)
}

/// `count`: a string of digits that is a safe integer.
fn count(value: &Value) -> Option<u64> {
    let text = value.as_str()?;
    if text.is_empty() || !text.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    text.parse::<u64>().ok().filter(|n| *n < (1 << 53))
}

#[derive(Clone, Copy)]
struct Query {
    dimensions: &'static [&'static str],
    metrics: &'static [&'static str],
    dates: (&'static str, &'static str),
    limit: usize,
    rank: bool,
}

impl Query {
    const fn totals(dates: (&'static str, &'static str)) -> Self {
        Self {
            dimensions: &[],
            metrics: TOTALS,
            dates,
            limit: 1,
            rank: false,
        }
    }

    const fn ranking(
        dimensions: &'static [&'static str],
        metric: &'static [&'static str],
        limit: usize,
    ) -> Self {
        Self {
            dimensions,
            metrics: metric,
            dates: CURRENT,
            limit,
            rank: true,
        }
    }

    fn body(self) -> Value {
        let mut body = json!({
            "dateRanges": [{ "startDate": self.dates.0, "endDate": self.dates.1 }],
            "metrics": self.metrics.iter().map(|name| json!({ "name": name })).collect::<Vec<_>>(),
            "dimensions": self.dimensions.iter().map(|name| json!({ "name": name })).collect::<Vec<_>>(),
            "limit": self.limit.to_string(),
            "keepEmptyRows": true,
        });
        if self.rank {
            body["orderBys"] =
                json!([{ "metric": { "metricName": self.metrics[0] }, "desc": true }]);
        } else if self.dimensions == ["date"] {
            body["orderBys"] = json!([{ "dimension": { "dimensionName": "date" } }]);
        }
        body
    }
}

const OVERVIEW: &[Query] = &[
    Query::totals(CURRENT),
    Query::totals(PREVIOUS),
    Query {
        dimensions: &["date"],
        metrics: &["activeUsers", "screenPageViews"],
        dates: CURRENT,
        limit: DAYS,
        rank: false,
    },
];
const BREAKDOWNS: &[Query] = &[
    Query::ranking(&["pageTitle", "pagePath"], &["screenPageViews"], 10),
    Query::ranking(&["sessionDefaultChannelGroup"], &["sessions"], 10),
    Query::ranking(&["deviceCategory"], &["activeUsers"], 10),
    Query::ranking(&["country"], &["activeUsers"], 10),
];

fn fields<'a>(input: &'a Value, key: &str, field: &str) -> Result<Vec<&'a str>, Reason> {
    optional_array(input, key)?
        .iter()
        .map(|item| {
            item.get(field)
                .and_then(Value::as_str)
                .ok_or(Reason::InvalidResponse)
        })
        .collect()
}

fn optional_array<'a>(input: &'a Value, key: &str) -> Result<&'a [Value], Reason> {
    match input.get(key) {
        None => Ok(&[]),
        Some(Value::Array(items)) => Ok(items),
        _ => Err(Reason::InvalidResponse),
    }
}

struct Parsed<'a> {
    rows: &'a [Value],
    time_zone: Option<&'a str>,
    thresholded: bool,
}

fn parse_report(input: &Value, query: Query) -> Result<Parsed<'_>, Reason> {
    let invalid = Reason::InvalidResponse;
    if !input.is_object()
        || fields(input, "metricHeaders", "name")? != query.metrics
        || fields(input, "dimensionHeaders", "name")? != query.dimensions
    {
        return Err(invalid);
    }
    let rows = optional_array(input, "rows")?;
    if rows.len() > query.limit {
        return Err(invalid);
    }
    if let Some(row_count) = input.get("rowCount") {
        let row_count = row_count.as_u64().ok_or(invalid)?;
        let returned = rows.len() as u64;
        if row_count < returned || (!query.rank && row_count != returned) {
            return Err(invalid);
        }
    }
    for row in rows {
        if fields(row, "dimensionValues", "value")?.len() != query.dimensions.len()
            || optional_array(row, "metricValues")?.len() != query.metrics.len()
        {
            return Err(invalid);
        }
    }
    let (time_zone, thresholded) = match input.get("metadata") {
        None => (None, false),
        Some(Value::Object(metadata)) => (
            metadata
                .get("timeZone")
                .map(|value| value.as_str().ok_or(invalid))
                .transpose()?,
            metadata
                .get("subjectToThresholding")
                .map(|value| value.as_bool().ok_or(invalid))
                .transpose()?
                .unwrap_or(false),
        ),
        _ => return Err(invalid),
    };
    Ok(Parsed {
        rows,
        time_zone,
        thresholded,
    })
}

fn metric(row: &Value, index: usize) -> Result<u64, Reason> {
    count(&row["metricValues"][index]["value"]).ok_or(Reason::InvalidResponse)
}

fn totals(report: &Parsed<'_>) -> Result<Option<Totals>, Reason> {
    let Some(row) = report.rows.first() else {
        return Ok(None);
    };
    let engagement_seconds = row["metricValues"][4]["value"]
        .as_str()
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| (0.0..(1_u64 << 53) as f64).contains(value))
        .ok_or(Reason::InvalidResponse)?;
    Ok(Some(Totals {
        active_users: metric(row, 0)?,
        new_users: metric(row, 1)?,
        sessions: metric(row, 2)?,
        views: metric(row, 3)?,
        engagement_seconds,
    }))
}

fn date(value: &str) -> Option<time::Date> {
    if value.len() != 8 || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    time::Date::from_calendar_date(
        value[..4].parse().ok()?,
        time::Month::try_from(value[4..6].parse::<u8>().ok()?).ok()?,
        value[6..].parse().ok()?,
    )
    .ok()
}

fn daily(report: &Parsed<'_>) -> Result<Vec<Daily>, Reason> {
    let mut daily = report
        .rows
        .iter()
        .map(|row| {
            Ok(Daily {
                date: row["dimensionValues"][0]["value"]
                    .as_str()
                    .and_then(date)
                    .ok_or(Reason::InvalidResponse)?,
                users: metric(row, 0)?,
                views: metric(row, 1)?,
            })
        })
        .collect::<Result<Vec<_>, Reason>>()?;
    daily.sort_unstable_by_key(|row| row.date);
    if daily.windows(2).any(|pair| pair[0].date == pair[1].date)
        || daily
            .first()
            .zip(daily.last())
            .is_some_and(|(first, last)| (last.date - first.date).whole_days() >= DAYS as i64)
    {
        return Err(Reason::InvalidResponse);
    }
    Ok(daily)
}

fn ranked(report: &Parsed<'_>) -> Result<Vec<Ranked>, Reason> {
    report
        .rows
        .iter()
        .map(|row| {
            let names = fields(row, "dimensionValues", "value")?;
            Ok(Ranked {
                name: names[0].to_owned(),
                path: names.get(1).map(|path| (*path).to_owned()),
                value: metric(row, 0)?,
            })
        })
        .collect()
}

fn parse_batch<'a>(input: &'a Value, queries: &[Query]) -> Result<Vec<Parsed<'a>>, Reason> {
    let reports = optional_array(input, "reports")?;
    if reports.len() != queries.len() {
        return Err(Reason::InvalidResponse);
    }
    reports
        .iter()
        .zip(queries)
        .map(|(value, query)| parse_report(value, *query))
        .collect()
}

async fn load_report<Fut>(mode: Mode, run: impl Fn(Value) -> Fut) -> Result<Report, Reason>
where
    Fut: std::future::Future<Output = Result<Value, Reason>>,
{
    let batch = |queries: &[Query]| {
        json!({
            "requests": queries.iter().map(|query| query.body()).collect::<Vec<_>>()
        })
    };
    let overview = batch(OVERVIEW);
    let (overview, breakdowns) = if mode == Mode::Analytics {
        // GA4 allows five reports per batch. Keep the overview reusable by the dashboard.
        let (overview, breakdowns) = tokio::join!(run(overview), run(batch(BREAKDOWNS)));
        (overview?, Some(breakdowns?))
    } else {
        (run(overview).await?, None)
    };
    let overview = parse_batch(&overview, OVERVIEW)?;
    let summary = &overview[0];
    let current = totals(summary)?;
    let previous = totals(&overview[1])?;
    let daily = daily(&overview[2])?;
    let breakdowns = breakdowns
        .as_ref()
        .map(|value| parse_batch(value, BREAKDOWNS))
        .transpose()?;
    let mut rows = breakdowns.iter().flatten().map(ranked);
    let mut next = || rows.next().transpose().map(Option::unwrap_or_default);
    let ready = Ready {
        totals: current,
        previous,
        daily,
        pages: next()?,
        channels: next()?,
        devices: next()?,
        countries: next()?,
        time_zone: summary.time_zone.map(str::to_owned),
        thresholded: overview
            .iter()
            .chain(breakdowns.iter().flatten())
            .any(|report| report.thresholded),
        fetched_at: format::iso(time::OffsetDateTime::now_utc()),
    };
    if ready.totals.is_none()
        && ready.daily.is_empty()
        && ready.pages.is_empty()
        && ready.channels.is_empty()
        && ready.devices.is_empty()
        && ready.countries.is_empty()
    {
        return Ok(Report::Empty);
    }
    Ok(Report::Ready(Box::new(ready)))
}

async fn fetch(
    state: &AppState,
    mode: Mode,
    property: &str,
    email: &str,
    signer: &dyn rustls::sign::Signer,
) -> Result<Report, Reason> {
    let now = crate::auth::now_ms() / 1000;
    let assertion = assertion(email, now, signer).ok_or(Reason::Unavailable)?;
    let form = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
        .append_pair("assertion", &assertion)
        .finish();
    let token = google_json(
        state,
        TOKEN_URL,
        &[(
            CONTENT_TYPE,
            HeaderValue::from_static("application/x-www-form-urlencoded"),
        )],
        form,
        true,
    )
    .await?;
    let access = token
        .get("access_token")
        .and_then(Value::as_str)
        .filter(|token| !token.is_empty())
        .ok_or(Reason::InvalidResponse)?
        .to_owned();
    let url = format!(
        "https://analyticsdata.googleapis.com/v1beta/properties/{property}:batchRunReports"
    );
    let bearer =
        HeaderValue::from_str(&format!("Bearer {access}")).map_err(|_| Reason::InvalidResponse)?;
    let headers = [
        (AUTHORIZATION, bearer),
        (CONTENT_TYPE, HeaderValue::from_static("application/json")),
    ];
    load_report(mode, |body| {
        google_json(state, &url, &headers, body.to_string(), false)
    })
    .await
}

fn reason_text(reason: Reason) -> &'static str {
    match reason {
        Reason::Authentication => "Google 인증에 실패했어요. 서비스 계정 키를 확인해 주세요.",
        Reason::Permission => {
            "GA4 접근 권한이 없어요. Data API 활성화와 속성의 서비스 계정 Viewer 권한을 확인해 주세요."
        }
        Reason::Quota => "Google API 할당량에 도달했어요. 잠시 후 다시 조회해 주세요.",
        Reason::Unavailable => "Google Analytics에 연결할 수 없어요. 잠시 후 다시 조회해 주세요.",
        Reason::InvalidResponse => "Google 응답을 검증할 수 없어 통계를 표시하지 않았어요.",
    }
}

/// Connection status and sanitized errors.
fn unavailable(report: &Report) -> Markup {
    let title = match report {
        Report::MissingConfig(_) => "GA4 연결 설정 필요",
        Report::Empty | Report::Ready(_) => "조회 기간 데이터 없음",
        _ => "GA4 리포트 사용 불가",
    };
    html! {
        section role="status" class="space-y-3 rounded-xl border border-border bg-surface p-5" {
            h2 class="font-semibold" { (title) }
            @match report {
                Report::MissingConfig(missing) => {
                    p class="text-sm text-muted" { "서버 환경변수를 설정해야 실제 리포트를 조회할 수 있어요. NEXT_PUBLIC_GA_ID는 수집용 측정 ID이며 보고서 접근 권한이 아닙니다." }
                    ul class="list-inside list-disc text-sm" { @for name in missing { li { code { (name) } } } }
                    p class="text-sm text-muted" { "GA4 속성의 숫자 ID와 서비스 계정 자격 증명을 서버에만 등록하고, Google Analytics Data API를 활성화한 뒤 서비스 계정에 속성 Viewer 권한을 부여해 주세요. 비밀 키를 공개 환경변수에 넣지 마세요." }
                }
                Report::InvalidConfig => p class="text-sm text-muted" { "서버의 GA4 속성 ID 또는 서비스 계정 설정 형식이 올바르지 않아요." },
                Report::Error(reason) => p class="text-sm text-muted" { (reason_text(*reason)) },
                Report::Empty | Report::Ready(_) => p class="text-sm text-muted" { "Google이 이 기간의 행을 반환하지 않았어요. 수집 상태와 속성을 확인해 주세요. 빈 결과를 0으로 대체하지 않습니다." },
            }
        }
    }
}

pub fn report_panel(report: &Report) -> Markup {
    let Report::Ready(ready) = report else {
        return unavailable(report);
    };
    html! {
        div class="space-y-5" {
            (charts::tiles(ready))
            (charts::trend(&ready.daily, false))
            div class="grid items-start gap-5 xl:grid-cols-2" {
                (charts::bars("인기 페이지", "조회수", &ready.pages, "경로·제목별 상위 10개"))
                (charts::bars("유입 채널", "세션", &ready.channels, "세션 기본 채널 그룹"))
                (charts::bars("기기", "활성 사용자", &ready.devices, "기기 유형"))
                (charts::bars("국가", "활성 사용자", &ready.countries, "상위 10개"))
            }
            (notes(ready))
        }
    }
}

pub fn dashboard_panel(report: &Report) -> Markup {
    html! {
        section aria-labelledby="ga4-dashboard" class="space-y-4" {
            div class="flex flex-wrap items-center justify-between gap-2" {
                h2 id="ga4-dashboard" class="text-lg font-bold" { "방문 분석 · GA4" }
                a href="/admin/analytics" class="text-sm text-accent-text underline" { "28일 상세 리포트" }
            }
            @if let Report::Ready(ready) = report {
                (charts::tiles(ready))
                (charts::trend(&ready.daily, true))
                (notes(ready))
            } @else {
                (unavailable(report))
            }
        }
    }
}

fn notes(ready: &Ready) -> Markup {
    html! {
        @if ready.thresholded {
            p role="status" class="text-sm text-muted" { "Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요." }
        }
        p class="text-xs text-muted" {
            "속성 시간대 " (ready.time_zone.as_deref().unwrap_or("미제공"))
            " · 조회 시각 " (ready.fetched_at)
        }
    }
}
