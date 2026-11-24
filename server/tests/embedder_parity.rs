//! The Rust embedder against tests/fixtures/meme_embedding_vectors.json,
//! which the real lib/meme-embedding-runtime.server.ts wrote
//! (server/parity/embeddings/vectors.capture.ts): the same token ids, and
//! vectors with a cosine of at least 0.9999.
//!
//! It needs the pinned model, which is not in the repository and not in CI:
//!
//!   node scripts/prepare-meme-embedding-model.mjs   # from huggingface.co
//!   MEME_EMBEDDING_MODEL_ROOT=$PWD/../.local/embedding-models \
//!   ORT_DYLIB_PATH=<libonnxruntime 1.21.0> cargo test --test embedder_parity
//!
//! Without `MEME_EMBEDDING_MODEL_ROOT` both tests pass without checking
//! anything; without `ORT_DYLIB_PATH` only the token ids are checked. The
//! library of onnxruntime-node 1.21.0 (node_modules/onnxruntime-node/bin/
//! napi-v3/<os>/<arch>/) is the one the fixture was made with.

use std::path::PathBuf;

use memecatch_server::embedder::model::{MODEL, Model};
use memecatch_server::embedder::tokenizer::Tokenizer;
use serde::Deserialize;

const MIN_COSINE: f64 = 0.9999;

#[derive(Deserialize)]
struct Fixture {
    cases: Vec<Case>,
}

#[derive(Deserialize)]
struct Case {
    id: String,
    kind: String,
    text: String,
    input_ids: Vec<u32>,
    vector: Vec<f64>,
}

impl Case {
    /// What the runtime hands the model: `passage: ` is added to a document.
    fn input(&self) -> String {
        match self.kind.as_str() {
            "passage" => format!("passage: {}", self.text),
            _ => self.text.clone(),
        }
    }
}

fn fixture() -> Fixture {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/meme_embedding_vectors.json"
    );
    serde_json::from_str(&std::fs::read_to_string(path).expect("fixture")).expect("fixture JSON")
}

fn model_root() -> Option<PathBuf> {
    let root = std::env::var_os("MEME_EMBEDDING_MODEL_ROOT").map(PathBuf::from);
    if root.is_none() {
        eprintln!("MEME_EMBEDDING_MODEL_ROOT is not set: nothing checked");
    }
    root
}

#[test]
fn token_ids_match_transformers_js() {
    let Some(root) = model_root() else { return };
    let json =
        std::fs::read_to_string(root.join(MODEL).join("tokenizer.json")).expect("tokenizer.json");
    let tokenizer = Tokenizer::from_json(&json).expect("tokenizer");
    let fixture = fixture();
    let mismatched: Vec<&str> = fixture
        .cases
        .iter()
        .filter(|case| tokenizer.encode(&case.input()) != case.input_ids)
        .map(|case| case.id.as_str())
        .collect();
    assert!(mismatched.is_empty(), "token ids differ for {mismatched:?}");
    eprintln!("{} cases: token ids identical", fixture.cases.len());
}

#[test]
fn vectors_match_transformers_js() {
    let Some(root) = model_root() else { return };
    if std::env::var_os("ORT_DYLIB_PATH").is_none() {
        eprintln!("ORT_DYLIB_PATH is not set: vectors not checked");
        return;
    }
    let model = Model::load(&root).expect("the model loads");
    let fixture = fixture();
    let (mut worst, mut max_diff, mut identical) = (1.0f64, 0.0f64, 0);
    for case in &fixture.cases {
        let vector = model.embed(&case.input()).expect("a vector");
        let cosine = cosine(&vector, &case.vector);
        let diff = vector
            .iter()
            .zip(&case.vector)
            .map(|(a, b)| (a - b).abs())
            .fold(0.0, f64::max);
        assert!(cosine >= MIN_COSINE, "{}: cosine {cosine}", case.id);
        worst = worst.min(cosine);
        max_diff = max_diff.max(diff);
        identical += usize::from(vector == case.vector);
    }
    eprintln!(
        "{} cases: lowest cosine {worst}, largest difference {max_diff:e}, {identical} bit-identical",
        fixture.cases.len()
    );
}

fn cosine(a: &[f64], b: &[f64]) -> f64 {
    let dot: f64 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm = |v: &[f64]| v.iter().map(|x| x * x).sum::<f64>().sqrt();
    dot / (norm(a) * norm(b))
}
