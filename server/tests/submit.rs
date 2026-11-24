//! `POST /api/submit` (route id `submit-meme`) end to end against the
//! migrations: `reserve_submission_attempt` (restored by D1) and
//! `submit_meme_v2` store the submission (PLAN.md D2-11), and an attachment
//! outside the user's own upload keys is refused (D2-8). Needs the test
//! database: `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use axum::body::Body;
use axum::http::StatusCode;
use common::session::{AUTH_TABLES, PLAIN, create_session, create_user, signed_cookie};
use common::{config, database_url, send, spawn_router};
use memecatch_server::db::{DbIdentity, IdentityOptions};
use memecatch_server::{AppState, build_app};
use serde_json::{Value, json};

const ORIGIN: &str = "https://memes.example";

#[tokio::test]
async fn a_signed_in_submission_is_stored_and_a_foreign_attachment_is_refused() {
    let state = AppState::new(config(
        &database_url(),
        &[
            ("NEXT_PUBLIC_SITE_URL", ORIGIN),
            ("NODE_ENV", "development"),
            ("NEXT_PUBLIC_SUBMISSIONS_OPEN", "true"),
        ],
    ))
    .expect("app state");
    let db = state.db.clone();
    let pool = db.pool().clone();
    sqlx::raw_sql(sqlx::AssertSqlSafe(AUTH_TABLES))
        .execute(&pool)
        .await
        .expect("auth tables");
    let user = create_user(&pool).await;
    let token = create_session(&pool, &user, 3_600.0).await;
    let cookie = signed_cookie(PLAIN, &token, "test-only-auth-secret");
    let app = spawn_router(build_app(state)).await;
    let post = |body: Value| {
        let cookie = cookie.clone();
        async move {
            let reply = send(
                app,
                "POST",
                "/api/submit",
                &[
                    ("content-type", "application/json"),
                    ("origin", ORIGIN),
                    ("cookie", &cookie),
                ],
                Body::from(body.to_string()),
            )
            .await;
            assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
            serde_json::from_str::<Value>(&reply.body).expect("json")
        }
    };
    let attachment = format!(
        "meme-uploads/{}/0f8fad5b-d9cb-469f-a165-70867728950e.png",
        user.id
    );

    let stored = post(json!({
        "name": " 제보 시험 밈 ",
        "seenAt": "단톡방",
        "sourceUrl": "https://news.example.org/a",
        "description": "처음 본 곳과 뜻",
        "guessReason": "",
        "tags": "시험, 제보, 시험",
        "attachmentPath": attachment,
    }))
    .await;
    assert_eq!(stored["status"], "success", "{stored}");
    let id = stored["submissionId"].as_str().expect("an id").to_owned();
    let row: Result<(String, String, Vec<String>, Option<String>), sqlx::Error> = db
        .with_identity(&DbIdentity::service_role(), IdentityOptions::default(), {
            let id = id.clone();
            |tx| {
                Box::pin(async move {
                    sqlx::query_as(
                        "select submitter_id::text, name, tags, attachment_path
                           from public.meme_submissions where id = $1::uuid",
                    )
                    .bind(id)
                    .fetch_one(tx)
                    .await
                })
            }
        })
        .await;
    let (submitter, name, tags, path) = row.expect("the stored submission");
    assert_eq!(submitter, user.id);
    assert_eq!(name, "제보 시험 밈");
    assert_eq!(tags, ["시험", "제보"]);
    assert_eq!(path.as_deref(), Some(attachment.as_str()));

    // Another user's file through `..`: refused before anything is stored.
    let foreign = post(json!({
        "name": "남의 파일",
        "attachmentPath": format!(
            "meme-uploads/{}/../9b2e0c1d-0000-4000-8000-000000000000/0f8fad5b-d9cb-469f-a165-70867728950e.png",
            user.id
        ),
    }))
    .await;
    assert_eq!(foreign["status"], "error", "{foreign}");
    assert!(
        foreign["fieldErrors"]["attachment"].is_string(),
        "{foreign}"
    );
}
