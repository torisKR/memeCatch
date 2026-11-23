//! The five public routes of `routes/public.rs` over HTTP: `/robots.txt`,
//! `/api/random-meme`, `/memes/random`, `/api/csp-report`, `/api/daily-quiz`.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They replace the approved
//! rows of `memes`, so they refuse a database that holds profiles or more
//! than a few memes of its own.

mod common;

use std::collections::BTreeSet;
use std::net::SocketAddr;
use std::time::SystemTime;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use common::{
    UNUSED_DATABASE_URL, client, closed_addr, config, database_url, spawn_app, spawn_router,
};
use http_body_util::BodyExt;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::routes::public::daily_quiz;
use memecatch_server::routes::public::quiz::{self, PoolMeme};
use memecatch_server::{AppState, build_app};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::{Mutex, MutexGuard};

const SITE_URL: &str = "https://memes.example";
const SHORT_ID_ALPHABET: &str = "abcdefghjkmnpqrstuvwxyz23456789";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
/// Every row these tests insert has a slug with this prefix.
const SLUG_PREFIX: &str = "axum-t4-";
const UNAVAILABLE: &str =
    r#"{"error":"오늘의 퀴즈를 불러오지 못했어요.","code":"DAILY_QUIZ_UNAVAILABLE"}"#;

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

impl Reply {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .get(name)
            .map(|value| value.to_str().expect("ascii header"))
    }
}

async fn send(
    app: SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: impl Into<Body>,
) -> Reply {
    let mut request = Request::builder()
        .method(method)
        .uri(format!("http://{app}{path}"));
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let response = client()
        .request(request.body(body.into()).unwrap())
        .await
        .expect("response");
    let (parts, body) = response.into_parts();
    let body = body.collect().await.expect("body").to_bytes();
    Reply {
        status: parts.status,
        headers: parts.headers,
        body: String::from_utf8(body.to_vec()).expect("utf-8 body"),
    }
}

async fn get(app: SocketAddr, path: &str) -> Reply {
    send(app, "GET", path, &[], Body::empty()).await
}

/// An upstream that answers every request with 418 and names what it saw.
async fn marker_upstream() -> SocketAddr {
    spawn_router(Router::new().fallback(|request: Request| async move {
        (
            StatusCode::IM_A_TEAPOT,
            format!("upstream saw {} {}", request.method(), request.uri()),
        )
    }))
    .await
}

/// The app with no database behind it, for routes and cases that query nothing.
async fn app_without_db(upstream: SocketAddr, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
    ];
    // `extra` first: the first value found for a name wins.
    spawn_app(config(
        upstream,
        UNUSED_DATABASE_URL,
        &[extra, &base[..]].concat(),
    ))
    .await
}

async fn app_with_db(upstream: SocketAddr) -> SocketAddr {
    spawn_app(config(
        upstream,
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", SITE_URL),
            ("RELEASE_SHA", "abc123"),
        ],
    ))
    .await
}

// ---------------------------------------------------------------------------
// Routing: ids, methods, hosts
// ---------------------------------------------------------------------------

const ROUTES: [(&str, &str, &str); 5] = [
    ("robots", "GET", "/robots.txt"),
    ("random-meme", "GET", "/api/random-meme"),
    ("memes-random", "GET", "/memes/random"),
    ("csp-report", "POST", "/api/csp-report"),
    ("daily-quiz", "GET", "/api/daily-quiz"),
];

#[tokio::test]
async fn each_route_id_in_axum_disabled_routes_falls_through_to_the_upstream() {
    let upstream = marker_upstream().await;

    for (id, method, path) in ROUTES {
        // A dead database makes any native answer differ from the marker
        // without the test waiting on a query.
        let app = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", id)]).await;

        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{id}");
        assert_eq!(reply.body, format!("upstream saw {method} {path}"), "{id}");
        // Nothing added on the way back.
        assert!(!reply.headers.contains_key("vary"), "{id}");
        assert!(
            !reply.headers.contains_key("x-memecatch-release-sha"),
            "{id}"
        );
    }
}

#[tokio::test]
async fn disabling_one_route_leaves_the_others_native_and_all_five_can_be_disabled() {
    let upstream = marker_upstream().await;
    let only_robots_off = app_without_db(upstream, &[("AXUM_DISABLED_ROUTES", "robots")]).await;
    let all_off = app_without_db(
        upstream,
        &[(
            "AXUM_DISABLED_ROUTES",
            "robots,random-meme,memes-random,csp-report,daily-quiz",
        )],
    )
    .await;

    let csp = send(
        only_robots_off,
        "POST",
        "/api/csp-report",
        &[],
        Body::empty(),
    )
    .await;
    let robots = get(all_off, "/robots.txt").await;
    let csp_off = send(all_off, "POST", "/api/csp-report", &[], Body::empty()).await;

    assert_eq!(csp.status, StatusCode::NO_CONTENT);
    assert_eq!(robots.body, "upstream saw GET /robots.txt");
    assert_eq!(csp_off.body, "upstream saw POST /api/csp-report");
}

#[tokio::test]
async fn methods_a_route_does_not_handle_go_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[]).await;

    for (method, path) in [
        ("POST", "/robots.txt"),
        ("OPTIONS", "/robots.txt"),
        ("POST", "/api/random-meme"),
        ("DELETE", "/memes/random"),
        ("GET", "/api/csp-report"),
        ("OPTIONS", "/api/csp-report"),
        ("PUT", "/api/daily-quiz"),
    ] {
        let reply = send(app, method, path, &[], Body::empty()).await;

        assert_eq!(reply.body, format!("upstream saw {method} {path}"));
        assert!(!reply.headers.contains_key("allow"), "{method} {path}");
        assert!(!reply.headers.contains_key("vary"), "{method} {path}");
    }
}

#[tokio::test]
async fn www_host_requests_for_the_non_api_routes_are_left_to_the_upstream() {
    let upstream = marker_upstream().await;
    let app = app_without_db(upstream, &[]).await;

    for host in ["www.catchmeme.com", "WWW.CatchMeme.com:443"] {
        for path in ["/robots.txt", "/memes/random"] {
            let reply = send(app, "GET", path, &[("host", host)], Body::empty()).await;

            assert_eq!(reply.body, format!("upstream saw GET {path}"), "{host}");
            // Not passed through the native-route header layer.
            assert!(!reply.headers.contains_key("vary"), "{host} {path}");
        }
    }
    // proxy.ts never runs for /api, so the host makes no difference there.
    let api = send(
        app,
        "POST",
        "/api/csp-report",
        &[("host", "www.catchmeme.com")],
        Body::empty(),
    )
    .await;
    let apex = send(
        app,
        "GET",
        "/robots.txt",
        &[("host", "catchmeme.com")],
        Body::empty(),
    )
    .await;
    assert_eq!(api.status, StatusCode::NO_CONTENT);
    assert_eq!(apex.status, StatusCode::OK);
}

// ---------------------------------------------------------------------------
// /robots.txt
// ---------------------------------------------------------------------------

// What the real Next server sent when built with
// NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001.
const ROBOTS_FROM_NEXT: &str = include_str!("fixtures/robots.txt");

#[tokio::test]
async fn robots_txt_is_the_text_next_prerendered_with_its_headers() {
    let app = app_without_db(closed_addr().await, &[]).await;

    let reply = get(app, "/robots.txt?anything=1").await;

    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.body,
        ROBOTS_FROM_NEXT.replace("http://127.0.0.1:3001", SITE_URL)
    );
    assert_eq!(
        reply.header("content-type"),
        Some("text/plain; charset=utf-8")
    );
    assert_eq!(reply.header("cache-control"), Some("s-maxage=31536000"));
    assert_eq!(reply.header("x-nextjs-cache"), Some("HIT"));
    assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    assert_eq!(reply.header("x-memecatch-release-sha"), Some("abc123"));
    // Chunked like Next, with no length.
    assert_eq!(reply.header("content-length"), None);
}

#[tokio::test]
async fn head_answers_carry_the_get_headers_and_no_length_or_body() {
    let app = app_without_db(closed_addr().await, &[]).await;

    let get_reply = get(app, "/robots.txt").await;
    let head = send(app, "HEAD", "/robots.txt", &[], Body::empty()).await;

    assert_eq!(head.status, StatusCode::OK);
    assert_eq!(head.body, "");
    assert_eq!(head.header("content-length"), None);
    for name in ["content-type", "cache-control", "x-nextjs-cache", "vary"] {
        assert_eq!(head.header(name), get_reply.header(name), "{name}");
    }
}

// ---------------------------------------------------------------------------
// /api/csp-report
// ---------------------------------------------------------------------------

const LEGACY_REPORT: &str = r#"{"csp-report":{"document-uri":"https://catchmeme.com/","blocked-uri":"https://evil.example/x.js","violated-directive":"script-src"}}"#;

async fn csp(app: SocketAddr, headers: &[(&str, &str)], body: impl Into<Body>) -> Reply {
    send(app, "POST", "/api/csp-report", headers, body).await
}

#[tokio::test]
async fn csp_report_answers_204_with_no_body_whatever_it_is_sent() {
    let app = app_without_db(closed_addr().await, &[]).await;
    let report = [("content-type", "application/csp-report")];
    let oversized = "x".repeat(16 * 1024 + 1);
    // No Content-Length: the limit is found while reading.
    let oversized_stream = Body::from_stream(futures_util::stream::iter(
        (0..20).map(|_| Ok::<_, std::convert::Infallible>(vec![b'x'; 1024])),
    ));

    let cases = [
        (
            "accepted legacy report",
            csp(app, &report, LEGACY_REPORT).await,
        ),
        (
            "accepted reporting api report",
            csp(
                app,
                &[("content-type", "application/reports+json; charset=utf-8")],
                r#"[{"type":"csp-violation","body":{"blocked-uri":"inline"}}]"#,
            )
            .await,
        ),
        (
            "oversized with a length",
            csp(app, &report, oversized).await,
        ),
        (
            "oversized without a length",
            csp(app, &report, oversized_stream).await,
        ),
        ("malformed json", csp(app, &report, "{not json").await),
        ("empty body", csp(app, &report, Body::empty()).await),
        (
            "wrong content type",
            csp(app, &[("content-type", "application/json")], LEGACY_REPORT).await,
        ),
        ("no content type", csp(app, &[], LEGACY_REPORT).await),
    ];

    for (name, reply) in cases {
        assert_eq!(reply.status, StatusCode::NO_CONTENT, "{name}");
        assert_eq!(reply.body, "", "{name}");
        assert_eq!(reply.header("retry-after"), None, "{name}");
        assert_eq!(reply.header("content-length"), None, "{name}");
        assert_eq!(reply.header("vary"), Some(NEXT_VARY), "{name}");
    }
}

#[tokio::test]
async fn csp_report_limits_each_client_ip_to_60_requests_a_minute() {
    let app = app_without_db(closed_addr().await, &[]).await;
    let from = |ip: &'static str| {
        [
            ("x-forwarded-for", ip),
            ("content-type", "application/csp-report"),
        ]
    };

    for request in 1..=60 {
        let reply = csp(app, &from("203.0.113.7"), LEGACY_REPORT).await;
        assert_eq!(reply.status, StatusCode::NO_CONTENT, "request {request}");
        assert_eq!(reply.header("retry-after"), None, "request {request}");
    }
    let over_limit = csp(app, &from("203.0.113.7"), LEGACY_REPORT).await;
    // The first entry of the list is the client, so this is the same bucket.
    let same_client_via_proxy = csp(app, &from("203.0.113.7, 10.0.0.1"), LEGACY_REPORT).await;
    let another_client = csp(app, &from("203.0.113.8"), LEGACY_REPORT).await;

    assert_eq!(over_limit.status, StatusCode::NO_CONTENT);
    assert_eq!(over_limit.body, "");
    // 60 s after the first request, rounded up; the 61 requests took well
    // under a second.
    assert_eq!(over_limit.header("retry-after"), Some("60"));
    assert_eq!(same_client_via_proxy.header("retry-after"), Some("60"));
    assert_eq!(another_client.header("retry-after"), None);
}

/// The app served the way `main.rs` serves it: handlers can see the address
/// of the TCP peer. (`common::spawn_app` serves without it.)
async fn app_with_peer_address() -> SocketAddr {
    let state =
        AppState::new(config(closed_addr().await, UNUSED_DATABASE_URL, &[])).expect("state");
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local addr");
    tokio::spawn(async move {
        axum::serve(
            listener,
            build_app(state).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .await
        .expect("serve")
    });
    addr
}

#[tokio::test]
async fn csp_report_keys_a_request_without_x_forwarded_for_by_its_peer_address() {
    let app = app_with_peer_address().await;

    // Next fills in the missing header with the peer address before the
    // route runs, so X-Real-IP plays no part: these all count as 127.0.0.1.
    for request in 0..60 {
        let real_ip = format!("198.51.100.{request}");
        let reply = csp(app, &[("x-real-ip", real_ip.as_str())], "").await;
        assert_eq!(reply.header("retry-after"), None, "request {request}");
    }
    let without_header = csp(app, &[("x-real-ip", "198.51.100.200")], "").await;
    let same_address_spelled_out = csp(app, &[("x-forwarded-for", "127.0.0.1")], "").await;
    let another_client = csp(app, &[("x-forwarded-for", "203.0.113.9")], "").await;

    assert_eq!(without_header.header("retry-after"), Some("60"));
    assert_eq!(same_address_spelled_out.header("retry-after"), Some("60"));
    assert_eq!(another_client.header("retry-after"), None);
}

#[tokio::test]
async fn csp_report_falls_back_to_x_real_ip_then_unknown_for_an_empty_first_entry() {
    let app = app_with_peer_address().await;
    let via_real_ip = [
        ("x-forwarded-for", " , 203.0.113.7"),
        ("x-real-ip", " 198.51.100.4 "),
    ];
    let unknown = [("x-forwarded-for", "")];

    for _ in 0..60 {
        csp(app, &via_real_ip, "").await;
        csp(app, &unknown, "").await;
    }
    let real_ip_over_limit = csp(app, &via_real_ip, "").await;
    let unknown_over_limit = csp(app, &unknown, "").await;
    // The same X-Real-IP address named as the forwarded client is that bucket.
    let same_bucket = csp(app, &[("x-forwarded-for", "198.51.100.4")], "").await;
    let peer_address = csp(app, &[], "").await;

    assert_eq!(real_ip_over_limit.header("retry-after"), Some("60"));
    assert_eq!(unknown_over_limit.header("retry-after"), Some("60"));
    assert_eq!(same_bucket.header("retry-after"), Some("60"));
    assert_eq!(peer_address.header("retry-after"), None);
}

// ---------------------------------------------------------------------------
// Routes that read `memes`
// ---------------------------------------------------------------------------

#[tokio::test]
async fn memes_random_is_left_to_the_upstream_when_the_site_url_cannot_be_a_redirect_target() {
    let upstream = marker_upstream().await;
    // Next throws on `new URL("/explore")` and answers 500 itself.
    let app = app_without_db(upstream, &[("NEXT_PUBLIC_SITE_URL", "")]).await;

    let reply = get(app, "/memes/random").await;

    assert_eq!(reply.body, "upstream saw GET /memes/random");
}

/// Tests that depend on what `memes` holds take this lock: cargo runs the
/// tests of one binary in parallel.
static MEMES_TABLE: Mutex<()> = Mutex::const_new(());

struct SeedMeme {
    short_id: String,
    slug: String,
    title: String,
    summary: String,
    category: String,
    origin_year: Option<i32>,
    safety_level: String,
    status: &'static str,
}

impl SeedMeme {
    fn new(short_id: &str, slug_suffix: &str, status: &'static str) -> Self {
        Self {
            short_id: short_id.to_owned(),
            slug: format!("{SLUG_PREFIX}{slug_suffix}"),
            title: format!("테스트 밈 {short_id}"),
            summary: format!(
                "{short_id}라는 말이 어디에서 왔고 언제 쓰는지 설명하는 충분히 긴 요약이에요."
            ),
            category: "phrase".to_owned(),
            origin_year: Some(2024),
            safety_level: "green".to_owned(),
            status,
        }
    }
}

fn seed_db() -> Db {
    Db::connect_lazy(&database_url(), 1).expect("database url")
}

/// The `memes` table in a state one test set up. Holds the table lock.
struct MemesTable {
    db: Db,
    _lock: MutexGuard<'static, ()>,
}

impl MemesTable {
    /// Deletes what the test inserted. Call it before the assertions, so that
    /// a failing one leaves nothing behind.
    async fn remove_test_memes(self) {
        let result: Result<(), sqlx::Error> = self
            .db
            .with_identity(
                &DbIdentity::service_role(),
                IdentityOptions::default(),
                |tx| {
                    Box::pin(async move {
                        sqlx::query("delete from memes where slug like $1")
                            .bind(format!("{SLUG_PREFIX}%"))
                            .execute(tx)
                            .await
                            .map(|_| ())
                    })
                },
            )
            .await;
        result.expect("remove test memes");
    }
}

/// Makes the approved rows of `memes` exactly the approved rows of `rows`.
async fn replace_approved_memes(db: &Db, rows: Vec<SeedMeme>) -> MemesTable {
    let lock = MEMES_TABLE.lock().await;
    let result: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let (profiles, other_memes): (i64, i64) = sqlx::query_as(
                        // Profiles named `ax` + 12 hex digits are the users
                        // tests/auth.rs and better_auth_cookie.mjs create on
                        // this same database; any other profile is a real one.
                        "select (select count(*) from profiles
                                 where nickname !~ '^ax[0-9a-f]{12}$'),
                            (select count(*) from memes where slug not like $1)",
                    )
                    .bind(format!("{SLUG_PREFIX}%"))
                    .fetch_one(&mut *tx)
                    .await?;
                    assert!(
                        profiles == 0 && other_memes <= 20,
                        "refusing to replace the approved memes: this does not look like the \
                     scripts/test-db.sh database ({profiles} profiles of its own, {other_memes} memes)"
                    );
                    sqlx::query(
                        "delete from memes where slug like $1 or moderation_status = 'approved'",
                    )
                    .bind(format!("{SLUG_PREFIX}%"))
                    .execute(&mut *tx)
                    .await?;
                    for row in rows {
                        sqlx::query(
                            "insert into memes (short_id, slug, title, summary, category,
                                            origin_year, safety_level, moderation_status)
                         values ($1, $2, $3, $4, $5::meme_category, $6, $7::safety_level,
                                 $8::moderation_status)",
                        )
                        .bind(row.short_id)
                        .bind(row.slug)
                        .bind(row.title)
                        .bind(row.summary)
                        .bind(row.category)
                        .bind(row.origin_year)
                        .bind(row.safety_level)
                        .bind(row.status)
                        .execute(&mut *tx)
                        .await?;
                    }
                    Ok(())
                })
            },
        )
        .await;
    result.expect("seed memes");
    MemesTable {
        db: db.clone(),
        _lock: lock,
    }
}

/// 31 approved memes, one per first letter of the short id alphabet, so a
/// random pivot lands before each of them equally often. Between them sit
/// memes in every other moderation status; `limited` ones are visible to the
/// anonymous role and must still never be picked.
fn spread_memes() -> Vec<SeedMeme> {
    const NOT_APPROVED: [&str; 5] = [
        "pending",
        "fact_checking",
        "rights_checking",
        "limited",
        "rejected",
    ];
    SHORT_ID_ALPHABET
        .chars()
        .enumerate()
        .flat_map(|(index, letter)| {
            [
                // A slug that needs percent-encoding on every third meme.
                SeedMeme::new(
                    &format!("{letter}mmmmmmm"),
                    &if index % 3 == 0 {
                        format!("밈 {index}/a?")
                    } else {
                        format!("plain-{index}")
                    },
                    "approved",
                ),
                SeedMeme::new(
                    &format!("{letter}nnnnnnn"),
                    &format!("hidden-{index}"),
                    NOT_APPROVED[index % NOT_APPROVED.len()],
                ),
            ]
        })
        .collect()
}

/// The path each approved meme of `spread_memes` must be served under.
fn spread_paths() -> BTreeSet<String> {
    SHORT_ID_ALPHABET
        .chars()
        .enumerate()
        .map(|(index, letter)| {
            let slug = if index % 3 == 0 {
                // encodeURIComponent("axum-t4-밈 " + index + "/a?")
                format!("axum-t4-%EB%B0%88%20{index}%2Fa%3F")
            } else {
                format!("axum-t4-plain-{index}")
            };
            format!("/memes/{letter}mmmmmmm-{slug}")
        })
        .collect()
}

// (30/31)^600 is 3e-9: the chance that 600 draws miss one given meme.
const DRAWS: usize = 600;

#[tokio::test]
async fn random_meme_db_serves_every_approved_meme_and_no_other() {
    #[derive(Deserialize)]
    struct PathBody {
        path: String,
    }
    let db = seed_db();
    let table = replace_approved_memes(&db, spread_memes()).await;
    let app = app_with_db(closed_addr().await).await;

    let mut paths = BTreeSet::new();
    for _ in 0..DRAWS {
        let reply = get(app, "/api/random-meme").await;
        assert_eq!(reply.status, StatusCode::OK);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        let body: PathBody = serde_json::from_str(&reply.body).expect("json body");
        // Exactly `{"path":"..."}`, nothing else in the object.
        assert_eq!(reply.body, format!("{{\"path\":\"{}\"}}", body.path));
        paths.insert(body.path);
    }
    table.remove_test_memes().await;

    assert_eq!(paths, spread_paths());
}

#[tokio::test]
async fn memes_random_db_redirects_to_every_approved_meme_and_no_other() {
    let db = seed_db();
    let table = replace_approved_memes(&db, spread_memes()).await;
    let app = app_with_db(closed_addr().await).await;

    let mut locations = BTreeSet::new();
    for _ in 0..DRAWS {
        let reply = get(app, "/memes/random").await;
        assert_eq!(reply.status, StatusCode::FOUND);
        assert_eq!(reply.body, "");
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("content-language"), Some("ko"));
        assert_eq!(reply.header("content-type"), None);
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        locations.insert(reply.header("location").expect("location").to_owned());
    }
    table.remove_test_memes().await;

    let expected: BTreeSet<String> = spread_paths()
        .iter()
        .map(|path| format!("{SITE_URL}{path}"))
        .collect();
    assert_eq!(locations, expected);
}

#[tokio::test]
async fn random_routes_db_fall_back_to_explore_when_no_meme_is_approved() {
    let db = seed_db();
    // `limited` is visible to the anonymous role but is not `approved`.
    let table = replace_approved_memes(
        &db,
        vec![
            SeedMeme::new("kkkkkkkk", "limited", "limited"),
            SeedMeme::new("pppppppp", "pending", "pending"),
        ],
    )
    .await;
    let app = app_with_db(closed_addr().await).await;

    let json = get(app, "/api/random-meme").await;
    let redirect = get(app, "/memes/random").await;
    let head = send(app, "HEAD", "/memes/random", &[], Body::empty()).await;
    table.remove_test_memes().await;

    assert_eq!(json.status, StatusCode::OK);
    assert_eq!(json.body, r#"{"path":"/explore"}"#);
    assert_eq!(json.header("cache-control"), Some("no-store"));
    for reply in [redirect, head] {
        assert_eq!(reply.status, StatusCode::FOUND);
        assert_eq!(
            reply.header("location"),
            Some("https://memes.example/explore")
        );
        // The fallback redirect sets no Cache-Control in the TypeScript.
        assert_eq!(reply.header("cache-control"), None);
        assert_eq!(reply.header("content-language"), Some("ko"));
        assert_eq!(reply.header("content-length"), None);
        assert_eq!(reply.body, "");
    }
}

/// The rows of the TypeScript fixture, as approved memes with unique slugs.
fn fixture_memes(count: usize) -> Vec<PoolMeme> {
    #[derive(Deserialize)]
    struct Fixture {
        rows: Vec<PoolMeme>,
    }
    let fixture: Fixture =
        serde_json::from_str(include_str!("fixtures/daily_quiz.json")).expect("fixture parses");
    fixture
        .rows
        .into_iter()
        .take(count)
        .enumerate()
        .map(|(index, row)| PoolMeme {
            slug: format!("{SLUG_PREFIX}{index}"),
            ..row
        })
        .collect()
}

fn approved(meme: &PoolMeme) -> SeedMeme {
    SeedMeme {
        short_id: meme.short_id.clone(),
        slug: meme.slug.clone(),
        title: meme.title.clone(),
        summary: meme.summary.clone(),
        category: meme.category.clone(),
        origin_year: meme.origin_year,
        safety_level: meme.safety_level.clone(),
        status: "approved",
    }
}

/// What the route's two queries must return: up to 120 memes in short id
/// order from the pivot, wrapping around to the smallest ids.
fn expected_pool(memes: &[PoolMeme], pivot: &str) -> Vec<PoolMeme> {
    let mut sorted = memes.to_vec();
    sorted.sort_by(|a, b| a.short_id.cmp(&b.short_id));
    let (before, from_pivot): (Vec<PoolMeme>, Vec<PoolMeme>) = sorted
        .into_iter()
        .partition(|meme| meme.short_id.as_str() < pivot);
    from_pivot.into_iter().chain(before).take(120).collect()
}

/// Requests the quiz and returns it with the Korean date it was served on.
async fn daily_quiz_on_one_day(app: SocketAddr) -> (String, Reply) {
    loop {
        let before = quiz::kst_day_key(SystemTime::now());
        let reply = get(app, "/api/daily-quiz").await;
        // Not across midnight in Korea.
        if quiz::kst_day_key(SystemTime::now()) == before {
            return (before, reply);
        }
    }
}

#[tokio::test]
async fn daily_quiz_db_builds_todays_question_from_the_approved_pool_around_the_pivot() {
    let db = seed_db();
    let app = app_with_db(closed_addr().await).await;

    // 40 memes: fewer than 120 follow any pivot, so the pool wraps around.
    // 300 memes: the first query alone fills the pool on most days.
    for count in [40, 300] {
        let memes = fixture_memes(count);
        let mut rows: Vec<SeedMeme> = memes.iter().map(approved).collect();
        // Memes right at the day's pivot that are not approved.
        rows.push(SeedMeme::new("zzzzzzzz", "limited", "limited"));
        rows.push(SeedMeme::new("yyyyyyyy", "pending", "pending"));
        let table = replace_approved_memes(&db, rows).await;

        let (day, reply) = daily_quiz_on_one_day(app).await;
        table.remove_test_memes().await;

        let pool = expected_pool(&memes, &quiz::daily_pivot(&day));
        let expected = quiz::daily_quiz_json(&day, &pool).expect("the pool is large enough");
        assert_eq!(reply.body, expected, "{count} memes on {day}");
        assert_eq!(reply.status, StatusCode::OK);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(
            reply.header("cache-control"),
            Some("public, s-maxage=300, stale-while-revalidate=60")
        );
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
        assert!(
            reply
                .body
                .starts_with(&format!("{{\"date\":\"{day}\",\"question\":{{"))
        );
    }
}

#[tokio::test]
async fn daily_quiz_db_pool_is_120_memes_in_short_id_order_from_the_pivot_wrapping_around() {
    let db = seed_db();

    for count in [40, 300] {
        let memes = fixture_memes(count);
        let mut rows: Vec<SeedMeme> = memes.iter().map(approved).collect();
        rows.push(SeedMeme::new("mmmmmmmm", "limited", "limited"));
        let table = replace_approved_memes(&db, rows).await;
        let mut sorted: Vec<&str> = memes.iter().map(|meme| meme.short_id.as_str()).collect();
        sorted.sort_unstable();

        // Before every id (digits sort before letters), after every id, in
        // the middle, and exactly on an id (the comparison is `>=`), near
        // each end so that both queries contribute.
        let pivots = [
            "22222222",
            "zzzzzzzz",
            "mmmmmmmm",
            sorted[3],
            sorted[count - 4],
        ];
        let mut pools = Vec::new();
        for pivot in pivots {
            pools.push(daily_quiz::pool(&db, pivot).await.expect("pool query"));
        }
        table.remove_test_memes().await;

        for (pivot, pool) in pivots.into_iter().zip(pools) {
            assert_eq!(
                pool,
                expected_pool(&memes, pivot),
                "{count} memes, pivot {pivot}"
            );
            assert_eq!(pool.len(), count.min(120));
        }
    }
}

#[tokio::test]
async fn daily_quiz_db_answers_502_when_the_approved_pool_is_too_small() {
    let db = seed_db();
    let app = app_with_db(closed_addr().await).await;
    // Three approved memes cannot fill four options. With the 60 `limited`
    // ones a question could be built, and the anonymous role can read those;
    // the route must not.
    let memes = fixture_memes(63);
    let day = quiz::kst_day_key(SystemTime::now());
    assert!(quiz::daily_quiz_json(&day, &memes).is_some());
    let rows: Vec<SeedMeme> = memes
        .iter()
        .enumerate()
        .map(|(index, meme)| SeedMeme {
            status: if index < 3 { "approved" } else { "limited" },
            ..approved(meme)
        })
        .collect();

    for rows in [rows, Vec::new()] {
        let table = replace_approved_memes(&db, rows).await;

        let reply = get(app, "/api/daily-quiz").await;
        let head = send(app, "HEAD", "/api/daily-quiz", &[], Body::empty()).await;
        table.remove_test_memes().await;

        assert_eq!(reply.status, StatusCode::BAD_GATEWAY);
        assert_eq!(reply.body, UNAVAILABLE);
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(head.status, StatusCode::BAD_GATEWAY);
        assert_eq!(head.header("content-length"), None);
        assert_eq!(head.body, "");
    }
}
