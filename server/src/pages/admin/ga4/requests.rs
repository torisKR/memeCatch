//! Report catalog shared by the server, fixture tests and the ops request checker.

use serde_json::{Value, json};

use super::{Mode, Range, Selection, Tab};

pub(super) const BATCH_LIMIT: usize = 5;
pub(super) const TOP: usize = 10;
pub(super) const CANDIDATES: usize = 250;
pub(super) const CHANNEL_TREND_LIMIT: usize = 32 * 90;
pub(super) const ACTIONS: [&str; 9] = [
    "meme_view",
    "copy",
    "share_click",
    "quiz_start",
    "quiz_complete",
    "quiz_share",
    "random_meme",
    "context_nav",
    "meme_contribution_submitted",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(super) enum Id {
    Totals,
    Daily,
    Pages,
    Channels,
    Devices,
    Countries,
    ChannelTrend,
    Sources,
    SearchEngines,
    Referrals,
    Social,
    Campaigns,
    FirstTouch,
    Returning,
    SourceLandings,
    Landings,
    Actions,
    KeyEvents,
    SiteSearch,
    Scroll,
    SiteBounce,
    PageEngagement,
    BounceDevice,
    BounceOs,
    BounceBrowser,
    BounceEnvironment,
    BounceSource,
    MissingPaths,
    MissingReferrers,
    Outbound,
    LiveTotal,
    LiveMinutes,
    LivePages,
    LiveCountries,
    LiveDevices,
}

const OVERVIEW: &[Id] = &[
    Id::Totals,
    Id::Daily,
    Id::Pages,
    Id::Channels,
    Id::Devices,
    Id::Countries,
];
const ACQUISITION: &[Id] = &[
    Id::ChannelTrend,
    Id::Sources,
    Id::SearchEngines,
    Id::Referrals,
    Id::Social,
    Id::Campaigns,
    Id::FirstTouch,
    Id::Returning,
    Id::SourceLandings,
];
const BEHAVIOUR: &[Id] = &[
    Id::Landings,
    Id::Totals,
    Id::Actions,
    Id::KeyEvents,
    Id::SiteSearch,
    Id::Scroll,
];
const DROPOFF: &[Id] = &[
    Id::Landings,
    Id::SiteBounce,
    Id::PageEngagement,
    Id::BounceDevice,
    Id::BounceOs,
    Id::BounceBrowser,
    Id::BounceEnvironment,
    Id::BounceSource,
    Id::MissingPaths,
    Id::MissingReferrers,
    Id::Outbound,
];
const REALTIME: &[Id] = &[
    Id::LiveTotal,
    Id::LiveMinutes,
    Id::LivePages,
    Id::LiveCountries,
    Id::LiveDevices,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Method {
    Batch,
    Realtime,
}

impl Method {
    pub(super) const fn name(self) -> &'static str {
        match self {
            Self::Batch => "batchRunReports",
            Self::Realtime => "runRealtimeReport",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(super) enum Period {
    Current,
    Previous,
}

#[derive(Clone, Copy)]
pub(super) struct Query {
    pub(super) id: Id,
    pub(super) period: Period,
    pub(super) dimensions: &'static [&'static str],
    pub(super) metrics: &'static [&'static str],
    pub(super) order: Order,
    pub(super) limit: usize,
    filter: Option<fn() -> Value>,
}

#[derive(Clone, Copy)]
pub(super) enum Order {
    Metric(usize),
    Dimension(bool),
}

impl Id {
    pub(super) fn query(self, period: Period, range: Range) -> Query {
        use Id::*;
        let metric = Order::Metric(0);
        let date = Order::Dimension(false);
        let active = &["activeUsers"];
        let events = &["eventCount"];
        let sessions = &["sessions"];
        let bounce = &["sessions", "bounceRate"];
        let (dimensions, metrics, order, limit): (&[_], &[_], _, _) = match self {
            Totals => (
                &[],
                &[
                    "activeUsers",
                    "newUsers",
                    "sessions",
                    "screenPageViews",
                    "userEngagementDuration",
                ],
                metric,
                1,
            ),
            Daily => (
                &["date"],
                &["activeUsers", "screenPageViews"],
                date,
                range.days(),
            ),
            Pages => (
                &["pageTitle", "pagePath"],
                &["screenPageViews"],
                metric,
                TOP,
            ),
            Channels => (&["sessionDefaultChannelGroup"], sessions, metric, TOP),
            Devices | LiveDevices => (&["deviceCategory"], active, metric, TOP),
            Countries | LiveCountries => (&["country"], active, metric, TOP),
            ChannelTrend => (
                &["date", "sessionDefaultChannelGroup"],
                sessions,
                date,
                CHANNEL_TREND_LIMIT / 90 * range.days(),
            ),
            Sources => (
                &["sessionSourceMedium"],
                &[
                    "sessions",
                    "activeUsers",
                    "engagementRate",
                    "userEngagementDuration",
                    "sessionKeyEventRate",
                ],
                metric,
                CANDIDATES,
            ),
            SearchEngines | Referrals | Social => (
                &["sessionSource"],
                sessions,
                metric,
                if self == SearchEngines {
                    CANDIDATES
                } else {
                    TOP
                },
            ),
            Campaigns => (
                &["sessionCampaignName", "sessionSourceMedium"],
                sessions,
                metric,
                TOP,
            ),
            FirstTouch => (&["firstUserSourceMedium"], &["newUsers"], metric, TOP),
            Returning => (&["sessionSourceMedium"], sessions, metric, TOP),
            SourceLandings => (
                &["sessionSourceMedium", "landingPage"],
                sessions,
                metric,
                500,
            ),
            Landings => (
                &["landingPage"],
                &[
                    "sessions",
                    "engagementRate",
                    "bounceRate",
                    "userEngagementDuration",
                    "screenPageViewsPerSession",
                ],
                metric,
                CANDIDATES,
            ),
            Actions => (
                &["date", "eventName"],
                events,
                date,
                ACTIONS.len() * range.days(),
            ),
            KeyEvents => (
                &["date", "eventName"],
                &["keyEvents"],
                date,
                32 * range.days(),
            ),
            SiteSearch => (&["searchTerm"], events, metric, TOP),
            Scroll => (&["pagePath", "eventName"], events, metric, 500),
            SiteBounce => (&[], bounce, metric, 1),
            PageEngagement => (
                &["pagePath"],
                &["screenPageViews", "activeUsers", "userEngagementDuration"],
                metric,
                CANDIDATES,
            ),
            BounceDevice => (&["deviceCategory"], bounce, metric, 15),
            BounceOs => (&["operatingSystem"], bounce, metric, 30),
            BounceBrowser => (&["browser"], bounce, metric, 50),
            BounceEnvironment => (&["deviceCategory", "browser"], bounce, metric, 100),
            BounceSource => (&["sessionSourceMedium"], bounce, metric, CANDIDATES),
            MissingPaths => (&["pagePath"], events, metric, TOP),
            MissingReferrers => (&["pageReferrer"], events, metric, TOP),
            Outbound => (&["linkDomain"], events, metric, TOP),
            LiveTotal => (&[], active, metric, 1),
            LiveMinutes => (&["minutesAgo"], active, Order::Dimension(true), 30),
            LivePages => (&["unifiedScreenName"], active, metric, TOP),
        };
        let filter: Option<fn() -> Value> = match self {
            SearchEngines => Some(|| exact("sessionDefaultChannelGroup", "Organic Search")),
            Referrals => Some(|| exact("sessionDefaultChannelGroup", "Referral")),
            Social => Some(|| {
                one_of(
                    "sessionDefaultChannelGroup",
                    &["Organic Social", "Paid Social"],
                )
            }),
            Campaigns => Some(
                || json!({"notExpression": one_of("sessionCampaignName", &["", "(not set)", "(not provided)", "(organic)", "(direct)", "(referral)", "(none)", "(data not available)"])}),
            ),
            Returning => Some(|| exact("newVsReturning", "returning")),
            SourceLandings => {
                Some(|| json!({"notExpression": one_of("landingPage", &["", "(not set)"])}))
            }
            Actions => Some(|| one_of("eventName", &ACTIONS)),
            SiteSearch => Some(|| {
                and([
                    exact("eventName", "view_search_results"),
                    json!({"notExpression": one_of("searchTerm", &["", "(not set)"])}),
                ])
            }),
            Scroll => Some(|| one_of("eventName", &["page_view", "scroll"])),
            MissingPaths | MissingReferrers => Some(|| {
                and([
                    exact("eventName", "page_view"),
                    one_of(
                        "pageTitle",
                        &[
                            crate::pages::not_found::TITLE,
                            &format!("{} | 밈캐치", crate::pages::not_found::TITLE),
                            crate::standalone::not_found::TITLE,
                        ],
                    ),
                ])
            }),
            Outbound => Some(|| and([exact("eventName", "click"), exact("outbound", "true")])),
            _ => None,
        };
        Query {
            id: self,
            period,
            dimensions,
            metrics,
            order,
            limit,
            filter,
        }
    }
}

fn exact(field: &str, value: &str) -> Value {
    json!({"filter": {"fieldName": field, "stringFilter": {"matchType": "EXACT", "value": value}}})
}

fn one_of(field: &str, values: &[&str]) -> Value {
    json!({"filter": {"fieldName": field, "inListFilter": {"values": values}}})
}

fn and<const N: usize>(expressions: [Value; N]) -> Value {
    json!({"andGroup": {"expressions": expressions.as_slice()}})
}

impl Query {
    fn body(self, method: Method, range: Range) -> Value {
        let mut body = json!({
            "dimensions": self.dimensions.iter().map(|name| json!({"name": name})).collect::<Vec<_>>(),
            "metrics": self.metrics.iter().map(|name| json!({"name": name})).collect::<Vec<_>>(),
            "limit": self.limit.to_string(),
            "returnPropertyQuota": true,
        });
        if !self.dimensions.is_empty() {
            body["orderBys"] = match self.order {
                Order::Metric(metric) => json!([
                    {"metric": {"metricName": self.metrics[metric]}, "desc": true},
                    {"dimension": {"dimensionName": self.dimensions[0]}},
                ]),
                Order::Dimension(desc) => json!([
                    {"dimension": {
                        "dimensionName": self.dimensions[0],
                        "orderType": if method == Method::Realtime { "NUMERIC" } else { "ALPHANUMERIC" }
                    }, "desc": desc},
                ]),
            };
        }
        if let Some(filter) = self.filter {
            body["dimensionFilter"] = filter();
        }
        match method {
            Method::Batch => {
                let days = range.days();
                let (start, end) = match self.period {
                    Period::Current => (format!("{days}daysAgo"), "yesterday".to_owned()),
                    Period::Previous => (
                        format!("{}daysAgo", days * 2),
                        format!("{}daysAgo", days + 1),
                    ),
                };
                body["dateRanges"] = json!([{"startDate": start, "endDate": end}]);
            }
            Method::Realtime => {
                // Default GA4 realtime minute range is 29 minutes ago through the current minute.
            }
        }
        body
    }
}

pub(super) fn body(method: Method, queries: &[Query], range: Range) -> Value {
    match method {
        Method::Batch => {
            json!({"requests": queries.iter().map(|q| q.body(method, range)).collect::<Vec<_>>()})
        }
        Method::Realtime => queries[0].body(method, range),
    }
}

pub(super) fn plan(mode: Mode) -> (Method, Vec<Query>) {
    let selection = match mode {
        Mode::Analytics(selection) => selection,
        Mode::Dashboard => Selection::default(),
    };
    let (method, ids) = match (mode, selection.tab) {
        (Mode::Dashboard, _) => (Method::Batch, &OVERVIEW[..2]),
        (_, Tab::Overview) => (Method::Batch, OVERVIEW),
        (_, Tab::Acquisition) => (Method::Batch, ACQUISITION),
        (_, Tab::Behaviour) => (Method::Batch, BEHAVIOUR),
        (_, Tab::Dropoff) => (Method::Batch, DROPOFF),
        (_, Tab::Realtime) => (Method::Realtime, REALTIME),
    };
    let mut queries: Vec<_> = ids
        .iter()
        .map(|id| id.query(Period::Current, selection.range))
        .collect();
    if method == Method::Batch {
        queries.extend(
            ids.iter()
                .filter(|id| selection.tab != Tab::Overview || **id == Id::Totals)
                .map(|id| id.query(Period::Previous, selection.range)),
        );
    }
    (method, queries)
}
