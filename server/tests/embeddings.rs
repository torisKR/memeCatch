//! `POST /v1/embeddings` and `/api/cron/meme-embeddings` (R12) through the
//! real app, with a stub in place of the embedder service. The answers are
//! the ones Next gave on the same requests (server/parity/embeddings.mjs);
//! the reindex test needs the test database (`scripts/test-db.sh up`).

mod common;

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

use axum::Router;
use axum::body::Body;
use axum::routing::post;
use common::{
    Reply, UNUSED_DATABASE_URL, closed_addr, config, database_url, send, spawn_app, spawn_router,
};
use hmac::{Hmac, KeyInit, Mac};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sha2::Sha256;
use sqlx::AssertSqlSafe;

const SECRET: &str = "embedding-test-cron-secret";
const SIGNING: &str = "embedding-test-signing-secret";
const PROFILE: &str = "multilingual-e5-small-v1";
const CRON: &str = "/api/cron/meme-embeddings";

/// An embedder that answers every input with `vector` and counts the calls.
async fn stub_embedder(vector: Vec<f64>) -> (String, Arc<AtomicUsize>) {
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let body = serde_json::json!({"embedding": vector, "rss_bytes": 1234, "peak_rss_bytes": 5678})
        .to_string();
    let router = Router::new().route(
        "/embed",
        post(move || {
            counter.fetch_add(1, Ordering::SeqCst);
            let body = body.clone();
            async move { ([("content-type", "application/json")], body) }
        }),
    );
    (format!("http://{}", spawn_router(router).await), calls)
}

fn unit_vector() -> Vec<f64> {
    let mut vector = vec![0.0; 384];
    vector[0] = 1.0;
    vector
}

fn signed(input: &str) -> [(String, String); 2] {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("clock")
        .as_millis();
    let message = format!(
        "[{now},\"{PROFILE}\",{}]",
        serde_json::to_string(input).expect("json")
    );
    let mut mac = Hmac::<Sha256>::new_from_slice(SECRET.as_bytes()).expect("key");
    mac.update(message.as_bytes());
    [
        ("x-memecatch-embedding-time".into(), now.to_string()),
        (
            "x-memecatch-embedding-signature".into(),
            hex::encode(mac.finalize().into_bytes()),
        ),
    ]
}

async fn app(extra: &[(&str, &str)], database: &str) -> std::net::SocketAddr {
    let upstream = closed_addr().await;
    spawn_app(config(upstream, database, extra)).await
}

async fn post_v1(app: std::net::SocketAddr, body: &str, sign: Option<&str>, ip: &str) -> Reply {
    let signature = sign.map(signed);
    let mut headers = vec![
        ("content-type", "application/json"),
        ("x-forwarded-for", ip),
    ];
    if let Some(pairs) = &signature {
        headers.extend(pairs.iter().map(|(k, v)| (k.as_str(), v.as_str())));
    }
    send(app, "POST", "/v1/embeddings", &headers, body.to_owned()).await
}

fn v1_body(input: &str) -> String {
    serde_json::json!({"model": PROFILE, "input": input}).to_string()
}

#[tokio::test]
async fn v1_checks_the_body_the_signature_and_the_limit() {
    let (embedder, calls) = stub_embedder(unit_vector()).await;
    let extra = [
        ("MEME_EMBEDDING_RUNTIME", "bundled"),
        ("CRON_SECRET", SECRET),
        ("MEME_EMBEDDER_URL", embedder.as_str()),
    ];
    let app = app(&extra, UNUSED_DATABASE_URL).await;
    let input = "query: 무야호";

    let ok = post_v1(app, &v1_body(input), Some(input), "203.0.113.5").await;
    let zeros = ",0".repeat(383);
    let expected =
        format!(r#"{{"model":"{PROFILE}","data":[{{"embedding":[1{zeros}],"index":0}}]}}"#);
    assert_eq!(
        (ok.status.as_u16(), ok.body.as_str()),
        (200, expected.as_str())
    );
    assert_eq!(ok.header("content-type"), Some("application/json"));
    assert_eq!(ok.header("cache-control"), Some("no-store"));
    assert_eq!(ok.header("content-language"), Some("ko"));

    let extra_key = r#"{"model":"multilingual-e5-small-v1","input":"query: 무야호","x":1}"#;
    let refused = post_v1(app, extra_key, Some(input), "203.0.113.6").await;
    assert_eq!(
        (refused.status.as_u16(), refused.body.as_str()),
        (400, r#"{"error":"invalid_request"}"#)
    );
    let unsigned = post_v1(app, &v1_body(input), None, "203.0.113.6").await;
    assert_eq!(
        (unsigned.status.as_u16(), unsigned.body.as_str()),
        (401, r#"{"error":"unauthorized"}"#)
    );

    // 30 per address per minute; the vector came from the cache after the first.
    for _ in 0..29 {
        assert_eq!(
            post_v1(app, &v1_body(input), Some(input), "203.0.113.5")
                .await
                .status,
            200
        );
    }
    let limited = post_v1(app, &v1_body(input), Some(input), "203.0.113.5").await;
    assert_eq!(
        (limited.status.as_u16(), limited.body.as_str()),
        (429, r#"{"error":"rate_limited"}"#)
    );
    assert!(limited.header("retry-after").is_some());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn v1_is_unavailable_without_the_runtime_a_secret_or_a_unit_vector() {
    let (bad, _) = stub_embedder(vec![0.5; 384]).await;
    let input = "query: 할머니";
    for extra in [
        vec![("CRON_SECRET", SECRET)],
        vec![("MEME_EMBEDDING_RUNTIME", "bundled"), ("CRON_SECRET", "  ")],
        vec![
            ("MEME_EMBEDDING_RUNTIME", "bundled"),
            ("CRON_SECRET", SECRET),
        ],
        vec![
            ("MEME_EMBEDDING_RUNTIME", "bundled"),
            ("CRON_SECRET", SECRET),
            ("MEME_EMBEDDER_URL", bad.as_str()),
        ],
    ] {
        let app = app(&extra, UNUSED_DATABASE_URL).await;
        let reply = post_v1(app, &v1_body(input), Some(input), "203.0.113.7").await;
        assert_eq!(
            (reply.status.as_u16(), reply.body.as_str()),
            (503, r#"{"error":"embedding_unavailable"}"#),
            "{extra:?}"
        );
    }
}

#[tokio::test]
async fn the_cron_route_checks_its_bearers_and_probes_the_model() {
    let (embedder, _) = stub_embedder(unit_vector()).await;
    let mut extra = vec![
        ("MEME_EMBEDDING_RUNTIME", "bundled"),
        ("CRON_SECRET", SECRET),
        ("MEMECATCH_SIGNING_SECRET", SIGNING),
    ];
    let without_model = app(&extra, UNUSED_DATABASE_URL).await;
    extra.push(("MEME_EMBEDDER_URL", embedder.as_str()));
    let with_model = app(&extra, UNUSED_DATABASE_URL).await;
    let cron = format!("Bearer {SECRET}");
    let signing = format!("Bearer {SIGNING}");
    let probe = r#"{"validate_model":true}"#;

    let disabled = send(
        with_model,
        "GET",
        CRON,
        &[("authorization", &cron)],
        Body::empty(),
    )
    .await;
    assert_eq!(
        (disabled.status.as_u16(), disabled.body.as_str()),
        (202, r#"{"ok":true,"status":"disabled"}"#)
    );
    let wrong = send(
        with_model,
        "GET",
        CRON,
        &[("authorization", &signing)],
        Body::empty(),
    )
    .await;
    assert_eq!(
        (wrong.status.as_u16(), wrong.body.as_str()),
        (401, r#"{"ok":false,"error":"UNAUTHORIZED"}"#)
    );
    let query = send(
        with_model,
        "POST",
        &format!("{CRON}?x"),
        &[("authorization", &signing)],
        probe,
    )
    .await;
    assert_eq!(
        (query.status.as_u16(), query.body.as_str()),
        (400, r#"{"ok":false,"error":"INVALID_REQUEST"}"#)
    );
    let other = send(
        with_model,
        "POST",
        CRON,
        &[("authorization", &signing)],
        r#"{"validate_model":1}"#,
    )
    .await;
    assert_eq!(other.status, 400);

    let measured = send(
        with_model,
        "POST",
        CRON,
        &[("authorization", &signing)],
        probe,
    )
    .await;
    assert_eq!(measured.status, 200);
    assert!(
        measured
            .body
            .starts_with(r#"{"profile":"multilingual-e5-small-v1","dimensions":384,"elapsed_ms":"#),
        "{}",
        measured.body
    );
    assert!(
        measured
            .body
            .contains(r#""rss_bytes":1234,"peak_rss_bytes":5678,"heap_used_bytes":0,"platform":""#),
        "{}",
        measured.body
    );
    let missing = send(
        without_model,
        "POST",
        CRON,
        &[("authorization", &signing)],
        probe,
    )
    .await;
    assert_eq!(
        (missing.status.as_u16(), missing.body.as_str()),
        (503, r#"{"error":"model_unavailable"}"#)
    );
}

async fn execute(db: &Db, statements: String) {
    let done: Result<(), sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    sqlx::raw_sql(AssertSqlSafe(statements))
                        .execute(tx)
                        .await
                        .map(|_| ())
                })
            },
        )
        .await;
    done.expect("test statements");
}

async fn text(db: &Db, query: &'static str) -> String {
    let found: Result<String, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| Box::pin(async move { sqlx::query_scalar(query).fetch_one(tx).await }),
        )
        .await;
    found.expect("test query")
}

const RESET: &str = "update private.meme_embedding_reindex_state set lease_owner = null, lease_until = null,
  last_status = 'idle', last_started_at = null, last_finished_at = null, last_indexed = 0, last_stale = 0,
  last_remaining = 0, consecutive_failures = 0, failed_runs = 0, retry_after = null, last_error_code = null;";
const STATE: &str = "select concat_ws('|', last_status, last_indexed, last_stale, last_remaining,
  consecutive_failures, failed_runs, last_error_code, lease_owner is null, (retry_after - last_finished_at)::text)
  from private.meme_embedding_reindex_state";
const BACKLOG: &str = "select pending::text from public.meme_embedding_backlog()";

/// The run state is one row, so every reindex case is in this one test.
#[tokio::test]
async fn reindex_runs_leave_the_rows_next_leaves() {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    let id = "3e3c0d1a-7a52-4c1e-9d5b-12e0f0a0b12a";
    execute(&db, format!(
        "insert into public.memes (id, title, slug, moderation_status) values
           ('{id}', 'R12 임베딩 테스트 밈', 'axum-r12-embedding-test', 'approved') on conflict (id) do nothing;
         delete from private.meme_semantic_embeddings;"
    )).await;
    let (embedder, calls) = stub_embedder(unit_vector()).await;
    let base = [
        ("MEME_EMBEDDING_RUNTIME", "bundled"),
        ("CRON_SECRET", SECRET),
        ("MEMECATCH_SIGNING_SECRET", SIGNING),
    ];
    let url = database_url();
    let without_model = app(&base, &url).await;
    let mut with_stub = base.to_vec();
    with_stub.extend([
        ("MEME_EMBEDDER_URL", embedder.as_str()),
        ("MEME_EMBEDDING_REINDEX_ENABLED", "true"),
    ]);
    let with_model = app(&with_stub, &url).await;
    let run = |app, method: &'static str, bearer: &'static str| async move {
        let auth = format!("Bearer {bearer}");
        send(
            app,
            method,
            CRON,
            &[("authorization", auth.as_str())],
            Body::empty(),
        )
        .await
    };

    // No model: the first job fails, the run is recorded, the next is held back.
    execute(&db, RESET.to_owned()).await;
    let backlog = text(&db, BACKLOG).await;
    let failed = run(without_model, "POST", SIGNING).await;
    let expected = format!(
        r#"{{"ok":false,"status":"failed","indexed":0,"stale":0,"remaining":{backlog},"errorCode":"model_unavailable"}}"#
    );
    assert_eq!(
        (failed.status.as_u16(), failed.body.as_str()),
        (503, expected.as_str())
    );
    assert_eq!(
        text(&db, STATE).await,
        format!("failed|0|0|{backlog}|1|1|model_unavailable|t|00:15:00")
    );
    let deferred = run(without_model, "POST", SIGNING).await;
    let expected = format!(
        r#"{{"ok":true,"status":"deferred","indexed":0,"stale":0,"remaining":{backlog},"errorCode":null}}"#
    );
    assert_eq!(
        (deferred.status.as_u16(), deferred.body.as_str()),
        (202, expected.as_str())
    );

    // With a model, through the scheduler's GET: every job is stored (D2-5:
    // lib/db's call cast the vector to text[], which no function takes, and
    // the first store failed, PLAN.md R12-3).
    execute(&db, RESET.to_owned()).await;
    let stored = run(with_model, "GET", SECRET).await;
    let answer: serde_json::Value = serde_json::from_str(&stored.body).expect("json");
    assert_eq!(stored.status, 200, "{}", stored.body);
    assert_eq!(answer["ok"], true, "{}", stored.body);
    assert_eq!(
        answer["errorCode"],
        serde_json::Value::Null,
        "{}",
        stored.body
    );
    let indexed = answer["indexed"].as_u64().expect("indexed");
    assert!(indexed >= 1, "{}", stored.body);
    assert_eq!(calls.load(Ordering::SeqCst) as u64, indexed);
    // The test meme's row: the vector as sent, for its current document.
    assert_eq!(
        text(
            &db,
            "select concat_ws('|', e.source_hash = md5(public.meme_embedding_document(m)),
                      (e.embedding::text like '[1,0,0,%'))
                     from private.meme_semantic_embeddings e join public.memes m on m.id = e.meme_id
                    where m.slug = 'axum-r12-embedding-test'"
        )
        .await,
        "t|t"
    );
    assert!(
        text(&db, STATE).await.starts_with("succeeded|")
            || text(&db, STATE).await.starts_with("partial|"),
        "{}",
        text(&db, STATE).await
    );

    // A lease another run holds.
    execute(&db, format!("{RESET} update private.meme_embedding_reindex_state set lease_owner = gen_random_uuid(), lease_until = now() + interval '60 seconds';")).await;
    let held = run(with_model, "GET", SECRET).await;
    assert_eq!(held.status, 202);
    assert!(
        held.body.contains(r#""status":"deferred""#),
        "{}",
        held.body
    );

    execute(
        &db,
        format!("{RESET} delete from private.meme_semantic_embeddings; delete from public.memes where id = '{id}';"),
    )
    .await;
}
