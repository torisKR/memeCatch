//! `POST /api/account/password` (route id `account-password`): a new
//! password longer than better-auth's maximum (128 UTF-16 units) is refused
//! as better-auth's own reset refuses it, so a user cannot set a password
//! that sign-in then turns away (B6 review L2, PLAN.md B6-5). Needs the test
//! database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::{AppState, build_app};

const SECRET: &str = "test-only-auth-secret";
const ORIGIN: &str = "https://memes.example";
const OLD_HASH: &str = "old-hash";

#[tokio::test]
async fn a_password_longer_than_better_auths_maximum_is_refused_and_kept() {
    let state = AppState::new(config(
        marker_upstream().await,
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
    sqlx::query(
        r#"insert into public.account ("accountId", "providerId", "userId", password, "updatedAt")
           values ($1, 'credential', $1::uuid, $2, now())"#,
    )
    .bind(&user.id)
    .bind(OLD_HASH)
    .execute(&pool)
    .await
    .expect("credential account");
    let token = create_session(&pool, &user, 3_600.0).await;
    let cookie = signed_cookie(PLAIN, &token, SECRET);
    let app = spawn_router(build_app(state)).await;
    let post = |password: String| {
        let cookie = cookie.clone();
        async move {
            let body = serde_json::json!({ "password": password, "confirm": password }).to_string();
            send(
                app,
                "POST",
                "/api/account/password",
                &[
                    ("content-type", "application/json"),
                    ("origin", ORIGIN),
                    ("cookie", &cookie),
                ],
                Body::from(body),
            )
            .await
        }
    };
    let stored = || async {
        sqlx::query_scalar::<_, String>(
            r#"select password from public.account where "userId" = $1::uuid"#,
        )
        .bind(&user.id)
        .fetch_one(&pool)
        .await
        .expect("password")
    };

    // 129 UTF-16 units (an emoji counts two): better-auth's refusal, nothing stored.
    let too_long = format!("abc1{}😂", "a".repeat(123));
    assert_eq!(too_long.encode_utf16().count(), 129);
    let refused = post(too_long).await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST, "{}", refused.body);
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&refused.body).unwrap(),
        serde_json::json!({ "message": "Password too long", "code": "PASSWORD_TOO_LONG" })
    );
    assert_eq!(stored().await, OLD_HASH);

    // 128 is allowed, and stored.
    let longest = format!("abc1{}", "a".repeat(124));
    let changed = post(longest).await;
    assert_eq!(changed.status, StatusCode::OK, "{}", changed.body);
    assert_eq!(changed.body, r#"{"redirect":"/my"}"#);
    assert_ne!(stored().await, OLD_HASH);
}
