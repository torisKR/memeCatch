//! `/llms.txt`, `/llms-full.txt`, `/feed.xml` and `/feed/updated.xml`.

use super::*;

const TEXT: &str = "text/plain; charset=utf-8";
const RSS: &str = "application/rss+xml; charset=utf-8";

/// The answer for `path` with the seeded corpus in place.
async fn seeded_reply(path: &str) -> Reply {
    let corpus = seeded_corpus().await;
    let app = app_with_db().await;
    let reply = get(app, path).await;
    corpus.remove().await;
    reply
}

#[tokio::test]
async fn llms_txt_db_is_the_recorded_body_for_the_same_rows() {
    let reply = seeded_reply("/llms.txt").await;

    assert_text_headers(&reply, TEXT, Some("ko-KR"), "/llms.txt");
    assert_eq!(reply.body, include_str!("../fixtures/r1/llms.txt"));
}

#[tokio::test]
async fn llms_full_txt_db_is_the_recorded_body_for_the_same_rows() {
    let reply = seeded_reply("/llms-full.txt").await;

    assert_text_headers(&reply, TEXT, Some("ko-KR"), "/llms-full.txt");
    assert_eq!(reply.body, include_str!("../fixtures/r1/llms-full.txt"));
}

#[tokio::test]
async fn feed_xml_db_is_the_recorded_body_for_the_same_rows() {
    let reply = seeded_reply("/feed.xml").await;

    assert_text_headers(&reply, RSS, None, "/feed.xml");
    assert_eq!(reply.body, include_str!("../fixtures/r1/feed.xml"));
}

#[tokio::test]
async fn feed_updated_xml_db_is_the_recorded_body_for_the_same_rows() {
    let reply = seeded_reply("/feed/updated.xml").await;

    assert_text_headers(&reply, RSS, None, "/feed/updated.xml");
    assert_eq!(reply.body, include_str!("../fixtures/r1/feed-updated.xml"));
}

#[tokio::test]
async fn head_db_answers_with_the_headers_and_no_body() {
    let corpus = seeded_corpus().await;
    let app = app_with_db().await;

    let llms = send(app, "HEAD", "/llms.txt", &[], Body::empty()).await;
    let feed = send(app, "HEAD", "/feed/updated.xml", &[], Body::empty()).await;
    corpus.remove().await;

    assert_text_headers(&llms, TEXT, Some("ko-KR"), "HEAD /llms.txt");
    assert_text_headers(&feed, RSS, None, "HEAD /feed/updated.xml");
    assert_eq!(llms.body, "");
    assert_eq!(feed.body, "");
}

#[tokio::test]
async fn an_empty_corpus_db_renders_the_placeholders_and_feeds_without_items() {
    let corpus = empty_corpus().await;
    let app = app_with_db().await;

    let llms = get(app, "/llms.txt").await;
    let full = get(app, "/llms-full.txt").await;
    let feed = get(app, "/feed.xml").await;
    let updated = get(app, "/feed/updated.xml").await;
    drop(corpus);

    assert_text_headers(&llms, TEXT, Some("ko-KR"), "/llms.txt");
    assert!(llms.body.contains("챌린지 0건의 뜻"), "{}", llms.body);
    assert!(
        llms.body
            .contains("\n## 지금 뜨는 밈\n- (실시간 목록은 사이트에서 확인)\n")
    );
    // No list to rank, so no rankings link.
    assert!(!llms.body.contains("/rankings"));
    assert_text_headers(&full, TEXT, Some("ko-KR"), "/llms-full.txt");
    assert!(
        full.body
            .ends_with("- 문의: toris@toris.kr\n\n- (본문은 사이트에서 확인하세요)\n")
    );
    assert_text_headers(&feed, RSS, None, "/feed.xml");
    assert_eq!(
        feed.body,
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\">\n  <channel>\n    <title>밈캐치 — 새로 등록된 밈</title>\n    <link>http://127.0.0.1:3411</link>\n    <atom:link href=\"http://127.0.0.1:3411/feed.xml\" rel=\"self\" type=\"application/rss+xml\"/>\n    <description>요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 최근 등록된 밈 30개를 전해드려요.</description>\n    <language>ko</language>\n\n  </channel>\n</rss>"
    );
    assert_text_headers(&updated, RSS, None, "/feed/updated.xml");
    assert!(!updated.body.contains("<item>") && !updated.body.contains("lastBuildDate"));
}

#[tokio::test]
async fn a_database_that_cannot_be_read_answers_503_with_retry_after() {
    let app = app_without_db(&[]).await;

    // Together: each waits out the pool's connection timeout.
    let replies = tokio::join!(
        get(app, "/llms.txt"),
        get(app, "/llms-full.txt"),
        get(app, "/feed.xml"),
        get(app, "/feed/updated.xml"),
    );

    for reply in [replies.0, replies.1, replies.2, replies.3] {
        assert_eq!(reply.status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(reply.body, UNAVAILABLE);
        assert_eq!(reply.header("content-type"), Some(TEXT));
        assert_eq!(reply.header("cache-control"), Some("no-store"));
        assert_eq!(reply.header("retry-after"), Some("300"));
        assert_eq!(reply.header("content-language"), None);
        assert_eq!(reply.header("vary"), Some(NEXT_VARY));
    }
}
