//! The deterministic parts of candidate matching: `lib/mpe/candidates.ts`
//! (text normalization, similarity, the text embedding, hash similarity,
//! scoring) and the pure functions of `lib/mpe/candidates.server.ts`
//! (`validateCandidateJobs`, `rankCandidateMatches`,
//! `discoverHashCandidateIds`). Numbers are computed in the TypeScript's
//! order of operations, so every double is the one JavaScript gets
//! (`tests/fixtures/mpe_candidates.json`).

use std::collections::HashSet;

use serde::Deserialize;
use serde_json::{Map, Value, json};
use unicode_normalization::UnicodeNormalization;

use crate::routes::js_string::JsString;
use crate::routes::public::js;
use crate::routes::unicode_classes::{WORD, contains};

/// `CANDIDATE_SIGNAL_WEIGHTS`, in key order.
const SIGNALS: [(&str, f64); 5] = [
    ("text", 0.3),
    ("visual", 0.25),
    ("audio", 0.2),
    ("metadata", 0.15),
    ("titleHashtags", 0.1),
];

/// `Math.min(1, Math.max(0, value))`; NaN stays NaN, as `clamp` keeps it.
fn unit(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

/// `normalizeKoreanText`: NFKC, lower case, the runs of Hangul, letters and
/// numbers joined by single spaces.
pub fn normalize_korean_text(value: &str) -> String {
    let lower = value.nfkc().collect::<String>().to_lowercase();
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    for c in lower.chars() {
        if contains(&WORD, c) {
            current.push(c);
        } else if !current.is_empty() {
            words.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        words.push(current);
    }
    words.join(" ")
}

fn tokens(value: &str) -> HashSet<String> {
    normalize_korean_text(value)
        .split(' ')
        .filter(|token| !token.is_empty())
        .map(str::to_owned)
        .collect()
}

/// Three-unit slices of the compact text, in UTF-16 units as `slice` cuts.
fn grams(compact: &JsString) -> Vec<JsString> {
    if compact.len() < 3 {
        return vec![compact.clone()];
    }
    (0..compact.len() - 2)
        .map(|at| compact.slice(at, at + 3))
        .collect()
}

fn compact(value: &str) -> JsString {
    JsString::from(normalize_korean_text(value).replace(' ', "").as_str())
}

fn trigrams(value: &str) -> HashSet<JsString> {
    let compact = compact(value);
    if compact.is_empty() {
        return HashSet::new();
    }
    grams(&compact).into_iter().collect()
}

fn overlap<T: Eq + std::hash::Hash>(left: &HashSet<T>, right: &HashSet<T>) -> f64 {
    left.iter().filter(|item| right.contains(*item)).count() as f64
}

fn jaccard<T: Eq + std::hash::Hash>(left: &HashSet<T>, right: &HashSet<T>) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    let shared = overlap(left, right);
    shared / (left.len() as f64 + right.len() as f64 - shared)
}

fn dice<T: Eq + std::hash::Hash>(left: &HashSet<T>, right: &HashSet<T>) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }
    (2.0 * overlap(left, right)) / (left.len() as f64 + right.len() as f64)
}

/// `koreanTextSimilarity`.
pub fn korean_text_similarity(left: &str, right: &str) -> f64 {
    if normalize_korean_text(left).is_empty() || normalize_korean_text(right).is_empty() {
        return 0.0;
    }
    0.45 * jaccard(&tokens(left), &tokens(right)) + 0.55 * dice(&trigrams(left), &trigrams(right))
}

/// `Math.hypot(...values)` as V8 computes it: scaled by the largest value,
/// with Kahan summation.
pub fn hypot(values: &[f64]) -> f64 {
    if values.iter().any(|value| value.is_infinite()) {
        return f64::INFINITY;
    }
    if values.iter().any(|value| value.is_nan()) {
        return f64::NAN;
    }
    let max = values.iter().fold(
        0.0_f64,
        |max, value| if value.abs() > max { value.abs() } else { max },
    );
    if max == 0.0 {
        return 0.0;
    }
    let (mut sum, mut compensation) = (0.0_f64, 0.0_f64);
    for value in values {
        let n = value.abs() / max;
        let summand = n * n - compensation;
        let preliminary = sum + summand;
        compensation = (preliminary - sum) - summand;
        sum = preliminary;
    }
    sum.sqrt() * max
}

/// `deterministicTextEmbedding(value, 64)`.
pub fn deterministic_text_embedding(value: &str) -> Vec<f64> {
    const DIMENSIONS: u32 = 64;
    let normalized = compact(value);
    let mut vector = vec![0.0_f64; DIMENSIONS as usize];
    if normalized.is_empty() {
        return vector;
    }
    for feature in grams(&normalized) {
        // `2166136261 ^ x` and `Math.imul` work on 32-bit integers.
        let mut hash: i32 = 2_166_136_261_u32 as i32;
        for point in feature.code_points() {
            hash ^= point as i32;
            hash = hash.wrapping_mul(16_777_619);
        }
        let slot = ((hash as u32) >> 1) % DIMENSIONS;
        vector[slot as usize] += if hash & 1 == 0 { 1.0 } else { -1.0 };
    }
    let norm = hypot(&vector);
    if norm == 0.0 {
        vector
    } else {
        vector.iter().map(|value| value / norm).collect()
    }
}

/// `cosineSimilarity`.
pub fn cosine_similarity(left: &[f64], right: &[f64]) -> Option<f64> {
    if left.is_empty() || left.len() != right.len() {
        return None;
    }
    let (left_norm, right_norm) = (hypot(left), hypot(right));
    if left_norm == 0.0 || right_norm == 0.0 {
        return None;
    }
    let dot = left.iter().zip(right).fold(0.0, |sum, (l, r)| sum + l * r);
    Some(unit(dot / (left_norm * right_norm)))
}

/// `perceptualHashSimilarity`.
pub fn perceptual_hash_similarity(left: &str, right: &str) -> Option<f64> {
    let (left, right) = (
        js::trim(left).to_lowercase(),
        js::trim(right).to_lowercase(),
    );
    let hex = |text: &str| {
        text.bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    };
    if left.is_empty() || left.len() != right.len() || !hex(&left) || !hex(&right) {
        return None;
    }
    let different: u32 = left
        .chars()
        .zip(right.chars())
        .map(|(l, r)| (l.to_digit(16).unwrap_or(0) ^ r.to_digit(16).unwrap_or(0)).count_ones())
        .sum();
    Some(1.0 - f64::from(different) / (left.len() as f64 * 4.0))
}

/// `classifyCandidate`, upper-cased as the matches store it.
pub fn classify(score: f64) -> &'static str {
    if score >= 0.82 {
        "DUPLICATE"
    } else if score >= 0.65 {
        "RELATED"
    } else if score >= 0.45 {
        "DERIVED"
    } else {
        "SEPARATE"
    }
}

/// `scoreCandidate`: the score, the signals used and each one's share.
pub struct Score {
    pub score: f64,
    pub available: Vec<&'static str>,
    pub contributions: Vec<(&'static str, f64)>,
}

/// `signals` in the order of `SIGNALS`: (value, authorized).
pub fn score_candidate(exact_duplicate: bool, signals: [(Option<f64>, bool); 5]) -> Score {
    if exact_duplicate {
        return Score {
            score: 1.0,
            available: Vec::new(),
            contributions: Vec::new(),
        };
    }
    let available: Vec<usize> = (0..5)
        .filter(|at| signals[*at].1 && signals[*at].0.is_some_and(f64::is_finite))
        .collect();
    let total = available.iter().fold(0.0, |sum, at| sum + SIGNALS[*at].1);
    let mut score = 0.0;
    let mut contributions = Vec::new();
    for at in &available {
        let value = unit(signals[*at].0.unwrap_or(0.0));
        let contribution = value * SIGNALS[*at].1 / total;
        contributions.push((SIGNALS[*at].0, contribution));
        score += contribution;
    }
    Score {
        score,
        available: available.iter().map(|at| SIGNALS[*at].0).collect(),
        contributions,
    }
}

/// `SourceEvidence`.
#[derive(Clone, Debug, Deserialize)]
pub struct Source {
    pub id: String,
    pub platform: String,
    pub external_id: Option<String>,
    pub channel_name: Option<String>,
    pub title: Option<String>,
}

/// `Fingerprint`; `embedding` holds `null` elements as `None`.
#[derive(Clone, Debug, Deserialize)]
pub struct Fingerprint {
    pub fingerprint_type: String,
    pub hash_value: String,
    #[serde(default)]
    pub embedding: Option<Vec<Option<f64>>>,
}

/// A meme to rank against, with what earlier candidates of it hold.
#[derive(Clone, Debug, Default)]
pub struct Target {
    pub id: String,
    pub title: String,
    pub aliases: Vec<Option<String>>,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub sources: Vec<Source>,
    pub text: Vec<String>,
    pub fingerprints: Vec<Fingerprint>,
}

/// `RankInput` without the memes.
pub struct Subject<'a> {
    pub title: &'a str,
    pub rights_mode: &'a str,
    pub source: Option<&'a Source>,
    pub text: &'a [String],
    pub fingerprints: &'a [Fingerprint],
}

/// One ranked match (`CandidateMatch` without the candidate id).
#[derive(Clone, Debug)]
pub struct Match {
    pub meme_id: String,
    pub rank: usize,
    pub overall_score: f64,
    pub text_score: Option<f64>,
    pub visual_score: Option<f64>,
    pub audio_score: Option<f64>,
    pub classification: &'static str,
    pub metadata_score: Option<f64>,
    pub title_hashtags_score: f64,
    pub available: Vec<&'static str>,
    pub contributions: Vec<(&'static str, f64)>,
    pub exact_duplicate: bool,
}

fn of_type<'a>(items: &'a [Fingerprint], types: &[&str]) -> Vec<&'a Fingerprint> {
    items
        .iter()
        .filter(|item| types.contains(&item.fingerprint_type.as_str()))
        .collect()
}

/// `maxHashSimilarity`.
pub fn max_hash_similarity(
    left: &[Fingerprint],
    right: &[Fingerprint],
    types: &[&str],
) -> Option<f64> {
    let (left, right) = (of_type(left, types), of_type(right, types));
    let mut best: Option<f64> = None;
    for l in &left {
        for r in &right {
            if let Some(similarity) = perceptual_hash_similarity(&l.hash_value, &r.hash_value)
                && best.is_none_or(|best| similarity > best)
            {
                best = Some(similarity);
            }
        }
    }
    best
}

/// `hasExactHash`.
pub fn has_exact_hash(left: &[Fingerprint], right: &[Fingerprint], kind: &str) -> bool {
    let hashes: HashSet<&str> = of_type(left, &[kind])
        .iter()
        .map(|item| item.hash_value.as_str())
        .collect();
    of_type(right, &[kind])
        .iter()
        .any(|item| hashes.contains(item.hash_value.as_str()))
}

fn embedding(items: &[Fingerprint]) -> Option<Vec<f64>> {
    let found = items
        .iter()
        .find(|item| item.fingerprint_type == "TEXT_EMBEDDING")?;
    // `null` elements count as 0 in `Math.hypot` and in the products.
    found
        .embedding
        .as_ref()
        .map(|values| values.iter().map(|value| value.unwrap_or(0.0)).collect())
}

fn metadata_similarity(left: Option<&Source>, right: &[Source]) -> Option<f64> {
    let left = left?;
    if right.is_empty() {
        return None;
    }
    fn filled(value: Option<&str>) -> Option<&str> {
        value.filter(|value| !value.is_empty())
    }
    let scores = right.iter().map(|source| {
        let pairs = [
            (filled(Some(&left.platform)), filled(Some(&source.platform))),
            (
                filled(left.channel_name.as_deref()),
                filled(source.channel_name.as_deref()),
            ),
        ];
        let comparable: Vec<_> = pairs
            .iter()
            .filter(|(a, b)| a.is_some() && b.is_some())
            .collect();
        if comparable.is_empty() {
            return 0.0;
        }
        comparable.iter().filter(|(a, b)| a == b).count() as f64 / comparable.len() as f64
    });
    Some(scores.fold(f64::NEG_INFINITY, f64::max))
}

/// `[...].filter(Boolean).join(" ")`.
fn join_filled(parts: &[Option<&str>]) -> String {
    let kept: Vec<&str> = parts
        .iter()
        .flatten()
        .copied()
        .filter(|part| !part.is_empty())
        .collect();
    kept.join(" ")
}

/// `[meme.title, ...meme.aliases]`, with `null` as `join` writes it.
fn titles(meme: &Target) -> Vec<&str> {
    let mut titles: Vec<&str> = vec![&meme.title];
    titles.extend(
        meme.aliases
            .iter()
            .map(|alias| alias.as_deref().unwrap_or("")),
    );
    titles
}

fn text_score(subject: &Subject<'_>, meme: &Target) -> Option<f64> {
    let source_title = subject.source.and_then(|source| source.title.as_deref());
    let mut source_parts = vec![Some(subject.title), source_title];
    source_parts.extend(subject.text.iter().map(|text| Some(text.as_str())));
    let source_text = join_filled(&source_parts);
    let mut target_parts = titles(meme);
    target_parts.push(meme.summary.as_deref().unwrap_or(""));
    target_parts.push(meme.description.as_deref().unwrap_or(""));
    target_parts.extend(meme.text.iter().map(String::as_str));
    let lexical = (!source_text.is_empty())
        .then(|| korean_text_similarity(&source_text, &target_parts.join(" ")));
    let semantic = match (
        embedding(subject.fingerprints),
        embedding(&meme.fingerprints),
    ) {
        (Some(l), Some(r)) => cosine_similarity(&l, &r),
        _ => None,
    };
    match (lexical, semantic) {
        (None, semantic) => semantic,
        (Some(lexical), None) => Some(lexical),
        (Some(lexical), Some(semantic)) => Some((lexical + semantic) / 2.0),
    }
}

fn exact_duplicate(subject: &Subject<'_>, meme: &Target, authorized: bool) -> bool {
    let same_source = subject.source.is_some_and(|source| {
        meme.sources.iter().any(|known| {
            known.id == source.id
                || (source
                    .external_id
                    .as_deref()
                    .is_some_and(|id| !id.is_empty())
                    && known.platform == source.platform
                    && known.external_id == source.external_id)
        })
    });
    same_source
        || (authorized && has_exact_hash(subject.fingerprints, &meme.fingerprints, "SHA256"))
}

fn rank_one(subject: &Subject<'_>, meme: &Target, search_rank: usize) -> Match {
    let authorized = matches!(
        subject.rights_mode,
        "OWNER_AUTHORIZED" | "USER_UPLOADED" | "LICENSED_MEDIA"
    );
    let text = text_score(subject, meme);
    let visual = authorized
        .then(|| {
            max_hash_similarity(
                subject.fingerprints,
                &meme.fingerprints,
                &["PHASH", "FRAME_PHASH"],
            )
        })
        .flatten();
    let has_audio =
        |items: &[Fingerprint]| items.iter().any(|item| item.fingerprint_type == "AUDIO");
    let audio = (authorized && has_audio(subject.fingerprints) && has_audio(&meme.fingerprints))
        .then(|| {
            if has_exact_hash(subject.fingerprints, &meme.fingerprints, "AUDIO") {
                1.0
            } else {
                0.0
            }
        });
    let metadata = metadata_similarity(subject.source, &meme.sources);
    let source_title = subject.source.and_then(|source| source.title.as_deref());
    let own = join_filled(&[Some(subject.title), source_title]);
    let title_hashtags = korean_text_similarity(&own, &titles(meme).join(" "));
    let exact = exact_duplicate(subject, meme, authorized);
    let signals = [
        (text, true),
        (visual, authorized),
        (audio, authorized),
        (metadata, true),
        (Some(title_hashtags), true),
    ];
    let scored = score_candidate(exact, signals);
    Match {
        meme_id: meme.id.clone(),
        rank: search_rank,
        overall_score: scored.score,
        text_score: text,
        visual_score: visual,
        audio_score: audio,
        classification: classify(scored.score),
        metadata_score: metadata,
        title_hashtags_score: title_hashtags,
        available: scored.available,
        contributions: scored.contributions,
        exact_duplicate: exact,
    }
}

/// `rankCandidateMatches`: the best five, best first, ranked from 1.
pub fn rank_candidate_matches(subject: &Subject<'_>, memes: &[Target]) -> Vec<Match> {
    let mut matches: Vec<Match> = memes
        .iter()
        .enumerate()
        .map(|(at, meme)| rank_one(subject, meme, at))
        .collect();
    // `sort((l, r) => r.overall_score - l.overall_score || l.rank - r.rank)`:
    // stable, and a NaN difference falls through to the rank.
    matches.sort_by(|left, right| {
        let by_score = right.overall_score - left.overall_score;
        if by_score > 0.0 {
            std::cmp::Ordering::Greater
        } else if by_score < 0.0 {
            std::cmp::Ordering::Less
        } else {
            left.rank.cmp(&right.rank)
        }
    });
    matches.truncate(5);
    for (at, item) in matches.iter_mut().enumerate() {
        item.rank = at + 1;
    }
    matches
}

/// `discoverHashCandidateIds`: memes earlier candidates point at whose media
/// share this one's hash or look alike (0.65 and up), best first, 25 at most.
pub fn discover_hash_candidate_ids(
    current: &[Fingerprint],
    candidates: &[(String, Option<String>)],
    previous: &[(String, Fingerprint)],
) -> Vec<String> {
    let mut scores: Vec<(String, f64)> = Vec::new();
    for (ingestion, target) in candidates {
        let Some(target) = target else { continue };
        let fingerprints: Vec<Fingerprint> = previous
            .iter()
            .filter(|(of, _)| of == ingestion)
            .map(|(_, item)| item.clone())
            .collect();
        let exact = has_exact_hash(current, &fingerprints, "SHA256");
        let visual = max_hash_similarity(current, &fingerprints, &["PHASH", "FRAME_PHASH"]);
        let score = if exact { 1.0 } else { visual.unwrap_or(0.0) };
        if score >= 0.65 {
            match scores.iter_mut().find(|(id, _)| id == target) {
                Some(entry) => entry.1 = score.max(entry.1),
                None => scores.push((target.clone(), score)),
            }
        }
    }
    // `localeCompare` orders these lower-case UUIDs as bytes do.
    scores.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });
    scores.into_iter().take(25).map(|(id, _)| id).collect()
}

/// `CandidateJob`.
#[derive(Clone, Debug, Deserialize)]
pub struct Job {
    pub job_type: String,
    pub status: String,
    #[serde(default)]
    pub processor_version: Option<String>,
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub output_json: Option<Value>,
}

/// `String(value)` of a JSON value.
fn js_string(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => "null".to_owned(),
        Value::Bool(flag) => flag.to_string(),
        Value::Number(_) => crate::routes::js_json::stringify(value),
        Value::Array(items) => items
            .iter()
            .map(|item| {
                if item.is_null() {
                    String::new()
                } else {
                    js_string(item)
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".to_owned(),
    }
}

/// `outputRecord(job.output_json)`.
fn output(job: &Job) -> Map<String, Value> {
    match &job.output_json {
        Some(Value::Object(map)) => map.clone(),
        _ => Map::new(),
    }
}

/// `hasExactOutput`: the same keys, each strictly equal (`===`).
fn exact_output(job: &Job, expected: &Value) -> bool {
    let (actual, expected) = (output(job), expected.as_object().expect("an object"));
    actual.len() == expected.len()
        && actual.iter().all(|(key, value)| {
            expected
                .get(key)
                .is_some_and(|wanted| match (value, wanted) {
                    (Value::Number(a), Value::Number(b)) => a.as_f64() == b.as_f64(),
                    (a, b) => !a.is_object() && !a.is_array() && a == b,
                })
        })
}

fn is_not_configured(job: &Job) -> bool {
    let reason = output(job)
        .get("reason")
        .filter(|reason| !reason.is_null())
        .map_or(String::new(), js_string);
    job.error_code
        .as_deref()
        .unwrap_or("")
        .contains("not_configured")
        || reason.contains("not_configured")
}

fn is_visual_only_video(job: &Job) -> bool {
    let out = output(job);
    let written = out.get("segmentsWritten").and_then(Value::as_f64);
    job.job_type == "scene_frames"
        && job.status == "completed"
        && job.processor_version.as_deref() == Some("1.1.0")
        && out.get("provider").and_then(Value::as_str) == Some("openrouter")
        && out.get("model").and_then(Value::as_str) == Some("stealth/ox-alpha")
        && out.get("providerBacked") == Some(&Value::Bool(true))
        && written.is_some_and(|n| n.fract() == 0.0 && n >= 0.0)
}

/// `validateCandidateJobs(mediaKind, jobs)`: the status and code it throws.
pub fn validate_candidate_jobs(media_kind: &str, jobs: &[Job]) -> Result<(), (u16, &'static str)> {
    let required: &[&str] = match media_kind {
        "image" => &["inspect", "fingerprint", "ocr"],
        "video" => &["inspect", "fingerprint", "scene_frames", "stt"],
        _ => return Err((422, "invalid_media_kind")),
    };
    if jobs.iter().any(|job| job.status == "failed") {
        return Err((409, "processing_jobs_failed"));
    }
    if jobs.iter().any(is_not_configured) {
        return Err((409, "processing_provider_not_configured"));
    }
    let inspect = |audio: bool| {
        jobs.iter().any(|job| {
            job.job_type == "inspect"
                && job.status == "completed"
                && output(job).get("hasAudio") == Some(&Value::Bool(audio))
        })
    };
    let (without_audio, with_audio) = (inspect(false), inspect(true));
    let visual_only = jobs.iter().any(is_visual_only_video);
    let no_audio = |job: &Job| {
        job.status == "skipped"
            && (exact_output(job, &json!({ "reason": "no_audio" }))
                || exact_output(
                    job,
                    &json!({ "reason": "no_audio", "segmentsWritten": 0, "audioDetected": false }),
                ))
            && without_audio
    };
    let stt_disabled = |job: &Job| {
        let expected = json!({
            "reason": "audio_stt_disabled", "provider": "openrouter", "model": "stealth/ox-alpha",
            "providerBacked": false, "segmentsWritten": 0, "audioDetected": true,
        });
        job.status == "skipped" && exact_output(job, &expected) && with_audio && visual_only
    };
    let unfinished = required.iter().any(|kind| {
        let matching: Vec<&Job> = jobs.iter().filter(|job| job.job_type == *kind).collect();
        matching.is_empty()
            || matching.iter().any(|job| match *kind {
                "scene_frames" => !visual_only,
                "stt" => !(no_audio(job) || stt_disabled(job)),
                _ => job.status != "completed",
            })
    });
    if unfinished {
        Err((409, "processing_jobs_not_terminal"))
    } else {
        Ok(())
    }
}

/// The rows `generateCandidateMatches` reads about earlier candidates.
pub struct Previous<'a> {
    pub candidates: &'a [(String, Option<String>)],
    pub ingestions: &'a [(String, Option<String>)],
    pub sources: &'a [Source],
    pub segments: &'a [(String, String)],
    pub fingerprints: &'a [(String, Fingerprint)],
}

impl Previous<'_> {
    /// What the earlier candidates of `meme` hold: their sources, text and
    /// fingerprints.
    pub fn attach(&self, meme: &mut Target) {
        let ids: HashSet<&str> = self
            .candidates
            .iter()
            .filter(|(_, target)| target.as_deref() == Some(meme.id.as_str()))
            .map(|(ingestion, _)| ingestion.as_str())
            .collect();
        let sources: HashSet<&str> = self
            .ingestions
            .iter()
            .filter(|(id, _)| ids.contains(id.as_str()))
            .filter_map(|(_, source)| source.as_deref())
            .collect();
        meme.sources = self
            .sources
            .iter()
            .filter(|source| sources.contains(source.id.as_str()))
            .cloned()
            .collect();
        meme.text = self
            .segments
            .iter()
            .filter(|(of, _)| ids.contains(of.as_str()))
            .map(|(_, text)| text.clone())
            .collect();
        meme.fingerprints = self
            .fingerprints
            .iter()
            .filter(|(of, _)| ids.contains(of.as_str()))
            .map(|(_, item)| item.clone())
            .collect();
    }
}
