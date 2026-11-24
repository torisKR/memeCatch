//! `POST /api/meme-studio` and `POST /api/admin/meme-studio` over HTTP, with
//! Bedrock replaced by a local stub that records each request.
//! `parity/studio.mjs` compares the same cases with Next.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Bytes;
use axum::extract::Request;
use axum::http::{HeaderMap, StatusCode};
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{
    UNUSED_DATABASE_URL, config, database_url, marker_upstream, send, spawn_app, spawn_router,
};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use serde_json::{Value, json};

const SECRET: &str = "test-only-auth-secret";
const SITE_URL: &str = "https://memes.example";
const ORIGIN: (&str, &str) = ("origin", SITE_URL);
const JSON_TYPE: (&str, &str) = ("content-type", "application/json");
const LIMIT: i64 = 100_000_000_000;
/// 4,096 input tokens at 3,000 and 2,048 output tokens at 15,000 nano-USD.
const RESERVATION: i64 = 43_008_000;
const UNAVAILABLE: &str = r#"{"error":"bedrock_unavailable"}"#;

/// What the stub saw: path, headers, body.
type Seen = Arc<Mutex<Vec<(String, HeaderMap, Bytes)>>>;

/// A Bedrock stand-in that answers every request with `answer` (200).
async fn bedrock(answer: Value) -> (SocketAddr, Seen) {
    let seen: Seen = Arc::default();
    let record = seen.clone();
    let stub = Router::new().fallback(move |request: Request| {
        let record = record.clone();
        let answer = answer.clone();
        async move {
            let (parts, body) = request.into_parts();
            let body = axum::body::to_bytes(body, usize::MAX).await.unwrap();
            let path = parts.uri.path().to_owned();
            record.lock().unwrap().push((path, parts.headers, body));
            axum::Json(answer)
        }
    });
    (spawn_router(stub).await, seen)
}

fn concept(n: u8) -> Value {
    json!({
        "country_code": "JP", "headline": format!(" 제목 {n} "),
        "caption": format!("캡션 {n} — 반전"), "local_caption": format!("キャプション{n}"),
        "cultural_anchor": format!("앵커 {n}"), "visual_brief": format!("그림 {n}"),
        "why_it_works": format!("이유 {n}"), "usage_context": format!("상황 {n}"),
    })
}

fn valid_answer() -> Value {
    json!({ "output": { "message": { "role": "assistant", "content": [{ "toolUse": {
        "toolUseId": "t", "name": "submit_meme_concepts",
        "input": { "concepts": [concept(1), concept(2), concept(3)] },
    } }] } }, "stopReason": "tool_use" })
}

async fn studio_app(endpoint: SocketAddr, enabled: &str) -> SocketAddr {
    let endpoint = format!("http://{endpoint}");
    let env = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("NODE_ENV", "development"),
        ("BEDROCK_MEME_STUDIO_ENABLED", enabled),
        ("AWS_ACCESS_KEY_ID", "AKIDTEST"),
        ("AWS_SECRET_ACCESS_KEY", "test-secret"),
        ("AWS_REGION", "us-west-2"),
        ("AWS_ENDPOINT_URL_BEDROCK_RUNTIME", endpoint.as_str()),
    ];
    spawn_app(config(marker_upstream().await, &database_url(), &env)).await
}

/// One statement as `service_role`, its first column as text.
async fn service(db: &Db, sql: &'static str, arg: String) -> Option<String> {
    let result: Result<Option<String>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move { sqlx::query_scalar(sql).bind(arg).fetch_optional(tx).await })
            },
        )
        .await;
    result.expect("test statement")
}

/// The database with the auth tables, and the cookie of a new operator.
async fn operator() -> (Db, String) {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("auth tables");
    let user = create_user(db.pool()).await;
    let promote =
        "update public.profiles set role = 'operator' where id = $1::uuid returning id::text";
    service(&db, promote, user.id.clone())
        .await
        .expect("profile");
    let token = create_session(db.pool(), &user, 3_600.0).await;
    (db, signed_cookie(PLAIN, &token, SECRET))
}

/// `reserve_bedrock_meme_studio_budget(profile, nano_usd)` as `service_role`:
/// the ledger's new total, `None` when it refuses. Only that function can
/// read or change the ledger, so the tests move it through the function.
async fn reserve(db: &Db, nano_usd: i64) -> Option<i64> {
    let sql = "select public.reserve_bedrock_meme_studio_budget('global.anthropic.claude-sonnet-5', $1::bigint)::text";
    let db = db.clone();
    let result: Result<String, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::query_scalar(sql)
                        .bind(nano_usd.to_string())
                        .fetch_one(tx)
                        .await
                })
            },
        )
        .await;
    result.ok().map(|total| total.parse().expect("a number"))
}

async fn ask(app: SocketAddr, cookie: &str) -> common::Reply {
    let body =
        json!({ "topic": " 회의  예약 ", "tone": "absurd", "format": "caption", "country": "JP" });
    let headers = [ORIGIN, JSON_TYPE, ("cookie", cookie)];
    send(
        app,
        "POST",
        "/api/admin/meme-studio",
        &headers,
        body.to_string(),
    )
    .await
}

/// The ledger is one row for every test: one test walks it, in order.
#[tokio::test]
async fn the_lifetime_budget_db_is_reserved_once_per_call_and_refused_past_the_ceiling() {
    let (stub, seen) = bedrock(valid_answer()).await;
    let (db, cookie) = operator().await;
    let user = create_user(db.pool()).await;
    let token = create_session(db.pool(), &user, 3_600.0).await;
    let user_cookie = signed_cookie(PLAIN, &token, SECRET);
    let total = reserve(&db, 1)
        .await
        .expect("the ledger is full: run on a fresh test database");
    assert!(
        total < LIMIT - RESERVATION - 1,
        "the ledger is too full: run on a fresh test database"
    );

    // Switched off here: Next keeps the route. Not an operator, no origin,
    // malformed: refused before anything is reserved.
    let app = studio_app(stub, "true").await;
    let not_operator = ask(app, &user_cookie).await;
    let headers = [("cookie", cookie.as_str())];
    let no_origin = send(app, "POST", "/api/admin/meme-studio", &headers, "{}").await;
    let headers = [ORIGIN, ("cookie", cookie.as_str())];
    let bad = send(app, "POST", "/api/admin/meme-studio", &headers, "{").await;
    assert_eq!(reserve(&db, 1).await, Some(total + 1));
    assert!(seen.lock().unwrap().is_empty());

    // Up to the last reservation that fits, then that one, then a refusal.
    reserve(&db, LIMIT - RESERVATION - (total + 1))
        .await
        .expect("top up");
    let last = ask(app, &cookie).await;
    let over = ask(app, &cookie).await;
    let refused = reserve(&db, 1).await;

    assert_eq!(not_operator.status, StatusCode::FORBIDDEN);
    assert_eq!(not_operator.body, r#"{"error":"operator_required"}"#);
    assert_eq!(no_origin.status, StatusCode::FORBIDDEN);
    assert_eq!(no_origin.body, r#"{"error":"invalid_origin"}"#);
    assert_eq!(bad.status, StatusCode::BAD_REQUEST);
    assert_eq!(last.status, StatusCode::OK, "{}", last.body);
    assert_eq!(last.header("cache-control"), Some("no-store"));
    let first = r#"{"mode":"ai","provider":"bedrock","concepts":[{"country_code":"JP","headline":"제목 1","caption":"캡션 1 - 반전""#;
    assert!(last.body.starts_with(first), "{}", last.body);
    assert_eq!(over.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(over.body, UNAVAILABLE);
    // The ledger stands exactly at the ceiling: one more nano-dollar is refused.
    assert_eq!(refused, None);
    // Bedrock was asked once: the refused reservation stopped the second call.
    let seen = seen.lock().unwrap();
    assert_eq!(seen.len(), 1);
    let (path, headers, body) = &seen[0];
    assert_eq!(path, "/model/global.anthropic.claude-sonnet-5/converse");
    assert_eq!(headers["content-type"], "application/json");
    let authorization = headers["authorization"].to_str().unwrap();
    assert!(
        authorization.starts_with("AWS4-HMAC-SHA256 Credential=AKIDTEST/"),
        "{authorization}"
    );
    assert!(
        authorization.contains("/us-west-2/bedrock/aws4_request"),
        "{authorization}"
    );
    let body: Value = serde_json::from_slice(body).unwrap();
    let text = body["messages"][0]["content"][0]["text"].as_str().unwrap();
    let start = r#"{"topic":"회의 예약","tone":"absurd","format":"caption","country_code":"JP""#;
    assert!(text.starts_with(start), "{text}");
}

#[tokio::test]
async fn the_public_studio_answers_templates_and_counts_ten_an_hour_per_address() {
    let app = spawn_app(config(marker_upstream().await, UNUSED_DATABASE_URL, &[])).await;
    let body = json!({ "topic": " 출근길 ", "tone": "hype", "format": "reaction" }).to_string();
    let from = [JSON_TYPE, ("x-forwarded-for", "203.0.113.9")];
    let mut answers = Vec::new();
    for _ in 0..11 {
        answers.push(send(app, "POST", "/api/meme-studio", &from, body.clone()).await);
    }
    let bad = send(app, "POST", "/api/meme-studio", &from, "{").await;

    assert_eq!(answers[0].status, StatusCode::OK);
    assert_eq!(answers[0].header("cache-control"), Some("no-store"));
    let caption = r#""caption":"내 반응: 여러분, 드디어 출근길이 등장했습니다!""#;
    assert!(answers[0].body.contains(caption), "{}", answers[0].body);
    assert_eq!(answers[9].status, StatusCode::OK);
    assert_eq!(answers[10].status, StatusCode::TOO_MANY_REQUESTS);
    assert!(answers[10].header("retry-after").is_some());
    assert_eq!(bad.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        bad.body,
        r#"{"error":"JSON 요청 본문이 올바르지 않습니다."}"#
    );
}

/// C3-2: without an upstream the operator route is Axum's even with Bedrock
/// switched off, and answers as Next's does then: the checks first, then 503
/// `bedrock_unavailable`, with nothing sent to Bedrock.
#[tokio::test]
async fn without_an_upstream_db_a_switched_off_studio_answers_as_next_does() {
    let (stub, seen) = bedrock(valid_answer()).await;
    let (_db, cookie) = operator().await;
    let endpoint = format!("http://{stub}");
    let env = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("NODE_ENV", "development"),
        ("AWS_ACCESS_KEY_ID", "AKIDTEST"),
        ("AWS_SECRET_ACCESS_KEY", "test-secret"),
        ("AWS_REGION", "us-west-2"),
        ("AWS_ENDPOINT_URL_BEDROCK_RUNTIME", endpoint.as_str()),
    ];
    let app = spawn_app(common::config_alone(&database_url(), &env)).await;
    let signed_out = send(app, "POST", "/api/admin/meme-studio", &[ORIGIN], "{}").await;
    let headers = [ORIGIN, ("cookie", cookie.as_str())];
    let bad = send(app, "POST", "/api/admin/meme-studio", &headers, "{").await;
    let off = ask(app, &cookie).await;

    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);
    assert_eq!(signed_out.body, r#"{"error":"signed_out"}"#);
    assert_eq!(bad.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        bad.body,
        r#"{"error":"topic(2~120자), tone, format, country를 올바르게 보내 주세요."}"#
    );
    assert_eq!(off.status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(off.body, UNAVAILABLE);
    assert_eq!(off.header("cache-control"), Some("no-store"));
    assert!(seen.lock().unwrap().is_empty());
}
