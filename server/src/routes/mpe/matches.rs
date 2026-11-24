//! `generateCandidateMatches` of lib/mpe/candidates.server.ts: replace the
//! ingestion's text embedding, rank the memes the search and the hashes of
//! earlier candidates find, and store the best five with
//! `replace_mpe_candidate_matches`.
//!
//! The TypeScript's RPC planner sends `p_matches` as `text[]` (it reads the
//! argument types as text, `lib/db/execute.ts`), so Postgres finds no such
//! function and every call ends in a 500 after the embedding is replaced.
//! This port sends the same call and so fails the same way.

use serde::Deserialize;
use sha2::{Digest, Sha256};

use super::candidate_post::{Refusal, require_operator};
use super::matching::{self, Fingerprint, Match, Previous, Source, Subject, Target};
use super::rows::{self, Bind};
use crate::AppState;
use crate::auth::SessionUser;
use crate::db::DbIdentity;
use crate::routes::js_json;
use crate::routes::public::js;

// What lib/db/execute.ts compiles for each read (from the Postgres statement log).
pub const CANDIDATE_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."ingestion_id", r1."title" FROM public."meme_candidates" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const INGESTION_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."source_id", r1."ingest_mode" FROM public."media_ingestions" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const SOURCE_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."platform", r1."external_id", r1."channel_name", r1."title" FROM public."media_sources" r1 WHERE r1."id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const SEGMENTS_SQL: &str = r#"WITH __q AS (SELECT r1."raw_text", r1."normalized_text", r1."origin" FROM public."text_segments" r1 WHERE r1."ingestion_id" = $1::uuid AND r1."origin" <> $2) SELECT row_to_json(__q)::text FROM __q"#;
const FINGERPRINTS_SQL: &str = r#"WITH __q AS (SELECT r1."fingerprint_type", r1."hash_value", r1."embedding" FROM public."media_fingerprints" r1 WHERE r1."ingestion_id" = $1::uuid) SELECT row_to_json(__q)::text FROM __q"#;
const DELETE_EMBEDDING_SQL: &str = r#"DELETE FROM public."media_fingerprints" r1 WHERE r1."ingestion_id" = $1::uuid AND r1."fingerprint_type" = $2"#;
const INSERT_EMBEDDING_SQL: &str = r#"INSERT INTO public."media_fingerprints" ("ingestion_id", "fingerprint_type", "hash_value", "embedding", "frame_ms", "processor_version") VALUES ($1::uuid, $2, $3, $4::double precision[], $5::bigint, $6)"#;
const SEARCH_SQL: &str = r#"WITH __q AS (SELECT r1.* FROM public."search_memes"("p_query" => $1, "p_limit" => $2) r1 WHERE TRUE) SELECT row_to_json(__q)::text FROM __q"#;
const PREVIOUS_SQL: &str = r#"WITH __q AS (SELECT r1."ingestion_id", r1."target_meme_id" FROM public."meme_candidates" r1 WHERE r1."target_meme_id" IS NOT NULL) SELECT row_to_json(__q)::text FROM __q"#;
const HASHES_SQL: &str = r#"WITH __q AS (SELECT r1."ingestion_id", r1."fingerprint_type", r1."hash_value" FROM public."media_fingerprints" r1 WHERE r1."ingestion_id" = ANY($1::uuid[]) AND r1."fingerprint_type" = ANY($2::text[])) SELECT row_to_json(__q)::text FROM __q"#;
const MEMES_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."title", r1."aliases", r1."summary", r1."description" FROM public."memes" r1 WHERE r1."id" = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q"#;
const INGESTIONS_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."source_id" FROM public."media_ingestions" r1 WHERE r1."id" = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q"#;
const SOURCES_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."platform", r1."external_id", r1."channel_name", r1."title" FROM public."media_sources" r1 WHERE r1."id" = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q"#;
const PREVIOUS_SEGMENTS_SQL: &str = r#"WITH __q AS (SELECT r1."ingestion_id", r1."raw_text", r1."normalized_text", r1."origin" FROM public."text_segments" r1 WHERE r1."ingestion_id" = ANY($1::uuid[]) AND r1."origin" <> $2) SELECT row_to_json(__q)::text FROM __q"#;
const PREVIOUS_FINGERPRINTS_SQL: &str = r#"WITH __q AS (SELECT r1."ingestion_id", r1."fingerprint_type", r1."hash_value", r1."embedding" FROM public."media_fingerprints" r1 WHERE r1."ingestion_id" = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q"#;
const REPLACE_SQL: &str = r#"WITH __q AS (SELECT * FROM public."replace_mpe_candidate_matches"("p_candidate_id" => $1, "p_matches" => $2::text[])) SELECT row_to_json(__q)::text FROM __q"#;

#[derive(Deserialize)]
pub struct Candidate {
    pub ingestion_id: String,
    pub title: String,
}

#[derive(Deserialize)]
struct Ingestion {
    source_id: Option<String>,
    ingest_mode: String,
}

#[derive(Deserialize)]
struct Segment {
    #[serde(default)]
    ingestion_id: Option<String>,
    raw_text: String,
    normalized_text: Option<String>,
    origin: Option<String>,
}

impl Segment {
    /// `item.normalized_text || item.raw_text`, STT left out.
    fn text(&self) -> Option<String> {
        let stt = self
            .origin
            .as_deref()
            .is_some_and(|origin| js::trim(origin).to_uppercase() == "STT");
        let normalized = self
            .normalized_text
            .as_deref()
            .filter(|text| !text.is_empty());
        (!stt).then(|| normalized.unwrap_or(&self.raw_text).to_owned())
    }
}

#[derive(Deserialize)]
struct Ranked {
    id: String,
    title: String,
    #[serde(default)]
    aliases: Vec<Option<String>>,
    summary: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct Of<T> {
    ingestion_id: String,
    #[serde(flatten)]
    item: T,
}

#[derive(Deserialize)]
struct Pair {
    #[serde(alias = "ingestion_id")]
    id: String,
    #[serde(alias = "target_meme_id")]
    source_id: Option<String>,
}

fn parse<T: for<'de> Deserialize<'de>>(rows: &[String]) -> Result<Vec<T>, Refusal> {
    rows.iter()
        .map(|row| serde_json::from_str(row))
        .collect::<Result<_, _>>()
        .map_err(|_| Refusal::Plain)
}

/// `throwDb(error, fallback)`.
fn db(fallback: &str) -> impl Fn(String) -> Refusal + '_ {
    move |message| Refusal::coded(500, format!("{fallback}: {message}"))
}

/// The text embedding fingerprint of the candidate's own text.
pub fn embedding_fingerprint(title: &str, texts: &[String]) -> (String, Vec<f64>) {
    let mut parts = vec![title.to_owned()];
    parts.extend(texts.iter().cloned());
    let normalized = matching::normalize_korean_text(js::trim(&parts.join(" ")));
    let hash = hex::encode(Sha256::digest(normalized.as_bytes()));
    (hash, matching::deterministic_text_embedding(&normalized))
}

fn number(value: Option<f64>) -> String {
    value.map_or("null".to_owned(), |value| {
        js_json::stringify(&serde_json::json!(value))
    })
}

/// One element of `p_matches`, as `JSON.stringify` writes it.
pub fn match_json(item: &Match) -> String {
    let available: Vec<String> = item
        .available
        .iter()
        .map(|signal| format!(r#""{signal}""#))
        .collect();
    let contributions: Vec<String> = item
        .contributions
        .iter()
        .map(|(signal, value)| format!(r#""{signal}":{}"#, number(Some(*value))))
        .collect();
    format!(
        concat!(
            r#"{{"meme_id":"{}","rank":{},"overall_score":{},"text_score":{},"visual_score":{},"audio_score":{},"classification":"{}","#,
            r#""evidence_json":{{"metadataScore":{},"titleHashtagsScore":{},"availableSignals":[{}],"contributions":{{{}}},"exactDuplicate":{}}}}}"#
        ),
        item.meme_id,
        item.rank,
        number(Some(item.overall_score)),
        number(item.text_score),
        number(item.visual_score),
        number(item.audio_score),
        item.classification,
        number(item.metadata_score),
        number(Some(item.title_hashtags_score)),
        available.join(","),
        contributions.join(","),
        item.exact_duplicate
    )
}

/// The candidate and its ingestion, as the first reads give them.
struct Start {
    candidate: Candidate,
    ingestion: Ingestion,
}

async fn start(state: &AppState, user: &DbIdentity, candidate_id: &str) -> Result<Start, Refusal> {
    let candidate = rows::single(
        state,
        user,
        CANDIDATE_SQL,
        vec![Bind::Text(candidate_id.to_owned())],
    )
    .await
    .ok()
    .and_then(|row| serde_json::from_str::<Candidate>(&row).ok())
    .ok_or_else(|| Refusal::coded(404, "candidate_not_found".to_owned()))?;
    let ingestion = rows::single(
        state,
        user,
        INGESTION_SQL,
        vec![Bind::Text(candidate.ingestion_id.clone())],
    )
    .await
    .map_err(db("ingestion_load_failed"))?;
    let ingestion = serde_json::from_str(&ingestion).map_err(|_| Refusal::Plain)?;
    Ok(Start {
        candidate,
        ingestion,
    })
}

/// The ingestion's source, its text and its fingerprints, read together.
async fn own(
    state: &AppState,
    user: &DbIdentity,
    start: &Start,
) -> Result<(Option<Source>, Vec<String>, Vec<Fingerprint>), Refusal> {
    let id = &start.candidate.ingestion_id;
    let source = async {
        match &start.ingestion.source_id {
            Some(source) => rows::single(state, user, SOURCE_SQL, vec![Bind::Text(source.clone())])
                .await
                .map(Some),
            None => Ok(None),
        }
    };
    let segments = rows::rows(
        state,
        user,
        SEGMENTS_SQL,
        vec![Bind::Text(id.clone()), Bind::Text("STT".to_owned())],
    );
    let fingerprints = rows::rows(state, user, FINGERPRINTS_SQL, vec![Bind::Text(id.clone())]);
    let (source, segments, fingerprints) = tokio::join!(source, segments, fingerprints);
    let source = source.map_err(db("source_load_failed"))?;
    let segments = segments.map_err(db("segment_load_failed"))?;
    let fingerprints = fingerprints.map_err(db("fingerprint_load_failed"))?;
    let source = source
        .map(|row| serde_json::from_str(&row))
        .transpose()
        .map_err(|_| Refusal::Plain)?;
    let texts = parse::<Segment>(&segments)?
        .iter()
        .filter_map(Segment::text)
        .collect();
    Ok((source, texts, parse(&fingerprints)?))
}

/// Deletes the old text embedding and stores the new one, as the admin client.
async fn replace_embedding(
    state: &AppState,
    ingestion: &str,
    hash: &str,
    vector: &[f64],
) -> Result<(), Refusal> {
    let admin = DbIdentity::service_role();
    let delete = vec![
        Bind::Text(ingestion.to_owned()),
        Bind::Text("TEXT_EMBEDDING".to_owned()),
    ];
    rows::execute(state, &admin, DELETE_EMBEDDING_SQL, delete)
        .await
        .map_err(db("text_embedding_replace_failed"))?;
    let insert = vec![
        Bind::Text(ingestion.to_owned()),
        Bind::Text("TEXT_EMBEDDING".to_owned()),
        Bind::Text(hash.to_owned()),
        Bind::Floats(vector.to_vec()),
        Bind::NullInt,
        Bind::Text("mpe-text-embedding-v1".to_owned()),
    ];
    rows::execute(state, &admin, INSERT_EMBEDDING_SQL, insert)
        .await
        .map_err(db("text_embedding_save_failed"))
}

fn target(meme: Ranked) -> Target {
    Target {
        id: meme.id,
        title: meme.title,
        aliases: meme.aliases,
        summary: meme.summary,
        description: meme.description,
        ..Target::default()
    }
}

/// The ids `discoverHashCandidateIds` finds through earlier candidates' hashes.
async fn hash_ids(
    state: &AppState,
    user: &DbIdentity,
    current: &[Fingerprint],
    previous: &[(String, Option<String>)],
) -> Result<Vec<String>, Refusal> {
    let ingestions: Vec<String> = previous
        .iter()
        .map(|(ingestion, _)| ingestion.clone())
        .collect();
    let types = vec![Bind::Texts(vec![
        "SHA256".to_owned(),
        "PHASH".to_owned(),
        "FRAME_PHASH".to_owned(),
    ])];
    let found = rows_for(state, user, HASHES_SQL, &ingestions, types)
        .await
        .map_err(db("hash_candidate_fingerprint_load_failed"))?;
    let hashes: Vec<(String, Fingerprint)> = parse::<Of<Fingerprint>>(&found)?
        .into_iter()
        .map(|row| (row.ingestion_id, row.item))
        .collect();
    Ok(matching::discover_hash_candidate_ids(
        current, previous, &hashes,
    ))
}

/// The memes to rank: the search's 25, then those only the hashes find;
/// with every earlier candidate that points at a meme.
async fn memes(
    state: &AppState,
    user: &DbIdentity,
    query: &str,
    current: &[Fingerprint],
) -> Result<(Vec<Target>, Vec<(String, Option<String>)>), Refusal> {
    let searched = rows::rows(
        state,
        user,
        SEARCH_SQL,
        vec![Bind::Text(query.to_owned()), Bind::Int(25)],
    )
    .await
    .map_err(db("candidate_search_failed"))?;
    let searched: Vec<Ranked> = parse(&searched)?;
    let previous = rows::rows(state, user, PREVIOUS_SQL, Vec::new())
        .await
        .map_err(db("hash_candidate_load_failed"))?;
    let previous: Vec<(String, Option<String>)> = pairs(&previous)?;
    let missing: Vec<String> = hash_ids(state, user, current, &previous)
        .await?
        .into_iter()
        .filter(|id| !searched.iter().any(|meme| meme.id == *id))
        .collect();
    let extra = rows_for(state, user, MEMES_SQL, &missing, Vec::new())
        .await
        .map_err(db("hash_candidate_meme_load_failed"))?;
    let extra: Vec<Ranked> = parse(&extra)?;
    Ok((
        searched.into_iter().chain(extra).map(target).collect(),
        previous,
    ))
}

/// `ids.length ? query : { data: [] }`: no query for no ids.
async fn rows_for(
    state: &AppState,
    user: &DbIdentity,
    sql: &'static str,
    ids: &[String],
    extra: Vec<Bind>,
) -> Result<Vec<String>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut values = vec![Bind::Texts(ids.to_vec())];
    values.extend(extra);
    rows::rows(state, user, sql, values).await
}

fn pairs(rows: &[String]) -> Result<Vec<(String, Option<String>)>, Refusal> {
    Ok(parse::<Pair>(rows)?
        .into_iter()
        .map(|pair| (pair.id, pair.source_id))
        .collect())
}

/// What the earlier candidates of the ranked memes hold.
async fn evidence(
    state: &AppState,
    user: &DbIdentity,
    memes: &mut [Target],
    previous: &[(String, Option<String>)],
) -> Result<(), Refusal> {
    let ranked = |target: &Option<String>| {
        target
            .as_ref()
            .is_some_and(|target| memes.iter().any(|meme| meme.id == *target))
    };
    let relevant: Vec<(String, Option<String>)> = previous
        .iter()
        .filter(|(_, target)| ranked(target))
        .cloned()
        .collect();
    let ids: Vec<String> = relevant
        .iter()
        .map(|(ingestion, _)| ingestion.clone())
        .collect();
    let ingestions = rows_for(state, user, INGESTIONS_SQL, &ids, Vec::new())
        .await
        .map_err(db("candidate_ingestion_load_failed"))?;
    let ingestions = pairs(&ingestions)?;
    let source_ids: Vec<String> = ingestions
        .iter()
        .filter_map(|(_, source)| source.clone())
        .collect();
    let stt = vec![Bind::Text("STT".to_owned())];
    let (sources, segments, fingerprints) = tokio::join!(
        rows_for(state, user, SOURCES_SQL, &source_ids, Vec::new()),
        rows_for(state, user, PREVIOUS_SEGMENTS_SQL, &ids, stt),
        rows_for(state, user, PREVIOUS_FINGERPRINTS_SQL, &ids, Vec::new()),
    );
    let sources: Vec<Source> = parse(&sources.map_err(db("candidate_source_load_failed"))?)?;
    let segments: Vec<Segment> = parse(&segments.map_err(db("candidate_text_load_failed"))?)?;
    let fingerprints = fingerprints.map_err(db("candidate_fingerprint_load_failed"))?;
    let segments: Vec<(String, String)> = segments
        .iter()
        .filter_map(|segment| Some((segment.ingestion_id.clone()?, segment.text()?)))
        .collect();
    let fingerprints: Vec<(String, Fingerprint)> = parse::<Of<Fingerprint>>(&fingerprints)?
        .into_iter()
        .map(|row| (row.ingestion_id, row.item))
        .collect();
    let previous = Previous {
        candidates: &relevant,
        ingestions: &ingestions,
        sources: &sources,
        segments: &segments,
        fingerprints: &fingerprints,
    };
    memes.iter_mut().for_each(|meme| previous.attach(meme));
    Ok(())
}

/// `generateCandidateMatches(candidateId, client)`: the stored matches, as
/// the rows the function returns.
pub async fn generate(
    state: &AppState,
    user: &SessionUser,
    candidate_id: &str,
) -> Result<Vec<String>, Refusal> {
    require_operator(state, user).await?;
    let identity = user.db_identity();
    let start = start(state, &identity, candidate_id).await?;
    let (source, texts, fingerprints) = own(state, &identity, &start).await?;
    let mut parts = vec![start.candidate.title.clone()];
    parts.extend(texts.iter().cloned());
    let query = js::trim(&parts.join(" ")).to_owned();
    let (hash, vector) = embedding_fingerprint(&start.candidate.title, &texts);
    replace_embedding(state, &start.candidate.ingestion_id, &hash, &vector).await?;
    let mut current: Vec<Fingerprint> = fingerprints
        .into_iter()
        .filter(|item| item.fingerprint_type != "TEXT_EMBEDDING")
        .collect();
    current.push(Fingerprint {
        fingerprint_type: "TEXT_EMBEDDING".to_owned(),
        hash_value: hash,
        embedding: Some(vector.into_iter().map(Some).collect()),
    });
    let (mut memes, previous) = memes(state, &identity, &query, &current).await?;
    evidence(state, &identity, &mut memes, &previous).await?;
    let subject = Subject {
        title: &start.candidate.title,
        rights_mode: &start.ingestion.ingest_mode,
        source: source.as_ref(),
        text: &texts,
        fingerprints: &current,
    };
    let ranked: Vec<String> = matching::rank_candidate_matches(&subject, &memes)
        .iter()
        .map(match_json)
        .collect();
    let bound = vec![
        Bind::Untyped(candidate_id.to_owned()),
        Bind::Texts(ranked.clone()),
    ];
    rows::rows(state, &identity, REPLACE_SQL, bound).await.map_err(|message| {
        tracing::error!(candidate = candidate_id, matches = %format!("[{}]", ranked.join(",")), %message, "replace_mpe_candidate_matches failed");
        Refusal::coded(500, format!("candidate_match_replace_failed: {message}"))
    })
}
