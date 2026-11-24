//! Email sign-in, sign-up, verification and password reset in Rust against
//! the app's own better-auth on one test database, each flow both ways,
//! under each `NODE_ENV`:
//!
//! - a user signed up by better-auth verifies its address and signs in on
//!   Rust, and one signed up on Rust does both on better-auth (the token of
//!   either server's mail, the password hash of either server);
//! - a reset requested on one server is completed on the other, and the new
//!   password signs in on the first; a spent token is refused by both;
//! - a session Rust signs in is one better-auth's `getSession` reads.
//!
//! Both servers post their mail to one local stub, which this test reads.
//! Needs the test database, Node and the repository's `node_modules`:
//!
//! ```sh
//! export DATABASE_URL="$(scripts/test-db.sh up)"
//! cargo test --test auth_credentials_cross -- --ignored --nocapture
//! ```

mod common;

use std::net::SocketAddr;
use std::path::Path;
use std::process::Command;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::post;
use common::{Reply, config, database_url, marker_upstream, send, spawn_app, spawn_router};
use serde_json::{Value, json};
use sqlx::PgPool;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const ORIGIN: &str = "http://localhost:3000";
const MODES: [&str; 2] = ["development", "production"];
const PASSWORD: &str = "first password 1";
const NEW_PASSWORD: &str = "second password 2";

/// One Node process at a time: each runs `ensureAuthSchema`, whose grants
/// fail when two run at once.
static NODE: Mutex<()> = Mutex::new(());

/// The webhook both servers post their mail to.
#[derive(Clone, Default)]
struct Mailbox(Arc<Mutex<Vec<Value>>>);

impl Mailbox {
    async fn serve(&self) -> SocketAddr {
        let router = Router::new()
            .route(
                "/hook",
                post(|State(mailbox): State<Mailbox>, body: Bytes| async move {
                    let mail = serde_json::from_slice(&body).expect("a JSON mail");
                    mailbox.0.lock().expect("mailbox").push(mail);
                    StatusCode::NO_CONTENT
                }),
            )
            .with_state(self.clone());
        spawn_router(router).await
    }

    /// The `url` of the last mail to `to` with this subject.
    fn link(&self, to: &str, subject: &str) -> String {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|mail| mail["to"] == to && mail["subject"] == subject)
            .unwrap_or_else(|| panic!("no {subject:?} mail to {to}"));
        mail["url"].as_str().expect("url").to_owned()
    }
}

/// The `token` query parameter of a mailed link.
fn token_in(link: &str) -> String {
    let url = url::Url::parse(link).expect("an absolute link");
    url.query_pairs()
        .find(|(key, _)| key == "token")
        .map(|(_, value)| value.into_owned())
        .expect("a token")
}

struct Side {
    mode: &'static str,
    app: SocketAddr,
    webhook: String,
    mailbox: Mailbox,
    pool: PgPool,
}

impl Side {
    async fn new(mode: &'static str) -> Self {
        let mailbox = Mailbox::default();
        let webhook = format!("http://{}/hook", mailbox.serve().await);
        let vars = [("NODE_ENV", mode), ("AUTH_EMAIL_WEBHOOK", webhook.as_str())];
        let app = spawn_app(config(marker_upstream().await, &database_url(), &vars)).await;
        let pool = PgPool::connect(&database_url()).await.expect("connect");
        let side = Self {
            mode,
            app,
            webhook,
            mailbox,
            pool,
        };
        // better-auth creates its tables when Next first serves it
        // (`ensureAuthSchema`); on a fresh test database Rust must not be
        // first. In production they have existed since then.
        side.better_auth("get-session", &[""]);
        side
    }

    fn email(&self, flow: &str) -> String {
        let unique = format!("{:x}", rand_suffix());
        format!("a2-cross-{flow}-{}-{unique}@example.com", self.mode)
    }

    /// One step through the app's better-auth (tests/better_auth_credentials.mjs).
    fn better_auth(&self, step: &str, args: &[&str]) -> Value {
        let _one_at_a_time = NODE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("repository root");
        let output = Command::new("node")
            .args([
                "--import",
                "./scripts/register-ts-paths.mjs",
                "server/tests/better_auth_credentials.mjs",
                step,
            ])
            .args(args)
            .current_dir(repository)
            .env("DATABASE_URL", database_url())
            .env("BETTER_AUTH_SECRET", SECRET)
            .env("NODE_ENV", self.mode)
            .env("AUTH_EMAIL_WEBHOOK", &self.webhook)
            .output()
            .expect("run node");
        assert!(
            output.status.success(),
            "{step} failed:\n{}",
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).expect("one JSON line")
    }

    async fn rust(&self, method: &str, path: &str, body: Value) -> Reply {
        let address = format!("198.51.100.{}", rand_suffix() % 250);
        let headers = [
            ("content-type", "application/json"),
            ("origin", ORIGIN),
            ("x-forwarded-for", address.as_str()),
        ];
        let body = if method == "GET" {
            Body::empty()
        } else {
            Body::from(body.to_string())
        };
        send(self.app, method, path, &headers, body).await
    }

    async fn verified(&self, email: &str) -> (bool, Option<String>) {
        sqlx::query_as(
            r#"select u."emailVerified", (select a.email_confirmed_at::text from auth.users a where a.id = u.id)
                 from public."user" u where u.email = $1"#,
        )
        .bind(email)
        .fetch_one(&self.pool)
        .await
        .expect("the user")
    }
}

fn rand_suffix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("after 1970")
        .subsec_nanos();
    u64::from(nanos) ^ (COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed) << 32)
}

const VERIFY: &str = "Verify your MemeCatch email";
const RESET: &str = "Reset your MemeCatch password";

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs Node, node_modules and the test database"]
async fn signed_up_on_better_auth_then_verified_and_signed_in_on_rust() {
    for mode in MODES {
        let side = Side::new(mode).await;
        let email = side.email("ba-up");
        let up = side.better_auth("sign-up", &[&email, PASSWORD, "cross user"]);
        assert_eq!(up["status"], 200, "{up}");

        let refused = side
            .rust(
                "POST",
                "/api/auth/sign-in/email",
                json!({"email": email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(
            refused.status,
            StatusCode::FORBIDDEN,
            "{mode}: {}",
            refused.body
        );
        assert!(refused.body.contains("EMAIL_NOT_VERIFIED"));

        let link = side.mailbox.link(&email, VERIFY);
        let path = format!(
            "/api/auth/verify-email?token={}&callbackURL=%2F",
            token_in(&link)
        );
        let verified = side.rust("GET", &path, Value::Null).await;
        assert_eq!(
            verified.status,
            StatusCode::FOUND,
            "{mode}: {}",
            verified.body
        );
        assert_eq!(verified.header("location"), Some("/"));
        let (user_verified, confirmed_at) = side.verified(&email).await;
        assert!(
            user_verified && confirmed_at.is_some(),
            "{mode}: the user and auth.users are verified"
        );

        let signed_in = side
            .rust(
                "POST",
                "/api/auth/sign-in/email",
                json!({"email": email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(
            signed_in.status,
            StatusCode::OK,
            "{mode}: {}",
            signed_in.body
        );
        let cookie = signed_in.header("set-cookie").expect("a session cookie");
        let pair = cookie.split(';').next().expect("name=value");
        // better-auth reads the session Rust made.
        let session = side.better_auth("get-session", &[pair]);
        assert_eq!(
            session["body"]["user"]["email"],
            email.as_str(),
            "{mode}: {session}"
        );
        // Using the link again changes nothing, on either server.
        assert_eq!(
            side.rust("GET", &path, Value::Null).await.status,
            StatusCode::FOUND
        );
        assert_eq!(
            side.better_auth("verify", &[&token_in(&link)])["body"]["status"],
            true
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs Node, node_modules and the test database"]
async fn signed_up_on_rust_then_verified_and_signed_in_on_better_auth() {
    for mode in MODES {
        let side = Side::new(mode).await;
        let email = side.email("rust-up");
        let up = side
            .rust(
                "POST",
                "/api/auth/sign-up/email",
                json!({"name": "cross user", "email": email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(up.status, StatusCode::OK, "{mode}: {}", up.body);

        // better-auth refuses the unverified address, then reads Rust's token.
        assert_eq!(
            side.better_auth("sign-in", &[&email, PASSWORD])["code"],
            "EMAIL_NOT_VERIFIED"
        );
        let token = token_in(&side.mailbox.link(&email, VERIFY));
        let verified = side.better_auth("verify", &[&token]);
        assert_eq!(verified["status"], 200, "{mode}: {verified}");
        let (user_verified, confirmed_at) = side.verified(&email).await;
        assert!(user_verified && confirmed_at.is_some(), "{mode}");

        // Rust's scrypt hash, verified by better-auth; a wrong one refused.
        let signed_in = side.better_auth("sign-in", &[&email, PASSWORD]);
        assert_eq!(signed_in["status"], 200, "{mode}: {signed_in}");
        assert_eq!(
            side.better_auth("sign-in", &[&email, NEW_PASSWORD])["code"],
            "INVALID_EMAIL_OR_PASSWORD"
        );
        // Rust's syncAuthUser wrote the user into auth.users with its
        // nickname (profiles, which the login role cannot read, are compared
        // by parity/auth-credentials.mjs).
        let nickname: String = sqlx::query_scalar(
            r#"select a.raw_user_meta_data->>'nickname' from auth.users a join public."user" u on u.id = a.id where u.email = $1"#,
        )
        .bind(&email)
        .fetch_one(&side.pool)
        .await
        .expect("an auth.users row");
        assert!(nickname.starts_with("cross user"), "{nickname}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "needs Node, node_modules and the test database"]
async fn a_reset_requested_on_one_server_is_completed_on_the_other() {
    for mode in MODES {
        let side = Side::new(mode).await;

        // Requested on better-auth, completed on Rust, signed in on better-auth.
        let email = side.email("reset-ba");
        side.better_auth("sign-up", &[&email, PASSWORD, "reset user"]);
        sqlx::query(r#"update public."user" set "emailVerified" = true where email = $1"#)
            .bind(&email)
            .execute(&side.pool)
            .await
            .expect("verify");
        assert_eq!(side.better_auth("request-reset", &[&email])["status"], 200);
        let token = token_in(&side.mailbox.link(&email, RESET));
        let reset = side
            .rust(
                "POST",
                "/api/auth/reset-password",
                json!({"newPassword": NEW_PASSWORD, "token": token}),
            )
            .await;
        assert_eq!(reset.status, StatusCode::OK, "{mode}: {}", reset.body);
        assert_eq!(
            side.better_auth("sign-in", &[&email, NEW_PASSWORD])["status"],
            200
        );
        assert_eq!(
            side.better_auth("sign-in", &[&email, PASSWORD])["code"],
            "INVALID_EMAIL_OR_PASSWORD"
        );
        // The token is spent for both.
        assert_eq!(
            side.better_auth("reset", &[&token, PASSWORD])["code"],
            "INVALID_TOKEN"
        );
        let again = side
            .rust(
                "POST",
                "/api/auth/reset-password",
                json!({"newPassword": PASSWORD, "token": token}),
            )
            .await;
        assert!(again.body.contains("INVALID_TOKEN"), "{}", again.body);

        // Requested on Rust, completed on better-auth, signed in on Rust.
        let email = side.email("reset-rust");
        side.better_auth("sign-up", &[&email, PASSWORD, "reset user"]);
        sqlx::query(r#"update public."user" set "emailVerified" = true where email = $1"#)
            .bind(&email)
            .execute(&side.pool)
            .await
            .expect("verify");
        let requested = side
            .rust(
                "POST",
                "/api/auth/request-password-reset",
                json!({"email": email}),
            )
            .await;
        assert_eq!(requested.status, StatusCode::OK, "{}", requested.body);
        let token = token_in(&side.mailbox.link(&email, RESET));
        assert_eq!(
            side.better_auth("reset", &[&token, NEW_PASSWORD])["status"],
            200,
            "{mode}"
        );
        let signed_in = side
            .rust(
                "POST",
                "/api/auth/sign-in/email",
                json!({"email": email, "password": NEW_PASSWORD}),
            )
            .await;
        assert_eq!(
            signed_in.status,
            StatusCode::OK,
            "{mode}: {}",
            signed_in.body
        );
        let again = side
            .rust(
                "POST",
                "/api/auth/reset-password",
                json!({"newPassword": PASSWORD, "token": token}),
            )
            .await;
        assert!(again.body.contains("INVALID_TOKEN"), "{}", again.body);
    }
}
