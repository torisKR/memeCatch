//! Satori's text segmentation in Rust (`og::satori`) against Node:
//! `tests/fixtures/og/segments.json` holds what `Intl.Segmenter` and the
//! `linebreak` package Satori bundles give for a corpus of card texts
//! (`parity/og-text-tables.mjs`).

use std::fs;
use std::path::Path;

use memecatch_server::og::satori::{linebreak, segment};
use serde_json::Value;

fn corpus() -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/og/segments.json");
    let fixture: Value =
        serde_json::from_str(&fs::read_to_string(path).expect("segments.json")).unwrap();
    fixture["cases"].as_array().expect("cases").clone()
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_owned())
        .collect()
}

#[test]
fn graphemes_are_intl_segmenters() {
    for case in corpus() {
        let text = case["text"].as_str().unwrap();
        assert_eq!(
            segment::graphemes(text),
            strings(&case["graphemes"]),
            "{text:?}"
        );
    }
}

#[test]
fn line_break_words_are_the_linebreak_packages() {
    for case in corpus() {
        let text = case["text"].as_str().unwrap();
        let expected: Vec<(String, bool)> = case["lineWords"]
            .as_array()
            .unwrap()
            .iter()
            .map(|pair| {
                (
                    pair[0].as_str().unwrap().to_owned(),
                    pair[1].as_bool().unwrap(),
                )
            })
            .collect();
        let (words, required) = linebreak::words(text);
        let ours: Vec<(String, bool)> = words
            .iter()
            .zip(&required[1..])
            .map(|(word, required)| ((*word).to_owned(), *required))
            .collect();
        assert_eq!(ours, expected, "{text:?}");
    }
}

/// The words, a no-break space merged as Satori merges it. Where ICU goes
/// its own way (its dictionary for Han, kana and Thai; conjoining jamo) only
/// the places of the space segments are compared: they are what ends a
/// painted run, the one thing Satori uses these words for.
#[test]
fn words_inside_a_line_break_word_are_intl_segmenters() {
    for case in corpus() {
        let text = case["text"].as_str().unwrap();
        let ours: Vec<String> = segment::words(text);
        let mut expected = strings(&case["words"]);
        // Satori's merge of a no-break space, applied to Node's words.
        let mut merged: Vec<String> = Vec::new();
        let mut index = 0;
        while index < expected.len() {
            if expected[index] == "\u{a0}" {
                let before = merged.pop().unwrap_or_default();
                let after = expected.get(index + 1).cloned().unwrap_or_default();
                merged.push(format!("{before}\u{a0}{after}"));
                index += 2;
            } else {
                merged.push(expected[index].clone());
                index += 1;
            }
        }
        expected = merged;
        let icu_own = text.chars().any(|c| {
            matches!(c, '\u{1100}'..='\u{11ff}' | '\u{3040}'..='\u{30ff}' | '\u{4e00}'..='\u{9fff}' | '\u{e00}'..='\u{e7f}')
        });
        if icu_own {
            let spaces = |words: &[String]| {
                let mut offset = 0;
                let mut found = Vec::new();
                for word in words {
                    if word == " " {
                        found.push(offset);
                    }
                    offset += word.len();
                }
                found
            };
            assert_eq!(spaces(&ours), spaces(&expected), "{text:?}");
        } else {
            assert_eq!(ours, expected, "{text:?}");
        }
    }
}
