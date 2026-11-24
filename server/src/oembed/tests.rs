//! The client against a local provider stub: what is cached, for whom, and
//! how answers become `getOEmbed` results and exceptions.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Bytes;
use axum::extract::Request;
use axum::http::StatusCode;

use super::*;

type Hits = Arc<Mutex<HashMap<String, usize>>>;

/// A provider stub: `answer(path)` is the status, body and delay in ms of
/// each request; every path requested is counted.
async fn provider(answer: fn(&str) -> (u16, &'static str, u64)) -> (OEmbed, Hits) {
    let hits: Hits = Arc::default();
    let seen = hits.clone();
    let router = Router::new().fallback(move |request: Request| {
        let seen = seen.clone();
        async move {
            let path = request.uri().path().to_owned();
            *seen.lock().unwrap().entry(path.clone()).or_default() += 1;
            let (status, body, delay) = answer(&path);
            tokio::time::sleep(Duration::from_millis(delay)).await;
            (StatusCode::from_u16(status).unwrap(), body)
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    let client = OEmbed::build(Some(&format!("http://{addr}")), None).unwrap();
    (client, hits)
}

fn count(hits: &Hits, path: &str) -> usize {
    hits.lock().unwrap().get(path).copied().unwrap_or(0)
}

const YOUTUBE: &str = "https://youtu.be/dQw4w9WgXcQ";
const YOUTUBE_PATH: &str = "/www.youtube.com/oembed";
const TIKTOK: &str = "https://www.tiktok.com/@a/video/7312345678901234567";
const TIKTOK_PATH: &str = "/www.tiktok.com/oembed";

fn answers(path: &str) -> (u16, &'static str, u64) {
    match path {
        YOUTUBE_PATH => (200, r#"{"title":"  제목  ","author_name":"작성자"}"#, 50),
        TIKTOK_PATH => (404, r#"{"error":{"message":"gone"}}"#, 0),
        _ => (500, "", 0),
    }
}

#[tokio::test]
async fn a_200_is_kept_for_every_caller_and_other_answers_are_not() {
    let (client, hits) = provider(answers).await;
    let first = client.get(YOUTUBE).await.expect("a result");
    assert_eq!(first.title, Some(JsString::from("제목")));
    // Another spelling of the same video asks for the same provider URL.
    let second = client
        .get("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        .await
        .expect("a result");
    assert_eq!(second.author_name, first.author_name);
    assert_eq!(count(&hits, YOUTUBE_PATH), 1);

    for _ in 0..2 {
        let failure = client.get(TIKTOK).await.expect_err("a 404");
        assert_eq!(
            failure,
            Failure::OEmbed(oembed_error("gone", UPSTREAM_ERROR, 404))
        );
    }
    assert_eq!(count(&hits, TIKTOK_PATH), 2);

    client.expire_all();
    client.get(YOUTUBE).await.expect("a result");
    assert_eq!(count(&hits, YOUTUBE_PATH), 2);
}

#[tokio::test]
async fn misses_of_one_url_wait_for_each_other() {
    let (client, hits) = provider(answers).await;
    let (a, b) = tokio::join!(client.get(YOUTUBE), client.get(YOUTUBE));
    assert_eq!(a.expect("a"), b.expect("b"));
    assert_eq!(count(&hits, YOUTUBE_PATH), 1);
}

#[tokio::test]
async fn a_stale_answer_is_given_while_it_is_refreshed() {
    let (client, hits) = provider(answers).await;
    client.get(YOUTUBE).await.expect("a result");
    let key = "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json";
    client
        .0
        .cache
        .age(key, cache::REVALIDATE + Duration::from_secs(1));
    client.get(YOUTUBE).await.expect("the stale result");
    assert!(
        matches!(client.0.cache.get(key), Lookup::Stale(_)),
        "answered before the refresh"
    );
    tokio::time::sleep(Duration::from_millis(300)).await;
    assert_eq!(count(&hits, YOUTUBE_PATH), 2);
    assert!(
        matches!(client.0.cache.get(key), Lookup::Fresh(_)),
        "the refresh replaced it"
    );
}

fn fetched(status: u16, body: &'static str) -> Fetched {
    Fetched {
        status,
        content_length: None,
        body: Some(Bytes::from_static(body.as_bytes())),
    }
}

fn read(status: u16, body: &'static str, provider: Provider) -> Result<Value, Failure> {
    read_json(&fetched(status, body), provider)
}

fn upstream(status: u16, message: &str) -> Result<Value, Failure> {
    Err(Failure::OEmbed(oembed_error(
        message,
        UPSTREAM_ERROR,
        status,
    )))
}

#[test]
fn provider_answers_map_to_the_typescripts_errors() {
    let missing = r#"{"error":{"message":"m","code":24,"error_subcode":2207045}}"#;
    assert_eq!(read(400, missing, Provider::Instagram), upstream(404, "m"));
    assert_eq!(read(400, missing, Provider::Facebook), upstream(502, "m"));
    assert_eq!(
        read(404, "", Provider::Tiktok),
        upstream(404, UPSTREAM_FAILED)
    );
    assert_eq!(
        read(500, r#"{"error":"x"}"#, Provider::Tiktok),
        upstream(502, UPSTREAM_FAILED)
    );
    assert_eq!(
        read(200, "0", Provider::Youtube),
        upstream(502, UPSTREAM_FAILED)
    );
    assert_eq!(
        read(200, "null", Provider::Youtube),
        upstream(502, UPSTREAM_FAILED)
    );
    assert_eq!(
        read(200, "[1]", Provider::Youtube),
        Ok(serde_json::json!([1]))
    );
    assert_eq!(
        read(503, "2.50", Provider::Youtube),
        Err(Failure::Error(
            "Cannot use 'in' operator to search for 'error' in 2.5".into()
        ))
    );
    assert_eq!(
        read(503, r#""busy""#, Provider::Youtube),
        Err(Failure::Error(
            "Cannot use 'in' operator to search for 'error' in busy".into()
        ))
    );
    // The body is parsed before the status is looked at.
    assert!(matches!(
        read(404, "<html>", Provider::Tiktok),
        Err(Failure::Error(_))
    ));
    // Too large, or a declared length that is not a number: read as "".
    let mut large = fetched(200, "{}");
    large.content_length = Some(b"262145".to_vec());
    assert_eq!(
        read_json(&large, Provider::Youtube),
        upstream(502, UPSTREAM_FAILED)
    );
    large.content_length = Some(b"2, 2".to_vec());
    assert_eq!(
        read_json(&large, Provider::Youtube),
        upstream(502, UPSTREAM_FAILED)
    );
    large.content_length = Some(b"262144".to_vec());
    assert_eq!(
        read_json(&large, Provider::Youtube),
        Ok(serde_json::json!({}))
    );
}

#[test]
fn text_is_trimmed_and_cut_in_utf16_units() {
    let long = format!("{}😀", "a".repeat(499));
    let cut = safe_text(Some(&Value::String(long))).expect("text");
    assert_eq!(cut.json(), format!("\"{}\\ud83d\"", "a".repeat(499)));
    assert_eq!(safe_text(Some(&Value::String(" \u{3000} ".into()))), None);
    assert_eq!(safe_text(Some(&serde_json::json!(5))), None);
    assert_eq!(
        tiktok_response_id(r#"<b data-video-id="x"></b data-video-id='12">"#).as_deref(),
        Some("12")
    );
    assert!(is_graph_version("v25.0") && !is_graph_version("v25") && !is_graph_version("25.0"));
}

#[test]
fn a_body_that_cannot_start_json_gets_v8s_message() {
    let message = |text: &str| syntax_error(text, "serde".to_owned());
    // Measured on Node 26 through the parity run (server/parity/oembed.mjs).
    assert_eq!(
        message("<html>bad gateway</html>"),
        r#"Unexpected token '<', "<html>bad "... is not valid JSON"#
    );
    assert_eq!(
        message("<html>"),
        r#"Unexpected token '<', "<html>" is not valid JSON"#
    );
    assert_eq!(
        message(&format!("{}<x", " ".repeat(30))),
        format!(
            r#"Unexpected token '<', ..."{}<x" is not valid JSON"#,
            " ".repeat(10)
        )
    );
    assert_eq!(message(" \n"), "Unexpected end of JSON input");
    assert_eq!(message(r#"{"a":}"#), "serde");
}
