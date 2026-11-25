//! Every route id at once: the routes of `routes/` and the pages of `pages/`
//! register through one builder and one id list (`routes::ROUTE_IDS`).
//!
//! Needs the test database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.
//! It only reads.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{config, database_url, send, spawn_router};
use memecatch_server::routes::ROUTE_IDS;
use memecatch_server::storage::Storage;
use memecatch_server::{AppState, build_app};

// R2 values, so that the upload routes (R2 only) are registered too. The
// storage is pointed at a closed local port: no sample reaches it.
const BASE: [(&str, &str); 10] = [
    ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
    ("MEMECATCH_SIGNING_SECRET", "test-only-signing-secret"),
    // The Instagram video cache route needs it.
    ("CRON_SECRET", "test-only-cron-secret"),
    ("NODE_ENV", "development"),
    ("R2_ACCOUNT_ID", "not-used"),
    ("R2_ACCESS_KEY_ID", "not-used"),
    ("R2_SECRET_ACCESS_KEY", "not-used"),
    ("R2_BUCKET", "not-used"),
    // The operator studio is registered only with Bedrock switched on.
    ("BEDROCK_MEME_STUDIO_ENABLED", "true"),
    // The repository's public/ folder, for the `public-files` route.
    (
        "AXUM_PUBLIC_DIR",
        concat!(env!("CARGO_MANIFEST_DIR"), "/../public"),
    ),
];

fn state(extra: &[(&str, &str)]) -> Result<AppState, String> {
    let config = config(&database_url(), &[extra, &BASE[..]].concat());
    let mut state = AppState::new(config.clone())?;
    state.storage = Storage::with_r2_endpoint(&config, "http://127.0.0.1:1")?;
    Ok(state)
}

async fn app(extra: &[(&str, &str)]) -> SocketAddr {
    spawn_router(build_app(state(extra).expect("app state"))).await
}

/// The file name of the pages' stylesheet, which carries a content hash: read
/// from the `/about` page of an app with the pilots on.
async fn css_name() -> String {
    let all = app(&[]).await;
    let about = send(all, "GET", "/about", &[], Body::empty()).await;
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
        ("page-home", "GET", "/"),
        ("page-locale-home", "GET", "/en"),
        ("page-locale-explore", "GET", "/en/explore"),
        ("page-locale-search", "GET", "/en/search"),
        ("page-locale-meme", "GET", "/en/memes/zzzzzzzz-no-such-meme"),
        ("page-locale-rankings", "GET", "/en/rankings"),
        ("page-locale-meme-cards", "GET", "/en/meme-cards"),
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
        ("page-admin-activity", "GET", "/admin/activity"),
        ("page-admin-users", "GET", "/admin/users"),
        ("page-admin-mpe-candidate", "GET", "/admin/mpe/x"),
        ("page-admin-mpe", "GET", "/admin/mpe"),
        (
            "admin-action-mpe-reprocess",
            "POST",
            "/_axum/admin/mpe-reprocess",
        ),
        ("admin-action-mpe-claim", "POST", "/_axum/admin/mpe-claim"),
        (
            "admin-action-mpe-source-rights",
            "POST",
            "/_axum/admin/mpe-source-rights",
        ),
        (
            "admin-action-mpe-revision",
            "POST",
            "/_axum/admin/mpe-revision",
        ),
        ("admin-action-mpe-review", "POST", "/_axum/admin/mpe-review"),
        ("page-admin-meme", "GET", "/admin/memes/x"),
        (
            "admin-action-meme-korean-draft",
            "POST",
            "/_axum/admin/meme-korean-draft",
        ),
        (
            "admin-action-meme-update",
            "POST",
            "/_axum/admin/meme-update",
        ),
        (
            "admin-action-meme-origin-country",
            "POST",
            "/_axum/admin/meme-origin-country",
        ),
        (
            "admin-action-meme-transition",
            "POST",
            "/_axum/admin/meme-transition",
        ),
        ("page-admin-catalog-new", "GET", "/admin/memes/catalog/new"),
        (
            "admin-action-catalog-register",
            "POST",
            "/_axum/admin/catalog-register",
        ),
        (
            "admin-action-catalog-duplicates",
            "POST",
            "/_axum/admin/catalog-duplicates",
        ),
        ("page-admin-meme-new", "GET", "/admin/memes/new"),
        (
            "admin-action-house-original",
            "POST",
            "/_axum/admin/house-original",
        ),
        ("page-admin-memes", "GET", "/admin/memes"),
        ("page-admin-translations", "GET", "/admin/translations"),
        (
            "admin-action-translation-stale",
            "POST",
            "/_axum/admin/translation-stale",
        ),
        (
            "admin-action-translation-delete",
            "POST",
            "/_axum/admin/translation-delete",
        ),
        (
            "admin-action-translation-reject",
            "POST",
            "/_axum/admin/translation-reject",
        ),
        (
            "admin-action-translation-review",
            "POST",
            "/_axum/admin/translation-review",
        ),
        (
            "admin-action-translation-save",
            "POST",
            "/_axum/admin/translation-save",
        ),
        (
            "admin-action-translation-draft",
            "POST",
            "/_axum/admin/translation-draft",
        ),
        (
            "admin-action-translation-preview",
            "POST",
            "/_axum/admin/translation-preview",
        ),
        (
            "admin-action-translation-gpt-review",
            "POST",
            "/_axum/admin/translation-gpt-review",
        ),
        (
            "admin-action-source-review",
            "POST",
            "/_axum/admin/source-review",
        ),
        ("page-admin-sources", "GET", "/admin/sources"),
        (
            "admin-action-submission-approve",
            "POST",
            "/_axum/admin/submission-approve",
        ),
        (
            "admin-action-submission-draft",
            "POST",
            "/_axum/admin/submission-draft",
        ),
        (
            "admin-action-submission-reject",
            "POST",
            "/_axum/admin/submission-reject",
        ),
        (
            "admin-action-submission-claim",
            "POST",
            "/_axum/admin/submission-claim",
        ),
        ("page-admin-submission", "GET", "/admin/submissions/x"),
        (
            "admin-action-contribution-review",
            "POST",
            "/_axum/admin/contribution-review",
        ),
        ("page-admin-submissions", "GET", "/admin/submissions"),
        (
            "admin-action-inquiry-status",
            "POST",
            "/_axum/admin/inquiry-status",
        ),
        (
            "admin-action-inquiry-answer",
            "POST",
            "/_axum/admin/inquiry-answer",
        ),
        ("page-admin-inquiries", "GET", "/admin/inquiries"),
        (
            "admin-action-discussion-visibility",
            "POST",
            "/_axum/admin/discussion-visibility",
        ),
        (
            "admin-action-report-handle",
            "POST",
            "/_axum/admin/report-handle",
        ),
        ("page-admin-reports", "GET", "/admin/reports"),
        ("page-admin", "GET", "/admin"),
        ("page-admin-analytics", "GET", "/admin/analytics"),
        ("page-admin-radar-safety", "GET", "/admin/radar-safety"),
        (
            "admin-action-radar-review",
            "POST",
            "/_axum/admin/radar-review",
        ),
        (
            "admin-action-radar-match",
            "POST",
            "/_axum/admin/radar-match",
        ),
        (
            "page-admin-publisher-readiness",
            "GET",
            "/admin/publisher-readiness",
        ),
        ("page-admin-growth", "GET", "/admin/growth"),
        (
            "admin-action-growth-slot",
            "POST",
            "/_axum/admin/growth-slot",
        ),
        (
            "admin-action-growth-interview",
            "POST",
            "/_axum/admin/growth-interview",
        ),
        ("page-admin-user", "GET", "/admin/users/x"),
        (
            "admin-action-user-password",
            "POST",
            "/_axum/admin/user-password",
        ),
        ("admin-action-user-reset", "POST", "/_axum/admin/user-reset"),
        ("admin-action-user-role", "POST", "/_axum/admin/user-role"),
        ("page-quiz-result", "GET", "/quiz/r/a00120brm83m233wtsxf"),
        (
            "page-original-edition",
            "GET",
            "/originals/edition/monday-loading",
        ),
        ("health", "GET", "/api/health"),
        ("media-signed", "GET", "/api/media/signed"),
        ("robots", "GET", "/robots.txt"),
        ("sitemap", "GET", "/sitemap.xml"),
        ("public-files", "GET", "/ads.txt"),
        ("app-icons", "GET", "/favicon.ico"),
        ("web-manifest", "GET", "/manifest.webmanifest"),
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
        ("og-meme", "GET", "/memes/r10og01/opengraph-image-k2cx9c"),
        ("og-meme-locale", "GET", "/en/memes/r10og01/opengraph-image"),
        ("meme-export", "GET", "/memes/r10og01/export"),
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
        ("page-onboarding", "GET", "/onboarding"),
        ("account-onboarding", "POST", "/api/account/onboarding"),
        ("account-nickname", "POST", "/api/account/nickname"),
        ("page-my", "GET", "/my"),
        ("page-support", "GET", "/support"),
        ("page-community", "GET", "/community"),
        ("page-community-new", "GET", "/community/new"),
        (
            "page-community-post",
            "GET",
            "/community/b6000000-0000-4000-8000-000000000001",
        ),
        ("community-comment", "POST", "/api/community/comment"),
        ("community-report", "POST", "/api/community/report"),
        (
            "community-post-comment",
            "POST",
            "/api/community/post-comment",
        ),
        ("community-post", "POST", "/api/community/post"),
        ("community-preview", "POST", "/api/community/preview"),
        ("page-submit", "GET", "/submit"),
        ("submit-meme", "POST", "/api/submit"),
        ("support-inquiry", "POST", "/api/support/inquiry"),
        // Signed out: the route's own 401.
        ("oembed", "GET", "/api/oembed"),
        // No origin: the route's own 403.
        (
            "admin-source-ingestions",
            "POST",
            "/api/admin/source-ingestions",
        ),
        ("source-refresh-run", "GET", "/api/cron/source-refresh"),
        ("dead-link-sweep", "GET", "/api/cron/dead-link-sweep"),
        (
            "meme-view-id",
            "POST",
            "/api/memes/11111111-1111-4111-8111-111111111111/view",
        ),
        // No embedder, no MEME_EMBEDDING_RUNTIME: 503, 401 and 401.
        ("v1-embeddings", "POST", "/v1/embeddings"),
        ("meme-embeddings-cron", "GET", "/api/cron/meme-embeddings"),
        (
            "meme-embeddings-cron-post",
            "POST",
            "/api/cron/meme-embeddings",
        ),
        ("auth-tiktok", "GET", "/auth/tiktok"),
    ];
    let mut samples: Vec<(&str, &str, String)> = fixed
        .iter()
        .map(|(id, method, path)| (*id, *method, (*path).to_owned()))
        .collect();
    samples.push(("page-assets", "GET", format!("/_axum/{css_name}")));
    samples
}

/// The headers and body a sample needs to reach its route's work: the auth
/// endpoints take only JSON objects of their schema. Most samples are
/// refused before any query.
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

/// Every route id answers its sample itself.
#[tokio::test]
async fn every_route_id_is_native() {
    let samples = samples(&css_name().await);
    let all = app(&[]).await;

    // The samples name every id once: none can be added without a line here.
    let mut sampled: Vec<&str> = samples.iter().map(|(id, ..)| *id).collect();
    let mut known = ROUTE_IDS.to_vec();
    sampled.sort_unstable();
    known.sort_unstable();
    assert_eq!(sampled, known);

    for (id, method, path) in &samples {
        let reply = send_sample(all, id, method, path, &[]).await;
        assert!(
            reply.headers.get("x-axum-not-ported").is_none(),
            "{id} {method} {path} is not ported: {}",
            reply.status
        );
    }
}

/// The crawl (PLAN.md L2): every route id's path with `GET`, `HEAD`, `POST`
/// and `OPTIONS`, and paths no route has with those and more. Nothing is a
/// 501, and every request is answered in time.
#[tokio::test]
async fn no_request_is_answered_501_or_left_hanging() {
    const DEADLINE: std::time::Duration = std::time::Duration::from_secs(15);
    let samples = samples(&css_name().await);
    let all = app(&[]).await;
    let mut requests: Vec<(&str, &str, String)> = Vec::new();
    for (id, _, path) in &samples {
        for method in ["GET", "HEAD", "POST", "OPTIONS"] {
            requests.push((id, method, path.clone()));
        }
    }
    let bogus = [
        "/no-such-page",
        "/no/such/page",
        "/api/no-such-route",
        "/api/auth/no-such-endpoint",
        "/_next/static/chunks/none.js",
        "/memes/abc-x/no/such/part",
        "/en/no-such-page",
        "/%ff",
        "/api/%ff",
    ];
    for path in bogus {
        for method in ["GET", "HEAD", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"] {
            requests.push(("bogus", method, path.to_owned()));
        }
    }

    for (id, method, path) in &requests {
        let reply = tokio::time::timeout(DEADLINE, send_sample(all, id, method, path, &[]))
            .await
            .unwrap_or_else(|_| panic!("{id} {method} {path}: no answer in {DEADLINE:?}"));
        assert_ne!(
            reply.status,
            StatusCode::NOT_IMPLEMENTED,
            "{id} {method} {path}"
        );
        assert!(
            reply.headers.get("x-axum-not-ported").is_none(),
            "{id} {method} {path}"
        );
        if *id == "bogus" {
            assert!(
                reply.status.is_client_error(),
                "{method} {path}: {}",
                reply.status
            );
        }
    }
}
