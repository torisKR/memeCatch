//! `GET /memes/{key}/export` (route id `meme-export`) end to end: the quota
//! of the migrations (`reserve_meme_export`, 30 an hour), the meme and its
//! translation as the user reads them, and the drawn card (D2-10, PLAN.md).
//! Needs the test database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{client, config, database_url, spawn_router};
use http_body_util::BodyExt;
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};

const SHORT_ID: &str = "d2exp001";

async fn as_service(db: &Db, sql: String) {
    let done: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(sqlx::AssertSqlSafe(sql))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    done.expect("service sql");
}

struct Got {
    status: StatusCode,
    headers: axum::http::HeaderMap,
    body: Vec<u8>,
}

impl Got {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(name).map(|v| v.to_str().unwrap())
    }
}

async fn get(app: SocketAddr, path: &str, cookie: &str) -> Got {
    let request = Request::builder()
        .uri(format!("http://{app}{path}"))
        .header("cookie", cookie)
        .body(Body::empty())
        .unwrap();
    let (parts, body) = client().request(request).await.unwrap().into_parts();
    Got {
        status: parts.status,
        headers: parts.headers,
        body: body.collect().await.unwrap().to_bytes().to_vec(),
    }
}

#[tokio::test]
async fn a_signed_in_user_downloads_a_card_until_the_hourly_quota() {
    let state = AppState::new(config(
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", "https://memes.example"),
            ("NODE_ENV", "development"),
        ],
    ))
    .expect("app state");
    let db = state.db.clone();
    let pool = db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let user = create_user(&pool).await;
    as_service(
        &db,
        format!(
            "delete from public.memes where short_id = '{SHORT_ID}';
             insert into public.memes (short_id, slug, title, summary, safety_level, lifecycle_status, moderation_status, updated_at)
             values ('{SHORT_ID}', 'd2-export', '어쩔티비', '상대의 말을 받아치는 유행어', 'red', 'rising', 'approved', '2026-11-01T00:00:00.123456Z');
             insert into public.meme_translations (meme_id, locale, localized_slug, title, summary, description, origin, status,
                                                   source_updated_at, provider, model, reviewed_at, reviewed_by)
             select id, 'ja', 'd2-export-ja', 'オッチョルTV', '言い返す流行語', '説明', '由来', 'reviewed',
                    updated_at, 'test', 'test', now(), '{}'
               from public.memes where short_id = '{SHORT_ID}';",
            user.id
        ),
    )
    .await;
    let token = create_session(&pool, &user, 3_600.0).await;
    let cookie = signed_cookie(PLAIN, &token, "test-only-auth-secret");
    let app = spawn_router(build_app(state)).await;
    let path = format!("/memes/{SHORT_ID}-d2-export/export");

    let card = get(app, &format!("{path}?template=bold&format=story"), &cookie).await;
    assert_eq!(
        card.status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&card.body)
    );
    assert_eq!(card.header("content-type"), Some("image/png"));
    let disposition = format!(r#"attachment; filename="memecatch-{SHORT_ID}-bold-story.png""#);
    assert_eq!(
        card.header("content-disposition"),
        Some(disposition.as_str())
    );
    assert_eq!(card.header("cache-control"), Some("private, no-store"));
    assert_eq!(card.header("content-language"), Some("ko"));
    let reader = png::Decoder::new(std::io::Cursor::new(&card.body))
        .read_info()
        .expect("a png");
    assert_eq!((reader.info().width, reader.info().height), (1080, 1920));

    // The reviewed Japanese translation of this revision; none in Chinese.
    let ja = get(app, &format!("{path}?locale=ja"), &cookie).await;
    assert_eq!(ja.status, StatusCode::OK);
    assert_eq!(ja.header("content-language"), Some("ja"));
    let zh = get(app, &format!("{path}?locale=zh"), &cookie).await;
    assert_eq!(zh.status, StatusCode::NOT_FOUND);
    assert_eq!(zh.body, br#"{"error":"localized_translation_unavailable"}"#);
    let missing = get(app, "/memes/nosuchmeme/export", &cookie).await;
    assert_eq!(missing.body, br#"{"error":"not_found"}"#);

    // 30 an hour, every request above counted: four so far.
    for _ in 4..30 {
        assert_eq!(get(app, &path, &cookie).await.status, StatusCode::OK);
    }
    let limited = get(app, &path, &cookie).await;
    assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(limited.body, br#"{"error":"rate_limited"}"#);

    as_service(
        &db,
        format!("delete from public.memes where short_id = '{SHORT_ID}';"),
    )
    .await;
}
