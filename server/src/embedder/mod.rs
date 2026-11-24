//! The bundled meme embedding model (`MEME_EMBEDDING_RUNTIME=bundled`) of
//! lib/meme-embedding-runtime.server.ts: intfloat/multilingual-e5-small at a
//! pinned revision, FP32 ONNX, 384 dimensions, run on ONNX Runtime 1.21.0
//! (the version transformers.js runs it on) through `ort` with
//! `load-dynamic`. The server binary links no ONNX Runtime: the library is
//! opened only by `memecatch-server embedder` (`service`), the compose
//! service that holds the model. Axum's routes reach it over HTTP
//! (`routes/embeddings`).
//!
//! `tokenizer` and `vector` port transformers.js's tokenizer and pooling;
//! `server/tests/embedder_parity.rs` holds them, and the vectors, to the
//! fixture the real TypeScript wrote.

pub mod model;
pub mod service;
pub mod tokenizer;
pub mod vector;
