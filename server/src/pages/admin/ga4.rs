//! GA4 reports for the operator dashboard and analytics page.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, HeaderValue};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use futures_util::{StreamExt, stream};
use maud::{Markup, html};
use rustls::SignatureScheme;
use rustls::pki_types::PrivateKeyDer;
use rustls::pki_types::pem::PemObject;
use serde_json::Value;
use tokio::sync::Semaphore;

use super::format;
use crate::AppState;
use crate::config::Ga4Config;
use crate::pages::cache::{Freshness, Timed};

mod advanced;
mod charts;
mod diagnosis;
mod requests;
#[cfg(test)]
mod tests;
use requests::{Id, Method, Period, Query};

const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const SCOPE: &str = "https://www.googleapis.com/auth/analytics.readonly";
const REQUIRED: [&str; 3] = [
    "GA4_PROPERTY_ID",
    "GA4_SERVICE_ACCOUNT_EMAIL",
    "GA4_SERVICE_ACCOUNT_PRIVATE_KEY",
];
const TIMEOUT: Duration = Duration::from_secs(10);
const BODY_LIMIT: usize = 4 * 1024 * 1024;
const HISTORICAL_TTL: Duration = Duration::from_secs(600);
const REALTIME_TTL: Duration = Duration::from_secs(45);
const REPORT_SLOTS: usize = 10;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) enum Tab {
    #[default]
    Overview,
    Acquisition,
    Behaviour,
    Dropoff,
    Realtime,
}

impl Tab {
    pub(super) const ALL: [Self; 5] = [
        Self::Overview,
        Self::Acquisition,
        Self::Behaviour,
        Self::Dropoff,
        Self::Realtime,
    ];

    pub(super) const fn key(self) -> &'static str {
        match self {
            Self::Overview => "overview",
            Self::Acquisition => "acquisition",
            Self::Behaviour => "behaviour",
            Self::Dropoff => "dropoff",
            Self::Realtime => "realtime",
        }
    }

    pub(super) const fn label(self) -> &'static str {
        match self {
            Self::Overview => "개요",
            Self::Acquisition => "유입",
            Self::Behaviour => "행동",
            Self::Dropoff => "이탈",
            Self::Realtime => "실시간",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) enum Range {
    Week,
    #[default]
    Month,
    Quarter,
}

impl Range {
    pub(super) const ALL: [Self; 3] = [Self::Week, Self::Month, Self::Quarter];

    pub(super) const fn days(self) -> usize {
        match self {
            Self::Week => 7,
            Self::Month => 28,
            Self::Quarter => 90,
        }
    }

    pub(super) const fn key(self) -> &'static str {
        match self {
            Self::Week => "7d",
            Self::Month => "28d",
            Self::Quarter => "90d",
        }
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub(super) struct Selection {
    pub(super) tab: Tab,
    pub(super) range: Range,
}

impl Selection {
    pub(super) fn parse(query: Option<&str>) -> Self {
        let pairs = url::form_urlencoded::parse(query.unwrap_or_default().as_bytes());
        let mut selection = Self::default();
        for (key, value) in pairs {
            match key.as_ref() {
                "tab" => {
                    selection.tab = Tab::ALL
                        .into_iter()
                        .find(|tab| tab.key() == value)
                        .unwrap_or_default()
                }
                "range" => {
                    selection.range = Range::ALL
                        .into_iter()
                        .find(|range| range.key() == value)
                        .unwrap_or_default()
                }
                _ => {}
            }
        }
        selection
    }

    pub(super) fn href(self) -> String {
        format!(
            "/admin/analytics?tab={}&range={}",
            self.tab.key(),
            self.range.key()
        )
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Mode {
    Analytics(Selection),
    Dashboard,
}

impl Mode {
    fn range(self) -> Range {
        match self {
            Self::Dashboard => Range::Month,
            Self::Analytics(selection) => selection.range,
        }
    }
}

pub(in crate::pages) struct Cache {
    historical: [[Timed<Arc<Data>>; 3]; 4],
    dashboard: Timed<Arc<Data>>,
    realtime: Timed<Arc<Data>>,
    requests: Semaphore,
}

impl Cache {
    pub(in crate::pages) fn new() -> Self {
        // Analytics ages independently of edits to the site catalog.
        let freshness = Freshness::default();
        let historical = || Timed::new(HISTORICAL_TTL, &freshness);
        Self {
            historical: std::array::from_fn(|_| std::array::from_fn(|_| historical())),
            dashboard: historical(),
            realtime: Timed::new(REALTIME_TTL, &freshness),
            requests: Semaphore::new(REPORT_SLOTS),
        }
    }

    fn slot(&self, mode: Mode) -> &Timed<Arc<Data>> {
        match mode {
            Mode::Dashboard => &self.dashboard,
            Mode::Analytics(Selection {
                tab: Tab::Realtime, ..
            }) => &self.realtime,
            Mode::Analytics(Selection { tab, range }) => {
                &self.historical[tab as usize][range as usize]
            }
        }
    }

    async fn get_or_load(
        &self,
        mode: Mode,
        load: impl AsyncFnOnce() -> Result<Data, Reason>,
    ) -> Result<Arc<Data>, Reason> {
        self.slot(mode)
            .get_or_load(|| async {
                let data = load().await?;
                if data.reports.values().any(Result::is_ok) {
                    return Ok(Arc::new(data));
                }
                // Use request order, not the hash map's order, to report a total failure.
                let (_, queries) = requests::plan(mode);
                Err(queries
                    .iter()
                    .find_map(|query| data.get(query.id, query.period).err())
                    .unwrap_or(Reason::InvalidResponse))
            })
            .await
    }
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

struct Ready {
    totals: Option<Totals>,
    previous: Option<Totals>,
}

pub(super) enum Report {
    MissingConfig(Vec<&'static str>),
    InvalidConfig,
    Error(Reason),
    Data(Arc<Data>),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Reason {
    Authentication,
    Permission,
    Quota,
    Rejected,
    Configuration,
    Unavailable,
    InvalidResponse,
}

pub(super) async fn report(state: &AppState, mode: Mode) -> Report {
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
    let result = state
        .pages
        .ga4
        .get_or_load(mode, async || {
            let pem = key.expose().replace("\\n", "\n");
            let signer = signer(&pem).ok_or(Reason::Configuration)?;
            let access = bearer(state, email, signer.as_ref()).await?;
            let headers = [
                (AUTHORIZATION, access),
                (CONTENT_TYPE, HeaderValue::from_static("application/json")),
            ];
            let data = load_report(mode, |method, body| {
                let url = format!(
                    "https://analyticsdata.googleapis.com/v1beta/properties/{property}:{}",
                    method.name()
                );
                let headers = &headers;
                // GA4 counts each report in a batch against concurrent quota.
                let weight = body["requests"]
                    .as_array()
                    .map_or(1, |reports| reports.len() as u32);
                async move {
                    let _slot = state
                        .pages
                        .ga4
                        .requests
                        .acquire_many(weight)
                        .await
                        .map_err(|_| Reason::Unavailable)?;
                    google_json(state, &url, headers, body.to_string(), false).await
                }
            })
            .await;
            Ok(data)
        })
        .await;
    match result {
        Ok(data) => Report::Data(data),
        Err(Reason::Configuration) => Report::InvalidConfig,
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
            400 => Reason::Rejected,
            _ => Reason::Unavailable,
        });
    }
    serde_json::from_slice(&bytes).map_err(|_| Reason::InvalidResponse)
}

async fn bearer(
    state: &AppState,
    email: &str,
    signer: &dyn rustls::sign::Signer,
) -> Result<HeaderValue, Reason> {
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
    let mut bearer =
        HeaderValue::from_str(&format!("Bearer {access}")).map_err(|_| Reason::InvalidResponse)?;
    bearer.set_sensitive(true);
    Ok(bearer)
}

fn reason_text(reason: Reason) -> &'static str {
    match reason {
        Reason::Authentication => "Google 인증에 실패했어요. 서비스 계정 키를 확인해 주세요.",
        Reason::Permission => {
            "GA4 접근 권한이 없어요. Data API 활성화와 속성의 서비스 계정 Viewer 권한을 확인해 주세요."
        }
        Reason::Quota => "Google API 할당량에 도달했어요. 잠시 후 다시 조회해 주세요.",
        Reason::Unavailable => "Google Analytics에 연결할 수 없어요. 잠시 후 다시 조회해 주세요.",
        Reason::Configuration => "서비스 계정 설정 형식이 올바르지 않아요.",
        Reason::Rejected => "Google이 이 보고서의 조회 조건을 받아들이지 않았어요.",
        Reason::InvalidResponse => "Google 응답을 검증할 수 없어 통계를 표시하지 않았어요.",
    }
}

/// Connection status and sanitized errors.
fn unavailable(report: &Report) -> Markup {
    let title = match report {
        Report::MissingConfig(_) => "GA4 연결 설정 필요",
        Report::Data(_) => "조회 기간 데이터 없음",
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
                Report::Data(_) => p class="text-sm text-muted" { "Google이 이 기간의 행을 반환하지 않았어요. 수집 상태와 속성을 확인해 주세요. 빈 결과를 0으로 대체하지 않습니다." },
            }
        }
    }
}

fn optional_array<'a>(input: &'a Value, key: &str) -> Result<&'a [Value], Reason> {
    match input.get(key) {
        None => Ok(&[]),
        Some(Value::Array(items)) => Ok(items),
        _ => Err(Reason::InvalidResponse),
    }
}

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

fn parse_metric(name: &str, value: &str) -> Option<f64> {
    let rate = matches!(
        name,
        "engagementRate" | "bounceRate" | "sessionKeyEventRate"
    );
    let fraction = rate || matches!(name, "userEngagementDuration" | "screenPageViewsPerSession");
    if !fraction && (value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit())) {
        return None;
    }
    let value = value.parse::<f64>().ok()?;
    let valid = if rate {
        (0.0..=1.0).contains(&value)
    } else {
        (0.0..(1_u64 << 53) as f64).contains(&value)
    };
    valid.then_some(value)
}

struct Row {
    dimensions: Vec<String>,
    metrics: Vec<f64>,
}

impl Row {
    fn name(&self) -> &str {
        &self.dimensions[0]
    }

    fn count(&self, metric: usize) -> u64 {
        self.metrics[metric] as u64
    }
}

struct Rows {
    rows: Vec<Row>,
    time_zone: Option<String>,
    thresholded: bool,
    limited: bool,
}

fn parse_report(input: &Value, query: Query, method: Method, range: Range) -> Result<Rows, Reason> {
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
    let limited = if let Some(row_count) = input.get("rowCount") {
        let row_count = row_count.as_u64().ok_or(invalid)?;
        let returned = rows.len() as u64;
        if row_count < returned || (query.dimensions.is_empty() && row_count != returned) {
            return Err(invalid);
        }
        row_count > returned
    } else {
        rows.len() == query.limit && !query.dimensions.is_empty()
    };
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::with_capacity(rows.len());
    let mut date_bounds = None::<(time::Date, time::Date)>;
    for row in rows {
        let names = fields(row, "dimensionValues", "value")?;
        let values = fields(row, "metricValues", "value")?;
        if names.len() != query.dimensions.len() || values.len() != query.metrics.len() {
            return Err(invalid);
        }
        if !seen.insert(names.clone()) {
            return Err(invalid);
        }
        if query.dimensions.first() == Some(&"date") {
            let day = date(names[0]).ok_or(invalid)?;
            let (first, last) = date_bounds.get_or_insert((day, day));
            *first = (*first).min(day);
            *last = (*last).max(day);
            if (*last - *first).whole_days() >= range.days() as i64 {
                return Err(invalid);
            }
        }
        if query.id == Id::LiveMinutes && !names[0].parse::<u32>().is_ok_and(|minute| minute < 30) {
            return Err(invalid);
        }
        let metrics = query
            .metrics
            .iter()
            .zip(values)
            .map(|(name, value)| parse_metric(name, value).ok_or(invalid))
            .collect::<Result<_, _>>()?;
        result.push(Row {
            dimensions: names.into_iter().map(str::to_owned).collect(),
            metrics,
        });
    }
    let mut metadata = Rows {
        rows: result,
        time_zone: None,
        thresholded: false,
        limited,
    };
    if let Some(value) = input.get("metadata") {
        let meta = value.as_object().ok_or(invalid)?;
        metadata.time_zone = meta
            .get("timeZone")
            .map(|value| value.as_str().map(str::to_owned).ok_or(invalid))
            .transpose()?;
        metadata.thresholded = meta
            .get("subjectToThresholding")
            .map(|value| value.as_bool().ok_or(invalid))
            .transpose()?
            .unwrap_or(false);
        metadata.limited |= meta
            .get("dataLossFromOtherRow")
            .and_then(Value::as_bool)
            .unwrap_or(false);
    }
    // The Realtime response has no property time zone or thresholding metadata.
    debug_assert!(method != Method::Realtime || query.period == Period::Current);
    Ok(metadata)
}

type Reports = HashMap<(Id, Period), Result<Rows, Reason>>;

pub(super) struct Data {
    reports: Reports,
    fetched_at: String,
}

impl Data {
    fn is_empty(&self) -> bool {
        self.reports
            .values()
            .all(|report| report.as_ref().is_ok_and(|rows| rows.rows.is_empty()))
    }

    fn get(&self, id: Id, period: Period) -> Result<&Rows, Reason> {
        self.reports
            .get(&(id, period))
            .ok_or(Reason::InvalidResponse)?
            .as_ref()
            .map_err(|error| *error)
    }

    fn current(&self, id: Id) -> Result<&Rows, Reason> {
        self.get(id, Period::Current)
    }

    fn previous(&self, id: Id) -> Option<&Rows> {
        self.get(id, Period::Previous).ok()
    }
}

async fn individual<Fut>(
    query: Query,
    method: Method,
    range: Range,
    run: &impl Fn(Method, Value) -> Fut,
) -> Result<Rows, Reason>
where
    Fut: std::future::Future<Output = Result<Value, Reason>>,
{
    let value = run(method, requests::body(method, &[query], range)).await?;
    let value = match method {
        Method::Realtime => &value,
        Method::Batch => {
            let [report] = optional_array(&value, "reports")? else {
                return Err(Reason::InvalidResponse);
            };
            report
        }
    };
    parse_report(value, query, method, range)
}

async fn load_batch<Fut>(
    queries: &[Query],
    range: Range,
    run: &impl Fn(Method, Value) -> Fut,
) -> Vec<Result<Rows, Reason>>
where
    Fut: std::future::Future<Output = Result<Value, Reason>>,
{
    let method = Method::Batch;
    if queries.len() == 1 {
        return vec![individual(queries[0], method, range, run).await];
    }
    let result = run(method, requests::body(method, queries, range)).await;
    match result {
        Ok(value) => {
            let Ok(reports) = optional_array(&value, "reports") else {
                return queries
                    .iter()
                    .map(|_| Err(Reason::InvalidResponse))
                    .collect();
            };
            if reports.len() != queries.len() {
                return queries
                    .iter()
                    .map(|_| Err(Reason::InvalidResponse))
                    .collect();
            }
            reports
                .iter()
                .zip(queries)
                .map(|(value, &query)| parse_report(value, query, method, range))
                .collect()
        }
        // GA4 rejects the entire batch for an incompatible report. Retry those
        // reports individually so the other panels can still show their data.
        Err(Reason::Rejected) => {
            let mut results = Vec::with_capacity(queries.len());
            for &query in queries {
                results.push(individual(query, method, range, run).await);
            }
            results
        }
        Err(error) => queries.iter().map(|_| Err(error)).collect(),
    }
}

async fn load_report<Fut>(mode: Mode, run: impl Fn(Method, Value) -> Fut) -> Data
where
    Fut: std::future::Future<Output = Result<Value, Reason>>,
{
    let (method, queries) = requests::plan(mode);
    let range = mode.range();
    let chunks = match method {
        Method::Batch => requests::BATCH_LIMIT,
        Method::Realtime => 1,
    };
    let groups: Vec<_> = queries.chunks(chunks).map(<[Query]>::to_vec).collect();
    let loaded = stream::iter(groups)
        .map(|queries| {
            let run = &run;
            async move {
                let results = match method {
                    Method::Batch => load_batch(&queries, range, run).await,
                    Method::Realtime => vec![individual(queries[0], method, range, run).await],
                };
                queries
                    .into_iter()
                    .map(|query| (query.id, query.period))
                    .zip(results)
            }
        })
        .buffer_unordered(2)
        .collect::<Vec<_>>()
        .await;
    Data {
        reports: loaded.into_iter().flatten().collect(),
        fetched_at: format::iso(time::OffsetDateTime::now_utc()),
    }
}

fn overview_totals(data: &Data, period: Period) -> Option<Totals> {
    let row = data.get(Id::Totals, period).ok()?.rows.first()?;
    Some(Totals {
        active_users: row.count(0),
        new_users: row.count(1),
        sessions: row.count(2),
        views: row.count(3),
        engagement_seconds: row.metrics[4],
    })
}

fn overview(data: &Data, range: Range, dashboard: bool) -> Markup {
    let ready = Ready {
        totals: overview_totals(data, Period::Current),
        previous: overview_totals(data, Period::Previous),
    };
    let rows = data.current(Id::Daily);
    let mut daily: Vec<_> = rows
        .ok()
        .into_iter()
        .flat_map(|daily| &daily.rows)
        .filter_map(|row| {
            Some(Daily {
                date: date(row.name())?,
                users: row.count(0),
                views: row.count(1),
            })
        })
        .collect();
    daily.sort_unstable_by_key(|row| row.date);

    html! {
        div class="space-y-5" {
            @if let Err(reason) = data.current(Id::Totals) {
                (charts::message("주요 지표", reason_text(reason)))
            } @else {
                (charts::tiles(&ready, range))
                @if let Err(reason) = data.get(Id::Totals, Period::Previous) {
                    p class="text-sm text-muted" role="status" { "이전 기간 · " (reason_text(reason)) }
                }
            }
            @if let Err(reason) = rows {
                (charts::message("일별 방문 추이", reason_text(reason)))
            } @else {
                (charts::trend(&daily, dashboard, range))
            }
            @if !dashboard {
                div class="grid items-start gap-5 xl:grid-cols-2" {
                    @for (id, title, metric, context) in [
                        (Id::Pages, "인기 페이지", "조회수", "경로·제목별 상위 10개"),
                        (Id::Channels, "유입 채널", "세션", "세션 기본 채널 그룹"),
                        (Id::Devices, "기기", "활성 사용자", "기기 유형"),
                        (Id::Countries, "국가", "활성 사용자", "상위 10개"),
                    ] {
                        @match data.current(id) {
                            Ok(rows) => (charts::bars(title, metric, &ranked(&rows.rows), context)),
                            Err(reason) => (charts::message(title, reason_text(reason))),
                        }
                    }
                }
            }
            (notes(data))
        }
    }
}

fn ranked(rows: &[Row]) -> Vec<Ranked> {
    rows.iter()
        .map(|row| Ranked {
            name: row.name().to_owned(),
            path: row.dimensions.get(1).cloned(),
            value: row.count(0),
        })
        .collect()
}

pub(super) fn report_panel(report: &Report, selection: Selection) -> Markup {
    let Report::Data(data) = report else {
        return unavailable(report);
    };
    match selection.tab {
        Tab::Overview if data.is_empty() => unavailable(report),
        Tab::Overview => overview(data, selection.range, false),
        tab => html! {
            div class="space-y-5" {
                (advanced::render(data, tab))
                (notes(data))
            }
        },
    }
}

pub(super) fn dashboard_panel(report: &Report) -> Markup {
    html! {
        section aria-labelledby="ga4-dashboard" class="space-y-4" {
            div class="flex flex-wrap items-center justify-between gap-2" {
                h2 id="ga4-dashboard" class="text-lg font-bold" { "방문 분석 · GA4" }
                a href="/admin/analytics" class="text-sm text-accent-text underline" { "28일 상세 리포트" }
            }
            @if let Report::Data(data) = report && !data.is_empty() {
                (overview(data, Range::Month, true))
            } @else {
                (unavailable(report))
            }
        }
    }
}

fn notes(data: &Data) -> Markup {
    let reports = || {
        data.reports
            .values()
            .filter_map(|result| result.as_ref().ok())
    };
    html! {
        @if reports().any(|report| report.thresholded) {
            p role="status" class="text-sm text-muted" { "Google 개인정보 보호 기준에 따라 일부 데이터가 제한될 수 있어요." }
        }
        p class="text-xs text-muted" {
            @if let Some(zone) = reports().find_map(|report| report.time_zone.as_deref()) {
                "속성 시간대 " (zone) " · "
            }
            "조회 시각 " (data.fetched_at)
        }
    }
}
