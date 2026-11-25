use std::cell::RefCell;
use std::path::PathBuf;

use serde_json::json;

use super::super::dashboard::analytics_main;
use super::*;

const OVERVIEW: Mode = Mode::Analytics(Selection {
    tab: Tab::Overview,
    range: Range::Month,
});

fn row(dimensions: &[&str], metrics: &[&str]) -> Value {
    json!({
        "dimensionValues": dimensions.iter().map(|value| json!({ "value": value })).collect::<Vec<_>>(),
        "metricValues": metrics.iter().map(|value| json!({ "value": value })).collect::<Vec<_>>(),
    })
}

fn response(request: &Value, rows: Vec<Value>) -> Value {
    json!({
        "metricHeaders": request["metrics"],
        "dimensionHeaders": request["dimensions"],
        "rowCount": rows.len(),
        "rows": rows,
        "metadata": { "timeZone": "Asia/Seoul" }
    })
}

fn rank(values: &[(&str, &str)]) -> Vec<Value> {
    values
        .iter()
        .map(|(name, count)| row(&[name], &[count]))
        .collect()
}

fn fixture(query: Query) -> Vec<Value> {
    use Id::*;
    let previous = query.period == Period::Previous;
    match query.id {
        Totals if previous => vec![row(&[], &["3200", "2800", "5100", "5600", "153600"])],
        Totals => vec![row(&[], &["3800", "3100", "4920", "6200", "243200.25"])],
        Daily | ChannelTrend | Actions | KeyEvents => {
            let days = if query.id == Daily { query.limit } else { 28 };
            let start = date(if previous { "20260930" } else { "20261028" }).unwrap();
            (0..days)
                .filter(|day| *day != 9)
                .flat_map(|day| {
                    let date = (start + time::Duration::days(day as i64))
                        .to_string()
                        .replace('-', "");
                    match query.id {
                        Daily => {
                            let users = if day == 27 {
                                218
                            } else {
                                102 + day * 3 + (day * 13) % 53
                            };
                            let views = if day == 27 {
                                362
                            } else {
                                158 + day * 5 + (day * 19) % 91
                            };
                            vec![row(&[&date], &[&users.to_string(), &views.to_string()])]
                        }
                        ChannelTrend => [
                            "Organic Search",
                            "Direct",
                            "Organic Social",
                            "Referral",
                            "Paid Search",
                            "Organic Video",
                        ]
                        .into_iter()
                        .enumerate()
                        .map(|(i, name)| {
                            let count = ((135 + (day * (17 + i)) % 80) / (i + 1))
                                .saturating_sub(usize::from(previous) * 9);
                            row(&[&date, name], &[&count.to_string()])
                        })
                        .collect(),
                        KeyEvents => vec![row(
                            &[&date, "quiz_complete"],
                            &[&(9 + day % 7).to_string()],
                        )],
                        _ => requests::ACTIONS
                            .into_iter()
                            .enumerate()
                            .map(|(i, name)| {
                                let count = ((100 + (day * (17 + i)) % 73) / (i + 1))
                                    .saturating_sub(usize::from(previous) * 8);
                                row(&[&date, name], &[&count.to_string()])
                            })
                            .collect(),
                    }
                })
                .collect()
        }
        Pages => [
            ("밈캐치 · 오늘의 밈", "/", "2430"),
            ("인기 밈 모아보기", "/explore", "1180"),
            ("밈 용어 사전", "/glossary", "720"),
            ("오늘의 밈 퀴즈", "/daily-quiz", "516"),
            ("커뮤니티", "/community", "365"),
            ("고양이 & 밈", "/memes/cat", "286"),
            ("밈 타임라인", "/timeline", "224"),
            ("저장한 밈", "/saved", "194"),
            ("신조어 모아보기", "/slang", "158"),
            ("밈 제보하기", "/contribute", "141"),
        ]
        .into_iter()
        .map(|(title, path, count)| row(&[title, path], &[count]))
        .collect(),
        Channels => rank(&[
            ("Organic Search", "2910"),
            ("Direct", "1180"),
            ("Organic Social", "490"),
            ("Referral", "230"),
            ("Organic Video", "79"),
        ]),
        Devices => rank(&[("mobile", "2890"), ("desktop", "970"), ("tablet", "56")]),
        Countries => rank(&[
            ("South Korea", "3340"),
            ("United States", "198"),
            ("Japan", "78"),
            ("Canada", "66"),
        ]),
        Sources => vec![
            row(
                &["google / organic"],
                &[
                    if previous { "1800" } else { "2300" },
                    "2000",
                    "0.53",
                    "114000",
                    "0.15",
                ],
            ),
            row(
                &["(direct) / (none)"],
                &["1000", "790", "0.55", "82000", "0.12"],
            ),
            row(
                &["naver / organic"],
                &["760", "662", "0.29", "13800", "0.07"],
            ),
            row(
                &["instagram.com / referral"],
                &["430", "398", "0.48", "18600", "0.13"],
            ),
            row(&["daum / organic"], &["220", "212", "0.48", "8200", "0.08"]),
        ],
        SearchEngines => rank(&[
            ("google", "2270"),
            ("naver", "760"),
            ("search.naver.com", "23"),
            ("daum", "220"),
            ("bing", "71"),
            ("duckduckgo", "36"),
        ]),
        Referrals => rank(&[
            ("m.blog.naver.com", "148"),
            ("tistory.com", "94"),
            ("meme-board.example", "61"),
        ]),
        Social => rank(&[
            ("instagram.com", "430"),
            ("tiktok.com", "240"),
            ("x.com", "163"),
            ("youtube.com", "89"),
        ]),
        Campaigns => vec![
            row(&["퀴즈 출시", "quiz / share"], &["242"]),
            row(&["인스타 릴스", "instagram / social"], &["143"]),
        ],
        FirstTouch => rank(&[
            ("google / organic", "1642"),
            ("naver / organic", "560"),
            ("(direct) / (none)", "410"),
        ]),
        Returning => rank(&[
            ("(direct) / (none)", "584"),
            ("google / organic", "396"),
            ("naver / organic", "133"),
        ]),
        SourceLandings => [
            ("google / organic", "/memes/고양이", "860"),
            ("(direct) / (none)", "/", "704"),
            ("naver / organic", "/glossary", "470"),
            ("instagram.com / referral", "/daily-quiz", "236"),
            ("daum / organic", "/glossary", "211"),
            ("google / organic", "/explore", "184"),
            ("naver / organic", "/memes/고양이", "94"),
            ("google / organic", "/", "80"),
        ]
        .into_iter()
        .map(|(source, path, count)| row(&[source, path], &[count]))
        .collect(),
        Landings => vec![
            row(&["/"], &["1300", "0.60", "0.40", "92000", "1.46"]),
            row(&["/glossary"], &["1080", "0.26", "0.74", "9828", "1.12"]),
            row(&["/explore"], &["830", "0.67", "0.33", "42700", "2.28"]),
            row(&["/daily-quiz"], &["480", "0.71", "0.29", "42000", "1.87"]),
            row(&["/memes/고양이"], &["370", "0.29", "0.71", "7700", "1.13"]),
            row(&["/tiny"], &["29", "0", "1", "0", "1"]),
        ],
        SiteSearch => rank(&[
            ("고양이", "312"),
            ("요즘 유행하는 밈", "193"),
            ("유행어", "127"),
            ("짤", "95"),
        ]),
        Scroll => vec![
            row(&["/explore", "page_view"], &["2120"]),
            row(&["/explore", "scroll"], &["890"]),
            row(&["/glossary", "page_view"], &["1430"]),
            row(&["/glossary", "scroll"], &["631"]),
            row(&["/", "page_view"], &["1400"]),
            row(&["/", "scroll"], &["598"]),
            row(&["/daily-quiz", "page_view"], &["720"]),
            row(&["/daily-quiz", "scroll"], &["184"]),
        ],
        SiteBounce => vec![row(&[], &["4920", if previous { "0.49" } else { "0.52" }])],
        PageEngagement => vec![
            row(&["/glossary"], &["1480", "920", "8280"]),
            row(&["/memes/고양이"], &["920", "720", "10080"]),
            row(&["/past-entry"], &["860", "530", "10600"]),
            row(&["/today"], &["420", "410", "13530"]),
        ],
        BounceDevice => vec![
            row(&["mobile"], &["3720", "0.63"]),
            row(&["desktop"], &["1000", "0.35"]),
            row(&["tablet"], &["200", "0.43"]),
        ],
        BounceOs => vec![
            row(&["iOS"], &["2110", "0.73"]),
            row(&["Android"], &["1640", "0.50"]),
            row(&["Windows"], &["760", "0.34"]),
            row(&["macOS"], &["410", "0.31"]),
        ],
        BounceBrowser => vec![
            row(&["Chrome"], &["2300", "0.44"]),
            row(&["Safari"], &["1730", "0.75"]),
            row(&["Samsung Internet"], &["470", "0.52"]),
        ],
        BounceEnvironment => vec![
            row(&["mobile", "Safari"], &["1600", "0.78"]),
            row(&["mobile", "Chrome"], &["1280", "0.48"]),
            row(&["desktop", "Chrome"], &["590", "0.35"]),
        ],
        BounceSource => vec![
            row(&["google / organic"], &["2300", "0.47"]),
            row(&["(direct) / (none)"], &["1000", "0.45"]),
            row(&["naver / organic"], &["760", "0.71"]),
            row(&["instagram.com / referral"], &["430", "0.52"]),
        ],
        MissingPaths => rank(&[
            ("/memes/old-slug", "84"),
            ("/abc", "27"),
            ("/en/old-meme", "18"),
        ]),
        MissingReferrers => rank(&[
            ("https://search.naver.com/search?stub=never-shown", "51"),
            ("https://catchmeme.example/glossary", "25"),
            ("(not set)", "13"),
        ]),
        Outbound => rank(&[
            ("youtube.com", "972"),
            ("tiktok.com", "348"),
            ("instagram.com", "259"),
            ("x.com", "108"),
        ]),
        LiveTotal => vec![row(&[], &["58"])],
        LiveMinutes => (0..30)
            .filter(|minute| *minute != 9)
            .map(|minute| {
                row(
                    &[&format!("{minute:02}")],
                    &[&(4 + (minute * 7) % 9 + (29 - minute) / 5).to_string()],
                )
            })
            .collect(),
        LivePages => rank(&[
            ("밈캐치 · 오늘의 밈", "26"),
            ("오늘의 밈 퀴즈", "14"),
            ("밈 용어 사전", "12"),
            ("고양이 밈", "9"),
        ]),
        LiveCountries => rank(&[
            ("South Korea", "47"),
            ("United States", "6"),
            ("Japan", "3"),
            ("Canada", "2"),
        ]),
        LiveDevices => rank(&[("mobile", "41"), ("desktop", "16"), ("tablet", "1")]),
    }
}

fn stub(mode: Mode, method: Method, body: &Value, empty: bool) -> Value {
    let (expected, queries) = requests::plan(mode);
    assert_eq!(method, expected);
    let single = |request: &Value| {
        let query = queries
            .iter()
            .copied()
            .find(|q| {
                let actual = requests::body(method, &[*q], mode.range());
                let actual = if method == Method::Batch {
                    &actual["requests"][0]
                } else {
                    &actual
                };
                actual == request
            })
            .expect("known request");
        response(request, if empty { vec![] } else { fixture(query) })
    };
    match method {
        Method::Batch => {
            json!({"reports": body["requests"].as_array().unwrap().iter().map(single).collect::<Vec<_>>() })
        }
        Method::Realtime => single(body),
    }
}

async fn mocked(mode: Mode) -> Data {
    load_report(mode, |method, body| {
        std::future::ready(Ok(stub(mode, method, &body, false)))
    })
    .await
}

fn mode(tab: Tab) -> Mode {
    Mode::Analytics(Selection {
        tab,
        range: Range::Month,
    })
}

fn page(data: Data, tab: Tab) -> String {
    analytics_main(
        &Report::Data(Arc::new(data)),
        Selection {
            tab,
            range: Range::Month,
        },
    )
    .into_string()
}

#[tokio::test]
async fn overview_keeps_tiles_rankings_and_chart_accessibility() {
    let report = page(mocked(OVERVIEW).await, Tab::Overview);
    assert_eq!(report.matches("<svg").count(), 5);
    assert_eq!(report.matches("<details").count(), 5);
    assert_eq!(report.matches("role=\"img\" aria-label=").count(), 5);
    for expected in [
        "3,800",
        "3,100",
        "4,920",
        "6,200",
        "1분 4초",
        "+18.8%",
        "−3.5%",
        "11/24",
        "218명",
        "362회",
        "집계가 없는 날짜",
        "2,430",
        "고양이 &amp; 밈",
        "/memes/cat",
        "/contribute",
        "자연 검색",
        "2,910",
        "모바일",
        "2,890",
        "대한민국",
        "3,340",
    ] {
        assert!(report.contains(expected), "missing {expected}");
    }
    for series in report.split("class=\"ga4-series ").skip(1) {
        let path = series
            .split_once(" d=\"")
            .unwrap()
            .1
            .split_once('"')
            .unwrap()
            .0;
        assert_eq!(
            path.matches('M').count(),
            2,
            "a missing date breaks the line"
        );
    }
}

#[tokio::test]
async fn dashboard_uses_one_batch_and_omits_rankings() {
    let requests = RefCell::new(Vec::new());
    let data = load_report(Mode::Dashboard, |method, body| {
        let result = stub(Mode::Dashboard, method, &body, false);
        requests.borrow_mut().push(body);
        std::future::ready(Ok(result))
    })
    .await;
    let requests = requests.into_inner();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0]["requests"].as_array().unwrap().len(), 3);
    let panel = dashboard_panel(&Report::Data(Arc::new(data))).into_string();
    assert_eq!(panel.matches("<svg").count(), 1);
    assert!(panel.contains("ga4-trend-compact"));
    assert!(panel.contains("3,800"));
    assert!(panel.contains("/admin/analytics"));
    assert!(!panel.contains("인기 페이지"));
}

#[tokio::test]
async fn advanced_panels_show_counts_rates_and_evidence() {
    for (tab, expected) in [
        (
            Tab::Acquisition,
            &[
                "2,300",
                "1,800",
                "783",
                "네이버",
                "재방문 세션 소스",
                "퀴즈 출시",
                "/memes/고양이",
            ][..],
        ),
        (
            Tab::Behaviour,
            &[
                "이벤트 수로 근사",
                "100세션당",
                "1.46",
                "42.0%",
                "사이트 검색어",
            ][..],
        ),
        (
            Tab::Dropoff,
            &[
                "이탈 원인 진단",
                "모바일 · Safari",
                "78.0%",
                "52.0%",
                "+26.0%p",
                "799",
                "search.naver.com/search",
                "youtube.com",
            ][..],
        ),
        (
            Tab::Realtime,
            &[
                "최근 30분 활성 사용자",
                "58",
                "29분 전",
                "현재 분",
                "활동이 있는 페이지",
                "실시간 국가",
                "실시간 기기",
            ][..],
        ),
    ] {
        let html = page(mocked(mode(tab)).await, tab);
        assert!(html.contains("aria-current=\"page\""));
        assert_eq!(
            html.matches("<svg").count(),
            html.matches("<details").count()
        );
        assert_eq!(
            html.matches("<svg").count(),
            html.matches("role=\"img\" aria-label=").count()
        );
        for value in expected {
            assert!(html.contains(value), "{tab:?} is missing {value}");
        }
        assert!(!html.contains("never-shown"), "referrer query leaked");
        if tab == Tab::Dropoff {
            assert!(
                !html.contains("/tiny"),
                "low-volume landing leaked into diagnosis"
            );
        }
    }
}

#[test]
fn range_tab_and_requests_are_bounded_and_periods_are_adjacent() {
    assert_eq!(Selection::parse(None), Selection::default());
    assert_eq!(
        Selection::parse(Some("tab=invalid&range=1d")),
        Selection::default()
    );
    assert_eq!(
        Selection::parse(Some("tab=dropoff&range=90d")),
        Selection {
            tab: Tab::Dropoff,
            range: Range::Quarter
        }
    );
    for tab in Tab::ALL {
        for range in Range::ALL {
            let (method, plan) = requests::plan(Mode::Analytics(Selection { tab, range }));
            let now =
                json!([{"startDate": format!("{}daysAgo", range.days()), "endDate": "yesterday"}]);
            let previous = json!([{"startDate": format!("{}daysAgo", 2*range.days()), "endDate": format!("{}daysAgo", range.days()+1)}]);
            let mut seen = std::collections::HashSet::new();
            for queries in plan.chunks(if tab == Tab::Realtime {
                1
            } else {
                requests::BATCH_LIMIT
            }) {
                let body = requests::body(method, queries, range);
                assert!(!body.to_string().contains("customEvent:"));
                if tab == Tab::Realtime {
                    assert_eq!(method, Method::Realtime);
                    assert!(body.get("dateRanges").is_none());
                    assert_eq!(body["metrics"], json!([{"name": "activeUsers"}]));
                    continue;
                }
                assert_eq!(method, Method::Batch);
                let bodies = body["requests"].as_array().unwrap();
                assert!(bodies.len() <= 5);
                for (query, body) in queries.iter().zip(bodies) {
                    assert!(seen.insert((query.id, query.period)));
                    assert_eq!(
                        body["dateRanges"],
                        if query.period == Period::Current {
                            &now
                        } else {
                            &previous
                        }
                        .clone()
                    );
                }
            }
            match tab {
                Tab::Overview => assert!(seen.contains(&(Id::Pages, Period::Current))),
                Tab::Acquisition => assert!(seen.contains(&(Id::Sources, Period::Previous))),
                Tab::Behaviour => assert!(!seen.contains(&(Id::Sources, Period::Current))),
                Tab::Dropoff => assert!(!seen.contains(&(Id::Actions, Period::Current))),
                Tab::Realtime => assert!(seen.is_empty()),
            }
        }
    }
}

#[tokio::test]
async fn report_failures_and_empty_rows_are_isolated() {
    let mode = mode(Tab::Realtime);
    let empty = load_report(mode, |method, body| {
        std::future::ready(Ok(stub(mode, method, &body, true)))
    })
    .await;
    let html = page(empty, Tab::Realtime);
    assert_eq!(html.matches("표시할 데이터가 없어요.").count(), 5);
    assert!(!html.contains("<svg"));

    let calls = RefCell::new(Vec::new());
    let data = load_report(OVERVIEW, |method, body| {
        let list = body["requests"].as_array().unwrap();
        let has_daily = list
            .iter()
            .any(|query| query["dimensions"] == json!([{"name":"date"}]));
        calls.borrow_mut().push(list.len());
        let result = if has_daily {
            Err(Reason::Rejected)
        } else {
            Ok(stub(OVERVIEW, method, &body, false))
        };
        std::future::ready(result)
    })
    .await;
    assert_eq!(
        calls.into_inner().iter().filter(|len| **len == 1).count(),
        5
    );
    let html = page(data, Tab::Overview);
    assert!(html.contains(reason_text(Reason::Rejected)));
    assert!(html.contains("3,800"));
    assert!(html.contains("인기 페이지"));
}

#[test]
fn response_parser_rejects_bad_values_and_validates_truncation() {
    let q = Id::Daily.query(Period::Current, Range::Month);
    let request = &requests::body(Method::Batch, &[q], Range::Month)["requests"][0];
    for malformed in [
        vec![row(&["2026-11-24"], &["20", "45"])],
        vec![row(&["20260230"], &["20", "45"])],
        vec![row(&["20261124"], &["NaN", "45"])],
        vec![row(&["20261124"], &["20", "45"]); 2],
        vec![
            row(&["20261027"], &["20", "45"]),
            row(&["20261124"], &["20", "45"]),
        ],
    ] {
        assert!(matches!(
            parse_report(
                &response(request, malformed),
                q,
                Method::Batch,
                Range::Month
            ),
            Err(Reason::InvalidResponse)
        ));
    }
    let mut valid = response(request, vec![row(&["20261124"], &["0", "0"])]);
    valid["rowCount"] = json!(2);
    assert!(
        parse_report(&valid, q, Method::Batch, Range::Month)
            .unwrap()
            .limited
    );
    let mut bad_header = valid;
    bad_header["metricHeaders"][0]["name"] = json!("sessions");
    assert!(parse_report(&bad_header, q, Method::Batch, Range::Month).is_err());
    assert_eq!(parse_metric("bounceRate", "0.52"), Some(0.52));
    assert_eq!(parse_metric("bounceRate", "1.001"), None);
    assert_eq!(parse_metric("sessions", "9007199254740992"), None);
}

#[tokio::test]
async fn cache_keys_and_ttls_match_the_report_windows() {
    let cache = Cache::new();
    let no_data = || {
        Arc::new(Data {
            reports: Reports::default(),
            fetched_at: String::new(),
        })
    };
    let first = cache
        .slot(OVERVIEW)
        .get_or_load(|| async { Ok::<_, Reason>(no_data()) })
        .await
        .unwrap();
    let same = cache
        .slot(OVERVIEW)
        .get_or_load(|| async { Ok::<_, Reason>(no_data()) })
        .await
        .unwrap();
    let other = cache
        .slot(Mode::Analytics(Selection {
            tab: Tab::Overview,
            range: Range::Week,
        }))
        .get_or_load(|| async { Ok::<_, Reason>(no_data()) })
        .await
        .unwrap();
    assert!(Arc::ptr_eq(&first, &same));
    assert!(!Arc::ptr_eq(&first, &other));
    assert!(std::ptr::eq(
        cache.slot(mode(Tab::Realtime)),
        cache.slot(Mode::Analytics(Selection {
            tab: Tab::Realtime,
            range: Range::Week
        }))
    ));
    assert_eq!(HISTORICAL_TTL.as_secs(), 600);
    assert_eq!(REALTIME_TTL.as_secs(), 45);
}

#[test]
fn configuration_is_checked() {
    assert!(is_property("123456"));
    assert!(!is_property("0123"));
    assert!(!is_property(" 123"));
    assert!(is_service_account(
        "reporter@project-1.iam.gserviceaccount.com"
    ));
    assert!(!is_service_account("reporter@example.com"));
    assert!(!is_service_account("a b@x.gserviceaccount.com"));
    assert!(signer("invalid key").is_none());
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

/// The ops script runs this local exporter without credentials, then sends
/// the exact request bodies. No checked-in copy of the requests can drift.
#[test]
#[ignore = "explicit offline export for scripts/ga4-check-requests.mjs"]
fn export_request_bodies() {
    let path = PathBuf::from(std::env::var_os("GA4_REQUEST_MANIFEST").expect("output path"));
    let mut entries = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let modes = [Mode::Dashboard]
        .into_iter()
        .chain(Tab::ALL.into_iter().flat_map(|tab| {
            Range::ALL
                .into_iter()
                .map(move |range| Mode::Analytics(Selection { tab, range }))
        }));
    for mode in modes {
        let range = mode.range();
        let (method, queries) = requests::plan(mode);
        let size = if method == Method::Batch {
            requests::BATCH_LIMIT
        } else {
            1
        };
        for chunk in queries.chunks(size) {
            let body = requests::body(method, chunk, range);
            if !seen.insert((method.name(), body.to_string())) {
                continue;
            }
            let name = match mode {
                Mode::Dashboard => "dashboard",
                Mode::Analytics(selection) => selection.tab.key(),
            };
            let label = format!(
                "{name} {} {:?}",
                range.key(),
                chunk.iter().map(|q| (q.id, q.period)).collect::<Vec<_>>()
            );
            let singles =
                if method == Method::Batch && chunk.len() > 1 {
                    chunk.iter().map(|q| json!({
                    "label": format!("{name} {} {:?} {:?}", range.key(), q.id, q.period),
                    "method": method.name(),
                    "body": requests::body(method, &[*q], range),
                })).collect::<Vec<_>>()
                } else {
                    vec![]
                };
            entries.push(json!({"label": label, "method": method.name(), "body": body, "onRejected": singles}));
        }
    }
    std::fs::write(path, serde_json::to_vec(&entries).unwrap()).unwrap();
}

#[tokio::test]
#[ignore = "explicit offline Playwright fixture export"]
async fn export_ga4_playwright_previews() {
    let directory = PathBuf::from(
        std::env::var_os("GA4_ADVANCED_PREVIEW_DIR").expect("preview output directory"),
    );
    std::fs::create_dir_all(&directory).unwrap();
    let site = crate::pages::document::Site {
        url: "http://127.0.0.1".to_owned(),
        ga_id: None,
        adsense_client: None,
        adsense_auto_ads: false,
        css_href: "/site.css".to_owned(),
        js_href: String::new(),
        page_js: Vec::new(),
        page_css: Vec::new(),
    };
    for tab in Tab::ALL {
        let selection = Selection {
            tab,
            range: Range::Month,
        };
        let report = Report::Data(Arc::new(mocked(mode(tab)).await));
        let preview = super::super::shell::document(
            &site,
            super::super::shell::Root::Private,
            "GA4 리포트",
            "/admin/analytics",
            analytics_main(&report, selection),
        );
        std::fs::write(
            directory.join(format!("{}.html", tab.key())),
            preview.into_string(),
        )
        .unwrap();
    }
    std::fs::write(directory.join("site.css"), crate::pages::SITE_CSS).unwrap();
}
