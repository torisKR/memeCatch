//! `getAdminGA4Report` of `lib/ga4-admin.ts` and the two panels that show it
//! (`components/admin/ga4-report-panel.tsx`, `ga4-dashboard-panel.tsx`).
//!
//! A service-account JWT (RS256) is exchanged for a token at Google's token
//! endpoint, then the Data API runs two reports for `/admin/analytics` (28
//! days) or five for the dashboard (14 days, today, channels, pages). No
//! Google response body or credential ever reaches the page: every failure
//! is one of five reasons.

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
use crate::AppState;
use crate::config::Ga4Config;

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/analytics.readonly";
const METRICS: [&str; 4] = ["activeUsers", "sessions", "screenPageViews", "eventCount"];
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

/// `GA4Metrics`.
#[derive(Clone, Copy, Default)]
pub struct Metrics {
    pub active_users: u64,
    pub sessions: u64,
    pub screen_page_views: u64,
    pub event_count: u64,
}

impl Metrics {
    fn values(&self) -> [u64; 4] {
        [
            self.active_users,
            self.sessions,
            self.screen_page_views,
            self.event_count,
        ]
    }
}

pub struct Ready {
    totals: Option<Metrics>,
    historical_empty: bool,
    today: Option<Metrics>,
    channels: Vec<(String, Metrics)>,
    pages: Vec<(String, Metrics)>,
    daily: Vec<(String, Metrics)>,
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

/// One parsed report: its rows' dimension value and metrics, and metadata.
struct Parsed {
    rows: Vec<(Option<String>, Metrics)>,
    time_zone: Option<String>,
    thresholded: bool,
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

/// `parseReport`: the schema, the headers, the row counts and each row.
fn parse_report(input: &Value, dimension: &str, limit: usize) -> Result<Parsed, Reason> {
    let invalid = Reason::InvalidResponse;
    let daily = dimension == "date";
    let ranked = !dimension.is_empty() && !daily;
    let object = input.as_object().ok_or(invalid)?;
    let names = |key: &str| -> Result<Option<Vec<String>>, Reason> {
        match object.get(key) {
            None => Ok(None),
            Some(Value::Array(items)) => items
                .iter()
                .map(|item| {
                    item.get("name")
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                        .ok_or(invalid)
                })
                .collect::<Result<Vec<_>, _>>()
                .map(Some),
            Some(_) => Err(invalid),
        }
    };
    let metric_headers = names("metricHeaders")?.ok_or(invalid)?;
    let dimension_headers = names("dimensionHeaders")?.unwrap_or_default();
    let mut rows = Vec::new();
    match object.get("rows") {
        None => {}
        Some(Value::Array(items)) => {
            for item in items {
                let item = item.as_object().ok_or(invalid)?;
                let dimension_values = match item.get("dimensionValues") {
                    None => None,
                    Some(Value::Array(values)) => Some(
                        values
                            .iter()
                            .map(|value| {
                                value
                                    .get("value")
                                    .and_then(Value::as_str)
                                    .map(str::to_owned)
                                    .ok_or(invalid)
                            })
                            .collect::<Result<Vec<_>, _>>()?,
                    ),
                    Some(_) => return Err(invalid),
                };
                let Some(Value::Array(metric_values)) = item.get("metricValues") else {
                    return Err(invalid);
                };
                let metrics = metric_values
                    .iter()
                    .map(|value| value.get("value").and_then(count).ok_or(invalid))
                    .collect::<Result<Vec<_>, _>>()?;
                rows.push((dimension_values, metrics));
            }
        }
        Some(_) => return Err(invalid),
    }
    let row_count = match object.get("rowCount") {
        None => None,
        Some(value) => Some(value.as_u64().ok_or(invalid)?),
    };
    let metadata = match object.get("metadata") {
        None => None,
        Some(Value::Object(metadata)) => Some(metadata),
        Some(_) => return Err(invalid),
    };
    let time_zone = match metadata.and_then(|metadata| metadata.get("timeZone")) {
        None => None,
        Some(Value::String(zone)) => Some(zone.clone()),
        Some(_) => return Err(invalid),
    };
    let thresholded = match metadata.and_then(|metadata| metadata.get("subjectToThresholding")) {
        None => false,
        Some(Value::Bool(flag)) => *flag,
        Some(_) => return Err(invalid),
    };
    if metric_headers.join(",") != METRICS.join(",") || dimension_headers.join(",") != dimension {
        return Err(invalid);
    }
    let length = rows.len() as u64;
    let count_wrong = row_count.is_some_and(|count| {
        if ranked {
            count < length
        } else {
            count != length
        }
    });
    if count_wrong || rows.len() > limit {
        return Err(invalid);
    }
    let mut parsed = Vec::with_capacity(rows.len());
    for (dimension_values, metrics) in rows {
        let dimension_value = match (&dimension_values, dimension.is_empty()) {
            (_, true) => None,
            (Some(values), false) if values.len() == 1 => Some(values[0].clone()),
            _ => return Err(invalid),
        };
        if metrics.len() != METRICS.len()
            || (daily
                && !dimension_value.as_deref().is_some_and(|date| {
                    date.len() == 8 && date.bytes().all(|b| b.is_ascii_digit())
                }))
        {
            return Err(invalid);
        }
        parsed.push((
            dimension_value,
            Metrics {
                active_users: metrics[0],
                sessions: metrics[1],
                screen_page_views: metrics[2],
                event_count: metrics[3],
            },
        ));
    }
    Ok(Parsed {
        rows: parsed,
        time_zone,
        thresholded,
    })
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
    let days: u64 = if mode == Mode::Dashboard { 14 } else { 28 };
    let url =
        format!("https://analyticsdata.googleapis.com/v1beta/properties/{property}:runReport");
    let bearer =
        HeaderValue::from_str(&format!("Bearer {access}")).map_err(|_| Reason::InvalidResponse)?;
    let run = |dimension: &'static str, today: bool, sort: Option<&'static str>| {
        let limit: u64 = if dimension == "date" {
            days
        } else if dimension.is_empty() {
            1
        } else {
            10
        };
        let mut body = json!({
            "dateRanges": [{
                "startDate": if today { "today".to_owned() } else { format!("{days}daysAgo") },
                "endDate": if today { "today" } else { "yesterday" },
            }],
            "metrics": METRICS.iter().map(|name| json!({ "name": name })).collect::<Vec<_>>(),
            "dimensions": if dimension.is_empty() { json!([]) } else { json!([{ "name": dimension }]) },
            "limit": limit.to_string(),
            "keepEmptyRows": true,
        });
        if let Some(sort) = sort {
            body["orderBys"] = json!([{ "metric": { "metricName": sort }, "desc": true }]);
        } else if dimension == "date" {
            body["orderBys"] = json!([{ "dimension": { "dimensionName": "date" } }]);
        }
        let headers = [
            (AUTHORIZATION, bearer.clone()),
            (CONTENT_TYPE, HeaderValue::from_static("application/json")),
        ];
        let url = url.clone();
        async move {
            let value = google_json(state, &url, &headers, body.to_string(), false).await?;
            parse_report(
                &value,
                dimension,
                usize::try_from(limit).unwrap_or(usize::MAX),
            )
        }
    };
    let dashboard = mode == Mode::Dashboard;
    let (summary, daily, today, channels, pages) = tokio::join!(
        run("", false, None),
        run("date", false, None),
        async {
            if dashboard {
                Some(run("", true, None).await)
            } else {
                None
            }
        },
        async {
            if dashboard {
                Some(run("sessionDefaultChannelGroup", false, Some("sessions")).await)
            } else {
                None
            }
        },
        async {
            if dashboard {
                Some(run("pagePath", false, Some("screenPageViews")).await)
            } else {
                None
            }
        },
    );
    // `Promise.all` rejects with the first failure in the order given.
    let (summary, daily) = (summary?, daily?);
    let today = today.transpose()?;
    let channels = channels.transpose()?;
    let pages = pages.transpose()?;
    if summary.rows.is_empty()
        && daily.rows.is_empty()
        && today.as_ref().is_none_or(|today| today.rows.is_empty())
    {
        return Ok(Report::Empty);
    }
    if summary.rows.is_empty() != daily.rows.is_empty() {
        return Err(Reason::InvalidResponse);
    }
    let thresholded = [
        Some(&summary),
        Some(&daily),
        today.as_ref(),
        channels.as_ref(),
        pages.as_ref(),
    ]
    .iter()
    .flatten()
    .any(|report| report.thresholded);
    let named = |report: Option<Parsed>| -> Vec<(String, Metrics)> {
        report
            .map(|report| {
                report
                    .rows
                    .into_iter()
                    .map(|(name, metrics)| (name.unwrap_or_default(), metrics))
                    .collect()
            })
            .unwrap_or_default()
    };
    Ok(Report::Ready(Box::new(Ready {
        totals: summary.rows.first().map(|(_, metrics)| *metrics),
        historical_empty: summary.rows.is_empty(),
        today: today
            .as_ref()
            .and_then(|today| today.rows.first().map(|(_, metrics)| *metrics)),
        daily: daily
            .rows
            .iter()
            .map(|(date, metrics)| {
                let date = date.as_deref().unwrap_or_default();
                (
                    format!("{}-{}-{}", &date[..4], &date[4..6], &date[6..8]),
                    *metrics,
                )
            })
            .collect(),
        time_zone: summary.time_zone.clone(),
        channels: named(channels),
        pages: named(pages),
        thresholded,
        fetched_at: iso_now(),
    })))
}

fn iso_now() -> String {
    format::iso(time::OffsetDateTime::now_utc())
}

const LABELS: [&str; 4] = ["활성 사용자", "세션", "페이지·화면 조회", "이벤트"];

fn number(value: u64) -> String {
    format::count(i64::try_from(value).unwrap_or(i64::MAX))
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

/// `GA4ReportPanel` for a report that is not ready (or ready without
/// totals, which it shows as empty).
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

/// `GA4ReportPanel`.
pub fn report_panel(report: &Report) -> Markup {
    let Report::Ready(ready) = report else {
        return unavailable(report);
    };
    let Some(totals) = ready.totals else {
        return unavailable(report);
    };
    html! {
        div class="space-y-5" {
            p class="text-sm text-muted" { "속성 시간대: " (ready.time_zone.as_deref().unwrap_or("제공되지 않음")) " · 조회 시각: " (ready.fetched_at) }
            @if ready.thresholded {
                p role="status" class="rounded-lg border border-border p-3 text-sm" { "Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요." }
            }
            dl class="grid grid-cols-2 gap-3 lg:grid-cols-4" {
                @for (label, value) in LABELS.iter().zip(totals.values()) {
                    div class="rounded-xl border border-border bg-surface p-4" { dt class="text-sm text-muted" { (label) } dd class="mt-2 text-2xl font-bold tabular-nums" { (number(value)) } }
                }
            }
            div class="overflow-x-auto rounded-xl border border-border bg-surface" {
                table class="w-full text-left text-sm" {
                    caption class="p-4 text-left font-semibold" { "일별 통계 · Google이 반환한 날짜만 표시" }
                    thead { tr class="border-b border-border" { th scope="col" class="p-3" { "날짜" } @for label in LABELS { th scope="col" class="p-3 text-right" { (label) } } } }
                    tbody {
                        @for (date, metrics) in &ready.daily {
                            tr class="border-b border-border last:border-0" {
                                th scope="row" class="whitespace-nowrap p-3 font-normal" { (date) }
                                @for value in metrics.values() { td class="p-3 text-right tabular-nums" { (number(value)) } }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// `GA4DashboardPanel`.
pub fn dashboard_panel(report: &Report) -> Markup {
    let Report::Ready(ready) = report else {
        return report_panel(report);
    };
    let max_views = ready
        .daily
        .iter()
        .map(|(_, metrics)| metrics.screen_page_views)
        .max()
        .unwrap_or(0)
        .max(1);
    let cards = [
        (
            "오늘 방문 세션",
            ready.today.map(|today| today.sessions),
            true,
        ),
        (
            "오늘 활성 사용자",
            ready.today.map(|today| today.active_users),
            true,
        ),
        (
            "오늘 페이지·화면 조회",
            ready.today.map(|today| today.screen_page_views),
            true,
        ),
        (
            "최근 14일 활성 사용자",
            ready.totals.map(|totals| totals.active_users),
            false,
        ),
    ];
    html! {
        section aria-labelledby="ga4-dashboard" class="space-y-4" {
            div class="flex flex-wrap items-center justify-between gap-2" {
                h2 id="ga4-dashboard" class="text-lg font-bold" { "방문 분석 · GA4" }
                a href="/admin/analytics" class="text-sm text-accent-text underline" { "28일 상세 리포트" }
            }
            p class="text-sm text-muted" { "속성 시간대: " (ready.time_zone.as_deref().unwrap_or("제공되지 않음")) " · 조회 시각: " (ready.fetched_at) }
            p class="text-sm text-muted" { "오늘은 집계 중인 부분 데이터이며 처리 지연으로 변경될 수 있어요. 실시간 접속자 수가 아닌 GA4 보고서 세션입니다. 최근 14일은 어제까지의 날짜를 기준으로 합니다." }
            @if ready.thresholded {
                p role="status" class="text-sm text-muted" { "Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요." }
            }
            dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" {
                @for (label, value, today) in cards {
                    div class="rounded-xl border border-border bg-surface p-5" {
                        dt class="text-sm text-muted" { (label) }
                        dd class="mt-2 text-2xl font-bold tabular-nums" {
                            @match value { Some(value) => (number(value)), None => (if today { "오늘 데이터 없음" } else { "기간 데이터 없음" }) }
                        }
                    }
                }
            }
            div class="rounded-xl border border-border bg-surface p-5" {
                h3 class="font-bold" { "최근 14일 페이지·화면 조회 추이 · 어제까지" }
                @if ready.historical_empty { p class="mt-2 text-sm text-muted" { "기간 데이터 없음" } }
                p class="mt-1 text-sm text-muted" { "GA4 screenPageViews · Google이 반환한 날짜만 표시하며 누락 날짜를 0으로 채우지 않습니다." }
                div aria-hidden="true" class="mt-4 flex h-24 items-end gap-1" {
                    @for (date, metrics) in &ready.daily {
                        @let views = metrics.screen_page_views;
                        @let floor = if views > 0 { 3.0 } else { 1.0 };
                        @let height = f64::max(floor, views as f64 / max_views as f64 * 88.0);
                        div class="flex-1 rounded-t bg-accent-strong/80" style=(format!("height:{}px", crate::routes::js_json::number(height))) title=(format!("{date} · {views}")) {}
                    }
                }
                details class="mt-3 text-sm" {
                    summary class="cursor-pointer" { "날짜별 수치 보기" }
                    div class="overflow-x-auto" {
                        table class="mt-2 w-full text-left" {
                            caption class="sr-only" { "GA4 최근 14일 일별 조회·세션" }
                            thead { tr { th scope="col" { "날짜" } th scope="col" { "페이지·화면 조회" } th scope="col" { "세션" } } }
                            tbody {
                                @for (date, metrics) in &ready.daily {
                                    tr { th scope="row" class="py-1 text-left font-normal" { (date) } td { (number(metrics.screen_page_views)) } td { (number(metrics.sessions)) } }
                                }
                            }
                        }
                    }
                }
                div class="mt-2 flex justify-between text-xs text-muted" {
                    span { (ready.daily.first().map_or("", |(date, _)| date.as_str())) }
                    span { (ready.daily.last().map_or("", |(date, _)| date.as_str())) }
                }
            }
            div class="grid gap-4 lg:grid-cols-2" {
                (ranked("유입 채널", &ready.channels, "세션", |metrics| metrics.sessions))
                (ranked("인기 페이지", &ready.pages, "페이지·화면 조회", |metrics| metrics.screen_page_views))
            }
        }
    }
}

fn ranked(
    title: &str,
    rows: &[(String, Metrics)],
    label: &str,
    metric: fn(&Metrics) -> u64,
) -> Markup {
    html! {
        div class="min-w-0 rounded-xl border border-border bg-surface p-5" {
            h3 class="font-bold" { (title) " · 최근 14일 상위 10개" }
            @if rows.is_empty() {
                p class="mt-2 text-sm text-muted" { "반환된 데이터가 없어요." }
            } @else {
                div class="overflow-x-auto" {
                    table class="mt-3 w-full text-left text-sm" {
                        thead { tr { th scope="col" { (title) } th scope="col" class="text-right" { (label) } } }
                        tbody {
                            @for (name, metrics) in rows {
                                tr class="border-t border-border" { th scope="row" class="break-all py-2 pr-3 text-left font-normal" { (name) } td class="text-right tabular-nums" { (number(metric(metrics))) } }
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

    fn report(rows: Value, dimension: Option<&str>) -> Value {
        let mut value = json!({
            "metricHeaders": METRICS.iter().map(|name| json!({ "name": name })).collect::<Vec<_>>(),
            "rows": rows,
            "metadata": { "timeZone": "Asia/Seoul" },
        });
        if let Some(dimension) = dimension {
            value["dimensionHeaders"] = json!([{ "name": dimension }]);
        }
        value
    }

    fn row(date: Option<&str>, values: [&str; 4]) -> Value {
        let metrics: Vec<Value> = values
            .iter()
            .map(|value| json!({ "value": value }))
            .collect();
        match date {
            Some(date) => {
                json!({ "dimensionValues": [{ "value": date }], "metricValues": metrics })
            }
            None => json!({ "metricValues": metrics }),
        }
    }

    #[test]
    fn reports_are_checked_as_the_typescript_checks_them() {
        let daily = report(
            json!([row(Some("20261123"), ["1", "2", "3", "4"])]),
            Some("date"),
        );
        let parsed = parse_report(&daily, "date", 28).expect("valid");
        assert_eq!(parsed.rows[0].1.screen_page_views, 3);
        assert_eq!(parsed.time_zone.as_deref(), Some("Asia/Seoul"));
        // A date that is not eight digits, a count that is not digits, a
        // missing dimension header, and more rows than asked.
        assert!(
            parse_report(
                &report(
                    json!([row(Some("2026-11-23"), ["1", "2", "3", "4"])]),
                    Some("date")
                ),
                "date",
                28
            )
            .is_err()
        );
        assert!(
            parse_report(
                &report(json!([row(None, ["1", "x", "3", "4"])]), None),
                "",
                1
            )
            .is_err()
        );
        assert!(parse_report(&report(json!([]), None), "date", 28).is_err());
        assert!(
            parse_report(
                &report(
                    json!([
                        row(None, ["1", "2", "3", "4"]),
                        row(None, ["1", "2", "3", "4"])
                    ]),
                    None
                ),
                "",
                1
            )
            .is_err()
        );
        let mut counted = report(json!([row(None, ["1", "2", "3", "4"])]), None);
        counted["rowCount"] = json!(2);
        assert!(parse_report(&counted, "", 1).is_err());
        let mut ranked = report(
            json!([row(Some("/"), ["1", "2", "3", "4"])]),
            Some("pagePath"),
        );
        ranked["rowCount"] = json!(40);
        assert!(parse_report(&ranked, "pagePath", 10).is_ok());
    }

    #[test]
    fn the_configuration_checks_match() {
        assert!(is_property("123456"));
        assert!(!is_property("0123"));
        assert!(!is_property(" 123"));
        assert!(is_service_account(
            "reporter@project-1.iam.gserviceaccount.com"
        ));
        assert!(!is_service_account("reporter@example.com"));
        assert!(!is_service_account("a b@x.gserviceaccount.com"));
        assert!(signer("not a key").is_none());
        let config = Ga4Config {
            property_id: Some(" ".to_owned()),
            email: Some("x".to_owned()),
            private_key: None,
        };
        assert_eq!(
            missing(&config),
            vec!["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_PRIVATE_KEY"]
        );
    }
}
