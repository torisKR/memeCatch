//! `POST /api/explore/previews` over HTTP.
//!
//! `tests/fixtures/previews.json` is what the TypeScript answered for the
//! rows of `tests/fixtures/previews_seed.sql`. The rights policy itself is held to the TypeScript by the fixture
//! test in `src/routes/public/meme_delivery.rs`.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::{Reply, UNUSED_DATABASE_URL, config, database_url, send, spawn_app};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};

const PATH: &str = "/api/explore/previews";
const SITE_URL: &str = "https://memes.example";
const NEXT_VARY: &str =
    "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch";
const SAME_ORIGIN: (&str, &str) = ("sec-fetch-site", "same-origin");

async fn app(database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("RELEASE_SHA", "abc123"),
    ];
    spawn_app(config(database_url, &[extra, &base[..]].concat())).await
}

async fn post(app: SocketAddr, headers: &[(&str, &str)], body: impl Into<Body>) -> Reply {
    send(app, "POST", PATH, headers, body).await
}

/// `{"ids":[...]}` for the seeded memes `first..=last`.
fn seeded_ids(first: u32, last: u32) -> String {
    let ids: Vec<String> = (first..=last)
        .map(|n| format!("\"a3000000-0000-4000-8000-{n:012}\""))
        .collect();
    format!("{{\"ids\":[{}]}}", ids.join(","))
}

/// The cards of an answer, sorted: the route lists them in the order
/// Postgres returns the rows.
fn cards(body: &str) -> Vec<&str> {
    let inner = body
        .strip_prefix("{\"previews\":[")
        .and_then(|rest| rest.strip_suffix("]}"))
        .unwrap_or_else(|| panic!("not a previews answer: {body}"));
    let mut cards: Vec<&str> = inner
        .split(",{\"id\":")
        .map(|card| card.trim_start_matches("{\"id\":"))
        .collect();
    cards.sort_unstable();
    cards
}

async fn as_service_role(db: &Db, sql: &'static str) {
    let result: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::raw_sql(sql).execute(tx).await.map(|_| ()) }),
        )
        .await;
    result.expect("write the preview rows");
}

#[tokio::test]
async fn seeded_cases_db_get_the_recorded_previews() {
    let db = Db::connect_lazy(&database_url(), 1).expect("database url");
    // Adds its own memes and deletes only those, so it needs no guard.
    as_service_role(&db, include_str!("fixtures/previews_seed.sql")).await;
    let app = app(&database_url(), &[]).await;

    let reply = post(app, &[SAME_ORIGIN], seeded_ids(1, 15)).await;
    let unknown = post(
        app,
        &[SAME_ORIGIN],
        "{\"ids\":[\"00000000-0000-4000-8000-000000000000\"]}",
    )
    .await;
    as_service_role(
        &db,
        "delete from public.media_sources where external_id like 'AxumR1%' or canonical_url like '%axumr1%';
         delete from public.memes where slug like 'axum-r1-preview-%'",
    )
    .await;

    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(reply.header("content-type"), Some("application/json"));
    assert_eq!(reply.header("cache-control"), Some("no-store"));
    assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    assert_eq!(reply.header("content-length"), None);
    let expected = include_str!("fixtures/previews.json");
    // 14 cards: the pending meme is not listed.
    assert_eq!(cards(expected).len(), 14);
    assert_eq!(cards(&reply.body), cards(expected));
    assert_eq!(unknown.status, StatusCode::OK);
    assert_eq!(unknown.body, "{\"previews\":[]}");
}

#[tokio::test]
async fn a_request_must_come_from_the_site_before_anything_is_read() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;
    let body = || seeded_ids(1, 1);

    for headers in [
        &[][..],
        &[("sec-fetch-site", "same-site")],
        &[("origin", "https://evil.example"), SAME_ORIGIN],
        &[("origin", "http://memes.example")],
    ] {
        let reply = post(app, headers, body()).await;

        assert_eq!(reply.status, StatusCode::FORBIDDEN, "{headers:?}");
        assert_eq!(reply.body, "{\"error\":\"untrusted origin\"}");
        assert_eq!(reply.header("content-type"), Some("application/json"));
        assert_eq!(reply.header("cache-control"), None);
    }
}

#[tokio::test]
async fn a_body_without_usable_ids_is_refused_without_a_read() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;
    let origin = ("origin", SITE_URL);

    for (body, status, error) in [
        ("{\"ids\":[]}".to_owned(), 400, "invalid ids"),
        (seeded_ids(1, 25), 400, "invalid ids"),
        ("{\"ids\":[\"not-a-uuid\"]}".to_owned(), 400, "invalid ids"),
        ("[]".to_owned(), 400, "invalid ids"),
        ("{\"ids\":[".to_owned(), 400, "invalid request"),
        (String::new(), 400, "invalid request"),
        (format!("{:2049}", seeded_ids(1, 1)), 413, "invalid request"),
    ] {
        let reply = post(app, &[origin], body.clone()).await;

        assert_eq!(reply.status.as_u16(), status, "{body}");
        assert_eq!(reply.body, format!("{{\"error\":\"{error}\"}}"), "{body}");
    }
}

#[tokio::test]
async fn the_121st_request_of_a_client_in_a_minute_is_refused() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;
    let client = [SAME_ORIGIN, ("x-forwarded-for", "198.51.100.7")];

    for _ in 0..120 {
        let reply = post(app, &client, "{}").await;
        assert_eq!(reply.status, StatusCode::BAD_REQUEST);
    }
    let refused = post(app, &client, "{}").await;
    let other = post(
        app,
        &[SAME_ORIGIN, ("x-forwarded-for", "198.51.100.8")],
        "{}",
    )
    .await;

    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.body, "{\"error\":\"rate_limited\"}");
    assert_eq!(refused.header("retry-after"), None);
    assert_eq!(other.status, StatusCode::BAD_REQUEST);
}

/// D2-17 (R9 review M2): a request refused by its client's limit does not
/// count toward the limit of all clients.
#[tokio::test]
async fn one_client_past_its_limit_does_not_use_up_the_global_one() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;
    let flooding = [SAME_ORIGIN, ("x-forwarded-for", "198.51.100.50")];
    for _ in 0..1_300 {
        post(app, &flooding, "{}").await;
    }
    let other = post(
        app,
        &[SAME_ORIGIN, ("x-forwarded-for", "198.51.100.51")],
        "{}",
    )
    .await;
    assert_eq!(other.status, StatusCode::BAD_REQUEST, "{}", other.body);
}

#[tokio::test]
async fn a_database_that_cannot_be_read_answers_503() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;

    let reply = post(app, &[SAME_ORIGIN], seeded_ids(1, 2)).await;

    assert_eq!(reply.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(reply.body, "{\"error\":\"previews unavailable\"}");
    assert_eq!(reply.header("cache-control"), Some("no-store"));
}
