//! `embedBundledMemeInput` and `embedBundledMemePassage` of
//! lib/meme-embedding-runtime.server.ts: their input checks, the query
//! cache (64 vectors, five minutes, least recently used first out), and the
//! one-inference-at-a-time rule (a second input while one runs gets `null`,
//! the same input shares the running one). One `Runtime` serves both routes.
//!
//! The model itself runs in the embedder service (`embedder::service`),
//! reached at `MEME_EMBEDDER_URL`. Without that URL every call gives `None`,
//! which is what the TypeScript gives when `.local/embedding-models` holds no
//! model: the load fails and is caught. Production runs that way today.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::http::uri::Authority;
use axum::http::{Method, Request, header};
use futures_util::FutureExt;
use futures_util::future::{BoxFuture, Shared};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use serde::Deserialize;
use unicode_normalization::UnicodeNormalization;

use crate::embedder::tokenizer::is_js_space;
use crate::embedder::vector::is_meme_vector;

const QUERY_PREFIX: &str = "query: ";
const CACHE_ENTRIES: usize = 64;
const CACHE_TTL: Duration = Duration::from_secs(300);
/// `Array.from(document).length > 6900` is refused.
const MAX_PASSAGE_CHARS: usize = 6_900;
/// The TypeScript sets none; this covers a first call that loads the model.
const EMBEDDER_TIMEOUT: Duration = Duration::from_secs(120);
const MAX_EMBEDDER_BODY: usize = 64 * 1024;

/// A vector and the embedder's memory when it made it (for the probe).
#[derive(Clone, Debug)]
pub struct Embedding {
    pub vector: Vec<f64>,
    pub rss_bytes: u64,
    pub peak_rss_bytes: u64,
}

type Pending = Shared<BoxFuture<'static, Option<Embedding>>>;

pub struct Runtime {
    bundled: bool,
    embedder: Option<Authority>,
    client: Client<HttpConnector, Body>,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    pending: HashMap<String, Pending>,
    /// Insertion order is use order, as in the TypeScript `Map`.
    cache: Vec<(String, Embedding, Instant)>,
}

#[derive(Deserialize)]
struct EmbedderAnswer {
    embedding: Vec<f64>,
    #[serde(default)]
    rss_bytes: u64,
    #[serde(default)]
    peak_rss_bytes: u64,
}

impl Runtime {
    pub fn new(bundled: bool, embedder: Option<Authority>) -> Arc<Self> {
        Arc::new(Self {
            bundled,
            embedder,
            client: Client::builder(TokioExecutor::new()).build_http(),
            state: Mutex::new(State::default()),
        })
    }

    /// `embedBundledMemeInput`: a `query: ` input of 2 to 120 UTF-16 units
    /// that NFKC and trimming leave unchanged.
    pub async fn embed_query(self: &Arc<Self>, input: &str) -> Option<Embedding> {
        let query = input.strip_prefix(QUERY_PREFIX)?;
        if !self.bundled || !is_plain_query(query) {
            return None;
        }
        self.run(input.to_owned(), true).await
    }

    /// `embedBundledMemePassage`: a non-blank document of at most 6,900
    /// characters, embedded as `passage: <document>`.
    pub async fn embed_passage(self: &Arc<Self>, document: &str) -> Option<Embedding> {
        let blank = document.trim_matches(is_js_space).is_empty();
        if !self.bundled || blank || document.chars().count() > MAX_PASSAGE_CHARS {
            return None;
        }
        self.run(format!("passage: {document}"), false).await
    }

    async fn run(self: &Arc<Self>, input: String, cache_query: bool) -> Option<Embedding> {
        let pending = {
            let mut state = self.state.lock().unwrap_or_else(|p| p.into_inner());
            if cache_query && let Some(hit) = state.cached(&input) {
                return Some(hit);
            }
            if let Some(pending) = state.pending.get(&input) {
                pending.clone()
            } else if !state.pending.is_empty() {
                return None;
            } else {
                let pending = self.start(input.clone(), cache_query);
                state.pending.insert(input, pending.clone());
                pending
            }
        };
        pending.await
    }

    /// Runs the call in its own task, so it finishes, fills the cache and
    /// clears `pending` even when the request that started it goes away.
    fn start(self: &Arc<Self>, input: String, cache_query: bool) -> Pending {
        let runtime = self.clone();
        let task = tokio::spawn(async move {
            let embedding = runtime.call_embedder(&input).await;
            let mut state = runtime.state.lock().unwrap_or_else(|p| p.into_inner());
            if cache_query && let Some(embedding) = &embedding {
                state.store(input.clone(), embedding.clone());
            }
            state.pending.remove(&input);
            embedding
        });
        task.map(|joined| joined.ok().flatten()).boxed().shared()
    }

    async fn call_embedder(&self, input: &str) -> Option<Embedding> {
        let authority = self.embedder.as_ref()?;
        let body = serde_json::json!({ "input": input }).to_string();
        let request = Request::builder()
            .method(Method::POST)
            .uri(format!("http://{authority}/embed"))
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body))
            .ok()?;
        let response = tokio::time::timeout(EMBEDDER_TIMEOUT, self.client.request(request))
            .await
            .ok()?
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        let bytes = axum::body::to_bytes(Body::new(response.into_body()), MAX_EMBEDDER_BODY)
            .await
            .ok()?;
        let answer: EmbedderAnswer = serde_json::from_slice(&bytes).ok()?;
        is_meme_vector(&answer.embedding).then_some(Embedding {
            vector: answer.embedding,
            rss_bytes: answer.rss_bytes,
            peak_rss_bytes: answer.peak_rss_bytes,
        })
    }
}

impl State {
    /// A live entry moves to the end; an expired one is dropped.
    fn cached(&mut self, input: &str) -> Option<Embedding> {
        let index = self.cache.iter().position(|(key, ..)| key == input)?;
        let entry = self.cache.remove(index);
        if entry.2 > Instant::now() {
            let embedding = entry.1.clone();
            self.cache.push(entry);
            return Some(embedding);
        }
        None
    }

    fn store(&mut self, input: String, embedding: Embedding) {
        self.cache.retain(|(key, ..)| *key != input);
        self.cache
            .push((input, embedding, Instant::now() + CACHE_TTL));
        while self.cache.len() > CACHE_ENTRIES {
            self.cache.remove(0);
        }
    }
}

/// `query.length >= 2 && query.length <= 120 && query ===
/// query.normalize("NFKC").trim()`, lengths in UTF-16 units.
pub fn is_plain_query(query: &str) -> bool {
    let length = query.encode_utf16().count();
    if !(2..=120).contains(&length) {
        return false;
    }
    let normalized: String = query.nfkc().collect();
    normalized.trim_matches(is_js_space) == query
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_query_must_be_normalized_trimmed_and_short() {
        assert!(is_plain_query("무야호"));
        assert!(is_plain_query("ab"));
        assert!(!is_plain_query("a"));
        assert!(!is_plain_query(" 무야호"));
        assert!(!is_plain_query("ＡＢ"));
        assert!(!is_plain_query(&"가".repeat(121)));
        // An astral character counts two UTF-16 units.
        assert!(is_plain_query(&"🤣".repeat(60)));
        assert!(!is_plain_query(&"🤣".repeat(61)));
    }

    #[tokio::test]
    async fn without_an_embedder_or_the_bundled_runtime_nothing_is_embedded() {
        let runtime = Runtime::new(true, None);
        assert!(runtime.embed_query("query: 무야호").await.is_none());
        assert!(runtime.embed_passage("문서").await.is_none());
        let off = Runtime::new(false, Some(Authority::from_static("127.0.0.1:9")));
        assert!(off.embed_query("query: 무야호").await.is_none());
        assert!(runtime.state.lock().expect("lock").pending.is_empty());
    }

    #[test]
    fn the_cache_keeps_the_64_most_recently_used() {
        let mut state = State::default();
        let embedding = Embedding {
            vector: vec![1.0],
            rss_bytes: 0,
            peak_rss_bytes: 0,
        };
        for index in 0..65 {
            state.store(format!("query: {index}"), embedding.clone());
        }
        assert_eq!(state.cache.len(), 64);
        assert!(state.cached("query: 0").is_none());
        assert!(state.cached("query: 1").is_some());
        state.store("query: 65".to_owned(), embedding);
        // "query: 1" was used last, so "query: 2" went out.
        assert!(state.cached("query: 2").is_none());
        assert!(state.cached("query: 1").is_some());
    }
}
