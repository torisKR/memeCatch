//! `getPipeline` and one `extractor(input, { pooling: "mean", normalize:
//! true })` of lib/meme-embedding-runtime.server.ts, on ONNX Runtime through
//! `ort` with the same model file and session options.

use std::path::{Path, PathBuf};

use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::Tensor;
use serde::Deserialize;

use super::tokenizer::Tokenizer;
use super::vector::{DIMENSIONS, mean_pool_normalize};

pub const MODEL: &str = "intfloat/multilingual-e5-small";
pub const REVISION: &str = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
const MODEL_SHA256: &str = "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665";

#[derive(Deserialize)]
struct Manifest {
    model: Option<String>,
    revision: Option<String>,
    dtype: Option<String>,
    dimensions: Option<f64>,
    files: Option<Vec<ManifestFile>>,
}

#[derive(Deserialize)]
struct ManifestFile {
    path: Option<String>,
    sha256: Option<String>,
}

/// The model of `<root>/intfloat/multilingual-e5-small`, loaded.
pub struct Model {
    tokenizer: Tokenizer,
    session: Session,
}

impl Model {
    /// The manifest check of `getPipeline`, then the tokenizer and an ONNX
    /// session with its `session_options`. The check reads only
    /// `manifest.json`, as the TypeScript does; the files' hashes were
    /// checked when they were prepared.
    pub fn load(root: &Path) -> Result<Self, String> {
        let directory = root.join(MODEL);
        check_manifest(&directory.join("manifest.json"))?;
        let tokenizer_json = std::fs::read_to_string(directory.join("tokenizer.json"))
            .map_err(|error| format!("tokenizer.json: {error}"))?;
        let tokenizer = Tokenizer::from_json(&tokenizer_json)?;
        drop(tokenizer_json);
        let session = session(&directory.join("onnx").join("model.onnx"))
            .map_err(|error| format!("model.onnx: {error}"))?;
        Ok(Self { tokenizer, session })
    }

    /// The vector of one prefixed input (`query: ...` or `passage: ...`).
    pub fn embed(&self, input: &str) -> Result<Vec<f64>, String> {
        let ids: Vec<i64> = self
            .tokenizer
            .encode(input)
            .into_iter()
            .map(i64::from)
            .collect();
        let tokens = ids.len();
        let hidden = self.run(ids).map_err(|error| error.to_string())?;
        if hidden.len() != tokens * DIMENSIONS {
            return Err(format!("unexpected output of {} floats", hidden.len()));
        }
        Ok(mean_pool_normalize(&hidden, tokens, DIMENSIONS))
    }

    fn run(&self, ids: Vec<i64>) -> ort::Result<Vec<f32>> {
        let shape = [1usize, ids.len()];
        let mask = vec![1i64; ids.len()];
        let types = vec![0i64; ids.len()];
        let outputs = self.session.run(ort::inputs![
            "input_ids" => Tensor::from_array((shape, ids))?,
            "attention_mask" => Tensor::from_array((shape, mask))?,
            "token_type_ids" => Tensor::from_array((shape, types))?,
        ]?)?;
        let (_, values) = outputs["last_hidden_state"].try_extract_raw_tensor::<f32>()?;
        Ok(values.to_vec())
    }
}

fn check_manifest(path: &Path) -> Result<(), String> {
    let text = std::fs::read_to_string(path).map_err(|error| format!("manifest.json: {error}"))?;
    let manifest: Manifest =
        serde_json::from_str(&text).map_err(|error| format!("manifest.json: {error}"))?;
    let pinned = manifest.files.unwrap_or_default().iter().any(|file| {
        file.path.as_deref() == Some("onnx/model.onnx")
            && file.sha256.as_deref() == Some(MODEL_SHA256)
    });
    let matches = manifest.model.as_deref() == Some(MODEL)
        && manifest.revision.as_deref() == Some(REVISION)
        && manifest.dtype.as_deref() == Some("fp32")
        && manifest.dimensions == Some(DIMENSIONS as f64)
        && pinned;
    if matches {
        Ok(())
    } else {
        Err("embedding_model_mismatch".to_owned())
    }
}

/// `device: "cpu"`, `intraOpNumThreads: 1`, `interOpNumThreads: 1`,
/// `executionMode: "sequential"`, `graphOptimizationLevel: "all"`.
fn session(path: &PathBuf) -> ort::Result<Session> {
    Session::builder()?
        .with_optimization_level(GraphOptimizationLevel::Level3)?
        .with_intra_threads(1)?
        .with_inter_threads(1)?
        .with_parallel_execution(false)?
        .commit_from_file(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_manifest(dir: &Path, body: &str) -> PathBuf {
        let path = dir.join("manifest.json");
        std::fs::write(&path, body).expect("manifest written");
        path
    }

    #[test]
    fn only_the_pinned_manifest_passes() {
        let dir = tempfile::tempdir().expect("temp dir");
        let good = format!(
            r#"{{"model":"{MODEL}","revision":"{REVISION}","dtype":"fp32","dimensions":384,
               "files":[{{"path":"onnx/model.onnx","sha256":"{MODEL_SHA256}","bytes":1}}]}}"#
        );
        assert!(check_manifest(&write_manifest(dir.path(), &good)).is_ok());
        for broken in [
            good.replace("fp32", "q8"),
            good.replace("384", "768"),
            good.replace(MODEL_SHA256, &"0".repeat(64)),
            good.replace("onnx/model.onnx", "onnx/model_quantized.onnx"),
            "[]".to_owned(),
        ] {
            let error = check_manifest(&write_manifest(dir.path(), &broken));
            assert!(error.is_err(), "{broken}");
        }
        assert!(check_manifest(&dir.path().join("missing.json")).is_err());
    }
}
