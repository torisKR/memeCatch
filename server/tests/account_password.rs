//! `POST /api/account/password` (route id `account-password`), the signed-in
//! password change. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.
//!
//! - A new password longer than better-auth's maximum (128 UTF-16 units) is
//!   refused as better-auth's own reset refuses it (B6 review L2, PLAN.md B6-5).
//! - D2 (PLAN.md B6-27 M2): it is better-auth's `changePassword` with
//!   `revokeOtherSessions`: the current password must match, and every other
//!   session of the user ends while the one that asked stays.
//! - D2 (B6 follow-up review L2): better-auth's limiter for
//!   `/change-password` (3 per 10 s in production), per client address and
//!   per user.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{Reply, config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::auth::SessionUser;
use memecatch_server::{AppState, build_app};
use serde_json::{Value, json};
use sqlx::PgPool;

const SECRET: &str = "test-only-auth-secret";
const ORIGIN: &str = "https://memes.example";
const CURRENT: &str = "current-password-1";

/// better-auth's `hashPassword` (scrypt N=16384, r=16, p=1, 64 bytes, salt
/// as hex text), written here apart from `src/routes/better_auth/passwords.rs`.
fn scrypt_hash(password: &str) -> String {
    let salt = "00112233445566778899aabbccddeeff";
    let params = scrypt::Params::new(14, 16, 1).expect("params");
    let mut key = [0u8; 64];
    scrypt::scrypt(password.as_bytes(), salt.as_bytes(), &params, &mut key).expect("scrypt");
    format!("{salt}:{}", hex::encode(key))
}

struct Fixture {
    app: SocketAddr,
    pool: PgPool,
    cookie_name: &'static str,
}

async fn fixture(node_env: &str) -> Fixture {
    let state = AppState::new(config(
        marker_upstream().await,
        &database_url(),
        &[("NEXT_PUBLIC_SITE_URL", ORIGIN), ("NODE_ENV", node_env)],
    ))
    .expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let cookie_name = if node_env == "production" {
        "__Secure-better-auth.session_token"
    } else {
        PLAIN
    };
    Fixture {
        app: spawn_router(build_app(state)).await,
        pool,
        cookie_name,
    }
}

impl Fixture {
    /// A user with a credential account whose password is `CURRENT` (or none).
    async fn user(&self, with_password: bool) -> SessionUser {
        let user = create_user(&self.pool).await;
        if with_password {
            sqlx::query(
                r#"insert into public.account ("accountId", "providerId", "userId", password, "updatedAt")
                   values ($1, 'credential', $1::uuid, $2, now())"#,
            )
            .bind(&user.id)
            .bind(scrypt_hash(CURRENT))
            .execute(&self.pool)
            .await
            .expect("credential account");
        }
        user
    }

    async fn post(&self, token: &str, body: Value, forwarded_for: &str) -> Reply {
        let cookie = signed_cookie(self.cookie_name, token, SECRET);
        send(
            self.app,
            "POST",
            "/api/account/password",
            &[
                ("content-type", "application/json"),
                ("origin", ORIGIN),
                ("cookie", &cookie),
                ("x-forwarded-for", forwarded_for),
            ],
            Body::from(body.to_string()),
        )
        .await
    }

    async fn stored(&self, user: &SessionUser) -> String {
        sqlx::query_scalar(r#"select password from public.account where "userId" = $1::uuid"#)
            .bind(&user.id)
            .fetch_one(&self.pool)
            .await
            .expect("password")
    }

    async fn sessions(&self, user: &SessionUser) -> Vec<String> {
        sqlx::query_scalar(
            r#"select token from public.session where "userId" = $1::uuid order by token"#,
        )
        .bind(&user.id)
        .fetch_all(&self.pool)
        .await
        .expect("sessions")
    }
}

fn change(current: &str, password: &str) -> Value {
    json!({ "currentPassword": current, "password": password, "confirm": password })
}

fn body(reply: &Reply) -> Value {
    serde_json::from_str(&reply.body).expect("json body")
}

#[tokio::test]
async fn a_password_longer_than_better_auths_maximum_is_refused_and_kept() {
    let fixture = fixture("development").await;
    let user = fixture.user(true).await;
    let token = create_session(&fixture.pool, &user, 3_600.0).await;
    let before = fixture.stored(&user).await;

    // 129 UTF-16 units (an emoji counts two): better-auth's refusal, nothing stored.
    let too_long = format!("abc1{}😂", "a".repeat(123));
    assert_eq!(too_long.encode_utf16().count(), 129);
    let refused = fixture
        .post(&token, change(CURRENT, &too_long), "203.0.113.1")
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST, "{}", refused.body);
    assert_eq!(
        body(&refused),
        json!({ "message": "Password too long", "code": "PASSWORD_TOO_LONG" })
    );
    assert_eq!(fixture.stored(&user).await, before);

    // 128 is allowed, and stored.
    let longest = format!("abc1{}", "a".repeat(124));
    let changed = fixture
        .post(&token, change(CURRENT, &longest), "203.0.113.1")
        .await;
    assert_eq!(changed.status, StatusCode::OK, "{}", changed.body);
    assert_eq!(changed.body, r#"{"redirect":"/my"}"#);
    assert_ne!(fixture.stored(&user).await, before);
}

#[tokio::test]
async fn the_current_password_is_required_and_other_sessions_end() {
    let fixture = fixture("development").await;
    let user = fixture.user(true).await;
    let token = create_session(&fixture.pool, &user, 3_600.0).await;
    let other = create_session(&fixture.pool, &user, 3_600.0).await;
    let bystander = fixture.user(true).await;
    let bystander_session = create_session(&fixture.pool, &bystander, 3_600.0).await;
    let before = fixture.stored(&user).await;
    let new_password = "new-password-2026";

    // No current password, or a wrong one: better-auth's refusal, nothing changes.
    for current in ["", "wrong-password-1"] {
        let refused = fixture
            .post(&token, change(current, new_password), "203.0.113.2")
            .await;
        assert_eq!(refused.status, StatusCode::BAD_REQUEST, "{}", refused.body);
        assert_eq!(
            body(&refused),
            json!({ "message": "Invalid password", "code": "INVALID_PASSWORD" })
        );
        assert_eq!(fixture.stored(&user).await, before);
        assert_eq!(fixture.sessions(&user).await.len(), 2);
    }

    // The right one: stored, this session kept, the user's other one gone.
    let changed = fixture
        .post(&token, change(CURRENT, new_password), "203.0.113.2")
        .await;
    assert_eq!(changed.status, StatusCode::OK, "{}", changed.body);
    assert_eq!(changed.body, r#"{"redirect":"/my"}"#);
    assert_ne!(fixture.stored(&user).await, before);
    let left = fixture.sessions(&user).await;
    assert_eq!(left, vec![token.clone()]);
    assert!(!left.contains(&other));
    assert_eq!(fixture.sessions(&bystander).await, vec![bystander_session]);

    // The old password no longer matches.
    let again = fixture
        .post(&token, change(CURRENT, "another-password-3"), "203.0.113.2")
        .await;
    assert_eq!(body(&again)["code"], "INVALID_PASSWORD");
}

#[tokio::test]
async fn a_user_without_a_credential_account_is_told_so() {
    let fixture = fixture("development").await;
    let user = fixture.user(false).await;
    let token = create_session(&fixture.pool, &user, 3_600.0).await;
    let refused = fixture
        .post(&token, change(CURRENT, "new-password-2026"), "203.0.113.3")
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST, "{}", refused.body);
    assert_eq!(
        body(&refused),
        json!({ "message": "Credential account not found", "code": "CREDENTIAL_ACCOUNT_NOT_FOUND" })
    );
}

#[tokio::test]
async fn three_tries_per_ten_seconds_per_address_and_per_user_in_production() {
    let fixture = fixture("production").await;

    // Per address: the fourth try from one client is refused, signed in or not.
    for attempt in 1..=4 {
        let reply = fixture
            .post(
                "not-a-session",
                change(CURRENT, "new-password-2026"),
                "198.51.100.7",
            )
            .await;
        if attempt <= 3 {
            assert_eq!(reply.status, StatusCode::OK, "{attempt}: {}", reply.body);
        } else {
            assert_eq!(
                reply.status,
                StatusCode::TOO_MANY_REQUESTS,
                "{}",
                reply.body
            );
            assert_eq!(
                body(&reply),
                json!({ "message": "Too many requests. Please try again later." })
            );
            assert!(reply.headers.contains_key("x-retry-after"));
        }
    }
    // Another client is counted apart.
    let elsewhere = fixture
        .post(
            "not-a-session",
            change(CURRENT, "new-password-2026"),
            "198.51.100.8",
        )
        .await;
    assert_eq!(elsewhere.status, StatusCode::OK, "{}", elsewhere.body);

    // Per user: four clients, one account, the fourth refused before any check.
    let user = fixture.user(true).await;
    let token = create_session(&fixture.pool, &user, 3_600.0).await;
    for attempt in 1..=4 {
        let address = format!("192.0.2.{attempt}");
        let reply = fixture
            .post(
                &token,
                change("wrong-password-1", "new-password-2026"),
                &address,
            )
            .await;
        if attempt <= 3 {
            assert_eq!(
                body(&reply)["code"],
                "INVALID_PASSWORD",
                "{attempt}: {}",
                reply.body
            );
        } else {
            assert_eq!(
                reply.status,
                StatusCode::TOO_MANY_REQUESTS,
                "{}",
                reply.body
            );
        }
    }
}
