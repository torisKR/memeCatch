//! `tests/fixtures/meme_chat.json`, written by the real TypeScript
//! (`parity/chat-fixture.mjs`): for each case the request
//! `answerMemeQuestion` sent to OpenRouter, byte for byte, and the result it
//! gave; then `memeTitleKey` and the answer check on their own.

use axum::http::StatusCode;
use serde::Deserialize;

use super::facts::{self, is_uuid};
use super::generate;

#[derive(Deserialize)]
struct Fixture {
    answers: Vec<Case>,
    title_keys: Vec<(String, String)>,
    unsafe_: Vec<(String, bool)>,
}

#[derive(Deserialize)]
struct Case {
    question: String,
    locale: String,
    rows: Vec<String>,
    status: u16,
    provider: String,
    request: Option<String>,
    result: String,
}

fn fixture() -> Fixture {
    let text = include_str!("../../../tests/fixtures/meme_chat.json")
        .replace("\"unsafe\":", "\"unsafe_\":");
    serde_json::from_str(&text).expect("meme_chat.json")
}

fn locale(code: &str) -> &'static str {
    facts::LOCALES
        .iter()
        .find(|locale| **locale == code)
        .expect("a chat locale")
}

/// What `answerMemeQuestion` does after the search, on the fixture's rows.
fn replay(case: &Case) -> (Option<String>, String) {
    let locale = locale(&case.locale);
    let mut ids: Vec<String> = Vec::new();
    for row in &case.rows {
        let id = serde_json::from_str::<serde_json::Value>(row).expect("a row")["id"]
            .as_str()
            .expect("an id")
            .to_owned();
        if is_uuid(&id) && !ids.contains(&id) {
            ids.push(id);
        }
    }
    ids.truncate(4);
    let found = facts::exact_title_facts(
        &case.question,
        facts::from_rows(&case.rows, &ids, locale).expect("the rows convert"),
    );
    if found.is_empty() {
        return (None, facts::retrieved(&found, locale, "keyword"));
    }
    let request = generate::prepared(&case.question, locale, &found).ok();
    let status = StatusCode::from_u16(case.status).expect("a status");
    let result = match generate::accept(status, Some(case.provider.as_bytes()), &found) {
        Ok(value) => facts::generated(
            &value.answer,
            &value.citation_ids,
            &found,
            locale,
            "keyword",
        ),
        Err(_) => facts::retrieved(&found, locale, "keyword"),
    };
    (request, result)
}

#[test]
fn the_request_and_the_result_are_the_typescripts() {
    let fixture = fixture();
    assert_eq!(fixture.answers.len(), 20);
    for case in &fixture.answers {
        let (request, result) = replay(case);
        let label = format!("{} ({})", case.question, case.locale);
        assert_eq!(request, case.request, "request of {label}");
        assert_eq!(result, case.result, "result of {label}");
    }
}

#[test]
fn title_keys_are_the_typescripts() {
    for (text, key) in fixture().title_keys {
        assert_eq!(facts::meme_title_key(&text), key, "{text:?}");
    }
}

#[test]
fn the_answer_check_is_the_typescripts() {
    for (text, refused) in fixture().unsafe_ {
        assert_eq!(generate::is_unsafe(&text), refused, "{text:?}");
    }
}
