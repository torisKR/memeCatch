//! `POST /api/admin/mpe-candidates` over HTTP, with real session rows.
//! `src/routes/mpe/fixture_tests.rs` holds the matching and the draft to
//! the TypeScript.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{UNUSED_DATABASE_URL, config, database_url, send, spawn_app};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use sha2::{Digest, Sha256};

/// `BETTER_AUTH_SECRET` in `common::config`.
const SECRET: &str = "test-only-auth-secret";
const SITE_URL: &str = "https://memes.example";
const PATH: &str = "/api/admin/mpe-candidates";
const REPLACE_FAILED: &str = r#"{"ok":false,"error":"candidate_match_replace_failed: function public.replace_mpe_candidate_matches(p_candidate_id => unknown, p_matches => text[]) does not exist"}"#;

async fn app(database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let base = [
        ("NEXT_PUBLIC_SITE_URL", SITE_URL),
        ("NODE_ENV", "development"),
    ];
    spawn_app(config(database_url, &[extra, &base[..]].concat())).await
}

async fn post(app: SocketAddr, cookie: Option<&str>, body: &str) -> common::Reply {
    let mut headers = vec![("origin", SITE_URL), ("content-type", "application/json")];
    headers.extend(cookie.map(|cookie| ("cookie", cookie)));
    send(app, "POST", PATH, &headers, body.to_owned()).await
}

#[tokio::test]
async fn origin_session_and_the_disabled_id_are_decided_before_the_database() {
    let app = app(UNUSED_DATABASE_URL, &[]).await;
    let no_origin = send(app, "POST", PATH, &[], "{}").await;
    let signed_out = post(app, None, "{}").await;
    let get_kept = send(app, "GET", PATH, &[], Body::empty()).await;

    assert_eq!(
        (no_origin.status, no_origin.body.as_str()),
        (
            StatusCode::FORBIDDEN,
            r#"{"ok":false,"error":"invalid_origin"}"#
        )
    );
    assert_eq!(
        (signed_out.status, signed_out.body.as_str()),
        (
            StatusCode::UNAUTHORIZED,
            r#"{"ok":false,"error":"signed_out"}"#
        )
    );
    // GET has its own id and stays native.
    assert_eq!(get_kept.status, StatusCode::UNAUTHORIZED);
}

async fn scalar(db: &Db, sql: &'static str, args: Vec<String>) -> Option<String> {
    let result: Result<Option<String>, sqlx::Error> = db
        .with_identity(
            &DbIdentity::service_role(),
            IdentityOptions::default(),
            |tx| {
                Box::pin(async move {
                    let query = args
                        .into_iter()
                        .fold(sqlx::query_scalar(sql), |query, arg| query.bind(arg));
                    query.fetch_optional(tx).await
                })
            },
        )
        .await;
    result.expect("test rows")
}

/// An image ingestion of `owner` with the three jobs it needs, `ocr` with `status`.
async fn ingestion(db: &Db, owner: &str, ocr: &str) -> String {
    let id = scalar(
        db,
        "insert into public.media_ingestions
           (user_id, ingest_mode, mime_type, media_kind, byte_size, sha256, temporary_storage_key, expires_at, rights_attested_at)
         values ($1::uuid, 'USER_UPLOADED', 'image/png', 'image', 10, repeat('b', 64), gen_random_uuid()::text, now() + interval '1 day', now())
         returning id::text",
        vec![owner.to_owned()],
    )
    .await
    .expect("an ingestion");
    scalar(
        db,
        "insert into public.processing_jobs (ingestion_id, job_type, status, processor_name, processor_version, input_hash)
         select $1::uuid, kind, case when kind = 'ocr' then $2 else 'completed' end, 'p', '1', gen_random_uuid()::text
           from unnest(array['inspect', 'fingerprint', 'ocr']) as kind
         returning 'ok'::text",
        vec![id.clone(), ocr.to_owned()],
    )
    .await;
    id
}

#[tokio::test]
async fn matches_replace_the_embedding_and_a_new_candidate_is_removed_db() {
    let db = Db::connect_lazy(&database_url(), 2).expect("database url");
    sqlx::raw_sql(AUTH_TABLES)
        .execute(db.pool())
        .await
        .expect("the better-auth tables");
    let (operator, user) = (create_user(db.pool()).await, create_user(db.pool()).await);
    let mut cookies = Vec::new();
    for person in [&operator, &user] {
        let token = create_session(db.pool(), person, 3_600.0).await;
        cookies.push(signed_cookie(PLAIN, &token, SECRET));
    }
    let (operator_cookie, user_cookie) = (cookies[0].clone(), cookies[1].clone());
    scalar(
        &db,
        "update public.profiles set role = 'operator' where id = $1::uuid returning id::text",
        vec![operator.id.clone()],
    )
    .await;
    let done = ingestion(&db, &operator.id, "completed").await;
    let fresh = ingestion(&db, &operator.id, "completed").await;
    let failed = ingestion(&db, &operator.id, "failed").await;
    let candidate = scalar(
        &db,
        "insert into public.meme_candidates (ingestion_id, title, meme_type, model_version, prompt_version)
         values ($1::uuid, '중꺾마 그 장면!', 'PHRASE', 'v', 'v') returning id::text",
        vec![done.clone()],
    )
    .await
    .expect("a candidate");
    let app = app(&database_url(), &[]).await;
    let matches = format!(r#"{{"candidateId":"{candidate}"}}"#);
    let create = |ingestion: &str| {
        format!(
            r#"{{"action":"create","ingestionId":"{ingestion}","title":" 새 후보 ","memeType":"OTHER"}}"#
        )
    };

    let not_operator = post(app, Some(&user_cookie), &matches).await;
    let invalid = post(app, Some(&operator_cookie), r#"{"candidateId":"x"}"#).await;
    let matched = post(app, Some(&operator_cookie), &matches).await;
    let stored = scalar(
        &db,
        "select hash_value || ' ' || embedding::text || ' ' || processor_version from public.media_fingerprints
          where ingestion_id = $1::uuid and fingerprint_type = 'TEXT_EMBEDDING'",
        vec![done],
    )
    .await;
    let draft = post(
        app,
        Some(&operator_cookie),
        &format!(r#"{{"candidateId":"{candidate}","action":"evidence_draft"}}"#),
    )
    .await;
    let created = post(app, Some(&operator_cookie), &create(&fresh)).await;
    let left = scalar(
        &db,
        "select count(*)::text from public.meme_candidates where ingestion_id = $1::uuid",
        vec![fresh],
    )
    .await;
    let refused = post(app, Some(&operator_cookie), &create(&failed)).await;

    assert_eq!(
        (not_operator.status, not_operator.body.as_str()),
        (
            StatusCode::FORBIDDEN,
            r#"{"ok":false,"error":"operator_required"}"#
        )
    );
    assert_eq!(
        (invalid.status, invalid.body.as_str()),
        (
            StatusCode::BAD_REQUEST,
            r#"{"ok":false,"error":"invalid_input"}"#
        )
    );
    assert_eq!(
        (matched.status, matched.body.as_str()),
        (StatusCode::INTERNAL_SERVER_ERROR, REPLACE_FAILED)
    );
    let hash = hex::encode(Sha256::digest("중꺾마 그 장면".as_bytes()));
    let fixture: serde_json::Value =
        serde_json::from_str(include_str!("fixtures/mpe_candidates.json")).expect("fixture");
    let embedding = fixture["embedding"]
        .as_array()
        .expect("embeddings")
        .iter()
        .find(|case| case[0] == "중꺾마 그 장면!")
        .expect("the case")[1]
        .clone();
    let embedding: Vec<f64> = serde_json::from_value(embedding).expect("numbers");
    let embedding: Vec<String> = embedding.iter().map(f64::to_string).collect();
    assert_eq!(
        stored,
        Some(format!(
            "{hash} {{{}}} mpe-text-embedding-v1",
            embedding.join(",")
        ))
    );
    assert_eq!(
        (draft.status, draft.body.as_str()),
        (
            StatusCode::SERVICE_UNAVAILABLE,
            r#"{"ok":false,"error":"draft_provider_not_configured"}"#
        )
    );
    assert_eq!(
        (created.status, created.body.as_str()),
        (StatusCode::INTERNAL_SERVER_ERROR, REPLACE_FAILED)
    );
    assert_eq!(
        left.as_deref(),
        Some("0"),
        "the candidate the failed create made is deleted again"
    );
    assert_eq!(
        (refused.status, refused.body.as_str()),
        (
            StatusCode::CONFLICT,
            r#"{"ok":false,"error":"processing_jobs_failed"}"#
        )
    );
}
