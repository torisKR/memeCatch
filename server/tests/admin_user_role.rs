//! `POST /_axum/admin/user-role` (`setUserRole`): an operator cannot take
//! their own operator role, whatever form of their id they send (B7 review
//! L1, PLAN.md D2-6). Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};

/// One statement as `service_role`, which may write `profiles`; its text.
async fn as_service(db: &Db, sql: &'static str, id: &str) -> Option<String> {
    let id = id.to_owned();
    let found: Result<Option<String>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_scalar(sql).bind(id).fetch_optional(tx).await }),
        )
        .await;
    found.expect("service statement")
}

const ORIGIN: &str = "https://memes.example";

#[tokio::test]
async fn an_operator_cannot_demote_themself_with_an_upper_case_id() {
    let state = AppState::new(config(
        marker_upstream().await,
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", ORIGIN),
            ("NODE_ENV", "development"),
            ("AXUM_PILOT_ROUTES", "admin-action-user-role"),
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
        "update public.profiles set role = 'operator' where id = $1::uuid returning role::text",
        &operator.id,
    )
    .await
    .expect("a profile");
    let token = create_session(&pool, &operator, 3_600.0).await;
    let cookie = signed_cookie(PLAIN, &token, "test-only-auth-secret");
    let app = spawn_router(build_app(state)).await;
    let role = || {
        as_service(
            &db,
            "select role::text from public.profiles where id = $1::uuid",
            &operator.id,
        )
    };

    for id in [operator.id.clone(), operator.id.to_uppercase()] {
        let body = serde_json::json!({ "userId": id, "role": "user" }).to_string();
        let reply = send(
            app,
            "POST",
            "/_axum/admin/user-role",
            &[
                ("content-type", "application/json"),
                ("origin", ORIGIN),
                ("cookie", &cookie),
            ],
            Body::from(body),
        )
        .await;
        assert_eq!(reply.status, StatusCode::OK, "{id}: {}", reply.body);
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&reply.body).unwrap()["ok"],
            false,
            "{id}: {}",
            reply.body
        );
        assert!(reply.body.contains("잠금 방지"), "{id}: {}", reply.body);
        assert_eq!(role().await.as_deref(), Some("operator"), "{id}");
    }
}
