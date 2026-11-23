//! Every native route and both switch variables together: the routes of
//! `routes/` and the page pilots of `pages/` register through one builder,
//! so one id list, `AXUM_DISABLED_ROUTES` and `AXUM_PILOT_ROUTES` govern all.
//!
//! Needs the test database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.
//! It only reads.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::routes::{PILOT_ROUTE_IDS, ROUTE_IDS};
use memecatch_server::storage::Storage;
use memecatch_server::{AppState, build_app};

const PILOTS_ON: (&str, &str) = ("AXUM_PILOT_ROUTES", "page-about,page-meme");
// R2 values, so that the upload routes (R2 only) are registered too. The
// storage is pointed at a closed local port: no sample reaches it.
const BASE: [(&str, &str); 7] = [
    ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
    ("MEMECATCH_SIGNING_SECRET", "test-only-signing-secret"),
    ("NODE_ENV", "development"),
    ("R2_ACCOUNT_ID", "not-used"),
    ("R2_ACCESS_KEY_ID", "not-used"),
    ("R2_SECRET_ACCESS_KEY", "not-used"),
    ("R2_BUCKET", "not-used"),
];

fn state(upstream: SocketAddr, extra: &[(&str, &str)]) -> Result<AppState, String> {
    let config = config(upstream, &database_url(), &[extra, &BASE[..]].concat());
    let mut state = AppState::new(config.clone())?;
    state.storage = Storage::with_r2_endpoint(&config, "http://127.0.0.1:1")?;
    Ok(state)
}

async fn app(upstream: SocketAddr, extra: &[(&str, &str)]) -> SocketAddr {
    spawn_router(build_app(state(upstream, extra).expect("app state"))).await
}

/// The file name of the pages' stylesheet, which carries a content hash: read
/// from the `/about` page of an app with the pilots on.
async fn css_name(upstream: SocketAddr) -> String {
    let pilots_on = app(upstream, &[PILOTS_ON]).await;
    let about = send(pilots_on, "GET", "/about", &[], Body::empty()).await;
    let after = about
        .body
        .split("/_axum/")
        .nth(1)
        .expect("a stylesheet link");
    let name = after.split('"').next().expect("the end of the link");
    assert!(name.ends_with(".css"), "{name}");
    name.to_owned()
}

/// One request per route id that the route answers itself.
fn samples(css_name: &str) -> Vec<(&'static str, &'static str, String)> {
    let fixed = [
        ("page-about", "GET", "/about"),
        ("page-meme", "GET", "/memes/zzzzzzzz-no-such-meme"),
        ("health", "GET", "/api/health"),
        ("media-signed", "GET", "/api/media/signed"),
        ("robots", "GET", "/robots.txt"),
        ("memes-random", "GET", "/memes/random"),
        ("random-meme", "GET", "/api/random-meme"),
        ("csp-report", "POST", "/api/csp-report"),
        ("daily-quiz", "GET", "/api/daily-quiz"),
        ("llms", "GET", "/llms.txt"),
        ("llms-full", "GET", "/llms-full.txt"),
        ("feed", "GET", "/feed.xml"),
        ("feed-updated", "GET", "/feed/updated.xml"),
        ("llms-localized", "GET", "/en/llms.txt"),
        ("llms-full-localized", "GET", "/zh-tw/llms-full.txt"),
        ("explore-previews", "POST", "/api/explore/previews"),
        ("quiz", "GET", "/api/quiz?set="),
        ("meme-cards", "GET", "/api/meme-cards?page=0"),
        ("meme-card", "GET", "/api/meme-cards/nope"),
        (
            "meme-cards-collection",
            "GET",
            "/api/meme-cards/collection?page=0",
        ),
        ("meme-cards-claim", "POST", "/api/meme-cards/claim"),
        ("memes-view", "POST", "/api/memes/view"),
        ("analytics-events", "POST", "/api/analytics/events"),
        ("media-object", "GET", "/api/media/other-bucket/a.png"),
        ("mpe-job", "GET", "/api/mpe/jobs/no-such-job"),
        ("mpe-renders", "POST", "/api/mpe/renders"),
        ("upload", "POST", "/api/upload"),
        ("mpe-uploads", "POST", "/api/mpe/uploads"),
        ("admin-mpe-candidates", "GET", "/api/admin/mpe-candidates"),
    ];
    let mut samples: Vec<(&str, &str, String)> = fixed
        .iter()
        .map(|(id, method, path)| (*id, *method, (*path).to_owned()))
        .collect();
    samples.push(("page-assets", "GET", format!("/_axum/{css_name}")));
    samples
}

#[tokio::test]
async fn every_route_id_is_native_when_on_and_falls_through_when_disabled() {
    let upstream = marker_upstream().await;
    let samples = samples(&css_name(upstream).await);
    let all_on = app(upstream, &[PILOTS_ON]).await;

    // The samples name every id once: none can be added without a line here.
    let mut sampled: Vec<&str> = samples.iter().map(|(id, ..)| *id).collect();
    let mut known = ROUTE_IDS.to_vec();
    sampled.sort_unstable();
    known.sort_unstable();
    assert_eq!(sampled, known);

    for (id, method, path) in &samples {
        let native = send(all_on, method, path, &[], Body::empty()).await;
        assert_ne!(
            native.status,
            StatusCode::IM_A_TEAPOT,
            "{id} is answered by the upstream"
        );

        let disabled = app(upstream, &[PILOTS_ON, ("AXUM_DISABLED_ROUTES", id)]).await;
        let proxied = send(disabled, method, path, &[], Body::empty()).await;
        assert_eq!(proxied.status, StatusCode::IM_A_TEAPOT, "{id}");
        assert_eq!(
            proxied.body,
            format!("upstream saw {method} {path}"),
            "{id}"
        );
    }
}

#[tokio::test]
async fn pilots_are_off_without_axum_pilot_routes_and_the_rest_is_native() {
    let upstream = marker_upstream().await;
    let samples = samples(&css_name(upstream).await);
    let default = app(upstream, &[]).await;

    for (id, method, path) in &samples {
        let reply = send(default, method, path, &[], Body::empty()).await;

        if PILOT_ROUTE_IDS.contains(id) {
            assert_eq!(reply.body, format!("upstream saw {method} {path}"), "{id}");
        } else {
            assert_ne!(reply.status, StatusCode::IM_A_TEAPOT, "{id}");
        }
    }
}

// The pages answer navigations only (no `RSC` header, `Sec-Fetch-Mode` absent
// or `navigate`) and hand everything else to Next. That rule belongs to the
// pages alone: a `fetch()` from a page reaches the native API routes.
#[tokio::test]
async fn the_document_rule_of_the_pages_does_not_reach_the_other_routes() {
    let upstream = marker_upstream().await;
    let samples = samples(&css_name(upstream).await);
    let all_on = app(upstream, &[PILOTS_ON]).await;

    for fetch in [
        &[("sec-fetch-mode", "cors")][..],
        &[("rsc", "1")],
        &[("sec-fetch-mode", "same-origin"), ("rsc", "1")],
    ] {
        for (id, method, path) in &samples {
            let reply = send(all_on, method, path, fetch, Body::empty()).await;

            if PILOT_ROUTE_IDS.contains(id) {
                assert_eq!(
                    reply.body,
                    format!("upstream saw {method} {path}"),
                    "{id} {fetch:?}"
                );
            } else {
                assert_ne!(reply.status, StatusCode::IM_A_TEAPOT, "{id} {fetch:?}");
            }
        }
    }
}

#[tokio::test]
async fn an_unknown_id_in_either_switch_variable_stops_the_server() {
    let upstream = marker_upstream().await;
    let refused = |extra: &[(&str, &str)]| state(upstream, extra).err().unwrap_or_default();

    let disabled = refused(&[("AXUM_DISABLED_ROUTES", "quiz,llms,page-meme,memes-id-view")]);
    let pilot = refused(&[("AXUM_PILOT_ROUTES", "page-about,page-mem")]);
    // A real route that is not a pilot cannot be named as one.
    let not_a_pilot = refused(&[("AXUM_PILOT_ROUTES", "quiz")]);

    assert!(
        disabled.starts_with("AXUM_DISABLED_ROUTES names no native route: memes-id-view."),
        "{disabled}"
    );
    for id in ROUTE_IDS {
        assert!(disabled.contains(id), "{id} is missing from: {disabled}");
    }
    assert!(
        pilot.starts_with("AXUM_PILOT_ROUTES names no pilot route: page-mem."),
        "{pilot}"
    );
    assert!(
        not_a_pilot.starts_with("AXUM_PILOT_ROUTES names no pilot route: quiz."),
        "{not_a_pilot}"
    );
    // Every valid combination starts.
    let valid = [PILOTS_ON, ("AXUM_DISABLED_ROUTES", "page-about,quiz,llms")];
    assert!(state(upstream, &valid).is_ok());
}
