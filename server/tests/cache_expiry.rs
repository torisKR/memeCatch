//! An edit shows on the public pages at once, not when their cache runs out
//! (PLAN.md L2-4): edit, then read. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, send, spawn_router};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};

const ORIGIN: &str = "https://memes.example";
const CRON: &str = "test-only-cron-secret";

/// One statement as `service_role`; the text of its first column.
async fn as_service(db: &Db, sql: String) -> Option<String> {
    let found: Result<Option<String>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(sqlx::AssertSqlSafe(sql))
                        .fetch_optional(tx)
                        .await
                })
            },
        )
        .await;
    found.expect("service statement")
}

/// A published meme with enough prose to be listed. Its title sorts first.
async fn listed_meme(db: &Db, title: &str) -> String {
    let slug = title.replace(' ', "-");
    let description = "가".repeat(420);
    let origin = "나".repeat(70);
    as_service(
        db,
        format!(
            "insert into public.memes (title, slug, summary, description, origin, moderation_status) \
             values ('{title}', '{slug}', '요약', '{description}', '{origin}', 'approved') \
             returning id::text"
        ),
    )
    .await
    .expect("a meme")
}

struct Site {
    app: SocketAddr,
    db: Db,
    cookie: String,
}

async fn site() -> Site {
    let state = AppState::new(config(
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", ORIGIN),
            ("NODE_ENV", "development"),
            ("CRON_SECRET", CRON),
        ],
    ))
    .expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let operator = create_user(&pool).await;
    let db = state.db.clone();
    as_service(
        &db,
        format!(
            "update public.profiles set role = 'operator' where id = '{}'::uuid returning role::text",
            operator.id
        ),
    )
    .await
    .expect("a profile");
    let token = create_session(&pool, &operator, 3_600.0).await;
    Site {
        app: spawn_router(build_app(state)).await,
        db,
        cookie: signed_cookie(PLAIN, &token, "test-only-auth-secret"),
    }
}

async fn shows(app: SocketAddr, path: &str, text: &str) -> bool {
    let reply = send(app, "GET", path, &[], Body::empty()).await;
    assert_eq!(reply.status, StatusCode::OK, "{path}");
    reply.body.contains(text)
}

fn unique(prefix: &str) -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{prefix} {nanos}")
}

#[tokio::test]
async fn an_operator_unpublishing_a_meme_takes_it_off_the_cached_pages_db() {
    let site = site().await;
    let title = unique("가가가 캐시 만료");
    let id = listed_meme(&site.db, &title).await;
    assert!(
        shows(site.app, "/memes", &title).await,
        "listed before the edit"
    );

    let body = serde_json::json!({ "memeId": id, "to": "fact_checking" }).to_string();
    let reply = send(
        site.app,
        "POST",
        "/_axum/admin/meme-transition",
        &[
            ("content-type", "application/json"),
            ("origin", ORIGIN),
            ("cookie", &site.cookie),
        ],
        Body::from(body),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert!(reply.body.contains(r#""ok":true"#), "{}", reply.body);

    assert!(
        !shows(site.app, "/memes", &title).await,
        "gone right after the edit"
    );
}

#[tokio::test]
async fn the_source_refresh_cron_expires_the_catalogue_db() {
    let site = site().await;
    let title = unique("가가가 크론 만료");
    let id = listed_meme(&site.db, &title).await;
    assert!(
        shows(site.app, "/memes", &title).await,
        "listed before the edit"
    );
    let renamed = unique("가가가 크론 고친 제목");
    as_service(
        &site.db,
        format!(
            "update public.memes set title = '{renamed}' where id = '{id}'::uuid returning id::text"
        ),
    )
    .await
    .expect("renamed");
    assert!(
        shows(site.app, "/memes", &title).await,
        "the cache still holds the old title"
    );

    let bearer = format!("Bearer {CRON}");
    let reply = send(
        site.app,
        "POST",
        "/api/cron/source-refresh",
        &[("authorization", &bearer)],
        Body::empty(),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);

    assert!(
        shows(site.app, "/memes", &renamed).await,
        "the new title right after"
    );
}
