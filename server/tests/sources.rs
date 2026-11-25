//! The oEmbed routes of R11 over HTTP (`src/routes/sources/`, `src/oembed/`,
//! `src/routes/tracking/view_id.rs`), with the providers as a local stub
//! (`AXUM_TEST_OEMBED_ORIGIN`). Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. The tests write
//! `media_sources`, the recovery ledger and a database function, so they
//! hold `DB` while they run.

mod common;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{Reply, config, database_url, send, spawn_app, spawn_router};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::AssertSqlSafe;

static DB: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const SECRET: &str = "test-only-auth-secret";
const SITE: &str = "https://memes.example";
const BEARER: &str = "Bearer test-only-cron-secret";
const TIKTOK_ID: &str = "7312345678901234567";
const TIKTOK_URL: &str = "https://www.tiktok.com/@cat/video/7312345678901234567";
const TIKTOK_PATH: &str = "/www.tiktok.com/oembed";

type Seen = Arc<Mutex<Vec<String>>>;

/// The provider stub: answers by path and the `url` asked about, and
/// records `path?query` of each request.
async fn provider(answer: fn(&str, &str) -> (u16, String)) -> (SocketAddr, Seen) {
    let seen: Seen = Arc::default();
    let record = seen.clone();
    let addr = spawn_router(Router::new().fallback(move |request: Request| {
        let record = record.clone();
        async move {
            let uri = request.uri().clone();
            record.lock().unwrap().push(uri.to_string());
            let query = uri.query().unwrap_or("").as_bytes();
            let pairs: HashMap<String, String> =
                url::form_urlencoded::parse(query).into_owned().collect();
            let asked = pairs.get("url").map_or("", String::as_str);
            let (status, body) = answer(uri.path(), asked);
            (StatusCode::from_u16(status).unwrap(), body)
        }
    }))
    .await;
    (addr, seen)
}

fn requests(seen: &Seen, prefix: &str) -> usize {
    let seen = seen.lock().unwrap();
    seen.iter().filter(|uri| uri.starts_with(prefix)).count()
}

const VIDEOS: &str = r#"{"items":[{"id":"aaaaaaaaaaa","snippet":{"title":"live","channelTitle":"ch","thumbnails":{"high":{"url":"https://i.example/a.jpg"}}},"contentDetails":{"duration":"PT1M"},"status":{"privacyStatus":"public","embeddable":true,"license":"youtube"}}]}"#;
const MISSING_POST: &str = r#"{"error":{"message":"gone","code":24,"error_subcode":2207045}}"#;

fn answers(path: &str, url: &str) -> (u16, String) {
    match (path, url) {
        (TIKTOK_PATH, TIKTOK_URL) => (
            200,
            format!(
                r#"{{"title":" 고양이 ","author_name":"cat","html":"<b data-video-id=\"{TIKTOK_ID}\">"}}"#
            ),
        ),
        // A bare player: no title, so the check is inconclusive.
        (TIKTOK_PATH, _) => (200, r#"{"html":"<b>"}"#.to_owned()),
        ("/graph.facebook.com/v25.0/instagram_oembed", _) => (400, MISSING_POST.to_owned()),
        ("/www.googleapis.com/youtube/v3/videos", _) => (200, VIDEOS.to_owned()),
        _ => (500, String::new()),
    }
}

async fn app(provider: SocketAddr) -> SocketAddr {
    let origin = format!("http://{provider}");
    let env = [
        ("NEXT_PUBLIC_SITE_URL", SITE),
        ("CRON_SECRET", "test-only-cron-secret"),
        ("YOUTUBE_API_KEY", "test-key"),
        ("AXUM_TEST_OEMBED_ORIGIN", origin.as_str()),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(&database_url(), &env)).await
}

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

/// The first column of each row of `query`, as `service_role`.
async fn rows(query: String) -> Vec<String> {
    let found: Result<Vec<String>, sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(
                    async move { sqlx::query_scalar(AssertSqlSafe(query)).fetch_all(tx).await },
                )
            },
        )
        .await;
    found.expect("test query")
}

/// Statements as `service_role`, which owns the source tables' rows.
async fn as_service(statements: &'static str) {
    let done: Result<(), sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::raw_sql(statements).execute(tx).await.map(|_| ()) }),
        )
        .await;
    done.expect("service statements");
}

async fn reset() {
    as_service(
        "delete from public.source_acquisition_recovery;
         delete from public.source_ingestions;
         delete from public.media_sources;
         delete from public.job_runs where job_name = 'refresh_media_sources';",
    )
    .await;
}

/// A session cookie, of an operator when `operator`.
async fn signed_in(operator: bool) -> String {
    let db = test_db();
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("the better-auth tables");
    let user = create_user(db.pool()).await;
    let token = create_session(db.pool(), &user, 3_600.0).await;
    if operator {
        let promote = format!(
            "update public.profiles set role = 'operator' where id = '{}' returning id::text",
            user.id
        );
        rows(promote).await;
    }
    signed_cookie(PLAIN, &token, SECRET)
}

async fn oembed(app: SocketAddr, cookie: &str, url: &str) -> Reply {
    let encoded: String = url::form_urlencoded::byte_serialize(url.as_bytes()).collect();
    let path = format!("/api/oembed?url={encoded}");
    send(app, "GET", &path, &[("cookie", cookie)], Body::empty()).await
}

/// `status body` of a POST with these headers.
async fn post(app: SocketAddr, path: &str, headers: &[(&str, &str)], body: &str) -> String {
    let reply = send(app, "POST", path, headers, body.to_owned()).await;
    format!("{} {}", reply.status.as_u16(), reply.body)
}

async fn ingest(app: SocketAddr, cookie: &str, origin: Option<&str>, body: &str) -> String {
    let mut headers = vec![("cookie", cookie)];
    headers.extend(origin.map(|origin| ("origin", origin)));
    post(app, "/api/admin/source-ingestions", &headers, body).await
}

async fn refresh(app: SocketAddr) -> Reply {
    let auth = [("authorization", BEARER)];
    send(app, "GET", "/api/cron/source-refresh", &auth, Body::empty()).await
}

#[tokio::test]
async fn one_cache_serves_the_oembed_route_the_ingestion_and_the_refresh_db() {
    let _db = DB.lock().await;
    reset().await;
    let (stub, seen) = provider(answers).await;
    let app = app(stub).await;
    let cookie = signed_in(true).await;

    let signed_out = oembed(app, "", TIKTOK_URL).await;
    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(
        signed_out.body,
        r#"{"error":"로그인이 필요해요.","code":"SIGNED_OUT"}"#
    );
    // `reserve_oembed_request` (db/migrations/20261124090100) allows a
    // signed-in user 100 calls an hour; each test signs in a new user.
    let first = oembed(app, &cookie, TIKTOK_URL).await;
    assert_eq!(first.status, StatusCode::OK, "{}", first.body);
    assert_eq!(first.header("cache-control"), Some("private, max-age=3600"));
    let player = format!("https://www.tiktok.com/player/v1/{TIKTOK_ID}?description=1&music_info=1");
    assert_eq!(
        first.body,
        format!(
            r#"{{"provider":"tiktok","sourceUrl":"{TIKTOK_URL}","embedUrl":"{player}","embedHtml":null,"contentId":"{TIKTOK_ID}","providerContentId":"{TIKTOK_ID}","title":"고양이","authorName":"cat"}}"#
        )
    );
    // The ingestion of the same post reads the answer the route stored.
    let body = format!(r#"{{"url":" {TIKTOK_URL}/ "}}"#);
    let ingested = ingest(app, &cookie, Some(SITE), &body).await;
    assert!(
        ingested.starts_with(r#"200 {"ok":true,"data":{"id":""#),
        "{ingested}"
    );
    let tail = format!(
        r#""status":"metadata_ready","platform":"tiktok","externalId":"{TIKTOK_ID}","canonicalUrl":"{TIKTOK_URL}","title":"고양이","author":"cat","rightsMode":"METADATA_ONLY","duplicate":false}}}}"#
    );
    assert!(ingested.ends_with(&tail), "{ingested}");
    assert_eq!(requests(&seen, TIKTOK_PATH), 1);

    // The refresh run leaves the TikTok source alone, even once it is due:
    // TikTok's oEmbed cannot tell a live post (refresh_select.rs, `choose`).
    as_service("update public.media_sources set last_checked_at = null").await;
    let refreshed = refresh(app).await;
    assert_eq!(refreshed.status, StatusCode::OK, "{}", refreshed.body);
    assert_eq!(refreshed.header("cache-control"), Some("no-store"));
    assert!(
        refreshed
            .body
            .contains(r#""oembed":{"checked":0,"removed":0,"failed":0,"#),
        "{}",
        refreshed.body
    );
    assert_eq!(
        requests(&seen, TIKTOK_PATH),
        1,
        "the route and the ingestion share the cache"
    );
    let unsupported = oembed(app, &cookie, "https://example.com/x").await;
    assert_eq!(unsupported.status, StatusCode::BAD_REQUEST);
    assert!(
        unsupported
            .body
            .ends_with(r#""code":"UNSUPPORTED_PROVIDER"}"#)
    );
    reset().await;
}

#[tokio::test]
async fn the_ingestion_refuses_as_the_typescript_does_db() {
    let _db = DB.lock().await;
    reset().await;
    let (stub, seen) = provider(answers).await;
    let app = app(stub).await;
    let operator = signed_in(true).await;
    let user = signed_in(false).await;
    let reel = r#"{"url":"https://www.instagram.com/reel/Cx1abc/"}"#;
    let invalid_origin = r#"403 {"ok":false,"error":"invalid_origin"}"#;

    assert_eq!(ingest(app, &operator, None, reel).await, invalid_origin);
    assert_eq!(
        ingest(app, &operator, Some("https://evil.example"), reel).await,
        invalid_origin
    );
    assert_eq!(
        ingest(app, "", Some(SITE), reel).await,
        r#"401 {"ok":false,"error":"signed_out"}"#
    );
    assert_eq!(
        ingest(app, &user, Some(SITE), reel).await,
        r#"403 {"ok":false,"error":"operator_required"}"#
    );
    for invalid in [
        "",
        "null",
        "[]",
        r#"{"url":"  "}"#,
        r#"{"url":5}"#,
        r#"{"url":"x","targetMemeId":null}"#,
        r#"{"url":"x","targetMemeId":"x"}"#,
        r#"{"url":"x","retry":"true"}"#,
    ] {
        assert_eq!(
            ingest(app, &operator, Some(SITE), invalid).await,
            r#"400 {"ok":false,"error":"invalid_input"}"#,
            "{invalid}"
        );
    }
    assert_eq!(
        ingest(app, &operator, Some(SITE), r#"{"url":"x","retry":false}"#).await,
        r#"400 {"ok":false,"error":"invalid_retry"}"#
    );
    assert_eq!(
        ingest(
            app,
            &operator,
            Some(SITE),
            r#"{"url":"https://vt.tiktok.com/x/","retry":true}"#
        )
        .await,
        r#"400 {"ok":false,"error":"지원하는 플랫폼의 최종 HTTPS 공개 URL이 필요합니다.","code":"invalid_url","retryable":false}"#
    );
    let unknown_meme = r#"{"url":"https://www.instagram.com/reel/Cx1abc/","targetMemeId":"11111111-1111-4111-8111-111111111111"}"#;
    assert_eq!(
        ingest(app, &operator, Some(SITE), unknown_meme).await,
        r#"404 {"ok":false,"error":"대상 밈을 찾지 못했습니다.","code":"missing_meme","retryable":false}"#
    );
    // Meta's missing post: 404, recorded, not retried.
    assert_eq!(
        ingest(app, &operator, Some(SITE), reel).await,
        r#"404 {"ok":false,"error":"gone","code":"provider_uncertain","retryable":false}"#
    );
    let ledger = rows(
        "select source_key || ' ' || last_error_code || ' ' || last_error_retryable
           from public.source_acquisition_recovery"
            .into(),
    )
    .await;
    assert_eq!(ledger, ["instagram:Cx1abc provider_uncertain false"]);
    // A provider 500 is transient: retried later.
    let shorts = r#"{"url":"https://www.youtube.com/shorts/bbbbbbbbbbb"}"#;
    let failed = ingest(app, &operator, Some(SITE), shorts).await;
    assert!(
        failed.starts_with(r#"502 {"ok":false,"error":"플랫폼에서 콘텐츠 정보를 가져오지 못했습니다.","code":"provider_transient","retryable":true,"nextRetryAt":""#),
        "{failed}"
    );
    assert_eq!(requests(&seen, "/www.youtube.com/oembed"), 1);
    reset().await;
}

const SOURCES: &str = "insert into public.media_sources (id, platform, external_id, canonical_url) values
  ('00000000-0000-4000-8000-000000000001', 'youtube', 'aaaaaaaaaaa', 'https://www.youtube.com/watch?v=aaaaaaaaaaa'),
  ('00000000-0000-4000-8000-000000000002', 'youtube', 'ccccccccccc', 'https://www.youtube.com/watch?v=ccccccccccc'),
  ('00000000-0000-4000-8000-000000000003', 'youtube', 'ddddddddddd', 'https://youtu.be/ddddddddddd'),
  ('00000000-0000-4000-8000-000000000004', 'tiktok', '7312345678901234567', 'https://www.tiktok.com/@cat/video/7312345678901234567'),
  ('00000000-0000-4000-8000-000000000005', 'tiktok', '7300000000000000001', 'https://www.tiktok.com/@dog/video/7300000000000000001'),
  ('00000000-0000-4000-8000-000000000006', 'instagram', 'Cx1abc', 'https://www.instagram.com/reel/Cx1abc/');";

const PARTIAL_RUN: &str = concat!(
    r#"{"ok":false,"status":"partial","#,
    r#""youtube":{"checked":3,"removed":1,"hidden":0,"failed":1,"errors":["invalid_source_identity:00000000-0000-4000-8000-000000000003"]},"#,
    r#""oembed":{"checked":1,"removed":1,"failed":0,"errors":[],"deferred_by_deadline":0},"#,
    r#""observations":{"youtube":{"selected":3,"provider_submitted":2,"confirmed":2,"inconclusive":0,"invalid_identity":1},"#,
    r#""youtube_shorts":{"selected":0,"provider_submitted":0,"confirmed":0,"inconclusive":0,"invalid_identity":0},"#,
    r#""instagram":{"selected":1,"provider_submitted":1,"confirmed":1,"inconclusive":0,"invalid_identity":0},"#,
    // TikTok sources are not selected: its oEmbed cannot tell a live post.
    r#""tiktok":{"selected":0,"provider_submitted":0,"confirmed":0,"inconclusive":0,"invalid_identity":0}},"#,
    r#""recovery_unmatched_due_keys":0,"recovery_conflicting_stale_sources":0,"recovery_unowned_keys":0}"#
);

#[tokio::test]
async fn the_refresh_run_checks_each_platform_and_records_the_run_db() {
    let _db = DB.lock().await;
    reset().await;
    let (stub, seen) = provider(answers).await;
    let app = app(stub).await;
    as_service(SOURCES).await;
    let unauthorized = send(app, "GET", "/api/cron/source-refresh", &[], Body::empty()).await;
    assert_eq!(unauthorized.status, StatusCode::UNAUTHORIZED);
    assert_eq!(unauthorized.body, r#"{"ok":false,"error":"UNAUTHORIZED"}"#);

    let reply = refresh(app).await;
    assert_eq!(reply.status, StatusCode::BAD_GATEWAY, "{}", reply.body);
    assert_eq!(reply.body, PARTIAL_RUN);
    let sources = rows(
        "select id::text || ' ' || coalesce(title, '-') || ' ' || (removed_at is not null)
                || ' ' || (last_checked_at is not null)
           from public.media_sources order by id"
            .into(),
    )
    .await;
    assert_eq!(
        sources,
        [
            "00000000-0000-4000-8000-000000000001 live false true",
            "00000000-0000-4000-8000-000000000002 - true true",
            "00000000-0000-4000-8000-000000000003 - false false",
            "00000000-0000-4000-8000-000000000004 - false false",
            "00000000-0000-4000-8000-000000000005 - false false",
            "00000000-0000-4000-8000-000000000006 - true true",
        ]
    );
    let ledger = rows(
        "select source_key || ' ' || last_error_code
           from public.source_acquisition_recovery order by 1"
            .into(),
    )
    .await;
    assert_eq!(
        ledger,
        ["invalid_identity:00000000-0000-4000-8000-000000000003 metadata_mismatch"]
    );
    let job = rows(
        "select ok::text || ' ' || (detail->>'status') from public.job_runs
          where job_name = 'refresh_media_sources'"
            .into(),
    )
    .await;
    assert_eq!(job, ["false partial"]);
    let videos = "/www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatus%2CcontentDetails&id=aaaaaaaaaaa%2Cccccccccccc&key=test-key";
    assert_eq!(requests(&seen, videos), 1);
    reset().await;
}

/// D2-11: the browser's own same-origin call is recorded, and
/// the meme page's call to `/api/memes/view` records its view too.
#[tokio::test]
async fn the_view_of_one_meme_takes_the_site_origin_records_it_and_shares_the_view_limit_db() {
    let _db = DB.lock().await;
    let env = [
        ("MEMECATCH_SIGNING_SECRET", "s"),
        ("NEXT_PUBLIC_SITE_URL", SITE),
    ];
    let app = spawn_app(config(&database_url(), &env)).await;
    as_service(
        "delete from public.memes where id = '11111111-1111-4111-8111-111111111111';
         insert into public.memes (id, title, slug, moderation_status)
         values ('11111111-1111-4111-8111-111111111111', 'D2 조회 시험', 'd2-view-test', 'approved');",
    )
    .await;
    let views = || {
        rows(
            "select count(*)::text from public.view_events
               where meme_id = '11111111-1111-4111-8111-111111111111'"
                .into(),
        )
    };
    let path = "/api/memes/11111111-1111-4111-8111-111111111111/view";
    let refused = r#"403 {"ok":false,"error":"origin_not_allowed"}"#;

    // Another site, or no origin and no same-origin fetch metadata: refused.
    assert_eq!(post(app, path, &[], "").await, refused);
    let foreign = [("origin", "https://evil.example")];
    assert_eq!(post(app, path, &foreign, "").await, refused);
    let cross_site = [("sec-fetch-site", "cross-site")];
    assert_eq!(post(app, path, &cross_site, "").await, refused);
    assert_eq!(views().await, ["0"]);

    // What a browser's same-origin fetch sends.
    let browser = [("origin", SITE), ("sec-fetch-site", "same-origin")];
    assert_eq!(
        post(app, "/api/memes/not-an-id/view", &browser, "").await,
        r#"400 {"ok":false,"error":"invalid_id"}"#
    );
    assert_eq!(post(app, path, &browser, "").await, r#"202 {"ok":true}"#);
    assert_eq!(views().await, ["1"]);
    // The same viewer the same day: still one.
    let same_origin = [("sec-fetch-site", "same-origin")];
    assert_eq!(
        post(app, path, &same_origin, "").await,
        r#"202 {"ok":true}"#
    );
    assert_eq!(views().await, ["1"]);

    // The meme page's own call (ui/page.js) records through increment_view.
    let page = [("origin", SITE), ("content-type", "application/json")];
    let body = r#"{"memeId":"11111111-1111-4111-8111-111111111111"}"#;
    assert_eq!(
        post(app, "/api/memes/view", &page, body).await,
        r#"202 {"ok":true}"#
    );
    assert_eq!(views().await, ["2"]);

    // One counter with /api/memes/view: 27 more there, and the 31st is refused here.
    for _ in 0..27 {
        post(app, "/api/memes/view", &[], "{}").await;
    }
    assert_eq!(
        post(app, path, &browser, "").await,
        r#"429 {"ok":false,"error":"rate_limited"}"#
    );
    as_service("delete from public.memes where id = '11111111-1111-4111-8111-111111111111';").await;
}
