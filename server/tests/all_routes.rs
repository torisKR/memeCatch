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
use memecatch_server::routes::{PAGE_ROUTE_IDS, ROUTE_IDS};
use memecatch_server::storage::Storage;
use memecatch_server::{AppState, build_app};

// Every page route id (`PAGE_ROUTE_IDS`), switched on.
const PILOTS_ON: (&str, &str) = (
    "AXUM_PILOT_ROUTES",
    "page-about,page-meme,page-contact,page-editorial,page-guides,page-guide,page-privacy,page-terms,page-offline,page-missing-meme,page-retired-products,page-originals,page-original-edition,page-memes,page-collections,page-collection,page-weekly,page-timeline,page-slang,page-explore,page-global,page-meme-cards,page-news,page-quiz,page-quiz-result,page-rankings,page-search,page-studio,page-forgot-password,page-reset-password,page-login",
);
// R2 values, so that the upload routes (R2 only) are registered too. The
// storage is pointed at a closed local port: no sample reaches it.
const BASE: [(&str, &str); 9] = [
    ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
    ("MEMECATCH_SIGNING_SECRET", "test-only-signing-secret"),
    // The Instagram video cache route and /api/db/query need it to reach
    // Next's cache.
    ("CRON_SECRET", "test-only-cron-secret"),
    ("NODE_ENV", "development"),
    ("R2_ACCOUNT_ID", "not-used"),
    ("R2_ACCESS_KEY_ID", "not-used"),
    ("R2_SECRET_ACCESS_KEY", "not-used"),
    ("R2_BUCKET", "not-used"),
    // The operator studio is registered only with Bedrock switched on.
    ("BEDROCK_MEME_STUDIO_ENABLED", "true"),
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
        ("page-contact", "GET", "/contact"),
        ("page-editorial", "GET", "/editorial"),
        ("page-guides", "GET", "/guides"),
        ("page-guide", "GET", "/guides/usage-signals"),
        ("page-privacy", "GET", "/privacy"),
        ("page-terms", "GET", "/terms"),
        ("page-offline", "GET", "/offline"),
        ("page-missing-meme", "GET", "/missing-public-meme"),
        ("page-retired-products", "GET", "/retired-products"),
        ("page-originals", "GET", "/originals"),
        ("page-memes", "GET", "/memes"),
        ("page-collections", "GET", "/collections"),
        ("page-collection", "GET", "/collections/latest"),
        ("page-weekly", "GET", "/weekly"),
        ("page-timeline", "GET", "/timeline"),
        ("page-slang", "GET", "/slang"),
        ("page-explore", "GET", "/explore"),
        ("page-global", "GET", "/global"),
        ("page-meme-cards", "GET", "/meme-cards"),
        ("page-news", "GET", "/news"),
        ("page-quiz", "GET", "/quiz"),
        ("page-rankings", "GET", "/rankings"),
        ("page-search", "GET", "/search"),
        ("page-studio", "GET", "/studio"),
        ("page-quiz-result", "GET", "/quiz/r/a00120brm83m233wtsxf"),
        (
            "page-original-edition",
            "GET",
            "/originals/edition/monday-loading",
        ),
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
        ("meme-contribution", "POST", "/api/memes/contribution"),
        ("analytics-events", "POST", "/api/analytics/events"),
        ("media-object", "GET", "/api/media/other-bucket/a.png"),
        ("mpe-job", "GET", "/api/mpe/jobs/no-such-job"),
        ("mpe-renders", "POST", "/api/mpe/renders"),
        ("upload", "POST", "/api/upload"),
        ("mpe-uploads", "POST", "/api/mpe/uploads"),
        ("admin-mpe-candidates", "GET", "/api/admin/mpe-candidates"),
        (
            "admin-mpe-candidates-post",
            "POST",
            "/api/admin/mpe-candidates",
        ),
        ("meme-studio", "POST", "/api/meme-studio"),
        ("admin-meme-studio", "POST", "/api/admin/meme-studio"),
        (
            "memes-semantic-search",
            "POST",
            "/api/memes/semantic-search",
        ),
        ("auth-get-session", "GET", "/api/auth/get-session"),
        ("auth-sign-out", "POST", "/api/auth/sign-out"),
        ("memes-chat", "POST", "/api/memes/chat"),
        ("mcp", "POST", "/api/mcp"),
        ("mcp-operator", "GET", "/api/mcp-operator"),
        ("mcp-operator-post", "POST", "/api/mcp-operator"),
        (
            "mcp-oauth-authorize",
            "GET",
            "/api/mcp-operator/oauth/authorize",
        ),
        ("mcp-oauth-token", "POST", "/api/mcp-operator/oauth/token"),
        (
            "mcp-oauth-metadata",
            "GET",
            "/.well-known/oauth-authorization-server",
        ),
        (
            "mcp-resource-metadata",
            "GET",
            "/.well-known/oauth-protected-resource/api/mcp-operator",
        ),
        ("mcp-github", "POST", "/api/mcp-operator/github"),
        ("mcp-events-cron", "GET", "/api/cron/mcp-events"),
        ("og-default", "GET", "/og/ko"),
        ("opengraph-image", "GET", "/opengraph-image"),
        ("og-quiz", "GET", "/og/quiz/a005aaaaaaa1aaaaaaa2aaaaaaa3"),
        ("growth-baseline", "GET", "/api/cron/growth-baseline"),
        ("saved-state-emails", "GET", "/api/cron/saved-state-emails"),
        ("source-refresh", "POST", "/api/cron/source-refresh"),
        ("trend-pulse", "GET", "/api/cron/trend-pulse"),
        (
            "instagram-video-cache",
            "POST",
            "/api/admin/instagram-video-verification/revalidate",
        ),
        ("adpick-hotdeals", "GET", "/api/cron/adpick-hotdeals"),
        ("creator-products", "GET", "/api/creator-products/x"),
        // No origin: the route's own 403.
        ("db-query", "POST", "/api/db/query"),
        ("auth-sign-in-email", "POST", "/api/auth/sign-in/email"),
        ("auth-sign-up-email", "POST", "/api/auth/sign-up/email"),
        ("auth-verify-email", "GET", "/api/auth/verify-email?token=x"),
        (
            "auth-request-password-reset",
            "POST",
            "/api/auth/request-password-reset",
        ),
        ("auth-reset-password", "POST", "/api/auth/reset-password"),
        ("auth-oauth", "GET", "/api/auth/callback/google"),
        ("auth-callback", "GET", "/auth/callback"),
        ("account-password", "POST", "/api/account/password"),
        ("page-forgot-password", "GET", "/forgot-password"),
        ("page-reset-password", "GET", "/reset-password"),
        ("page-login", "GET", "/login"),
    ];
    let mut samples: Vec<(&str, &str, String)> = fixed
        .iter()
        .map(|(id, method, path)| (*id, *method, (*path).to_owned()))
        .collect();
    samples.push(("page-assets", "GET", format!("/_axum/{css_name}")));
    samples
}

/// The headers and body a sample needs to be answered natively: the auth
/// endpoints take only JSON objects of their schema (everything else is
/// Next's). Most samples are refused before any query.
fn sample_request(id: &str) -> (&'static [(&'static str, &'static str)], &'static str) {
    const JSON: &[(&str, &str)] = &[("content-type", "application/json")];
    match id {
        "auth-sign-out" => (JSON, "{}"),
        "auth-sign-in-email" => (JSON, r#"{"email":"nobody","password":"x"}"#),
        "auth-sign-up-email" => (
            JSON,
            r#"{"name":"n","email":"nobody@example.com","password":"short"}"#,
        ),
        "auth-request-password-reset" => (JSON, r#"{"email":"nobody@example.com"}"#),
        "auth-reset-password" => (JSON, r#"{"newPassword":"x","token":""}"#),
        _ => (&[], ""),
    }
}

async fn send_sample(
    app: SocketAddr,
    id: &str,
    method: &str,
    path: &str,
    extra: &[(&str, &str)],
) -> common::Reply {
    let (headers, body) = sample_request(id);
    let headers = [headers, extra].concat();
    send(app, method, path, &headers, Body::from(body)).await
}

/// Routes that hand a request with an `RSC` header to Next on purpose: Next
/// redirects it, whatever the method, before better-auth runs
/// (`routes/better_auth/session.rs`, `forms.rs`; PLAN.md A2-13).
const RSC_TO_NEXT: [&str; 9] = [
    "auth-get-session",
    "auth-callback",
    "auth-verify-email",
    "auth-sign-out",
    "auth-sign-in-email",
    "auth-sign-up-email",
    "auth-request-password-reset",
    "auth-reset-password",
    "auth-oauth",
];

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
        let native = send_sample(all_on, id, method, path, &[]).await;
        assert_ne!(
            native.status,
            StatusCode::IM_A_TEAPOT,
            "{id} is answered by the upstream"
        );

        let disabled = app(upstream, &[PILOTS_ON, ("AXUM_DISABLED_ROUTES", id)]).await;
        let proxied = send_sample(disabled, id, method, path, &[]).await;
        assert_eq!(proxied.status, StatusCode::IM_A_TEAPOT, "{id}");
        assert_eq!(
            proxied.body,
            format!("upstream saw {method} {path}"),
            "{id}"
        );
    }
}

#[tokio::test]
async fn pages_are_off_without_axum_page_routes_and_the_rest_is_native() {
    let upstream = marker_upstream().await;
    let samples = samples(&css_name(upstream).await);
    let default = app(upstream, &[]).await;

    for (id, method, path) in &samples {
        let reply = send_sample(default, id, method, path, &[]).await;

        if PAGE_ROUTE_IDS.contains(id) {
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
            let reply = send_sample(all_on, id, method, path, fetch).await;
            let to_next = PAGE_ROUTE_IDS.contains(id)
                || (RSC_TO_NEXT.contains(id) && fetch.iter().any(|(name, _)| *name == "rsc"));

            if to_next {
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

// Start and callbacks move together: `auth-oauth` off hands all three to
// Next, so no sign-in starts on one server's rules and ends on the other's
// (routes/better_auth/oauth/mod.rs).
#[tokio::test]
async fn the_oauth_start_and_both_callbacks_share_one_switch() {
    let upstream = marker_upstream().await;
    let on = app(upstream, &[]).await;
    let off = app(upstream, &[("AXUM_DISABLED_ROUTES", "auth-oauth")]).await;
    let start = (
        "POST",
        "/api/auth/sign-in/social",
        r#"{"provider":"nope","callbackURL":"/"}"#,
    );
    for (method, path, body) in [
        start,
        ("GET", "/api/auth/callback/google", ""),
        ("GET", "/api/auth/callback/kakao", ""),
    ] {
        let headers = [("content-type", "application/json")];
        let native = send(on, method, path, &headers, Body::from(body)).await;
        assert_ne!(native.status, StatusCode::IM_A_TEAPOT, "{path}");
        let proxied = send(off, method, path, &headers, Body::from(body)).await;
        assert_eq!(
            proxied.body,
            format!("upstream saw {method} {path}"),
            "{path}"
        );
    }
    // A provider this server does not have, and better-auth's other callbacks.
    for path in [
        "/api/auth/callback/github",
        "/api/auth/oauth2/callback/kakao",
    ] {
        let reply = send(on, "GET", path, &[], Body::empty()).await;
        assert_eq!(reply.body, format!("upstream saw GET {path}"), "{path}");
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
        pilot.starts_with("AXUM_PILOT_ROUTES names no page route: page-mem."),
        "{pilot}"
    );
    assert!(
        not_a_pilot.starts_with("AXUM_PILOT_ROUTES names no page route: quiz."),
        "{not_a_pilot}"
    );
    // Every valid combination starts.
    let valid = [PILOTS_ON, ("AXUM_DISABLED_ROUTES", "page-about,quiz,llms")];
    assert!(state(upstream, &valid).is_ok());
}

/// Method, path, headers and body of one request.
type Sample = (
    &'static str,
    &'static str,
    &'static [(&'static str, &'static str)],
    &'static str,
);

// The native auth endpoints answer only the requests they can answer as
// better-auth would; every other better-auth request goes to Next as it came.
#[tokio::test]
async fn the_other_auth_requests_go_to_next() {
    let upstream = marker_upstream().await;
    let all_on = app(upstream, &[PILOTS_ON]).await;
    const JSON: (&str, &str) = ("content-type", "application/json");
    let requests: [Sample; 15] = [
        ("POST", "/api/auth/sign-in/email", &[JSON], "{}"),
        // A provider's form post: better-auth redirects it to the `GET`.
        (
            "POST",
            "/api/auth/callback/google",
            &[("content-type", "application/x-www-form-urlencoded")],
            "code=x&state=y",
        ),
        (
            "GET",
            "/api/auth/get-session?disableCookieCache=true",
            &[],
            "",
        ),
        ("GET", "/api/auth/get-session", &[("rsc", "1")], ""),
        ("POST", "/api/auth/get-session", &[JSON], "{}"),
        ("GET", "/api/auth/sign-out", &[], ""),
        (
            "POST",
            "/api/auth/sign-out",
            &[("content-type", "text/plain")],
            "{}",
        ),
        (
            "POST",
            "/api/auth/sign-out",
            &[JSON],
            r#"{"callbackURL":"/"}"#,
        ),
        ("POST", "/api/auth/sign-out", &[JSON], "[]"),
        // better-auth's origin check reads `callbackURL` from the query too,
        // and these body keys, and refuses untrusted or non-string ones.
        (
            "POST",
            "/api/auth/sign-out?callbackURL=https://evil.example",
            &[JSON],
            "{}",
        ),
        ("POST", "/api/auth/sign-out?x=1", &[JSON], "{}"),
        (
            "POST",
            "/api/auth/sign-out",
            &[JSON],
            r#"{"redirectTo":"https://evil.example"}"#,
        ),
        ("POST", "/api/auth/sign-out", &[JSON], r#"{"redirectTo":1}"#),
        (
            "POST",
            "/api/auth/sign-out",
            &[JSON],
            r#"{"errorCallbackURL":"https://evil.example"}"#,
        ),
        (
            "POST",
            "/api/auth/sign-out",
            &[JSON],
            r#"{"newUserCallbackURL":"https://evil.example"}"#,
        ),
    ];
    for (method, path, headers, body) in requests {
        let reply = send(all_on, method, path, headers, Body::from(body)).await;
        assert_eq!(
            reply.body,
            format!("upstream saw {method} {path}"),
            "{method} {path} {headers:?} {body}"
        );
    }
}
