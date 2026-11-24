//! `/{locale}/llms.txt` and `/{locale}/llms-full.txt`.
//!
//! Japanese has one listed translation and the two Chinese locales none, so
//! their bodies are compared byte for byte. English has 23, listed in
//! whatever order Postgres returns the rows (the TypeScript orders the
//! embedded meme, not the query): the two English index fixtures are the
//! answers under two query plans. For English the tests compare what is
//! listed, not its order.

use std::collections::BTreeSet;

use super::*;

const TEXT: &str = "text/plain; charset=utf-8";
const ENTRY_SEPARATOR: &str = "\n\n---\n\n";

/// The answers for `paths` with the seeded corpus in place.
async fn seeded_replies(paths: &[&str]) -> Vec<Reply> {
    let corpus = seeded_corpus().await;
    let app = app_with_db().await;
    let mut replies = Vec::new();
    for path in paths {
        replies.push(get(app, path).await);
    }
    corpus.remove().await;
    replies
}

/// The item lines of an index body, and the body with them taken out.
fn index_items(body: &str) -> (BTreeSet<&str>, String) {
    let is_item = |line: &&str| line.starts_with("- [") && line.contains("/en/memes/");
    let items: BTreeSet<&str> = body.lines().filter(is_item).collect();
    let rest: Vec<&str> = body.lines().filter(|line| !is_item(line)).collect();
    (items, rest.join("\n"))
}

/// The header of a full export, and its entries as a set.
fn header_and_entries(body: &str) -> (&str, BTreeSet<&str>) {
    let (header, entries) = body.split_once("\n\n## ").expect("a first entry");
    let entries = entries.trim_end_matches('\n').split("\n\n---\n\n## ");
    (header, entries.collect())
}

#[tokio::test]
async fn localized_index_db_is_the_recorded_body_for_the_same_rows() {
    let replies = seeded_replies(&[
        "/ja/llms.txt",
        "/zh/llms.txt",
        "/zh-tw/llms.txt",
        "/en/llms.txt",
    ])
    .await;

    for (reply, language, fixture) in [
        (
            &replies[0],
            "ja-JP",
            include_str!("../fixtures/r1/ja-llms.txt"),
        ),
        (
            &replies[1],
            "zh-CN",
            include_str!("../fixtures/r1/zh-llms.txt"),
        ),
        (
            &replies[2],
            "zh-TW",
            include_str!("../fixtures/r1/zh-tw-llms.txt"),
        ),
    ] {
        assert_text_headers(reply, TEXT, Some(language), language);
        assert_eq!(reply.body, fixture, "{language}");
    }

    // English: fifteen of the 23 lines listed under either plan, and
    // everything around them byte for byte.
    let english = &replies[3];
    let (plan_a, around) = index_items(include_str!("../fixtures/r1/en-llms.plan-a.txt"));
    let (plan_b, _) = index_items(include_str!("../fixtures/r1/en-llms.plan-b.txt"));
    let known: BTreeSet<&str> = plan_a.union(&plan_b).copied().collect();
    let (listed, listed_around) = index_items(&english.body);
    assert_text_headers(english, TEXT, Some("en-US"), "/en/llms.txt");
    assert_eq!(known.len(), 23);
    assert_eq!(listed.len(), 15, "{}", english.body);
    assert!(listed.is_subset(&known), "{}", english.body);
    assert_eq!(listed_around, around);
}

#[tokio::test]
async fn localized_full_db_is_the_recorded_body_for_the_same_rows() {
    let replies = seeded_replies(&[
        "/ja/llms-full.txt",
        "/zh/llms-full.txt",
        "/zh-tw/llms-full.txt",
        "/en/llms-full.txt",
    ])
    .await;

    for (reply, language, fixture) in [
        (
            &replies[0],
            "ja-JP",
            include_str!("../fixtures/r1/ja-llms-full.txt"),
        ),
        (
            &replies[1],
            "zh-CN",
            include_str!("../fixtures/r1/zh-llms-full.txt"),
        ),
        (
            &replies[2],
            "zh-TW",
            include_str!("../fixtures/r1/zh-tw-llms-full.txt"),
        ),
    ] {
        assert_text_headers(reply, TEXT, Some(language), language);
        assert_eq!(reply.body, fixture, "{language}");
    }

    // English: the same header and the same 23 entries, in any order.
    let english = &replies[3];
    let (header, entries) = header_and_entries(&english.body);
    let (next_header, next_entries) =
        header_and_entries(include_str!("../fixtures/r1/en-llms-full.txt"));
    assert_text_headers(english, TEXT, Some("en-US"), "/en/llms-full.txt");
    assert_eq!(header, next_header);
    assert_eq!(next_entries.len(), 23);
    assert_eq!(english.body.matches(ENTRY_SEPARATOR).count(), 22);
    assert!(english.body.ends_with("+00:00\n"), "{}", english.body);
    assert_eq!(entries, next_entries);
}

#[tokio::test]
async fn an_empty_corpus_db_says_there_are_no_translations_yet() {
    let corpus = empty_corpus().await;
    let app = app_with_db().await;

    let index = get(app, "/en/llms.txt").await;
    let full = get(app, "/zh-tw/llms-full.txt").await;
    drop(corpus);

    assert_text_headers(&index, TEXT, Some("en-US"), "/en/llms.txt");
    assert!(index.body.contains(
        "\n## Featured reviewed translations\n- (No reviewed translations are available yet.)\n"
    ));
    assert_text_headers(&full, TEXT, Some("zh-TW"), "/zh-tw/llms-full.txt");
    assert_eq!(
        full.body,
        include_str!("../fixtures/r1/zh-tw-llms-full.txt")
    );
}

#[tokio::test]
async fn a_database_that_cannot_be_read_answers_200_with_an_empty_list() {
    let app = app_without_db(&[]).await;

    let (index, full) = tokio::join!(get(app, "/ja/llms.txt"), get(app, "/zh/llms-full.txt"));

    // `getLocalizedFeaturedMemes` turns a failed read into an empty list.
    assert_text_headers(&index, TEXT, Some("ja-JP"), "/ja/llms.txt");
    assert!(
        index
            .body
            .contains("\n- (確認済みの翻訳はまだありません。)\n")
    );
    assert_text_headers(&full, TEXT, Some("zh-CN"), "/zh/llms-full.txt");
    assert_eq!(full.body, include_str!("../fixtures/r1/zh-llms-full.txt"));
}
