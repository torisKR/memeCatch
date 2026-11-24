//! TikTok login (`/auth/tiktok`, `/auth/tiktok/callback`) end to end in Rust
//! against a stub of TikTok (`AXUM_TEST_OAUTH_ORIGIN`): the requests TikTok
//! sees, the rows and mail a first login leaves, the refusal every address
//! this flow makes gets (PLAN.md A4-1), and the session a verified user gets,
//! which get-session reads. The comparison with Next, both ways, is
//! parity/auth-tiktok.mjs. Needs the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode, Uri};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use common::session::AUTH_TABLES;
use common::{Reply, config, database_url, marker_upstream, send, spawn_router};
use memecatch_server::{AppState, build_app};
use sha2::{Digest, Sha256};
use sqlx::PgPool;

/// What the stub saw, one line per request.
#[derive(Clone, Default)]
struct Seen(Arc<Mutex<Vec<String>>>);

impl Seen {
    fn push(&self, line: String) {
        self.0.lock().expect("seen").push(line);
    }

    fn take(&self) -> Vec<String> {
        std::mem::take(&mut *self.0.lock().expect("seen"))
    }
}

/// What the stub answers for one TikTok account.
#[derive(Clone)]
struct Account {
    open_id: String,
    name: String,
    video: String,
    seen: Seen,
}

async fn token(State(account): State<Account>, headers: HeaderMap, body: Bytes) -> String {
    let content_type = headers["content-type"].to_str().expect("type");
    let body = String::from_utf8_lossy(&body);
    account.seen.push(format!("token {content_type} {body}"));
    format!(
        r#"{{"access_token":"at-1","open_id":"{}","scope":"user.info.basic,video.list"}}"#,
        account.open_id
    )
}

async fn user(State(account): State<Account>, uri: Uri, headers: HeaderMap) -> String {
    let bearer = headers["authorization"].to_str().expect("bearer");
    let query = uri.query().unwrap_or_default();
    account.seen.push(format!("user {query} {bearer}"));
    format!(
        r#"{{"data":{{"user":{{"open_id":"{}","display_name":"{}"}}}}}}"#,
        account.open_id, account.name
    )
}

async fn videos(State(account): State<Account>, uri: Uri, body: Bytes) -> String {
    let query = uri.query().unwrap_or_default();
    let body = String::from_utf8_lossy(&body);
    account.seen.push(format!("videos {query} {body}"));
    format!(
        r#"{{"data":{{"videos":[{{"id":"v1","title":"t","share_url":"{}"}}]}},"error":{{"code":"ok"}}}}"#,
        account.video
    )
}

async fn hook(State(account): State<Account>, body: Bytes) -> impl IntoResponse {
    account
        .seen
        .push(format!("mail {}", String::from_utf8_lossy(&body)));
    StatusCode::NO_CONTENT
}

async fn stub(account: Account) -> String {
    let router = Router::new()
        .route("/v2/oauth/token/", post(token))
        .route("/v2/user/info/", get(user))
        .route("/v2/video/list/", post(videos))
        .route("/hook", post(hook))
        .with_state(account);
    format!("http://{}", spawn_router(router).await)
}

fn cookies(reply: &Reply) -> Vec<String> {
    reply
        .headers
        .get_all("set-cookie")
        .iter()
        .map(|value| value.to_str().expect("ascii").to_owned())
        .collect()
}

/// The `name=value` pairs a browser keeps from `reply`.
fn jar(reply: &Reply) -> String {
    cookies(reply)
        .iter()
        .filter_map(|line| line.split(';').next())
        .filter(|pair| !pair.ends_with('='))
        .collect::<Vec<_>>()
        .join("; ")
}

async fn login(app: std::net::SocketAddr, query: &str) -> (Reply, Reply) {
    let path = format!("/auth/tiktok?{query}");
    let start = send(app, "GET", &path, &[], Body::empty()).await;
    let jar = jar(&start);
    let state = jar
        .split("; ")
        .find_map(|pair| pair.strip_prefix("tiktok_oauth_state="))
        .expect("state cookie")
        .to_owned();
    let callback = send(
        app,
        "GET",
        &format!("/auth/tiktok/callback?state={state}&code=c-1"),
        &[("cookie", &jar), ("user-agent", "a4-test")],
        Body::empty(),
    )
    .await;
    (start, callback)
}

/// The identity and submission rows, as the app reads them (`service_role`).
async fn as_service(pool: &PgPool) -> sqlx::Transaction<'static, sqlx::Postgres> {
    let mut tx = pool.begin().await.expect("begin");
    sqlx::query("set local role service_role")
        .execute(&mut *tx)
        .await
        .expect("role");
    tx
}

/// The user a subject's identity names (by address) and the user it is bound to.
async fn user_of(pool: &PgPool, subject: &str) -> (String, bool, String, Option<String>) {
    let mut tx = as_service(pool).await;
    let (email, bound): (String, Option<String>) = sqlx::query_as(
        "select internal_email, user_id::text from public.tiktok_provider_identities
          where provider_subject = $1",
    )
    .bind(subject)
    .fetch_one(&mut *tx)
    .await
    .expect("the identity of the subject");
    drop(tx);
    let (id, verified, name): (String, bool, String) = sqlx::query_as(
        r#"select id::text, "emailVerified", name from public."user" where email = $1"#,
    )
    .bind(email)
    .fetch_one(pool)
    .await
    .expect("the user of the subject");
    (id, verified, name, bound)
}

#[tokio::test]
async fn a_tiktok_login_writes_the_rows_and_signs_in_only_a_verified_user() {
    // `ax` and 12 hex digits: the profile names the database tests leave
    // (public_routes/memes_table.rs refuses a database with others).
    let name = format!("ax{:012x}", rand::random::<u64>() & 0xffff_ffff_ffff);
    let account = Account {
        open_id: format!("open-{name}"),
        name: name.clone(),
        video: format!("https://www.tiktok.com/@a/video/{name}"),
        seen: Seen::default(),
    };
    let seen = account.seen.clone();
    let subject = hex::encode(Sha256::digest(account.open_id.as_bytes()));
    let video = account.video.clone();
    let origin = stub(account).await;
    let hook = format!("{origin}/hook");
    let vars = [
        ("NODE_ENV", "development"),
        ("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3000"),
        ("TIKTOK_CLIENT_KEY", "a4-client-key"),
        ("TIKTOK_CLIENT_SECRET", "a4-client-secret"),
        ("AXUM_TEST_OAUTH_ORIGIN", origin.as_str()),
        ("AUTH_EMAIL_WEBHOOK", hook.as_str()),
    ];
    let state =
        AppState::new(config(marker_upstream().await, &database_url(), &vars)).expect("app state");
    let pool = state.db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let app = spawn_router(build_app(state)).await;

    // The start: TikTok's authorize URL and the three flow cookies.
    let (start, first) = login(app, "next=%2Fmy&import=1").await;
    assert_eq!(start.status, StatusCode::TEMPORARY_REDIRECT);
    let authorize = start.header("location").expect("location");
    assert!(
        authorize.starts_with(
            "https://www.tiktok.com/v2/auth/authorize/?client_key=a4-client-key\
             &scope=user.info.basic%2Cvideo.list&response_type=code\
             &redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Ftiktok%2Fcallback&state="
        ),
        "{authorize}"
    );
    let set = cookies(&start);
    assert_eq!(set.len(), 3, "{set:?}");
    assert!(
        set[1].starts_with("tiktok_oauth_next=%2Fmy; Path=/auth/tiktok; Expires="),
        "{set:?}"
    );
    assert!(
        set[2].ends_with("; Max-Age=600; HttpOnly; SameSite=lax"),
        "{set:?}"
    );

    // A first login: rows and mail, then better-auth refuses the unverified
    // address, so the browser goes back to the login page without a session.
    assert_eq!(first.status, StatusCode::TEMPORARY_REDIRECT);
    assert_eq!(
        first.header("location"),
        Some("/login?error=auth&next=%2Fmy")
    );
    assert_eq!(
        cookies(&first),
        [
            "tiktok_oauth_state=; Path=/auth/tiktok; Max-Age=0",
            "tiktok_oauth_next=; Path=/auth/tiktok; Max-Age=0",
            "tiktok_oauth_import=; Path=/auth/tiktok; Max-Age=0",
        ]
    );
    let seen_first = seen.take();
    assert_eq!(seen_first.len(), 3, "{seen_first:?}");
    assert_eq!(
        seen_first[0],
        "token application/x-www-form-urlencoded client_key=a4-client-key\
         &client_secret=a4-client-secret&code=c-1&grant_type=authorization_code\
         &redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Ftiktok%2Fcallback"
    );
    assert_eq!(
        seen_first[1],
        "user fields=open_id,display_name,avatar_url Bearer at-1"
    );
    assert!(
        seen_first[2].starts_with("mail ") && seen_first[2].contains("@auth.memecatch.internal"),
        "{seen_first:?}"
    );
    let (user_id, verified, stored_name, bound) = user_of(&pool, &subject).await;
    assert!(!verified);
    assert_eq!(stored_name, name);
    assert_eq!(bound, None);

    // Verified by hand, the same login signs in, binds the identity and
    // imports the video.
    sqlx::query(r#"update public."user" set "emailVerified" = true where id = $1::uuid"#)
        .bind(&user_id)
        .execute(&pool)
        .await
        .expect("verify");
    let (_, second) = login(app, "next=%2Fmy&import=1").await;
    assert_eq!(
        second.header("location"),
        Some("/my?tiktokImport=done&imported=1")
    );
    let set = cookies(&second);
    assert_eq!(set[0], "tiktok_oauth_state=; Path=/auth/tiktok");
    assert!(
        set[3].starts_with("better-auth.session_token=")
            && set[3].ends_with("; Max-Age=604800; HttpOnly; SameSite=lax"),
        "{set:?}"
    );
    let read = send(
        app,
        "GET",
        "/api/auth/get-session",
        &[("cookie", &jar(&second))],
        Body::empty(),
    )
    .await;
    assert!(
        read.body.contains(&format!(r#""id":"{user_id}"}}}}"#)),
        "{}",
        read.body
    );
    let (.., bound) = user_of(&pool, &subject).await;
    assert_eq!(bound.as_deref(), Some(user_id.as_str()));
    let submitted: (String, Vec<String>, String) = sqlx::query_as(
        "select name, tags, status::text from public.meme_submissions where source_url = $1",
    )
    .bind(&video)
    .fetch_one(&mut *as_service(&pool).await)
    .await
    .expect("submission");
    assert_eq!(submitted.0, "t");
    assert_eq!(submitted.1, ["tiktok", "oauth-import"]);
    assert_eq!(submitted.2, "pending");
    assert_eq!(
        seen.take().last().map(String::as_str),
        Some(r#"videos fields=id%2Ctitle%2Cvideo_description%2Cshare_url {"max_count":20}"#)
    );

    // A state that does not match the cookie reaches neither TikTok nor
    // the database.
    let refused = send(
        app,
        "GET",
        "/auth/tiktok/callback?state=other&code=c-1",
        &[("cookie", "tiktok_oauth_state=mine; tiktok_oauth_next=%2Fmy")],
        Body::empty(),
    )
    .await;
    assert_eq!(
        refused.header("location"),
        Some("/login?error=auth&next=%2Fmy")
    );
    assert!(seen.take().is_empty());
}
