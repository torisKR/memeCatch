//! Native routes while Postgres refuses connections. Needs no database.
//!
//! Next answers these in under a second, because node-pg fails at once on a
//! refused connection. sqlx keeps retrying until the pool's acquire timeout,
//! so that timeout is what a client waits for each query (`db.rs`).

mod common;

use std::net::SocketAddr;
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::Request;
use axum::http::StatusCode;
use common::{client, closed_addr, config, spawn_app};
use http_body_util::BodyExt;

/// The acquire timeout of the main pool is 5 s; allow a second on top.
const PER_QUERY: Duration = Duration::from_secs(6);

struct Reply {
    status: StatusCode,
    location: Option<String>,
    body: String,
    took: Duration,
}

async fn get(app: SocketAddr, path: &str) -> Reply {
    let started = Instant::now();
    let request = Request::get(format!("http://{app}{path}"))
        .body(Body::empty())
        .unwrap();
    let response = client().request(request).await.expect("response");
    let status = response.status();
    let location = response
        .headers()
        .get("location")
        .map(|value| value.to_str().unwrap().to_owned());
    let body = response.into_body().collect().await.unwrap().to_bytes();
    Reply {
        status,
        location,
        body: String::from_utf8(body.to_vec()).expect("utf-8 body"),
        took: started.elapsed(),
    }
}

#[tokio::test]
async fn database_routes_answer_within_the_acquire_timeout_when_postgres_refuses_connections() {
    let dead_database = format!(
        "postgresql://memecatch:unused@{}/memecatch",
        closed_addr().await
    );
    // No upstream either: every answer below is Axum's own.
    let app = spawn_app(config(
        closed_addr().await,
        &dead_database,
        &[("NEXT_PUBLIC_SITE_URL", "http://127.0.0.1:3001")],
    ))
    .await;

    // Concurrently, as separate clients would arrive.
    let (redirect, quiz, random) = tokio::join!(
        get(app, "/memes/random"),
        get(app, "/api/daily-quiz"),
        get(app, "/api/random-meme"),
    );

    // The same answers Next gives without its database.
    assert_eq!(redirect.status, StatusCode::FOUND);
    assert_eq!(
        redirect.location.as_deref(),
        Some("http://127.0.0.1:3001/explore")
    );
    assert_eq!(quiz.status, StatusCode::BAD_GATEWAY);
    assert!(
        quiz.body.contains("DAILY_QUIZ_UNAVAILABLE"),
        "{}",
        quiz.body
    );
    assert_eq!(random.status, StatusCode::OK);
    assert_eq!(random.body, r#"{"path":"/explore"}"#);
    // One query each, and two for /api/random-meme (it tries both sides of
    // its pivot).
    assert!(
        redirect.took < PER_QUERY,
        "/memes/random took {:?}",
        redirect.took
    );
    assert!(
        quiz.took < PER_QUERY,
        "/api/daily-quiz took {:?}",
        quiz.took
    );
    assert!(
        random.took < 2 * PER_QUERY,
        "/api/random-meme took {:?}",
        random.took
    );
    println!(
        "/memes/random {:?}, /api/daily-quiz {:?}, /api/random-meme {:?}",
        redirect.took, quiz.took, random.took
    );
}
