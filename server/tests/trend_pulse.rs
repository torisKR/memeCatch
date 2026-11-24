//! `GET /api/cron/trend-pulse` over HTTP (`src/routes/ops/trend_pulse.rs`),
//! with the radar providers and Next's internal cache route as local stubs.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They share
//! `connector_health`, so they hold `DB` while they run.

#[path = "common/mod.rs"]
mod common;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{
    Reply, UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app,
    spawn_router,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sqlx::AssertSqlSafe;

const PATH: &str = "/api/cron/trend-pulse";
const BEARER: &str = "Bearer test-only-cron-secret";
const X_SEARCH: &str = "/api.x.com/2/tweets/search/recent";
const CACHE: &str = "/api/internal/cache";

static DB: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

type Seen = Arc<Mutex<Vec<String>>>;

/// A stub that records `METHOD target authorization` and answers each path
/// with its scripted status and body, 404 otherwise.
async fn stub(script: &[(&str, u16, &str)]) -> (SocketAddr, Seen) {
    let answers: HashMap<String, (u16, String)> = script
        .iter()
        .map(|(path, status, body)| ((*path).to_owned(), (*status, (*body).to_owned())))
        .collect();
    let answers = Arc::new(answers);
    let seen: Seen = Arc::new(Mutex::new(Vec::new()));
    let record = seen.clone();
    let addr = spawn_router(Router::new().fallback(move |request: Request| {
        let (record, answers) = (record.clone(), answers.clone());
        async move {
            let authorization = request
                .headers()
                .get("authorization")
                .map(|value| value.to_str().expect("ascii").to_owned())
                .unwrap_or_default();
            record.lock().expect("lock").push(format!(
                "{} {} {authorization}",
                request.method(),
                request.uri()
            ));
            let (status, body) = answers
                .get(request.uri().path())
                .cloned()
                .unwrap_or((404, String::new()));
            (StatusCode::from_u16(status).expect("a status"), body)
        }
    }))
    .await;
    (addr, seen)
}

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
        ("CRON_SECRET", "test-only-cron-secret"),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

/// The app with the X connector sending to `provider`.
async fn app_with_x(next: SocketAddr, provider: SocketAddr) -> SocketAddr {
    let origin = format!("http://{provider}");
    let env = [
        ("RADAR_X_TERMS", "밈, #짤"),
        ("X_API_BEARER_TOKEN", " x-token "),
        ("AXUM_TEST_RADAR_ORIGIN", origin.as_str()),
    ];
    app(next, &database_url(), &env).await
}

async fn pulse(app: SocketAddr) -> Reply {
    send(
        app,
        "GET",
        PATH,
        &[("authorization", BEARER)],
        Body::empty(),
    )
    .await
}

fn test_db() -> Db {
    Db::connect_lazy(&database_url(), 2).expect("database url")
}

async fn execute(statements: &'static str) {
    let done: Result<(), sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(AssertSqlSafe(statements))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    done.expect("test statements");
}

async fn clear_health() {
    execute("delete from public.connector_health").await;
}

type HealthRow = (String, String, i32, Option<String>, Option<String>);

async fn health() -> Vec<HealthRow> {
    let found: Result<Vec<HealthRow>, sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(
                        "select connector_key, status, consecutive_failures, last_error, \
                     cursor_state->>'cursor' from public.connector_health order by connector_key",
                    )
                    .fetch_all(tx)
                    .await
                })
            },
        )
        .await;
    found.expect("health rows")
}

#[tokio::test]
async fn trend_pulse_refuses_a_wrong_bearer() {
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &[]).await;
    for header in [
        None,
        Some("Bearer wrong"),
        Some("bearer test-only-cron-secret"),
    ] {
        let headers: Vec<(&str, &str)> = header.map(|v| ("authorization", v)).into_iter().collect();
        let reply = send(app, "GET", PATH, &headers, Body::empty()).await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED, "{header:?}");
        assert_eq!(reply.body, r#"{"ok":false,"error":"UNAUTHORIZED"}"#);
    }
    // POST is not the route's: Next answers it.
    let reply = send(
        app,
        "POST",
        PATH,
        &[("authorization", BEARER)],
        Body::empty(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::IM_A_TEAPOT);
}

#[tokio::test]
async fn trend_pulse_falls_through_to_next_when_disabled() {
    let disabled = [("AXUM_DISABLED_ROUTES", "trend-pulse")];
    let app = app(marker_upstream().await, UNUSED_DATABASE_URL, &disabled).await;
    let reply = pulse(app).await;
    assert_eq!(reply.body, format!("upstream saw GET {PATH}"));
}

#[tokio::test]
async fn trend_pulse_db_runs_and_then_expires_the_catalog() {
    let _db = DB.lock().await;
    let (next, seen) = stub(&[(CACHE, 200, "{}")]).await;
    let reply = pulse(app(next, &database_url(), &[]).await).await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert_eq!(
        reply.body,
        r#"{"ok":true,"status":"ok","alerts":0,"savedContextAlerts":0}"#
    );
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!("POST {CACHE}?scope=public-catalog {BEARER}")]
    );
    // A failed expiry is Next's background work: the answer stays.
    let (failing, _) = stub(&[(CACHE, 500, "{}")]).await;
    let reply = pulse(app(failing, &database_url(), &[]).await).await;
    assert_eq!(reply.status, StatusCode::OK);
}

#[tokio::test]
async fn trend_pulse_reports_a_failed_compute_and_expires_nothing() {
    let (next, seen) = stub(&[(CACHE, 200, "{}")]).await;
    let database = format!(
        "postgresql://memecatch:x@{}/memecatch",
        common::closed_addr().await
    );
    let reply = pulse(app(next, &database, &[]).await).await;
    assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
    let prefix =
        r#"{"ok":false,"status":"failed","alerts":0,"savedContextAlerts":0,"error":"compute:"#;
    assert!(reply.body.starts_with(prefix), "{}", reply.body);
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    // The scores were not computed: nothing to expire.
    assert!(seen.lock().expect("lock").is_empty());
}

#[tokio::test]
async fn trend_pulse_db_sends_the_x_search_and_records_its_health() {
    let _db = DB.lock().await;
    clear_health().await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let (provider, seen) = stub(&[(X_SEARCH, 200, r#"{"meta":{"newest_id":"42"}}"#)]).await;
    let reply = pulse(app_with_x(next, provider).await).await;
    // " #짤" is the seed "짤" (D2-12; the TypeScript kept the `#`).
    let radar = r#""radar":{"status":"ok","persistedSignals":0,"automaticMatches":0,"pendingMatches":0,"observations":0,"safetyReviews":0}"#;
    assert_eq!(
        reply.body,
        format!(r#"{{"ok":true,"status":"ok","alerts":0,"savedContextAlerts":0,{radar}}}"#)
    );
    let query = "query=%28%22%EB%B0%88%22+OR+%22%EC%A7%A4%22%29+lang%3Ako+-is%3Aretweet+-has%3Amedia\
                 &tweet.fields=created_at%2Clang&max_results=25";
    assert_eq!(
        *seen.lock().expect("lock"),
        [format!("GET {X_SEARCH}?{query} Bearer x-token")]
    );
    // X's key is "x" (R8-2, D3-2): its health and its cursor are kept, and
    // the next search starts after it.
    assert_eq!(
        health().await,
        [("x".into(), "healthy".into(), 0, None, Some("42".into()))]
    );
    let (provider, seen) = stub(&[(X_SEARCH, 200, "{}")]).await;
    pulse(app_with_x(next, provider).await).await;
    let first = seen.lock().expect("lock")[0].clone();
    assert!(first.contains("&since_id=42 "), "{first}");
    clear_health().await;
}

#[tokio::test]
async fn trend_pulse_db_records_threads_health_and_counts_failures() {
    let _db = DB.lock().await;
    clear_health().await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let search = "/graph.threads.com/v1.0/keyword_search";
    let threads = |provider: SocketAddr| async move {
        let origin = format!("http://{provider}");
        let env = [
            ("RADAR_THREADS_TERMS", "a,b"),
            ("THREADS_ACCESS_TOKEN", "t-token"),
            ("AXUM_TEST_RADAR_ORIGIN", origin.as_str()),
        ];
        pulse(app(next, &database_url(), &env).await).await
    };
    let answer = r#"{"data":[{"id":"1","media_type":"IMAGE"}]}"#;
    let (provider, seen) = stub(&[(search, 200, answer)]).await;
    let reply = threads(provider).await;
    assert!(reply.body.contains(r#""status":"ok""#), "{}", reply.body);
    assert_eq!(seen.lock().expect("lock").len(), 2, "one search per term");
    let healthy = ("threads".into(), "healthy".into(), 0, None, None);
    assert_eq!(health().await, [healthy]);
    let (provider, _) = stub(&[(search, 503, "")]).await;
    let reply = threads(provider).await;
    assert!(
        reply.body.contains(r#""radar":{"status":"failed""#),
        "{}",
        reply.body
    );
    let down = (
        "threads".into(),
        "down".into(),
        1,
        Some("HTTP 503".into()),
        None,
    );
    assert_eq!(health().await, [down]);
    clear_health().await;
}

/// One statement's rows as text, as `service_role`.
async fn texts(sql: &'static str) -> Vec<String> {
    let found: Result<Vec<String>, sqlx::Error> = test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_scalar(sql).fetch_all(tx).await }),
        )
        .await;
    found.expect("rows")
}

/// One statement in its own transaction, for a check that may refuse it.
async fn try_execute(sql: &'static str) -> Result<(), sqlx::Error> {
    test_db()
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(AssertSqlSafe(sql))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await
}

/// The radar's key checks take X's one-letter key `x` and nothing looser
/// (migration 20261124100000, D3-2).
#[tokio::test]
async fn radar_db_key_checks_take_the_one_letter_x_key() {
    let _db = DB.lock().await;
    clear_health().await;
    execute("delete from public.external_signals where platform_content_id = 'd3-check'").await;
    try_execute(
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values ('x', 'healthy', now())",
    )
    .await
    .expect("the key x");
    try_execute(
        "insert into public.external_signals (platform, connector_key, platform_content_id, \
         signal_kind, observed_at, first_seen_at, last_seen_at, ingestion_version, rights_mode) \
         values ('x', 'x', 'd3-check', 'text_mention', now(), now(), now(), 1, 'link_only')",
    )
    .await
    .expect("the platform and connector x");
    let refused = [
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values ('X', 'healthy', now())",
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values ('-', 'healthy', now())",
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values ('', 'healthy', now())",
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values (repeat('a', 65), 'healthy', now())",
        "update public.external_signals set connector_key = '_' \
         where platform_content_id = 'd3-check'",
        "update public.external_signals set platform = 'y' \
         where platform_content_id = 'd3-check'",
    ];
    for sql in refused {
        let error = try_execute(sql).await.expect_err(sql);
        let code = error.as_database_error().and_then(|error| error.code());
        assert_eq!(code.as_deref(), Some("23514"), "{sql}: {error}");
    }
    try_execute(
        "insert into public.connector_health (connector_key, status, last_checked_at) \
         values (repeat('a', 64), 'healthy', now())",
    )
    .await
    .expect("64 characters");
    execute("delete from public.external_signals where platform_content_id = 'd3-check'").await;
    clear_health().await;
}

const INSTAGRAM_SEARCH: &str = "/graph.facebook.com/v26.0/ig_hashtag_search";
const INSTAGRAM_MEDIA: &str = "/graph.facebook.com/v26.0/d3tag/recent_media";
const OPERATOR_PAGE: &str = "/admin/radar-safety";

/// Three memes for the radar: two it reads (approved), one it does not
/// (pending), and no signal of an earlier run.
async fn seed_radar_memes() {
    execute(
        "delete from public.radar_meme_state where meme_id in \
           (select id from public.memes where slug like 'd3-radar-%'); \
         delete from public.memes where slug like 'd3-radar-%'; \
         delete from public.external_signals where platform_content_id like 'd3%'; \
         insert into public.memes (title, slug, aliases, moderation_status, lifecycle_status) values \
           ('d3냥이춤', 'd3-radar-a', '{d3냥냥}', 'approved', 'active'), \
           ('d3멍멍', 'd3-radar-b', '{}', 'approved', 'active'), \
           ('d3숨은밈', 'd3-radar-c', '{}', 'pending', 'active')",
    )
    .await;
}

/// An operator's session cookie on `state`'s database, and their id.
async fn operator_cookie(state: &memecatch_server::AppState) -> (String, String) {
    use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
    let pool = state.db.pool().clone();
    sqlx::raw_sql(AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let operator = create_user(&pool).await;
    let id = operator.id.clone();
    let promoted: Result<u64, sqlx::Error> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query("update public.profiles set role = 'operator' where id = $1::uuid")
                        .bind(id)
                        .execute(tx)
                        .await
                        .map(|done| done.rows_affected())
                })
            },
        )
        .await;
    assert_eq!(promoted.expect("a profile"), 1);
    let token = create_session(&pool, &operator, 3_600.0).await;
    (
        signed_cookie(PLAIN, &token, "test-only-auth-secret"),
        operator.id,
    )
}

/// A full radar run over the X and Instagram stubs (R8-1, D3-1, D3-3):
/// every new signal is stored with 30 days of raw retention, matched to the
/// memes the radar reads, kept as automatic (0.9 and above) or pending, the
/// matched meme gets an observation, and the operator screen lists the
/// pending match. A second run stores nothing new and matches nothing.
#[tokio::test]
async fn trend_pulse_db_stores_matches_scores_and_queues_signals() {
    let _db = DB.lock().await;
    clear_health().await;
    seed_radar_memes().await;
    // Tomorrow (age 0, so the heat does not depend on when the test runs),
    // Instagram a minute after X.
    let times = texts(
        "select to_char(t, 'YYYY-MM-DD\"T\"HH24:MI:SS.000\"Z\"') || '|' || \
                to_char(t + interval '1 minute', 'YYYY-MM-DD\"T\"HH24:MI:SS\"+0000\"') \
         from (select date_trunc('second', now() + interval '1 day') at time zone 'UTC' as t) n",
    )
    .await;
    let (x_time, instagram_time) = times[0].split_once('|').expect("two times");
    let posts = serde_json::json!({
        "data": [
            { "id": "d3x1", "text": "an older copy", "created_at": x_time, "lang": "ko" },
            { "id": "d3x2", "text": "zz d3멍멍 zz", "created_at": x_time, "lang": "ko" },
            { "id": "d3x3", "text": "d3숨은밈", "created_at": x_time, "lang": "ko" },
            { "id": "d3x1", "text": "d3냥이춤", "created_at": x_time, "lang": "ko" },
        ],
        "meta": { "newest_id": "d3x3" },
    })
    .to_string();
    let media = serde_json::json!({
        "data": [{
            "id": "d3i1",
            "caption": "보세요 #d3냥이춤",
            "media_type": "IMAGE",
            "permalink": "https://www.instagram.com/p/d3i1/",
            "timestamp": instagram_time,
            "like_count": 10,
            "comments_count": 2,
        }],
    })
    .to_string();
    let (provider, _) = stub(&[
        (X_SEARCH, 200, posts.as_str()),
        (INSTAGRAM_SEARCH, 200, r#"{"data":[{"id":"d3tag"}]}"#),
        (INSTAGRAM_MEDIA, 200, media.as_str()),
    ])
    .await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let origin = format!("http://{provider}");
    let state = memecatch_server::AppState::new(config(
        next,
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
            ("CRON_SECRET", "test-only-cron-secret"),
            ("NODE_ENV", "development"),
            ("AXUM_PILOT_ROUTES", "page-admin-radar-safety"),
            ("RADAR_X_TERMS", "d3"),
            ("X_API_BEARER_TOKEN", "x-token"),
            ("RADAR_INSTAGRAM_HASHTAGS", "d3냥이춤"),
            ("META_INSTAGRAM_ACCESS_TOKEN", "ig-token"),
            ("META_INSTAGRAM_USER_ID", "ig-user"),
            ("AXUM_TEST_RADAR_ORIGIN", origin.as_str()),
        ],
    ))
    .expect("app state");
    let (cookie, _) = operator_cookie(&state).await;
    let app = spawn_router(memecatch_server::build_app(state)).await;
    let headers = [("cookie", cookie.as_str())];
    let operator_page = || send(app, "GET", OPERATOR_PAGE, &headers, Body::empty());
    let page = operator_page().await;
    assert!(
        page.body.contains("확인을 기다리는 신호 매칭이 없어요."),
        "{}",
        page.body
    );

    let reply = pulse(app).await;
    let radar = r#""radar":{"status":"ok","persistedSignals":4,"automaticMatches":2,"pendingMatches":1,"observations":1,"safetyReviews":0}"#;
    assert!(reply.body.contains(radar), "{}", reply.body);

    // The signals as `signalInsert` writes them, the last copy of d3x1.
    assert_eq!(
        texts(
            "select concat_ws('|', platform_content_id, platform, connector_key, signal_kind, \
                    rights_mode, text, hashtags::text, metrics_json::text, payload::text, \
                    coalesce(query_seed, '-'), coalesce(language, '-'), \
                    (raw_expires_at - collected_at)::text, \
                    collected_at = (select last_checked_at from public.connector_health \
                                    where connector_key = 'x')) \
             from public.external_signals where platform_content_id like 'd3%' \
             order by platform_content_id",
        )
        .await,
        [
            "d3i1|instagram|instagram|instagram_media|api_metadata|보세요 #d3냥이춤|{d3냥이춤}|\
             {\"engagement\": 38.47424036192305}|{\"media_type\": \"IMAGE\"}|d3냥이춤|-|30 days|t",
            "d3x1|x|x|text_mention|link_only|d3냥이춤|{}|{\"volume\": 1}|{}|-|ko|30 days|t",
            "d3x2|x|x|text_mention|link_only|zz d3멍멍 zz|{}|{\"volume\": 1}|{}|-|ko|30 days|t",
            "d3x3|x|x|text_mention|link_only|d3숨은밈|{}|{\"volume\": 1}|{}|-|ko|30 days|t",
        ]
    );
    // The retention check's bound is the expiry: a microsecond more is refused.
    let error = try_execute(
        "update public.external_signals set raw_expires_at = raw_expires_at + interval '1 microsecond' \
         where platform_content_id = 'd3x1'",
    )
    .await
    .expect_err("past 30 days");
    assert!(
        error.to_string().contains("raw_retention_max_30d"),
        "{error}"
    );

    let links = "select concat_ws('|', m.slug, s.platform_content_id, l.match_method, \
                        l.match_confidence, l.review_state, (l.reviewed_at is not null)::text, \
                        (l.reviewed_by is null)::text) \
                 from public.meme_signal_links l \
                 join public.memes m on m.id = l.meme_id \
                 join public.external_signals s on s.id = l.signal_id \
                 where m.slug like 'd3-radar-%' order by 1";
    let expected_links = [
        "d3-radar-a|d3i1|canonical_hashtag|0.9400|auto_matched|true|true",
        "d3-radar-a|d3x1|canonical_exact|0.9900|auto_matched|true|true",
        "d3-radar-b|d3x2|canonical_phrase|0.8700|pending|false|true",
    ];
    assert_eq!(texts(links).await, expected_links);
    // X and Instagram at 0.99 and 0.94: heat 5.87, confidence 0.8606 (what
    // calculateRadarSignal gives). `compute_trend_scores`, which runs first,
    // made the viewless meme `cooling`; under 25 the radar recommends
    // `archive`, a candidate until a second observation. The newest signal
    // is the observation's.
    let observations = "select concat_ws('|', m.slug, s.platform_content_id, o.heat_score, \
                               o.confidence, o.recommended_state, o.model_version, o.factors::text, \
                               r.current_state, r.candidate_state, r.candidate_observations, \
                               r.required_observations) \
                        from public.radar_trend_observations o \
                        join public.memes m on m.id = o.meme_id \
                        join public.external_signals s on s.id = o.signal_id \
                        join public.radar_meme_state r on r.last_observation_id = o.id \
                        where m.slug like 'd3-radar-%'";
    let expected_observations = ["d3-radar-a|d3i1|5.8700|0.8606|archive|radar_v1|\
         {\"platforms\": [\"instagram\", \"x\"], \"excluded_platforms\": []}|cooling|archive|1|2"];
    assert_eq!(texts(observations).await, expected_observations);

    let page = operator_page().await;
    assert_eq!(page.status, StatusCode::OK);
    for shown in [
        "확인을 기다리는 신호 매칭",
        "d3멍멍",
        "zz d3멍멍 zz",
        "대표 이름이 글에 나옴",
        "신뢰도 0.87",
        "href=\"https://x.com/i/web/status/d3x2\"",
    ] {
        assert!(page.body.contains(shown), "{shown}: {}", page.body);
    }
    assert!(!page.body.contains("d3숨은밈"), "{}", page.body);

    // Nothing is new the second time.
    let reply = pulse(app).await;
    let radar = r#""radar":{"status":"ok","persistedSignals":0,"automaticMatches":0,"pendingMatches":0,"observations":0,"safetyReviews":0}"#;
    assert!(reply.body.contains(radar), "{}", reply.body);
    assert_eq!(texts(links).await, expected_links);
    assert_eq!(texts(observations).await, expected_observations);

    seed_radar_memes().await;
    clear_health().await;
}

/// A meme whose recorded observation is newer than this run's newest signal
/// (`stale_radar_observation`) is skipped and named in the result; the run
/// still succeeds and the other memes are observed (D4-2).
#[tokio::test]
async fn trend_pulse_db_skips_a_stale_observation_and_observes_the_rest() {
    let _db = DB.lock().await;
    clear_health().await;
    seed_radar_memes().await;
    // Meme a was observed ten days from now: every signal of the run is older.
    execute(
        "select public.record_radar_trend_observation(p_meme_id => m.id, p_signal_id => null, \
           p_observed_at => now() + interval '10 days', p_heat_score => 1, p_confidence => 0.5, \
           p_recommended_state => 'archive', p_model_version => 'd4-seed') \
         from public.memes m where m.slug = 'd3-radar-a'",
    )
    .await;
    let stale_meme = texts("select id::text from public.memes where slug = 'd3-radar-a'").await;
    let x_time = texts(
        "select to_char(date_trunc('second', now() + interval '1 day') at time zone 'UTC', \
                        'YYYY-MM-DD\"T\"HH24:MI:SS.000\"Z\"')",
    )
    .await;
    let posts = serde_json::json!({
        "data": [
            { "id": "d3x1", "text": "d3냥이춤", "created_at": x_time[0], "lang": "ko" },
            { "id": "d3x2", "text": "d3멍멍", "created_at": x_time[0], "lang": "ko" },
        ],
        "meta": { "newest_id": "d3x2" },
    })
    .to_string();
    let (provider, _) = stub(&[(X_SEARCH, 200, posts.as_str())]).await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let app = app_with_x(next, provider).await;

    let reply = pulse(app).await;
    let radar = format!(
        r#""radar":{{"status":"ok","persistedSignals":2,"automaticMatches":2,"pendingMatches":0,"observations":1,"safetyReviews":0,"skippedObservations":[{{"memeId":"{}","error":"stale_radar_observation"}}]}}"#,
        stale_meme[0]
    );
    assert!(reply.body.contains(&radar), "{}", reply.body);
    // Meme a keeps the seeded observation; meme b has this run's.
    assert_eq!(
        texts(
            "select concat_ws('|', m.slug, o.model_version, coalesce(s.platform_content_id, '-')) \
             from public.radar_meme_state r \
             join public.radar_trend_observations o on o.id = r.last_observation_id \
             join public.memes m on m.id = r.meme_id \
             left join public.external_signals s on s.id = o.signal_id \
             where m.slug like 'd3-radar-%' order by 1",
        )
        .await,
        ["d3-radar-a|d4-seed|-", "d3-radar-b|radar_v1|d3x2"]
    );

    seed_radar_memes().await;
    clear_health().await;
}

const MATCH_ACTION: &str = "/_axum/admin/radar-match";
const SITE: &str = "https://memes.example";

/// An operator approves (`reviewed`) or rejects a pending match from
/// `/admin/radar-safety` (D3-8, D4-1): same origin only, once per match, the
/// operator and time on the row and one audit record per decision. An
/// approved match is one an observation may cite; a rejected one is not.
#[tokio::test]
async fn radar_match_db_an_operator_approves_or_rejects_a_pending_match() {
    let _db = DB.lock().await;
    seed_radar_memes().await;
    execute(
        "insert into public.external_signals (platform, connector_key, platform_content_id, \
           signal_kind, observed_at, first_seen_at, last_seen_at, ingestion_version, rights_mode, text) \
         values ('x', 'x', 'd3m1', 'text_mention', now(), now(), now(), 1, 'link_only', 'zz d3멍멍 zz'), \
                ('x', 'x', 'd3m2', 'text_mention', now(), now(), now(), 1, 'link_only', 'zz d3냥냥 zz'); \
         insert into public.meme_signal_links (meme_id, signal_id, match_method, match_confidence) \
         select m.id, s.id, 'canonical_phrase', 0.87 \
           from public.memes m, public.external_signals s \
          where (m.slug, s.platform_content_id) in (('d3-radar-b', 'd3m1'), ('d3-radar-a', 'd3m2'))",
    )
    .await;
    let pairs = texts(
        "select l.meme_id::text || '|' || l.signal_id::text from public.meme_signal_links l \
         join public.external_signals s on s.id = l.signal_id \
         where s.platform_content_id like 'd3m%' order by s.platform_content_id",
    )
    .await;
    let pair = |index: usize| pairs[index].split_once('|').expect("a pair");
    let state = memecatch_server::AppState::new(config(
        marker_upstream().await,
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", SITE),
            ("NODE_ENV", "development"),
            (
                "AXUM_PILOT_ROUTES",
                "page-admin-radar-safety,admin-action-radar-match",
            ),
        ],
    ))
    .expect("app state");
    let (cookie, operator) = operator_cookie(&state).await;
    let app = spawn_router(memecatch_server::build_app(state)).await;
    let page_headers = [("cookie", cookie.as_str())];
    let page = || send(app, "GET", OPERATOR_PAGE, &page_headers, Body::empty());
    let decide = |origin: &'static str, index: usize, decision: &'static str| {
        let (meme_id, signal_id) = pair(index);
        let body =
            serde_json::json!({ "memeId": meme_id, "signalId": signal_id, "decision": decision });
        let cookie = cookie.clone();
        async move {
            send(
                app,
                "POST",
                MATCH_ACTION,
                &[
                    ("content-type", "application/json"),
                    ("origin", origin),
                    ("cookie", &cookie),
                ],
                Body::from(body.to_string()),
            )
            .await
        }
    };
    let links = "select concat_ws('|', s.platform_content_id, l.review_state, \
                        coalesce(l.reviewed_by::text, '-'), (l.reviewed_at is not null)::text) \
                 from public.meme_signal_links l \
                 join public.external_signals s on s.id = l.signal_id \
                 where s.platform_content_id like 'd3m%' order by 1";

    let shown = page().await;
    for each in [
        "data-admin-controls=\"radar-match\"",
        "data-admin-action=\"radar-match\"",
        pair(0).1,
        pair(1).1,
        "매칭 승인",
        "매칭 거절",
    ] {
        assert!(shown.body.contains(each), "{each}: {}", shown.body);
    }

    let refused = decide("https://elsewhere.example", 0, "approved").await;
    assert_eq!(refused.status, StatusCode::FORBIDDEN);
    assert_eq!(
        decide(SITE, 0, "maybe").await.body,
        r#"{"error":"승인 또는 거절을 선택해 주세요.","ok":false}"#
    );
    let unknown = serde_json::json!({
        "memeId": pair(0).0,
        "signalId": pair(1).1,
        "decision": "approved",
    });
    let unknown = send(
        app,
        "POST",
        MATCH_ACTION,
        &[
            ("content-type", "application/json"),
            ("origin", SITE),
            ("cookie", &cookie),
        ],
        Body::from(unknown.to_string()),
    )
    .await;
    assert_eq!(
        unknown.body,
        r#"{"error":"신호 매칭 처리에 실패했어요.","ok":false}"#
    );
    assert_eq!(
        texts(links).await,
        ["d3m1|pending|-|false", "d3m2|pending|-|false"]
    );

    assert_eq!(decide(SITE, 0, "approved").await.body, r#"{"ok":true}"#);
    assert_eq!(decide(SITE, 1, "rejected").await.body, r#"{"ok":true}"#);
    // A decided match stays as it was decided.
    let already = r#"{"error":"이미 처리된 신호 매칭이에요.","ok":false}"#;
    assert_eq!(decide(SITE, 0, "rejected").await.body, already);
    assert_eq!(decide(SITE, 1, "approved").await.body, already);
    assert_eq!(
        texts(links).await,
        [
            format!("d3m1|reviewed|{operator}|true"),
            format!("d3m2|rejected|{operator}|true"),
        ]
    );
    assert_eq!(
        texts(
            "select concat_ws('|', a.action, a.entity_type, a.actor_id::text, a.detail::text) \
             from public.admin_audit_log a \
             join public.external_signals s on a.entity_id = \
               (select l.meme_id::text || ':' || l.signal_id::text \
                  from public.meme_signal_links l where l.signal_id = s.id) \
             where s.platform_content_id like 'd3m%' order by a.id",
        )
        .await,
        [
            format!(
                "radar_signal_link.approved|meme_signal_link|{operator}|\
                 {{\"decision\": \"approved\", \"match_method\": \"canonical_phrase\", \"match_confidence\": 0.8700}}"
            ),
            format!(
                "radar_signal_link.rejected|meme_signal_link|{operator}|\
                 {{\"decision\": \"rejected\", \"match_method\": \"canonical_phrase\", \"match_confidence\": 0.8700}}"
            ),
        ]
    );
    // What the radar's observation function takes as a reviewed link.
    try_execute(
        "select public.record_radar_trend_observation(p_meme_id => l.meme_id, \
           p_signal_id => l.signal_id, p_observed_at => now(), p_heat_score => 1, \
           p_confidence => 0.5, p_recommended_state => 'archive', p_model_version => 'd4') \
         from public.meme_signal_links l join public.external_signals s on s.id = l.signal_id \
         where s.platform_content_id = 'd3m1'",
    )
    .await
    .expect("an approved match");
    let error = try_execute(
        "select public.record_radar_trend_observation(p_meme_id => l.meme_id, \
           p_signal_id => l.signal_id, p_observed_at => now(), p_heat_score => 1, \
           p_confidence => 0.5, p_recommended_state => 'archive', p_model_version => 'd4') \
         from public.meme_signal_links l join public.external_signals s on s.id = l.signal_id \
         where s.platform_content_id = 'd3m2'",
    )
    .await
    .expect_err("a rejected match");
    assert!(
        error.to_string().contains("reviewed_signal_link_required"),
        "{error}"
    );

    let shown = page().await;
    assert!(
        shown.body.contains("확인을 기다리는 신호 매칭이 없어요."),
        "{}",
        shown.body
    );

    seed_radar_memes().await;
}

/// An approved match is confirmed evidence (D5-3): the next run observes
/// its meme with it (and cites it, as the function allows a `reviewed`
/// link), once; a rejected match never counts.
#[tokio::test]
async fn trend_pulse_db_an_approved_match_feeds_the_next_observation_once() {
    let _db = DB.lock().await;
    clear_health().await;
    seed_radar_memes().await;
    let state = memecatch_server::AppState::new(config(
        marker_upstream().await,
        &database_url(),
        &[("NODE_ENV", "development")],
    ))
    .expect("app state");
    let (_, operator) = operator_cookie(&state).await;
    drop(state);
    let decided = format!(
        "insert into public.external_signals (platform, connector_key, platform_content_id, \
           signal_kind, observed_at, first_seen_at, last_seen_at, ingestion_version, rights_mode, \
           text, metrics_json) \
         values ('x', 'x', 'd3r1', 'text_mention', now(), now(), now(), 1, 'link_only', \
                 'zz d3냥냥 zz', '{{\"volume\": 1}}'), \
                ('x', 'x', 'd3r2', 'text_mention', now(), now(), now(), 1, 'link_only', \
                 'zz d3멍멍 zz', '{{\"volume\": 1}}'); \
         insert into public.meme_signal_links (meme_id, signal_id, match_method, match_confidence, \
           review_state, reviewed_by, reviewed_at) \
         select m.id, s.id, 'canonical_phrase', 0.87, \
                case s.platform_content_id when 'd3r1' then 'reviewed' else 'rejected' end, \
                '{operator}'::uuid, now() \
           from public.memes m, public.external_signals s \
          where (m.slug, s.platform_content_id) in (('d3-radar-a', 'd3r1'), ('d3-radar-b', 'd3r2'))"
    );
    execute(Box::leak(decided.into_boxed_str())).await;
    let (provider, _) = stub(&[(X_SEARCH, 200, r#"{"meta":{"result_count":0}}"#)]).await;
    let (next, _) = stub(&[(CACHE, 200, "{}")]).await;
    let app = app_with_x(next, provider).await;
    let observed = "select concat_ws('|', m.slug, coalesce(s.platform_content_id, '-'), \
                           o.factors->'reviewed_signals' ? s.id::text) \
                    from public.radar_trend_observations o \
                    join public.memes m on m.id = o.meme_id \
                    left join public.external_signals s on s.id = o.signal_id \
                    where m.slug like 'd3-radar-%' order by o.created_at";

    let first = pulse(app).await;
    assert!(
        first.body.contains(
            r#""radar":{"status":"ok","persistedSignals":0,"automaticMatches":0,"pendingMatches":0,"observations":1,"safetyReviews":0}"#
        ),
        "{}",
        first.body
    );
    assert_eq!(texts(observed).await, ["d3-radar-a|d3r1|t"]);

    // Counted once: the next run has nothing new for either meme.
    let second = pulse(app).await;
    assert!(
        second.body.contains(r#""observations":0"#),
        "{}",
        second.body
    );
    assert_eq!(texts(observed).await, ["d3-radar-a|d3r1|t"]);

    seed_radar_memes().await;
    clear_health().await;
}
