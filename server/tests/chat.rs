//! `POST /api/memes/chat` over HTTP. `parity/chat.mjs` compares the answers
//! with Next on a seeded database, and `src/routes/chat/fixture_tests.rs`
//! the provider requests with what the real TypeScript sends.
//!
//! Tests named `..._db_...` need the test database:
//! `export DATABASE_URL="$(scripts/test-db.sh up)"`.

mod common;

use std::net::SocketAddr;
use std::time::Duration;

use axum::body::Body;
use axum::http::StatusCode;
use common::{config, database_url, marker_upstream, send, spawn_app};
use memecatch_server::db::{Db, DbIdentity, IdentityOptions};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;

const SITE_URL: &str = "https://memes.example";
const PATH: &str = "/api/memes/chat";

async fn app(database_url: &str, extra: &[(&str, &str)]) -> SocketAddr {
    let env = [&[("NEXT_PUBLIC_SITE_URL", SITE_URL)][..], extra].concat();
    spawn_app(config(marker_upstream().await, database_url, &env)).await
}

async fn ask(app: SocketAddr, body: &str, extra: &[(&str, &str)]) -> common::Reply {
    let headers = [
        &[("origin", SITE_URL), ("content-type", "application/json")][..],
        extra,
    ]
    .concat();
    send(app, "POST", PATH, &headers, body.to_owned()).await
}

#[tokio::test]
async fn origin_body_and_both_limits_are_checked_and_other_methods_go_to_next() {
    let app = app(common::UNUSED_DATABASE_URL, &[]).await;

    let no_origin = send(app, "POST", PATH, &[], r#"{"question":"밈"}"#).await;
    let short = ask(
        app,
        r#"{"question":" 밈 "}"#,
        &[("x-forwarded-for", "10.0.0.1")],
    )
    .await;
    let large = format!(r#"{{"question":"밈밈","pad":"{}"}}"#, "x".repeat(3000));
    let large = ask(app, &large, &[("x-forwarded-for", "10.0.0.2")]).await;
    let get = send(app, "GET", PATH, &[], Body::empty()).await;
    let mut from_one = Vec::new();
    for _ in 0..4 {
        from_one.push(
            ask(app, "{", &[("x-forwarded-for", "10.0.0.1")])
                .await
                .status,
        );
    }
    let limited = ask(app, "{", &[("x-forwarded-for", "10.0.0.1")]).await;

    assert_eq!(no_origin.status, StatusCode::FORBIDDEN);
    assert_eq!(no_origin.body, r#"{"error":"invalid_origin"}"#);
    assert_eq!(no_origin.header("cache-control"), Some("no-store"));
    assert_eq!(short.status, StatusCode::BAD_REQUEST);
    assert_eq!(short.body, r#"{"error":"invalid_question"}"#);
    assert_eq!(large.status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(large.body, r#"{"error":"body_too_large"}"#);
    assert_eq!(get.body, format!("upstream saw GET {PATH}"));
    // Five in ten minutes from one address: the sixth is refused.
    assert_eq!(from_one, [StatusCode::BAD_REQUEST; 4]);
    assert_eq!(limited.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(limited.body, r#"{"error":"rate_limited"}"#);
    let retry = limited
        .header("retry-after")
        .and_then(|value| value.parse::<u32>().ok());
    assert!(retry.is_some_and(|seconds| seconds > 590), "{retry:?}");
    // Twenty a minute in all: six were counted (not the one the address limit refused).
    let mut statuses = Vec::new();
    for index in 0..15 {
        let address = format!("10.0.1.{index}");
        statuses.push(ask(app, "{", &[("x-forwarded-for", &address)]).await.status);
    }
    assert_eq!(statuses[..14], [StatusCode::BAD_REQUEST; 14]);
    assert_eq!(statuses[14], StatusCode::TOO_MANY_REQUESTS);
}

#[tokio::test]
async fn a_usable_embedding_url_or_the_disabled_id_leaves_the_route_to_next() {
    let semantic = [
        ("MEME_SEMANTIC_SEARCH_ENABLED", "true"),
        ("MEME_EMBEDDING_URL", "http://127.0.0.1:9/v1/embeddings"),
    ];
    for extra in [&semantic[..], &[("AXUM_DISABLED_ROUTES", "memes-chat")]] {
        let app = app(common::UNUSED_DATABASE_URL, extra).await;
        let reply = ask(app, r#"{"question":"밈밈"}"#, &[]).await;
        assert_eq!(reply.body, format!("upstream saw POST {PATH}"));
    }
}

/// A meme the keyword search finds, with a title nothing else has.
async fn insert_meme(db: &Db, id: &str, title: &str) {
    let (id, title) = (id.to_owned(), title.to_owned());
    db.with_identity(&DbIdentity::service_role(), IdentityOptions::default(), |tx| {
        Box::pin(async move {
            sqlx::query(
                "insert into memes (id, short_id, slug, title, summary, description, origin, moderation_status)
                 values ($1::uuid, $2, $2, $3, '요약', repeat('가', 400), repeat('나', 60), 'approved')",
            )
            .bind(&id)
            .bind(format!("chat{}", &id[30..]))
            .bind(title)
            .execute(tx)
            .await
            .map(|_| ())
        })
    })
    .await
    .expect("insert a meme");
}

async fn delete_meme(db: &Db, id: &str) {
    let id = id.to_owned();
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query("delete from memes where id = $1::uuid")
                    .bind(id)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        },
    )
    .await
    .expect("delete the meme");
}

type Seen = mpsc::UnboundedReceiver<String>;

/// A provider that records each request and answers `reply`, or holds the
/// connection open when `reply` is `None`; it reports when the caller hangs up.
async fn provider(reply: Option<String>) -> (SocketAddr, Seen, mpsc::UnboundedReceiver<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let address = listener.local_addr().expect("address");
    let (requests, seen) = mpsc::unbounded_channel();
    let (closes, closed) = mpsc::unbounded_channel();
    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            let (requests, closes, reply) = (requests.clone(), closes.clone(), reply.clone());
            tokio::spawn(serve(stream, requests, closes, reply));
        }
    });
    (address, seen, closed)
}

async fn serve(
    mut stream: TcpStream,
    requests: mpsc::UnboundedSender<String>,
    closes: mpsc::UnboundedSender<()>,
    reply: Option<String>,
) {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        let read = stream.read(&mut chunk).await.unwrap_or(0);
        if read == 0 {
            let _ = closes.send(());
            return;
        }
        buffer.extend_from_slice(&chunk[..read]);
        let text = String::from_utf8_lossy(&buffer).into_owned();
        let Some((head, body)) = text.split_once("\r\n\r\n") else {
            continue;
        };
        let length = head
            .lines()
            .find_map(|line| {
                line.to_ascii_lowercase()
                    .strip_prefix("content-length: ")
                    .map(str::to_owned)
            })
            .and_then(|value| value.trim().parse::<usize>().ok())
            .unwrap_or(0);
        if body.len() < length {
            continue;
        }
        let _ = requests.send(text.clone());
        buffer.clear();
        if let Some(reply) = &reply {
            let response = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{reply}",
                reply.len()
            );
            let _ = stream.write_all(response.as_bytes()).await;
        }
    }
}

#[tokio::test]
async fn answers_retrieve_or_generate_and_a_client_leaving_cancels_the_provider_db() {
    let url = database_url();
    let db = Db::connect_lazy(&url, 2).expect("database url");
    let id = format!("e5c0c4a7-0000-4000-8000-{:012x}", std::process::id());
    let title = format!("챗테스트 {}", std::process::id());
    insert_meme(&db, &id, &title).await;
    let question = format!(r#"{{"question":"{title}"}}"#);

    let retrieved = ask(app(&url, &[]).await, &question, &[]).await;
    let content = serde_json::json!({ "answer": "생성된 답", "citationIds": [id] }).to_string();
    let answer = serde_json::json!({ "choices": [{ "finish_reason": "stop", "message": { "content": content } }] });
    let (answering, mut seen, _) = provider(Some(answer.to_string())).await;
    let origin = format!("http://{answering}");
    let key = [
        ("OPENROUTER_API_KEY", " test-key "),
        ("AXUM_TEST_OPENROUTER_ORIGIN", origin.as_str()),
    ];
    let generated = ask(app(&url, &key).await, &question, &[]).await;
    let request = seen.recv().await.expect("the provider was asked");

    let (hanging, mut seen, mut closed) = provider(None).await;
    let origin = format!("http://{hanging}");
    let key = [
        ("OPENROUTER_API_KEY", "test-key"),
        ("AXUM_TEST_OPENROUTER_ORIGIN", origin.as_str()),
    ];
    let (lines, client) = first_lines(app(&url, &key).await, &question).await;
    seen.recv().await.expect("the provider was asked");
    drop(client);
    let hung_up = tokio::time::timeout(Duration::from_secs(2), closed.recv()).await;
    delete_meme(&db, &id).await;

    let short = &id[30..];
    assert_eq!(retrieved.status, StatusCode::OK);
    assert_eq!(
        retrieved.body,
        format!(
            r#"{{"mode":"retrieved","retrievalMode":"keyword","answer":"검색된 공개 자료의 요약이에요. 자세한 맥락은 각 밈에서 확인해 주세요.\n{title}: 요약\n외부 출처가 없는 항목의 기원과 연도는 추가 확인이 필요해요.","items":[{{"id":"{id}","short_id":"chat{short}","slug":"chat{short}","title":"{title}","summary":"요약","href":"/memes/chat{short}-chat{short}","sources":[]}}]}}"#
        )
    );
    assert!(
        generated
            .body
            .starts_with(r#"{"answer":"생성된 답\n외부 출처가 없는"#),
        "{}",
        generated.body
    );
    assert!(generated.body.contains(r#""mode":"generated""#));
    assert!(
        request.starts_with("POST /api/v1/chat/completions HTTP/1.1\r\n"),
        "{request}"
    );
    assert!(request.contains("authorization: Bearer test-key\r\n"));
    assert_eq!(
        lines,
        [
            r#"{"type":"progress","progress":{"stage":"reading"}}"#,
            r#"{"type":"progress","progress":{"stage":"searching"}}"#,
            r#"{"type":"progress","progress":{"stage":"found","count":1}}"#,
            r#"{"type":"progress","progress":{"stage":"answering"}}"#,
        ]
    );
    assert!(
        hung_up.is_ok(),
        "the provider request stayed open after the client left"
    );
}

/// Streams `question` and reads up to the `answering` line; the connection
/// is returned for the caller to hang up.
async fn first_lines(app: SocketAddr, question: &str) -> (Vec<String>, TcpStream) {
    let mut stream = TcpStream::connect(app).await.expect("connect");
    let request = format!(
        "POST {PATH} HTTP/1.1\r\nhost: memes.example\r\norigin: {SITE_URL}\r\naccept: application/x-ndjson\r\ncontent-type: application/json\r\ncontent-length: {}\r\n\r\n{question}",
        question.len()
    );
    stream.write_all(request.as_bytes()).await.expect("write");
    let mut text = String::new();
    let mut chunk = [0_u8; 4096];
    while !text.contains(r#""answering""#) {
        let read = tokio::time::timeout(Duration::from_secs(5), stream.read(&mut chunk))
            .await
            .expect("progress before the provider answers")
            .expect("read");
        assert!(read > 0, "the stream ended early: {text}");
        text.push_str(&String::from_utf8_lossy(&chunk[..read]));
    }
    let body = text.split_once("\r\n\r\n").expect("a head").1;
    // Chunked: keep the JSON lines only.
    let lines = body
        .lines()
        .filter(|line| line.starts_with('{'))
        .map(str::to_owned)
        .collect();
    (lines, stream)
}
