//! `POST /api/auth/sign-up/email` and its mail: the webhook is called after
//! the user and its credential account are committed, so a slow webhook
//! holds no database connection (PLAN.md A2-12). Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::Router;
use axum::body::Body;
use axum::http::StatusCode;
use axum::routing::post;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::{AppState, build_app};
use tokio::sync::{Notify, oneshot};

const SECRET: &str = "test-only-auth-secret";
const ORIGIN: &str = "http://localhost:3000";

/// A webhook that says when a mail arrived and answers once released.
async fn held_webhook() -> (String, oneshot::Receiver<()>, Arc<Notify>) {
    let (arrived, arrived_rx) = oneshot::channel::<()>();
    let arrived = Arc::new(std::sync::Mutex::new(Some(arrived)));
    let release = Arc::new(Notify::new());
    let held = release.clone();
    let router = Router::new().route(
        "/hook",
        post(move || {
            let (arrived, held) = (arrived.clone(), held.clone());
            async move {
                if let Some(arrived) = arrived.lock().expect("hook").take() {
                    let _ = arrived.send(());
                }
                held.notified().await;
                StatusCode::NO_CONTENT
            }
        }),
    );
    let address = spawn_router(router).await;
    (format!("http://{address}/hook"), arrived_rx, release)
}

#[tokio::test]
async fn a_slow_mail_webhook_holds_no_database_connection() {
    let (webhook, arrived, release) = held_webhook().await;
    let vars = [
        ("NODE_ENV", "development"),
        ("AXUM_DB_POOL_MAX", "1"),
        ("AUTH_EMAIL_WEBHOOK", webhook.as_str()),
    ];
    let state =
        AppState::new(config(marker_upstream().await, &database_url(), &vars)).expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let reader = create_user(&pool).await;
    let token = create_session(&pool, &reader, 3_600.0).await;
    let app = spawn_router(build_app(state)).await;

    // `ax` and 12 hex digits: the name the database tests leave profiles
    // under (public_routes/memes_table.rs refuses a database with others).
    let name = format!("ax{:012x}", rand::random::<u64>() & 0xffff_ffff_ffff);
    let email = format!("{name}@example.com");
    let body = format!(r#"{{"name":"{name}","email":"{email}","password":"first password 1"}}"#);
    let sign_up = tokio::spawn(async move {
        send(
            app,
            "POST",
            "/api/auth/sign-up/email",
            &[("content-type", "application/json"), ("origin", ORIGIN)],
            Body::from(body),
        )
        .await
    });
    arrived.await.expect("the mail reached the webhook");

    // The pool's only connection is free while the webhook keeps the mail.
    let started = Instant::now();
    let session = send(
        app,
        "GET",
        "/api/auth/get-session",
        &[("cookie", &signed_cookie(PLAIN, &token, SECRET))],
        Body::empty(),
    )
    .await;
    assert_eq!(session.status, StatusCode::OK, "{}", session.body);
    assert!(
        started.elapsed() < Duration::from_secs(2),
        "get-session waited {:?} for a connection",
        started.elapsed()
    );
    // The user and its account are already there, before the mail is done.
    let committed: i64 = sqlx::query_scalar(
        r#"select count(*) from public."user" u join public.account a on a."userId" = u.id
            where u.email = $1 and a."providerId" = 'credential'"#,
    )
    .bind(&email)
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(committed, 1);

    release.notify_one();
    let signed_up = sign_up.await.expect("sign-up ends");
    assert_eq!(signed_up.status, StatusCode::OK, "{}", signed_up.body);
    // syncAuthUser ran after the mail.
    let synced: i64 = sqlx::query_scalar("select count(*) from auth.users where email = $1")
        .bind(&email)
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(synced, 1);
}
