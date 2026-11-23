//! The native pages of `src/pages` over HTTP: `/about`, `/memes/{key}` and
//! their assets.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`. They insert memes whose
//! slug starts with `axum-page-` and delete them again before asserting.
//!
//! What these pages share with Next's (text, links, head, structured data) is
//! checked against a real Next by `parity/pages/pages.mjs`.

#[path = "../common/mod.rs"]
mod common;

use std::net::SocketAddr;

use axum::Router;
use axum::body::Body;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use common::{UNUSED_DATABASE_URL, client, config, database_url, spawn_app, spawn_router};
use http_body_util::BodyExt;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use tokio::sync::{Mutex, MutexGuard};

const SITE_URL: &str = "https://memes.example";
/// Every row these tests insert has a slug with this prefix.
const SLUG_PREFIX: &str = "axum-page-";
const RICH: &str = "pt000001";
const THIN: &str = "pt000002";
const WITH_MEDIA: &str = "pt000003";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";

/// Tests that read or write `memes` take this lock: cargo runs the tests of
/// one binary in parallel, and the count on `/about` depends on every row.
static MEMES_TABLE: Mutex<()> = Mutex::const_new(());

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

async fn get(app: SocketAddr, path: &str, headers: &[(&str, &str)]) -> Reply {
    let mut request = Request::builder().uri(format!("http://{app}{path}"));
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let response = client()
        .request(request.body(Body::empty()).unwrap())
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

async fn app(upstream: SocketAddr, database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
        // The pages are pilots: off unless switched on.
        ("AXUM_PAGE_ROUTES", "page-about,page-meme"),
    ];
    // `extra` first: the first value found for a name wins.
    spawn_app(config(upstream, database_url, &[extra, &base[..]].concat())).await
}

/// The test memes in `memes`. Holds the table lock.
struct TestMemes {
    db: Db,
    _lock: MutexGuard<'static, ()>,
}

async fn run_sql(db: &Db, statements: Vec<String>) {
    let result: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    for statement in statements {
                        sqlx::raw_sql(sqlx::AssertSqlSafe(statement))
                            .execute(&mut *tx)
                            .await?;
                    }
                    Ok(())
                })
            },
        )
        .await;
    result.expect("test sql");
}

impl TestMemes {
    async fn lock() -> Self {
        let lock = MEMES_TABLE.lock().await;
        let db = Db::connect_lazy(&database_url(), 1).expect("database url");
        let memes = Self { db, _lock: lock };
        memes.delete().await;
        memes
    }

    async fn delete(&self) {
        run_sql(
            &self.db,
            vec![format!(
                "delete from memes where slug like '{SLUG_PREFIX}%'"
            )],
        )
        .await;
    }

    /// Deletes what the test inserted. Call it before the assertions, so that
    /// a failing one leaves nothing behind.
    async fn remove(self) {
        self.delete().await;
    }

    /// Three memes: one that passes the index gate (400 characters of
    /// description, an origin, two examples, two sources), one that is
    /// limited and thin, and one like the first with a video attached.
    async fn insert(&self) {
        let description = "가".repeat(400);
        let origin = "2022년 가을 한 커뮤니티의 게시글에서 처음 쓰였고, 이후 여러 대화방으로 퍼지면서 지금의 뜻으로 굳어졌습니다.";
        let examples = r#"[{"situation": "회의", "text": "예문 하나"}, {"situation": "단톡", "text": "예문 둘"}]"#;
        let rich = |short_id: &str, slug: &str| {
            format!(
                "insert into memes (short_id, slug, title, summary, description, origin, usage_examples,
                                    category, origin_year, safety_level, moderation_status, published_at, updated_at)
                 values ('{short_id}', '{SLUG_PREFIX}{slug}', '테스트 <밈>', '요약 & 설명', '{description}', '{origin}',
                         '{examples}'::jsonb, 'phrase', 2022, 'green', 'approved',
                         '2026-01-05T03:04:05.678Z', '2026-02-10T11:12:13.456Z')"
            )
        };
        let sources = |short_id: &str| {
            format!(
                "insert into meme_sources (meme_id, platform, source_url, title)
                 select id, '기사', url, '출처 제목' from memes,
                        unnest(array['https://news.example.org/a', 'https://namu.wiki/w/x']) as url
                  where short_id = '{short_id}'"
            )
        };
        run_sql(
            &self.db,
            vec![
                rich(RICH, "rich 밈"),
                sources(RICH),
                format!(
                    "insert into memes (short_id, slug, title, summary, description, category, moderation_status)
                     values ('{THIN}', '{SLUG_PREFIX}thin', '얇은 밈', '짧은 요약', '짧은 뜻.', 'image', 'limited')"
                ),
                rich(WITH_MEDIA, "media"),
                sources(WITH_MEDIA),
                format!(
                    "insert into meme_contents (meme_id, type, platform, content_id, url, is_representative, availability)
                     select id, 'video', 'youtube', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', true, 'live'
                       from memes where short_id = '{WITH_MEDIA}'"
                ),
            ],
        )
        .await;
    }
}

/// The number in "오늘까지 N건의 밈을 기록하고 있습니다."
fn recorded_count(body: &str) -> u32 {
    let (_, rest) = body
        .split_once("1990년대부터오늘까지 ")
        .expect("the recorded sentence");
    let (count, _) = rest.split_once("건의 밈을").expect("a count");
    count.replace(',', "").parse().expect("a number")
}

#[tokio::test]
async fn about_db_counts_the_memes_that_pass_the_index_gate() {
    let upstream = marker_upstream().await;
    let memes = TestMemes::lock().await;
    // A new app each time: the count is cached for the life of one.
    let before = get(app(upstream, &database_url(), &[]).await, "/about", &[]).await;
    memes.insert().await;
    let after = get(app(upstream, &database_url(), &[]).await, "/about", &[]).await;
    memes.remove().await;

    assert_eq!(after.status, StatusCode::OK);
    assert_eq!(
        after.header("content-type"),
        Some("text/html; charset=utf-8")
    );
    assert_eq!(after.header("content-language"), Some("ko"));
    assert_eq!(
        after.header("cache-control"),
        Some("private, no-cache, no-store, max-age=0, must-revalidate")
    );
    assert_eq!(after.header("vary"), Some(NEXT_VARY));
    assert_eq!(after.header("x-memecatch-release-sha"), Some("abc123"));
    assert!(after.header("content-security-policy").is_some());
    // Two rich memes were added and one thin one: the thin one is not counted.
    assert_eq!(
        recorded_count(&after.body),
        recorded_count(&before.body) + 2
    );
    assert!(after.body.contains("<title>소개 | 밈캐치</title>"));
    assert!(
        after
            .body
            .contains(r#"<link rel="canonical" href="https://memes.example/about">"#)
    );
    assert!(
        after
            .body
            .contains(r#"<meta property="og:image" content="https://memes.example/og/ko">"#)
    );
    assert!(!after.body.contains(r#"name="robots""#));
}

#[tokio::test]
async fn meme_db_document_is_indexed_only_when_it_passes_the_index_gate() {
    let upstream = marker_upstream().await;
    let memes = TestMemes::lock().await;
    memes.insert().await;
    let app = app(upstream, &database_url(), &[]).await;
    let rich = get(app, "/memes/pt000001-axum-page-rich%20%EB%B0%88", &[]).await;
    let thin = get(app, "/memes/pt000002-axum-page-thin", &[]).await;
    memes.remove().await;

    assert_eq!(rich.status, StatusCode::OK);
    let canonical = "https://memes.example/memes/pt000001-axum-page-rich%20%EB%B0%88";
    assert!(
        rich.body
            .contains(&format!(r#"<link rel="canonical" href="{canonical}">"#))
    );
    assert!(rich.body.contains(&format!(
        r#"<link rel="alternate" hreflang="x-default" href="{canonical}">"#
    )));
    assert!(
        !rich.body.contains(r#"name="robots""#),
        "an indexable document has no robots meta"
    );
    // Text from the database is escaped in markup and in structured data.
    assert!(
        rich.body
            .contains("<title>테스트 &lt;밈&gt; 뜻·유래, 지금 써도 될까? | 밈캐치</title>")
    );
    // In structured data `<` is a JSON escape, so no value can close the script.
    assert!(
        rich.body.contains(
            &r#""@type":"WebPage","name":"테스트 <밈>","description":"요약 & 설명""#
                .replace('<', "\\u003c")
        )
    );
    assert!(
        rich.body
            .contains(r#""dateModified":"2026-02-10T11:12:13.456+00:00""#)
    );
    assert!(
        rich.body
            .contains(r#""citation":["https://news.example.org/a","https://namu.wiki/w/x"]"#)
    );
    assert!(rich.body.contains(r#""@type":"BreadcrumbList""#));
    // The share card is versioned by the row's clock, in milliseconds.
    assert!(rich.body.contains(&format!(
        r#"<meta property="og:image" content="{canonical}/opengraph-image-k2cx9c?v=1770721933456">"#
    )));
    assert!(rich.body.contains(r#"<h1 class="meme-detail-title-title"#));
    assert!(!rich.body.contains("아직 정리 중인 문서예요"));

    assert_eq!(thin.status, StatusCode::OK);
    assert!(
        thin.body
            .contains(r#"<meta name="robots" content="noindex, follow">"#)
    );
    assert!(
        !thin.body.contains(r#""@type":"WebPage""#),
        "a thin document is not a finished entry"
    );
    assert!(thin.body.contains(r#""@type":"BreadcrumbList""#));
    assert!(thin.body.contains("아직 정리 중인 문서예요"));
    assert!(thin.body.contains("출처 확인 중 · 정보가 바뀔 수 있어요."));
}

#[tokio::test]
async fn meme_db_other_keys_redirect_once_and_a_missing_meme_is_a_404() {
    let upstream = marker_upstream().await;
    let memes = TestMemes::lock().await;
    memes.insert().await;
    let app = app(upstream, &database_url(), &[]).await;
    let bare = get(app, "/memes/pt000001?ref=x", &[]).await;
    let lowercase = get(app, "/memes/pt000001-axum-page-rich%20%eb%b0%88", &[]).await;
    let missing = get(app, "/memes/zzzzzzzz-nothing", &[]).await;
    let head = client()
        .request(
            Request::builder()
                .method("HEAD")
                .uri(format!("http://{app}/memes/zzzzzzzz-nothing"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("response");
    memes.remove().await;

    let canonical = "/memes/pt000001-axum-page-rich%20%EB%B0%88";
    assert_eq!(bare.status, StatusCode::PERMANENT_REDIRECT);
    assert_eq!(
        bare.header("location"),
        Some(format!("{canonical}?ref=x").as_str())
    );
    assert_eq!(
        bare.header("refresh"),
        Some(format!("0;url={canonical}?ref=x").as_str())
    );
    assert_eq!(bare.header("content-language"), Some("ko"));
    // As from proxy.ts: the site headers, but no Vary and no Content-Type.
    assert_eq!(bare.header("x-memecatch-release-sha"), Some("abc123"));
    assert_eq!(bare.header("vary"), None);
    assert_eq!(bare.header("content-type"), None);
    assert_eq!(lowercase.status, StatusCode::PERMANENT_REDIRECT);
    assert_eq!(lowercase.header("location"), Some(canonical));

    assert_eq!(missing.status, StatusCode::NOT_FOUND);
    assert!(
        missing
            .body
            .contains("<title>이 밈은 아직 없어요 | 밈캐치</title>")
    );
    assert!(
        missing
            .body
            .contains(r#"<meta name="robots" content="noindex, follow">"#)
    );
    assert!(!missing.body.contains(r#"rel="canonical""#));
    assert!(missing.body.contains("이 밈은... 아직 없네요"));
    assert_eq!(head.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn meme_db_documents_this_port_cannot_render_go_to_the_upstream() {
    let upstream = marker_upstream().await;
    let memes = TestMemes::lock().await;
    memes.insert().await;
    let app = app(upstream, &database_url(), &[]).await;
    let with_media = get(app, "/memes/pt000003-axum-page-media", &[]).await;
    // Curated memes render without a row, and an alias leads to one.
    let curated = get(app, "/memes/jkm2022k", &[]).await;
    let alias = get(app, "/memes/cssqxwmb", &[]).await;
    memes.remove().await;

    for (reply, path) in [
        (with_media, "/memes/pt000003-axum-page-media"),
        (curated, "/memes/jkm2022k"),
        (alias, "/memes/cssqxwmb"),
    ] {
        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{path}");
        assert_eq!(reply.body, format!("upstream saw GET {path}"));
        // Nothing added on the way back.
        assert!(!reply.headers.contains_key("vary"), "{path}");
    }
}

#[tokio::test]
async fn only_plain_document_requests_are_answered_here() {
    let upstream = marker_upstream().await;
    let app = app(upstream, UNUSED_DATABASE_URL, &[]).await;

    // Next's client router, a script's fetch, and the www host that proxy.ts
    // redirects: each is Next's to answer. None of them waits on the database.
    for headers in [
        [("rsc", "1")],
        [("sec-fetch-mode", "cors")],
        [("host", "www.catchmeme.com")],
    ] {
        for path in ["/about", "/memes/pt000001-x"] {
            let reply = get(app, path, &headers).await;
            assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{headers:?} {path}");
            assert_eq!(reply.body, format!("upstream saw GET {path}"));
        }
    }
}

#[tokio::test]
async fn about_renders_without_the_catalog_and_links_assets_that_never_change() {
    let upstream = marker_upstream().await;
    // No database: the page says so in its copy instead of failing.
    let app = app(
        upstream,
        UNUSED_DATABASE_URL,
        &[("NEXT_PUBLIC_GA_ID", "G-TEST")],
    )
    .await;

    let about = get(app, "/about", &[("sec-fetch-mode", "navigate")]).await;
    assert_eq!(about.status, StatusCode::OK);
    assert!(
        about
            .body
            .contains("1990년대부터오늘까지 공개된 한국 밈을 기록하고 있습니다.")
    );
    assert!(
        about
            .body
            .contains(r#"<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST">"#)
    );

    let asset = |marker: &str| {
        let (_, rest) = about.body.split_once(marker).expect("an asset link");
        rest.split_once('"').expect("a closing quote").0.to_owned()
    };
    let css = get(app, &asset(r#"rel="stylesheet" href=""#), &[]).await;
    let js = get(app, &asset(r#"<script defer src=""#), &[]).await;
    let stale = get(app, "/_axum/site.0000000000000000.css", &[]).await;

    for (reply, content_type) in [
        (&css, "text/css; charset=utf-8"),
        (&js, "text/javascript; charset=utf-8"),
    ] {
        assert_eq!(reply.status, StatusCode::OK);
        assert_eq!(reply.header("content-type"), Some(content_type));
        assert_eq!(
            reply.header("cache-control"),
            Some("public, max-age=31536000, immutable")
        );
    }
    assert!(css.body.contains(".max-w-site"));
    // A name from another build is not ours to answer.
    assert_eq!(
        stale.body,
        "upstream saw GET /_axum/site.0000000000000000.css"
    );
}

#[tokio::test]
async fn each_page_route_id_in_axum_disabled_routes_falls_through_to_the_upstream() {
    let upstream = marker_upstream().await;
    let off = app(
        upstream,
        UNUSED_DATABASE_URL,
        &[("AXUM_DISABLED_ROUTES", "page-about,page-meme,page-assets")],
    )
    .await;
    // With its own route off, /memes/random is a meme key here: still Next's.
    let random_off = app(
        upstream,
        UNUSED_DATABASE_URL,
        &[("AXUM_DISABLED_ROUTES", "memes-random")],
    )
    .await;

    for path in ["/about", "/memes/pt000001-x", "/_axum/site.css"] {
        let reply = get(off, path, &[]).await;
        assert_eq!(reply.status, StatusCode::IM_A_TEAPOT, "{path}");
        assert_eq!(reply.body, format!("upstream saw GET {path}"));
        assert!(!reply.headers.contains_key("vary"), "{path}");
    }
    let random = get(random_off, "/memes/random", &[]).await;
    assert_eq!(random.body, "upstream saw GET /memes/random");
}

#[tokio::test]
async fn the_pages_are_off_until_axum_page_routes_names_them() {
    let upstream = marker_upstream().await;
    let default = app(upstream, UNUSED_DATABASE_URL, &[("AXUM_PAGE_ROUTES", "")]).await;
    let only_about = app(
        upstream,
        UNUSED_DATABASE_URL,
        &[("AXUM_PAGE_ROUTES", "page-about")],
    )
    .await;

    for path in ["/about", "/memes/pt000001-x"] {
        let reply = get(default, path, &[]).await;
        assert_eq!(reply.body, format!("upstream saw GET {path}"), "{path}");
    }
    assert_eq!(get(only_about, "/about", &[]).await.status, StatusCode::OK);
    assert_eq!(
        get(only_about, "/memes/pt000001-x", &[]).await.body,
        "upstream saw GET /memes/pt000001-x"
    );
    // A typo must not leave the operator believing a page is on.
    let error = memecatch_server::AppState::new(config(
        upstream,
        UNUSED_DATABASE_URL,
        &[("AXUM_PAGE_ROUTES", "page-abuot")],
    ))
    .err()
    .expect("an unknown pilot id is refused");
    assert!(
        error.contains("AXUM_PAGE_ROUTES names no page route: page-abuot"),
        "{error}"
    );
    assert!(error.contains("page-about, page-meme"), "{error}");
}
