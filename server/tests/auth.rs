//! Session resolution, the extractors and the cron guard against the real
//! schema. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.
//!
//! `real_better_auth_cookies_resolve_to_the_same_user` also needs Node and the
//! repository's `node_modules`, so it is ignored by default:
//!
//! ```sh
//! cargo test --test auth -- --ignored --nocapture
//! ```

mod common;

use std::net::SocketAddr;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

use axum::Router;
use axum::body::Body;
use axum::http::header::COOKIE;
use axum::http::{HeaderMap, HeaderValue, Request, StatusCode};
use axum::routing::get;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use common::{closed_addr, database_url};
use hmac::{Hmac, KeyInit, Mac};
use http_body_util::BodyExt;
use memecatch_server::AppState;
use memecatch_server::auth::{
    CronAuthorized, Operator, RequestIdentity, SessionUser, SignedInUser, resolve_session,
};
use memecatch_server::db::{DbIdentity, IdentityOptions};
use sha2::Sha256;
use sqlx::PgPool;

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const PLAIN: &str = "better-auth.session_token";
const SECURE: &str = "__Secure-better-auth.session_token";
const HOUR: f64 = 3_600.0;

/// The tables better-auth 1.7.20 creates for lib/auth/server.ts
/// (`ensureAuthSchema`), copied from `\d "user"` and `\d session` on a
/// database the app had set up, with the grant from `grantServiceRole`.
/// `if not exists` leaves tables the app created (the ignored test) alone.
/// The advisory lock keeps parallel tests from creating them twice.
const AUTH_TABLES: &str = r#"
select pg_advisory_xact_lock(72031120);
create table if not exists public."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null,
  image text,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null default current_timestamp
);
create table if not exists public.session (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default current_timestamp,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references public."user" (id) on delete cascade
);
create index if not exists "session_userId_idx" on public.session ("userId");
grant select on public."user", public.session to service_role;
"#;

async fn state_for(database_url: &str, extra: &[(&str, &str)]) -> AppState {
    let config = common::config(closed_addr().await, database_url, extra);
    AppState::new(config).expect("app state")
}

/// App state on the test database, with the auth tables in place.
async fn state(extra: &[(&str, &str)]) -> AppState {
    let state = state_for(&database_url(), extra).await;
    sqlx::raw_sql(AUTH_TABLES)
        .execute(state.db.pool())
        .await
        .expect("create the better-auth tables");
    state
}

/// App state whose database refuses connections.
async fn state_without_database() -> AppState {
    let dead = format!(
        "postgresql://memecatch:unused@{}/memecatch",
        closed_addr().await
    );
    state_for(&dead, &[]).await
}

/// A better-auth user the way the app leaves one: the `"user"` row, and the
/// `auth.users` row `syncAuthUser` adds (lib/auth/sync-user.ts), whose trigger
/// creates the profile with role `user`.
async fn create_user(pool: &PgPool) -> SessionUser {
    let (id, email): (String, String) = sqlx::query_as(
        r#"insert into public."user" (name, email, "emailVerified")
           values ('axum auth test', 'axum-auth-' || gen_random_uuid() || '@example.com', true)
           returning id::text, email"#,
    )
    .fetch_one(pool)
    .await
    .expect("insert user");
    sqlx::query(
        "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1::uuid, $2, now(),
                 jsonb_build_object('nickname', 'ax' || substr(replace($1, '-', ''), 1, 12)))",
    )
    .bind(&id)
    .bind(&email)
    .execute(pool)
    .await
    .expect("insert auth.users");
    SessionUser { id, email }
}

/// A session row for `user` that expires `expires_in_secs` from now. Returns
/// its token.
async fn create_session(pool: &PgPool, user: &SessionUser, expires_in_secs: f64) -> String {
    sqlx::query_scalar(
        r#"insert into public.session (token, "expiresAt", "updatedAt", "userId")
           values (replace(gen_random_uuid()::text, '-', ''),
                   now() + make_interval(secs => $1), now(), $2::uuid)
           returning token"#,
    )
    .bind(expires_in_secs)
    .bind(&user.id)
    .fetch_one(pool)
    .await
    .expect("insert session")
}

/// Operators are profiles with role `operator` (`is_operator`,
/// db/migrations/20260708004500_schema_v2.sql:319-322). `service_role` is the
/// identity allowed to change a role (`protect_profile_columns`).
async fn make_operator(state: &AppState, user: &SessionUser) {
    let id = user.id.clone();
    let updated: Result<u64, sqlx::Error> = state
        .db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query("update public.profiles set role = 'operator' where id = $1::uuid")
                        .bind(id)
                        .execute(tx)
                        .await
                        .map(|done| done.rows_affected())
                })
            },
        )
        .await;
    assert_eq!(
        updated.expect("promote to operator"),
        1,
        "the profile the auth.users trigger created"
    );
}

/// The signature better-call's `makeSignature` produces (dist/crypto.mjs:21-25),
/// written independently of `src/auth.rs`.
fn signature(token: &str, secret: &str) -> String {
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).expect("hmac key");
    mac.update(token.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

/// `name=encodeURIComponent("<token>.<signature>")`, as `signCookieValue`
/// leaves it (dist/crypto.mjs:26-31). Tokens are alphanumeric.
fn cookie(name: &str, token: &str, signature: &str) -> String {
    let value = format!("{token}.{signature}")
        .replace('+', "%2B")
        .replace('/', "%2F")
        .replace('=', "%3D");
    format!("{name}={value}")
}

fn signed_cookie(name: &str, token: &str, secret: &str) -> String {
    cookie(name, token, &signature(token, secret))
}

/// `text` with its first character replaced by another one.
fn first_char_changed(text: &str, a: char, b: char) -> String {
    let replacement = if text.starts_with(a) { b } else { a };
    format!("{replacement}{}", &text[1..])
}

fn cookie_headers(cookie: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(
        COOKIE,
        HeaderValue::from_str(cookie).expect("cookie header"),
    );
    headers
}

async fn resolve(state: &AppState, cookie: &str) -> Option<SessionUser> {
    resolve_session(state, &cookie_headers(cookie))
        .await
        .expect("the database answers")
}

async fn whoami(identity: RequestIdentity) -> String {
    let role = identity.db_identity().role.as_str();
    match identity.0 {
        Some(user) => format!("{role} {} {}", user.id, user.email),
        None => role.to_owned(),
    }
}

async fn me(SignedInUser(user): SignedInUser) -> String {
    user.id
}

async fn admin(Operator(user): Operator) -> String {
    user.id
}

async fn cron(_: CronAuthorized) -> &'static str {
    "ran"
}

async fn spawn(state: AppState) -> SocketAddr {
    let router = Router::new()
        .route("/whoami", get(whoami))
        .route("/me", get(me))
        .route("/admin", get(admin))
        .route("/cron", get(cron))
        .with_state(state);
    common::spawn_router(router).await
}

async fn fetch(app: SocketAddr, path: &str, headers: &[(&str, &str)]) -> (StatusCode, String) {
    let mut request = Request::builder().uri(format!("http://{app}{path}"));
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    let response = common::client()
        .request(request.body(Body::empty()).expect("request"))
        .await
        .expect("response");
    let status = response.status();
    let body = response.into_body().collect().await.expect("body");
    (
        status,
        String::from_utf8(body.to_bytes().to_vec()).expect("utf-8 body"),
    )
}

#[tokio::test]
async fn a_valid_session_resolves_to_its_user_under_both_cookie_names() {
    let state = state(&[]).await;
    let user = create_user(state.db.pool()).await;
    let token = create_session(state.db.pool(), &user, HOUR).await;

    let plain = resolve(&state, &signed_cookie(PLAIN, &token, SECRET)).await;
    let secure = resolve(&state, &signed_cookie(SECURE, &token, SECRET)).await;
    let among_others = resolve(
        &state,
        &format!(
            "memecatch_locale=en; {}; theme=dark",
            signed_cookie(PLAIN, &token, SECRET)
        ),
    )
    .await;

    assert_eq!(plain.as_ref(), Some(&user));
    assert_eq!(secure.as_ref(), Some(&user));
    assert_eq!(among_others.as_ref(), Some(&user));
}

#[tokio::test]
async fn cookies_better_auth_would_refuse_resolve_to_signed_out() {
    let state = state(&[]).await;
    let pool = state.db.pool();
    let user = create_user(pool).await;
    let live = create_session(pool, &user, HOUR).await;
    let expired = create_session(pool, &user, -HOUR).await;
    let good = signed_cookie(PLAIN, &live, SECRET);
    let good_signature = signature(&live, SECRET);
    // One character changed in the signature, and one in the token.
    let tampered_signature = cookie(PLAIN, &live, &first_char_changed(&good_signature, 'A', 'B'));
    let tampered_token = cookie(PLAIN, &first_char_changed(&live, '0', '1'), &good_signature);

    let cases = [
        ("tampered signature", tampered_signature),
        ("tampered token", tampered_token),
        (
            "token not in the table",
            signed_cookie(PLAIN, "0123456789abcdef0123456789abcdef", SECRET),
        ),
        ("expired session", signed_cookie(PLAIN, &expired, SECRET)),
        (
            "expired session, secure name",
            signed_cookie(SECURE, &expired, SECRET),
        ),
        (
            "signed with a different secret",
            signed_cookie(PLAIN, &live, "another-secret"),
        ),
        ("unsigned token", format!("{PLAIN}={live}")),
        ("empty value", format!("{PLAIN}=")),
        ("only a dot", format!("{PLAIN}=.")),
        ("lone quote", format!("{PLAIN}=\"")),
        ("bad percent escape", format!("{PLAIN}={live}.%zz%3D")),
        (
            "signature that is not base64",
            format!("{PLAIN}={live}.{}%3D", "!".repeat(43)),
        ),
        (
            "signature of the wrong length",
            format!("{PLAIN}={live}.AAAA%3D"),
        ),
        (
            "no cookie pair at all",
            "better-auth.session_token".to_owned(),
        ),
        ("another cookie only", "theme=dark".to_owned()),
    ];
    for (case, cookie) in cases {
        assert_eq!(resolve(&state, &cookie).await, None, "{case}: {cookie}");
    }
    // The control: the untouched cookie is accepted.
    assert_eq!(resolve(&state, &good).await, Some(user));
    assert_eq!(
        resolve_session(&state, &HeaderMap::new()).await.unwrap(),
        None,
        "no Cookie header"
    );
}

#[tokio::test]
async fn a_database_failure_is_an_error_not_signed_out() {
    let state = state_without_database().await;
    let cookie = signed_cookie(PLAIN, "0123456789abcdef0123456789abcdef", SECRET);
    let started = Instant::now();

    let with_valid_signature = resolve_session(&state, &cookie_headers(&cookie)).await;
    // No session cookie and a bad signature never reach the database.
    let no_cookie = resolve_session(&state, &HeaderMap::new()).await;
    let bad_signature =
        resolve_session(&state, &cookie_headers(&format!("{PLAIN}=token.nope"))).await;

    assert!(
        with_valid_signature.is_err(),
        "expected an error, got {with_valid_signature:?}"
    );
    assert!(
        started.elapsed() < Duration::from_secs(6),
        "{:?}",
        started.elapsed()
    );
    assert_eq!(no_cookie.unwrap(), None);
    assert_eq!(bad_signature.unwrap(), None);
}

#[tokio::test]
async fn extractors_answer_503_when_the_database_is_down() {
    let app = spawn(state_without_database().await).await;
    let cookie = signed_cookie(PLAIN, "0123456789abcdef0123456789abcdef", SECRET);
    let signed = [("cookie", cookie.as_str())];

    let (whoami, me, admin, anonymous) = tokio::join!(
        fetch(app, "/whoami", &signed),
        fetch(app, "/me", &signed),
        fetch(app, "/admin", &signed),
        fetch(app, "/whoami", &[]),
    );

    let unavailable = (
        StatusCode::SERVICE_UNAVAILABLE,
        r#"{"ok":false,"error":"auth_unavailable"}"#.to_owned(),
    );
    assert_eq!(whoami, unavailable);
    assert_eq!(me, unavailable);
    assert_eq!(admin, unavailable);
    assert_eq!(anonymous, (StatusCode::OK, "anon".to_owned()));
}

#[tokio::test]
async fn extractors_separate_signed_out_users_and_operators() {
    let state = state(&[]).await;
    let pool = state.db.pool();
    let user = create_user(pool).await;
    let operator = create_user(pool).await;
    make_operator(&state, &operator).await;
    let user_cookie = signed_cookie(PLAIN, &create_session(pool, &user, HOUR).await, SECRET);
    let operator_cookie =
        signed_cookie(SECURE, &create_session(pool, &operator, HOUR).await, SECRET);
    let expired_operator_cookie =
        signed_cookie(PLAIN, &create_session(pool, &operator, -HOUR).await, SECRET);
    let app = spawn(state).await;
    let as_user = [("cookie", user_cookie.as_str())];
    let as_operator = [("cookie", operator_cookie.as_str())];
    let as_expired = [("cookie", expired_operator_cookie.as_str())];
    let signed_out = (
        StatusCode::UNAUTHORIZED,
        r#"{"ok":false,"error":"signed_out"}"#.to_owned(),
    );

    // Signed out.
    assert_eq!(
        fetch(app, "/whoami", &[]).await,
        (StatusCode::OK, "anon".to_owned())
    );
    assert_eq!(fetch(app, "/me", &[]).await, signed_out);
    assert_eq!(fetch(app, "/admin", &[]).await, signed_out);
    assert_eq!(fetch(app, "/admin", &as_expired).await, signed_out);
    // A normal user.
    assert_eq!(
        fetch(app, "/whoami", &as_user).await,
        (
            StatusCode::OK,
            format!("authenticated {} {}", user.id, user.email)
        )
    );
    assert_eq!(
        fetch(app, "/me", &as_user).await,
        (StatusCode::OK, user.id.clone())
    );
    assert_eq!(
        fetch(app, "/admin", &as_user).await,
        (
            StatusCode::FORBIDDEN,
            r#"{"ok":false,"error":"operator_required"}"#.to_owned()
        )
    );
    // An operator.
    assert_eq!(
        fetch(app, "/me", &as_operator).await,
        (StatusCode::OK, operator.id.clone())
    );
    assert_eq!(
        fetch(app, "/admin", &as_operator).await,
        (StatusCode::OK, operator.id.clone())
    );
}

#[tokio::test]
async fn the_resolved_identity_is_the_one_row_level_security_sees() {
    let state = state(&[]).await;
    let user = create_user(state.db.pool()).await;
    let token = create_session(state.db.pool(), &user, HOUR).await;
    let signed_in = RequestIdentity(resolve(&state, &signed_cookie(PLAIN, &token, SECRET)).await);
    let signed_out = RequestIdentity(resolve(&state, "theme=dark").await);

    let mut seen = Vec::new();
    for identity in [&signed_in, &signed_out] {
        let row: Result<(Option<String>, String, String), sqlx::Error> = state
            .db
            .with_identity(&identity.db_identity(), IdentityOptions::default(), |tx| {
                Box::pin(async move {
                    sqlx::query_as("select auth.uid()::text, auth.role(), current_user::text")
                        .fetch_one(tx)
                        .await
                })
            })
            .await;
        seen.push(row.expect("query as the resolved identity"));
    }

    assert_eq!(
        signed_in.db_identity(),
        DbIdentity::authenticated(user.id.as_str())
    );
    assert_eq!(signed_out.db_identity(), DbIdentity::anon());
    assert_eq!(
        seen[0],
        (
            Some(user.id),
            "authenticated".to_owned(),
            "authenticated".to_owned()
        )
    );
    assert_eq!(seen[1], (None, "anon".to_owned(), "anon".to_owned()));
}

#[tokio::test]
async fn cron_guard_accepts_only_the_exact_bearer() {
    // The pools are lazy and the cron guard never queries.
    let state = state_for(
        common::UNUSED_DATABASE_URL,
        &[("CRON_SECRET", "cron-secret-value")],
    );
    let app = spawn(state.await).await;
    let unauthorized = (
        StatusCode::UNAUTHORIZED,
        r#"{"ok":false,"error":"UNAUTHORIZED"}"#.to_owned(),
    );

    assert_eq!(
        fetch(
            app,
            "/cron",
            &[("authorization", "Bearer cron-secret-value")]
        )
        .await,
        (StatusCode::OK, "ran".to_owned())
    );
    for wrong in [
        "Bearer wrong-secret-value",
        "Bearer cron-secret-valu",
        "Bearer cron-secret-value-and-more",
        "bearer cron-secret-value",
        "Bearer  cron-secret-value",
        "cron-secret-value",
        "Bearer",
    ] {
        assert_eq!(
            fetch(app, "/cron", &[("authorization", wrong)]).await,
            unauthorized,
            "{wrong:?}"
        );
    }
    assert_eq!(fetch(app, "/cron", &[]).await, unauthorized, "no header");
    assert_eq!(
        fetch(
            app,
            "/cron",
            &[
                ("authorization", "Bearer wrong-secret-value"),
                ("authorization", "Bearer cron-secret-value"),
            ],
        )
        .await,
        unauthorized,
        "only the first of two Authorization headers counts"
    );
}

#[tokio::test]
async fn cron_guard_refuses_everything_while_the_secret_is_unset() {
    for extra in [
        &[][..],
        &[("CRON_SECRET", "")][..],
        &[("CRON_SECRET", "   ")][..],
    ] {
        let app = spawn(state_for(common::UNUSED_DATABASE_URL, extra).await).await;

        for sent in ["Bearer ", "Bearer", "Bearer undefined", "Bearer    "] {
            let (status, _) = fetch(app, "/cron", &[("authorization", sent)]).await;
            assert_eq!(status, StatusCode::UNAUTHORIZED, "{extra:?} {sent:?}");
        }
        let (status, _) = fetch(app, "/cron", &[]).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED, "{extra:?} no header");
    }
}

/// What tests/better_auth_cookie.mjs prints.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Minted {
    cookie: String,
    cookie_name: String,
    user_id: String,
    email: String,
}

/// Has the app's own better-auth sign a user up and in against the test
/// database, with the same secret the Rust side is configured with.
fn mint_with_better_auth(node_env: &str) -> Minted {
    let repository = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("repository root");
    let output = Command::new("node")
        .args([
            "--import",
            "./scripts/register-ts-paths.mjs",
            "server/tests/better_auth_cookie.mjs",
        ])
        .current_dir(repository)
        .env("DATABASE_URL", database_url())
        .env("BETTER_AUTH_SECRET", SECRET)
        .env("NODE_ENV", node_env)
        .output()
        .expect("run node");
    assert!(
        output.status.success(),
        "better_auth_cookie.mjs failed:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("one JSON line from better_auth_cookie.mjs")
}

#[tokio::test]
#[ignore = "needs Node and node_modules: cargo test --test auth -- --ignored --nocapture"]
async fn real_better_auth_cookies_resolve_to_the_same_user() {
    for (node_env, cookie_name) in [("development", PLAIN), ("production", SECURE)] {
        let minted = mint_with_better_auth(node_env);
        // After the script: its `ensureAuthSchema` created the real tables.
        let state = state(&[]).await;
        let better_auth_user = SessionUser {
            id: minted.user_id.clone(),
            email: minted.email.clone(),
        };

        let resolved = resolve(&state, &minted.cookie).await;
        // The same cookie with the first character of its token changed.
        let (name, value) = minted.cookie.split_once('=').expect("name=value");
        let tampered = format!("{name}={}", first_char_changed(value, '0', '1'));
        let tampered_resolved = resolve(&state, &tampered).await;

        println!("NODE_ENV={node_env}");
        println!("  cookie       {}", minted.cookie);
        println!("  better-auth  {} {}", minted.user_id, minted.email);
        println!("  rust         {resolved:?}");
        assert_eq!(minted.cookie_name, cookie_name);
        assert_eq!(resolved.as_ref(), Some(&better_auth_user));
        assert_eq!(tampered_resolved, None, "{tampered}");

        // The same cookie through the extractors, before and after the user
        // becomes an operator. The profile is the one the app's own sign-up
        // hook created.
        let app = spawn(state.clone()).await;
        let signed = [("cookie", minted.cookie.as_str())];
        let me = fetch(app, "/me", &signed).await;
        let admin_as_user = fetch(app, "/admin", &signed).await;
        make_operator(&state, &better_auth_user).await;
        let admin_as_operator = fetch(app, "/admin", &signed).await;

        println!(
            "  /me {} /admin {} -> operator -> /admin {}",
            me.0, admin_as_user.0, admin_as_operator.0
        );
        assert_eq!(me, (StatusCode::OK, minted.user_id.clone()));
        assert_eq!(admin_as_user.0, StatusCode::FORBIDDEN);
        assert_eq!(admin_as_operator, (StatusCode::OK, minted.user_id.clone()));
    }
}
