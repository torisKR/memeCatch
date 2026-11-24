//! `POST /api/community/preview` needs a session (PLAN.md D5-2): the only
//! page that calls it, /community/new, already requires sign-in, so a
//! signed-out request gets the `login_required` answer the other community
//! endpoints give, and nothing is rendered. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, send, spawn_router};
use memecatch_server::{AppState, build_app};

const ORIGIN: &str = "https://memes.example";
const DRAFT: &str = r#"{"body":"**bold**"}"#;

#[tokio::test]
async fn a_preview_needs_a_session() {
    let state = AppState::new(config(
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", ORIGIN),
            ("NODE_ENV", "development"),
        ],
    ))
    .expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let user = create_user(&pool).await;
    let token = create_session(&pool, &user, 3_600.0).await;
    let cookie = signed_cookie(PLAIN, &token, "test-only-auth-secret");
    let app = spawn_router(build_app(state)).await;
    let preview = async |cookie: Option<&str>| {
        let mut headers = vec![("origin", ORIGIN), ("content-type", "application/json")];
        if let Some(cookie) = cookie {
            headers.push(("cookie", cookie));
        }
        send(
            app,
            "POST",
            "/api/community/preview",
            &headers,
            Body::from(DRAFT),
        )
        .await
    };

    let signed_out = preview(None).await;
    assert_eq!(signed_out.status, StatusCode::OK);
    assert_eq!(
        signed_out.body,
        r#"{"error":"login_required","message":"로그인이 필요해요. 쓰던 내용은 저장해 둘게요.","ok":false}"#
    );
    // A session cookie that names no session is signed out too.
    let stale = signed_cookie(PLAIN, "nosuchtoken", "test-only-auth-secret");
    assert!(preview(Some(&stale)).await.body.contains("login_required"));

    let signed_in = preview(Some(&cookie)).await;
    assert_eq!(signed_in.status, StatusCode::OK);
    assert!(
        signed_in.body.contains("<strong>bold</strong>"),
        "{}",
        signed_in.body
    );

    // Another origin is still refused before anything else.
    let foreign = send(
        app,
        "POST",
        "/api/community/preview",
        &[("origin", "https://elsewhere.example"), ("cookie", &cookie)],
        Body::from(DRAFT),
    )
    .await;
    assert_eq!(foreign.status, StatusCode::FORBIDDEN);
}
