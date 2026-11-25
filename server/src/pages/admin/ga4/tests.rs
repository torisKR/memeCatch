use std::cell::RefCell;

use super::super::dashboard::analytics_main;
use super::*;

fn row(dimensions: &[&str], metrics: &[&str]) -> Value {
    json!({
        "dimensionValues": dimensions.iter().map(|value| json!({ "value": value })).collect::<Vec<_>>(),
        "metricValues": metrics.iter().map(|value| json!({ "value": value })).collect::<Vec<_>>(),
    })
}

fn batch(body: &Value, groups: Vec<Vec<Value>>) -> Value {
    let requests = body["requests"].as_array().expect("batch requests");
    assert_eq!(requests.len(), groups.len());
    json!({
        "reports": requests.iter().zip(groups).map(|(request, rows)| {
            json!({
                "metricHeaders": request["metrics"],
                "dimensionHeaders": request["dimensions"],
                "rowCount": rows.len(),
                "rows": rows,
                "metadata": { "timeZone": "Asia/Seoul" }
            })
        }).collect::<Vec<_>>(),
    })
}

fn ranked_rows(rows: &[(&str, &str)]) -> Vec<Value> {
    rows.iter()
        .map(|(name, value)| row(&[name], &[value]))
        .collect()
}

fn fixture(body: &Value) -> Value {
    if body["requests"].as_array().unwrap().len() == 3 {
        let start = date("20261028").unwrap();
        let daily = (0..28)
            .filter(|day| *day != 10)
            .map(|day| {
                let date = (start + time::Duration::days(day))
                    .to_string()
                    .replace('-', "");
                let users = if day == 27 {
                    218
                } else {
                    100 + day * 3 + ((day * 13) % 53)
                };
                let views = if day == 27 {
                    362
                } else {
                    158 + day * 5 + ((day * 19) % 91)
                };
                row(&[&date], &[&users.to_string(), &views.to_string()])
            })
            .collect();
        batch(
            body,
            vec![
                vec![row(&[], &["3800", "3100", "4920", "6200", "243200.25"])],
                vec![row(&[], &["3200", "2800", "5100", "5600", "153600"])],
                daily,
            ],
        )
    } else {
        batch(
            body,
            vec![
                [
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
                .map(|(title, path, value)| row(&[title, path], &[value]))
                .collect(),
                ranked_rows(&[
                    ("Organic Search", "2910"),
                    ("Direct", "1180"),
                    ("Organic Social", "490"),
                    ("Referral", "230"),
                    ("Organic Video", "79"),
                    ("Unassigned", "31"),
                ]),
                ranked_rows(&[("mobile", "2890"), ("desktop", "970"), ("tablet", "56")]),
                ranked_rows(&[
                    ("South Korea", "3340"),
                    ("United States", "198"),
                    ("Japan", "78"),
                    ("Canada", "66"),
                    ("Vietnam", "25"),
                    ("Germany", "18"),
                ]),
            ],
        )
    }
}

#[tokio::test]
async fn chart_page_renders_both_batches_and_values() {
    let requests = RefCell::new(Vec::new());
    let report = load_report(Mode::Analytics, |body| {
        let response = fixture(&body);
        requests.borrow_mut().push(body);
        std::future::ready(Ok(response))
    })
    .await
    .expect("valid report");
    let requests = requests.into_inner();
    assert_eq!(requests.len(), 2);
    let overview = &requests[0]["requests"];
    let breakdowns = &requests[1]["requests"];
    assert_eq!(
        overview[0]["dateRanges"][0],
        json!({ "startDate": "28daysAgo", "endDate": "yesterday" })
    );
    assert_eq!(
        overview[1]["dateRanges"][0],
        json!({ "startDate": "56daysAgo", "endDate": "29daysAgo" })
    );
    assert_eq!(overview[2]["dimensions"], json!([{ "name": "date" }]));
    assert_eq!(breakdowns[0]["limit"], "10");
    assert_eq!(
        breakdowns[0]["orderBys"][0]["metric"]["metricName"],
        "screenPageViews"
    );
    let page = analytics_main(&report).into_string();
    assert_eq!(page.matches("<svg").count(), 5);
    assert_eq!(page.matches("<details").count(), 5);
    assert_eq!(page.matches("role=\"img\" aria-label=").count(), 5);
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
        assert!(page.contains(expected), "missing {expected}");
    }
    for series in page.split("class=\"ga4-series ").skip(1) {
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
    let report = load_report(Mode::Dashboard, |body| {
        assert_eq!(body["requests"].as_array().unwrap().len(), 3);
        std::future::ready(Ok(fixture(&body)))
    })
    .await
    .expect("valid report");
    let panel = dashboard_panel(&report).into_string();
    assert_eq!(panel.matches("<svg").count(), 1);
    assert!(panel.contains("ga4-trend-compact"));
    assert!(panel.contains("3,800"));
    assert!(panel.contains("/admin/analytics"));
    assert!(!panel.contains("인기 페이지"));
}

#[tokio::test]
async fn unavailable_and_missing_comparison_have_clear_output() {
    let empty = load_report(Mode::Analytics, |body| {
        let count = body["requests"].as_array().unwrap().len();
        std::future::ready(Ok(batch(&body, vec![vec![]; count])))
    })
    .await
    .expect("valid empty report");
    let page = analytics_main(&empty).into_string();
    assert!(page.contains("조회 기간 데이터 없음"));
    assert!(!page.contains("<svg"));

    let error = load_report(Mode::Analytics, |_| std::future::ready(Err(Reason::Quota))).await;
    let page = analytics_main(&Report::Error(error.err().expect("request failed"))).into_string();
    assert!(page.contains("GA4 리포트 사용 불가"));
    assert!(page.contains("Google API 할당량"));
    assert!(!page.contains("<svg"));

    let partial = load_report(Mode::Dashboard, |body| {
        std::future::ready(Ok(batch(
            &body,
            vec![
                vec![row(&[], &["21", "20", "35", "49", "0"])],
                vec![row(&[], &["0", "0", "0", "0", "0"])],
                vec![],
            ],
        )))
    })
    .await
    .expect("valid partial report");
    let page = dashboard_panel(&partial).into_string();
    assert!(page.contains("비교 데이터 없음"));
    assert!(page.contains("일별 데이터가 없어요."));
    assert!(page.contains("0초"));
}

#[tokio::test]
async fn malformed_rows_are_rejected() {
    for bad_date in ["2026-11-24", "20260230"] {
        let result = load_report(Mode::Dashboard, |body| {
            let mut response = fixture(&body);
            response["reports"][2]["rows"][0]["dimensionValues"][0]["value"] = json!(bad_date);
            std::future::ready(Ok(response))
        })
        .await;
        assert!(matches!(result, Err(Reason::InvalidResponse)));
    }
    let result = load_report(Mode::Dashboard, |body| {
        let mut response = fixture(&body);
        response["reports"][0]["rows"][0]["metricValues"][4]["value"] = json!("NaN");
        std::future::ready(Ok(response))
    })
    .await;
    assert!(matches!(result, Err(Reason::InvalidResponse)));
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
