//! `tests/fixtures/mpe_candidates.json`, written by the real TypeScript
//! (`parity/mpe-candidates-fixture.mjs`): the matching functions, the claim
//! checks and the evidence draft's requests and stored arguments.

use serde::Deserialize;
use serde_json::Value;

use super::draft::{self, Evidence, Ingestion, SegmentRow, SourceRow};
use super::matches::match_json;
use super::matching::{self, Fingerprint, Job, Source, Subject, Target};
use super::structured;
use crate::routes::request::{self, Json};

fn fixture() -> Value {
    serde_json::from_str(include_str!("../../../tests/fixtures/mpe_candidates.json"))
        .expect("mpe_candidates.json")
}

#[test]
fn normalization_similarity_and_the_embedding_are_the_typescripts() {
    let fixture = fixture();
    for case in fixture["normalize"].as_array().expect("cases") {
        assert_eq!(
            matching::normalize_korean_text(case[0].as_str().expect("text")),
            case[1],
            "{case}"
        );
    }
    for case in fixture["similarity"].as_array().expect("cases") {
        let (left, right) = (
            case[0].as_str().expect("left"),
            case[1].as_str().expect("right"),
        );
        assert_eq!(
            matching::korean_text_similarity(left, right),
            case[2].as_f64().expect("a number"),
            "{case}"
        );
    }
    for case in fixture["embedding"].as_array().expect("cases") {
        let expected: Vec<f64> = serde_json::from_value(case[1].clone()).expect("numbers");
        assert_eq!(
            matching::deterministic_text_embedding(case[0].as_str().expect("text")),
            expected,
            "{}",
            case[0]
        );
    }
}

#[test]
fn hypot_cosine_and_hashes_are_the_typescripts() {
    let fixture = fixture();
    for case in fixture["hypot"].as_array().expect("cases") {
        let values: Vec<f64> = serde_json::from_value(case[0].clone()).expect("numbers");
        assert_eq!(
            matching::hypot(&values),
            case[1].as_f64().expect("a number"),
            "{case}"
        );
    }
    for case in fixture["cosine"].as_array().expect("cases") {
        let left: Vec<f64> = serde_json::from_value(case[0].clone()).expect("numbers");
        let right: Vec<f64> = serde_json::from_value(case[1].clone()).expect("numbers");
        assert_eq!(
            matching::cosine_similarity(&left, &right),
            case[2].as_f64(),
            "{case}"
        );
    }
    for case in fixture["phash"].as_array().expect("cases") {
        let (left, right) = (
            case[0].as_str().expect("left"),
            case[1].as_str().expect("right"),
        );
        assert_eq!(
            matching::perceptual_hash_similarity(left, right),
            case[2].as_f64(),
            "{case}"
        );
    }
}

#[test]
fn job_checks_are_the_typescripts() {
    for case in fixture()["jobs"].as_array().expect("cases") {
        let jobs: Vec<Job> = serde_json::from_value(case["jobs"].clone()).expect("jobs");
        let result =
            match matching::validate_candidate_jobs(case["kind"].as_str().expect("kind"), &jobs) {
                Ok(()) => "ok".to_owned(),
                Err((status, code)) => format!("{status} {code}"),
            };
        assert_eq!(result, case["result"], "{}", case["jobs"]);
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RankInput {
    title: String,
    rights_mode: String,
    source: Option<Source>,
    text: Vec<String>,
    fingerprints: Vec<Fingerprint>,
    memes: Vec<RankMeme>,
}

#[derive(Deserialize)]
struct RankMeme {
    id: String,
    title: String,
    aliases: Vec<Option<String>>,
    summary: Option<String>,
    description: Option<String>,
    sources: Vec<Source>,
    text: Vec<String>,
    fingerprints: Vec<Fingerprint>,
}

#[test]
fn ranking_and_discovery_are_the_typescripts() {
    let fixture = fixture();
    for case in fixture["rank"].as_array().expect("cases") {
        let input: RankInput = serde_json::from_value(case["input"].clone()).expect("a rank input");
        let memes: Vec<Target> = input
            .memes
            .into_iter()
            .map(|meme| Target {
                id: meme.id,
                title: meme.title,
                aliases: meme.aliases,
                summary: meme.summary,
                description: meme.description,
                sources: meme.sources,
                text: meme.text,
                fingerprints: meme.fingerprints,
            })
            .collect();
        let subject = Subject {
            title: &input.title,
            rights_mode: &input.rights_mode,
            source: input.source.as_ref(),
            text: &input.text,
            fingerprints: &input.fingerprints,
        };
        let ranked: Vec<String> = matching::rank_candidate_matches(&subject, &memes)
            .iter()
            .map(|item| format!(r#"{{"candidate_id":"c",{}"#, &match_json(item)[1..]))
            .collect();
        assert_eq!(
            format!("[{}]", ranked.join(",")),
            case["output"].as_str().expect("output")
        );
    }
    let case = &fixture["discover"][0];
    let current: Vec<Fingerprint> =
        serde_json::from_value(case["current"].clone()).expect("fingerprints");
    let candidates: Vec<(String, Option<String>)> = case["candidates"]
        .as_array()
        .expect("candidates")
        .iter()
        .map(|item| {
            (
                item["ingestion_id"].as_str().expect("id").to_owned(),
                item["target_meme_id"].as_str().map(str::to_owned),
            )
        })
        .collect();
    let previous: Vec<(String, Fingerprint)> = case["previous"]
        .as_array()
        .expect("previous")
        .iter()
        .map(|item| {
            (
                item["ingestion_id"].as_str().expect("id").to_owned(),
                serde_json::from_value(item.clone()).expect("a fingerprint"),
            )
        })
        .collect();
    let found = matching::discover_hash_candidate_ids(&current, &candidates, &previous);
    assert_eq!(serde_json::json!(found), case["output"]);
}

fn evidence_of(value: &Value) -> Vec<Evidence> {
    value
        .as_array()
        .expect("evidence")
        .iter()
        .map(|item| Evidence {
            id: item["id"].as_str().expect("id").to_owned(),
            kind: match item["kind"].as_str().expect("kind") {
                "source" => "source",
                "ingestion" => "ingestion",
                _ => "text_segment",
            },
            text: item["text"].as_str().expect("text").to_owned(),
            origin: item["origin"].as_str().map(str::to_owned),
        })
        .collect()
}

#[test]
fn claim_checks_and_abstention_notes_are_the_typescripts() {
    let evidence = evidence_of(&serde_json::json!([
        { "id": "s1", "kind": "source", "text": "youtube | 첫 영상" },
        { "id": "t1", "kind": "text_segment", "origin": "OCR", "text": "중꺾마" },
        { "id": "t2", "kind": "text_segment", "origin": "CAPTION", "text": "   " },
        { "id": "i1", "kind": "ingestion", "text": "MIME: image/png" },
    ]));
    for case in fixture()["claims"].as_array().expect("cases") {
        let input = Json::parse(case["input"].as_str().expect("input")).expect("json");
        let result = match draft::parse_claims(Some(&input), &evidence) {
            Ok(claims) => format!(
                "[{}]",
                claims
                    .iter()
                    .map(draft::claim_json)
                    .collect::<Vec<_>>()
                    .join(",")
            ),
            Err(code) => code.to_owned(),
        };
        assert_eq!(
            result,
            case["result"].as_str().expect("result"),
            "{}",
            case["input"]
        );
        assert_eq!(
            draft::abstention_notes(Some(&input)),
            case["notes"].as_str().expect("notes"),
            "{}",
            case["input"]
        );
    }
}

#[test]
fn the_draft_requests_and_what_it_stores_are_the_typescripts() {
    let fixture = fixture();
    let rows = &fixture["draft"]["rows"];
    let ingestion: Ingestion =
        serde_json::from_value(rows["media_ingestions"].clone()).expect("ingestion");
    let source: SourceRow = serde_json::from_value(rows["media_sources"].clone()).expect("source");
    let segments: Vec<SegmentRow> =
        serde_json::from_value(rows["text_segments"].clone()).expect("segments");
    let candidate = &rows["meme_candidates"];
    let evidence = draft::evidence(&ingestion, Some(&source), &segments);
    let (system, input) = draft::prompt(candidate["title"].as_str().expect("title"), &evidence);
    let first = structured::body(&system, &input, 4096, false);
    let correction = structured::body(&system, &input, 4096, true);
    for case in fixture["draft"]["cases"].as_array().expect("cases") {
        let label = case["label"].as_str().expect("label");
        let corrected = matches!(label, "two objects, then claims" | "no object twice");
        for (at, sent) in case["requests"]
            .as_array()
            .expect("requests")
            .iter()
            .enumerate()
        {
            assert_eq!(
                sent["url"], "https://openrouter.ai/api/v1/chat/completions",
                "{label}"
            );
            let expected = if corrected && at == 1 {
                &correction
            } else {
                &first
            };
            assert_eq!(
                sent["body"].as_str().expect("body"),
                expected,
                "{label}: request {at}"
            );
        }
        let Some(stored) = case["stored"].as_str() else {
            continue;
        };
        let replies = case["replies"].as_array().expect("replies");
        let reply: Value = serde_json::from_str(
            replies.last().expect("a reply")["body"]
                .as_str()
                .expect("a body"),
        )
        .expect("json");
        let content = reply["choices"][0]["message"]["content"]
            .as_str()
            .expect("content")
            .trim();
        let record = structured::parse_json_object(content).expect("one object");
        let claims_value = request::property(&record, "claims");
        let claims = draft::parse_claims(claims_value, &evidence).expect("claims");
        let args = draft::stored_arguments(
            candidate["id"].as_str().expect("id"),
            &claims,
            claims_value,
            &evidence,
        );
        assert_eq!(args, stored, "{label}");
    }
}
