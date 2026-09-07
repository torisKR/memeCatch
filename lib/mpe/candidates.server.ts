import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/profile-access";
import {
  cosineSimilarity,
  deterministicTextEmbedding,
  koreanTextSimilarity,
  normalizeKoreanText,
  perceptualHashSimilarity,
  scoreCandidate,
  type CandidateRelation,
} from "./candidates";

type MpeClient = Awaited<ReturnType<typeof createClient>>;
type AdminClient = ReturnType<typeof createAdminClient>;

type SourceEvidence = {
  id: string;
  platform: string;
  external_id: string | null;
  channel_name: string | null;
  title: string | null;
};

type Fingerprint = {
  fingerprint_type: string;
  hash_value: string;
  embedding?: number[] | null;
};

type RankedMeme = {
  id: string;
  title: string;
  aliases: string[];
  summary: string;
  description: string;
};

export type CandidateMatch = {
  candidate_id: string;
  meme_id: string;
  rank: number;
  overall_score: number;
  text_score: number | null;
  visual_score: number | null;
  audio_score: number | null;
  classification: Uppercase<CandidateRelation>;
  evidence_json: {
    metadataScore: number | null;
    titleHashtagsScore: number | null;
    availableSignals: string[];
    contributions: Record<string, number>;
    exactDuplicate: boolean;
  };
};

type RankInput = {
  candidateId: string;
  title: string;
  rightsMode: string;
  source: SourceEvidence | null;
  text: string[];
  fingerprints: Fingerprint[];
  memes: Array<RankedMeme & {
    sources: SourceEvidence[];
    text: string[];
    fingerprints: Fingerprint[];
  }>;
};

type FingerprintCandidate = {
  ingestion_id: string;
  target_meme_id: string | null;
};

export class MpeCandidateError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "MpeCandidateError";
  }
}

export const MPE_CANDIDATE_MODEL_VERSION = "mpe-candidate-v1";
export const MPE_CANDIDATE_PROMPT_VERSION = "mpe-evidence-v1";
export const MPE_TEXT_EMBEDDING_VERSION = "mpe-text-embedding-v1";

const MPE_MEDIA_PROCESSOR_VERSION = "1.1.0";

type CandidateJob = {
  job_type: string;
  status: string;
  processor_version?: string;
  error_code?: string | null;
  output_json?: unknown;
};

function outputRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function withoutSttSegments<T extends { origin?: string | null }>(segments: T[]): T[] {
  return segments.filter((segment) => segment.origin?.trim().toUpperCase() !== "STT");
}

function hasExactOutput(value: unknown, expected: Record<string, unknown>) {
  const actual = outputRecord(value);
  const keys = Object.keys(actual);
  return keys.length === Object.keys(expected).length
    && keys.every((key) => Object.hasOwn(expected, key) && actual[key] === expected[key]);
}

export function validateCandidateJobs(mediaKind: string, jobs: CandidateJob[]): void {
  const required = mediaKind === "image"
    ? ["inspect", "fingerprint", "ocr"]
    : mediaKind === "video"
      ? ["inspect", "fingerprint", "scene_frames", "stt"]
      : [];
  if (required.length === 0) throw new MpeCandidateError("invalid_media_kind", 422);
  if (jobs.some((job) => job.status === "failed")) throw new MpeCandidateError("processing_jobs_failed", 409);
  if (jobs.some((job) => /not_configured/.test(job.error_code ?? "")
    || /not_configured/.test(String(outputRecord(job.output_json).reason ?? "")))) {
    throw new MpeCandidateError("processing_provider_not_configured", 409);
  }
  const inspectWithoutAudio = jobs.some((job) => job.job_type === "inspect"
    && job.status === "completed"
    && outputRecord(job.output_json).hasAudio === false);
  const inspectWithAudio = jobs.some((job) => job.job_type === "inspect"
    && job.status === "completed"
    && outputRecord(job.output_json).hasAudio === true);
  const visualOnlyVideo = jobs.some((job) => {
    const output = outputRecord(job.output_json);
    return job.job_type === "scene_frames"
      && job.status === "completed"
      && job.processor_version === MPE_MEDIA_PROCESSOR_VERSION
      && output.provider === "openrouter"
      && output.model === "stealth/ox-alpha"
      && output.providerBacked === true
      && typeof output.segmentsWritten === "number"
      && Number.isInteger(output.segmentsWritten)
      && output.segmentsWritten >= 0;
  });
  const noAudioSkipped = (job: CandidateJob) => job.status === "skipped"
    && (hasExactOutput(job.output_json, { reason: "no_audio" })
      || hasExactOutput(job.output_json, { reason: "no_audio", segmentsWritten: 0, audioDetected: false }))
    && inspectWithoutAudio;
  const audioSttDisabled = (job: CandidateJob) => job.status === "skipped"
    && hasExactOutput(job.output_json, {
      reason: "audio_stt_disabled",
      provider: "openrouter",
      model: "stealth/ox-alpha",
      providerBacked: false,
      segmentsWritten: 0,
      audioDetected: true,
    })
    && inspectWithAudio
    && visualOnlyVideo;
  if (required.some((jobType) => {
    const matching = jobs.filter((job) => job.job_type === jobType);
    return matching.length === 0 || matching.some((job) => {
      if (jobType === "scene_frames") return !visualOnlyVideo;
      if (jobType === "stt") return !(noAudioSkipped(job) || audioSttDisabled(job));
      return job.status !== "completed";
    });
  })) throw new MpeCandidateError("processing_jobs_not_terminal", 409);
}

function maxHashSimilarity(left: Fingerprint[], right: Fingerprint[], types: Set<string>): number | null {
  const leftHashes = left.filter((item) => types.has(item.fingerprint_type));
  const rightHashes = right.filter((item) => types.has(item.fingerprint_type));
  if (leftHashes.length === 0 || rightHashes.length === 0) return null;
  let best: number | null = null;
  for (const leftHash of leftHashes) {
    for (const rightHash of rightHashes) {
      const similarity = perceptualHashSimilarity(leftHash.hash_value, rightHash.hash_value);
      if (similarity !== null && (best === null || similarity > best)) best = similarity;
    }
  }
  return best;
}

function hasExactHash(left: Fingerprint[], right: Fingerprint[], type: string): boolean {
  const hashes = new Set(left.filter((item) => item.fingerprint_type === type).map((item) => item.hash_value));
  return right.some((item) => item.fingerprint_type === type && hashes.has(item.hash_value));
}

function embeddingSimilarity(left: Fingerprint[], right: Fingerprint[]): number | null {
  const leftEmbedding = left.find((item) => item.fingerprint_type === "TEXT_EMBEDDING")?.embedding;
  const rightEmbedding = right.find((item) => item.fingerprint_type === "TEXT_EMBEDDING")?.embedding;
  return leftEmbedding && rightEmbedding ? cosineSimilarity(leftEmbedding, rightEmbedding) : null;
}

function metadataSimilarity(left: SourceEvidence | null, right: SourceEvidence[]): number | null {
  if (!left || right.length === 0) return null;
  return Math.max(...right.map((source) => {
    const comparable = [
      [left.platform, source.platform],
      [left.channel_name, source.channel_name],
    ].filter(([a, b]) => Boolean(a && b));
    if (comparable.length === 0) return 0;
    return comparable.filter(([a, b]) => a === b).length / comparable.length;
  }));
}

export function rankCandidateMatches(input: RankInput): CandidateMatch[] {
  const analysisAuthorized = ["OWNER_AUTHORIZED", "USER_UPLOADED", "LICENSED_MEDIA"].includes(input.rightsMode);
  const sourceText = [input.title, input.source?.title, ...input.text].filter(Boolean).join(" ");

  return input.memes.map((meme, searchRank) => {
    const targetText = [meme.title, ...meme.aliases, meme.summary, meme.description, ...meme.text].join(" ");
    const lexicalScore = sourceText ? koreanTextSimilarity(sourceText, targetText) : null;
    const semanticScore = embeddingSimilarity(input.fingerprints, meme.fingerprints);
    const textScore = lexicalScore === null
      ? semanticScore
      : semanticScore === null ? lexicalScore : (lexicalScore + semanticScore) / 2;
    const visualScore = analysisAuthorized
      ? maxHashSimilarity(input.fingerprints, meme.fingerprints, new Set(["PHASH", "FRAME_PHASH"]))
      : null;
    const audioScore = analysisAuthorized && input.fingerprints.some((item) => item.fingerprint_type === "AUDIO")
      && meme.fingerprints.some((item) => item.fingerprint_type === "AUDIO")
      ? (hasExactHash(input.fingerprints, meme.fingerprints, "AUDIO") ? 1 : 0)
      : null;
    const metadataScore = metadataSimilarity(input.source, meme.sources);
    const titleHashtagsScore = koreanTextSimilarity(
      [input.title, input.source?.title].filter(Boolean).join(" "),
      [meme.title, ...meme.aliases].join(" "),
    );
    const exactDuplicate = Boolean(input.source && meme.sources.some((source) => source.id === input.source!.id
      || (Boolean(input.source!.external_id)
        && source.platform === input.source!.platform
        && source.external_id === input.source!.external_id)))
      || (analysisAuthorized && hasExactHash(input.fingerprints, meme.fingerprints, "SHA256"));
    const scored = scoreCandidate({
      exactDuplicate,
      signals: {
        text: { value: textScore },
        visual: { value: visualScore, authorized: analysisAuthorized },
        audio: { value: audioScore, authorized: analysisAuthorized },
        metadata: { value: metadataScore },
        titleHashtags: { value: titleHashtagsScore },
      },
    });
    return {
      candidate_id: input.candidateId,
      meme_id: meme.id,
      rank: searchRank,
      overall_score: scored.score,
      text_score: textScore,
      visual_score: visualScore,
      audio_score: audioScore,
      classification: scored.relation.toUpperCase() as Uppercase<CandidateRelation>,
      evidence_json: {
        metadataScore,
        titleHashtagsScore,
        availableSignals: scored.availableSignals,
        contributions: scored.contributions,
        exactDuplicate,
      },
    };
  }).sort((left, right) => right.overall_score - left.overall_score || left.rank - right.rank)
    .slice(0, 5)
    .map((match, index) => ({ ...match, rank: index + 1 }));
}

export function discoverHashCandidateIds(
  current: Fingerprint[],
  candidates: FingerprintCandidate[],
  previous: Array<Fingerprint & { ingestion_id: string }>,
): string[] {
  const scores = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate.target_meme_id) continue;
    const fingerprints = previous.filter((item) => item.ingestion_id === candidate.ingestion_id);
    const exact = hasExactHash(current, fingerprints, "SHA256");
    const visual = maxHashSimilarity(current, fingerprints, new Set(["PHASH", "FRAME_PHASH"]));
    const score = exact ? 1 : visual ?? 0;
    if (score >= 0.65) scores.set(candidate.target_meme_id, Math.max(score, scores.get(candidate.target_meme_id) ?? 0));
  }
  return [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 25)
    .map(([memeId]) => memeId);
}

async function requireOperator(client: MpeClient) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new MpeCandidateError("signed_out", 401);
  if (!(await isOperator(client))) throw new MpeCandidateError("operator_required", 403);
  return user;
}

function throwDb(error: { message: string } | null, fallback: string) {
  if (error) throw new MpeCandidateError(`${fallback}: ${error.message}`);
}

export async function createCandidateFromIngestion(input: {
  ingestionId: string;
  title: string;
  memeType: string;
}, providedClient?: MpeClient, providedAdmin?: AdminClient) {
  const client = providedClient ?? await createClient();
  const user = await requireOperator(client);
  const admin = providedAdmin ?? createAdminClient();
  const { data: ingestion, error: ingestionError } = await client
    .from("media_ingestions")
    .select("id, media_kind")
    .eq("id", input.ingestionId)
    .single();
  if (ingestionError || !ingestion) throw new MpeCandidateError("ingestion_not_found", 404);
  const { data: jobs, error: jobsError } = await client
    .from("processing_jobs")
    .select("job_type, status, processor_version, error_code, output_json")
    .eq("ingestion_id", ingestion.id);
  throwDb(jobsError, "processing_jobs_load_failed");
  validateCandidateJobs(ingestion.media_kind, jobs ?? []);

  const { data: existing, error: existingError } = await client
    .from("meme_candidates")
    .select("*")
    .eq("ingestion_id", ingestion.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  throwDb(existingError, "candidate_lookup_failed");
  if (existing) return { candidate: existing, created: false };

  const { data: candidate, error: insertError } = await admin.from("meme_candidates").insert({
    ingestion_id: ingestion.id,
    title: input.title,
    meme_type: input.memeType,
    review_status: "FACT_CHECKING",
    draft_json: {},
    created_by: user.id,
    model_version: MPE_CANDIDATE_MODEL_VERSION,
    prompt_version: MPE_CANDIDATE_PROMPT_VERSION,
  }).select("*").single();
  throwDb(insertError, "candidate_create_failed");
  if (!candidate) throw new MpeCandidateError("candidate_create_failed");
  return { candidate, created: true };
}

export async function generateCandidateMatches(candidateId: string, providedClient?: MpeClient, providedAdmin?: AdminClient) {
  const client = providedClient ?? await createClient();
  await requireOperator(client);
  const admin = providedAdmin ?? createAdminClient();
  const { data: candidate, error: candidateError } = await client
    .from("meme_candidates")
    .select("id, ingestion_id, title")
    .eq("id", candidateId)
    .single();
  if (candidateError || !candidate) throw new MpeCandidateError("candidate_not_found", 404);

  const { data: ingestion, error: ingestionError } = await client
    .from("media_ingestions")
    .select("id, source_id, ingest_mode")
    .eq("id", candidate.ingestion_id)
    .single();
  throwDb(ingestionError, "ingestion_load_failed");
  if (!ingestion) throw new MpeCandidateError("ingestion_not_found", 404);

  const [{ data: source, error: sourceError }, { data: segments, error: segmentError }, { data: fingerprints, error: fingerprintError }] = await Promise.all([
    ingestion.source_id
      ? client.from("media_sources").select("id, platform, external_id, channel_name, title").eq("id", ingestion.source_id).single()
      : Promise.resolve({ data: null, error: null }),
    client.from("text_segments").select("raw_text, normalized_text, origin").eq("ingestion_id", ingestion.id).neq("origin", "STT"),
    client.from("media_fingerprints").select("fingerprint_type, hash_value, embedding").eq("ingestion_id", ingestion.id),
  ]);
  throwDb(sourceError, "source_load_failed");
  throwDb(segmentError, "segment_load_failed");
  throwDb(fingerprintError, "fingerprint_load_failed");
  const currentSegments = withoutSttSegments(segments ?? []);
  const query = [candidate.title, ...currentSegments.map((item) => item.normalized_text || item.raw_text)].join(" ").trim();
  const normalizedQuery = normalizeKoreanText(query);
  const embeddingFingerprint: Fingerprint = {
    fingerprint_type: "TEXT_EMBEDDING",
    hash_value: createHash("sha256").update(normalizedQuery).digest("hex"),
    embedding: deterministicTextEmbedding(normalizedQuery),
  };
  const { error: oldEmbeddingError } = await admin.from("media_fingerprints").delete()
    .eq("ingestion_id", ingestion.id)
    .eq("fingerprint_type", "TEXT_EMBEDDING");
  throwDb(oldEmbeddingError, "text_embedding_replace_failed");
  const { error: embeddingInsertError } = await admin.from("media_fingerprints").insert({
    ingestion_id: ingestion.id,
    ...embeddingFingerprint,
    frame_ms: null,
    processor_version: MPE_TEXT_EMBEDDING_VERSION,
  });
  throwDb(embeddingInsertError, "text_embedding_save_failed");
  const currentFingerprints = [
    ...(fingerprints ?? []).filter((item) => item.fingerprint_type !== "TEXT_EMBEDDING"),
    embeddingFingerprint,
  ];

  const { data: searched, error: searchError } = await client.rpc("search_memes", { p_query: query, p_limit: 25 });
  throwDb(searchError, "candidate_search_failed");
  const { data: allPreviousCandidates, error: allPreviousCandidateError } = await client
    .from("meme_candidates")
    .select("ingestion_id, target_meme_id")
    .not("target_meme_id", "is", null);
  throwDb(allPreviousCandidateError, "hash_candidate_load_failed");
  const allPreviousIngestionIds = (allPreviousCandidates ?? []).map((item) => item.ingestion_id);
  const { data: hashFingerprints, error: hashFingerprintError } = allPreviousIngestionIds.length
    ? await client.from("media_fingerprints")
      .select("ingestion_id, fingerprint_type, hash_value")
      .in("ingestion_id", allPreviousIngestionIds)
      .in("fingerprint_type", ["SHA256", "PHASH", "FRAME_PHASH"])
    : { data: [], error: null };
  throwDb(hashFingerprintError, "hash_candidate_fingerprint_load_failed");
  const hashMemeIds = discoverHashCandidateIds(currentFingerprints, allPreviousCandidates ?? [], hashFingerprints ?? []);
  const searchedMemes = (searched ?? []) as RankedMeme[];
  const searchedIds = new Set(searchedMemes.map((meme) => meme.id));
  const missingHashIds = hashMemeIds.filter((id) => !searchedIds.has(id));
  const { data: hashMemes, error: hashMemeError } = missingHashIds.length
    ? await client.from("memes").select("id, title, aliases, summary, description").in("id", missingHashIds)
    : { data: [], error: null };
  throwDb(hashMemeError, "hash_candidate_meme_load_failed");
  const memes = [...searchedMemes, ...((hashMemes ?? []) as RankedMeme[])];
  const memeIds = memes.map((meme) => meme.id);
  const previousCandidates = (allPreviousCandidates ?? []).filter((item) => item.target_meme_id && memeIds.includes(item.target_meme_id));
  const ingestionIds = (previousCandidates ?? []).map((item) => item.ingestion_id);
  const { data: previousIngestions, error: previousIngestionError } = ingestionIds.length
    ? await client.from("media_ingestions").select("id, source_id").in("id", ingestionIds)
    : { data: [], error: null };
  throwDb(previousIngestionError, "candidate_ingestion_load_failed");
  const sourceIds = (previousIngestions ?? []).flatMap((item) => item.source_id ? [item.source_id] : []);
  const [{ data: previousSources, error: previousSourceError }, { data: previousSegments, error: previousSegmentError }, { data: previousFingerprints, error: previousFingerprintError }] = await Promise.all([
    sourceIds.length ? client.from("media_sources").select("id, platform, external_id, channel_name, title").in("id", sourceIds) : Promise.resolve({ data: [], error: null }),
    ingestionIds.length ? client.from("text_segments").select("ingestion_id, raw_text, normalized_text, origin").in("ingestion_id", ingestionIds).neq("origin", "STT") : Promise.resolve({ data: [], error: null }),
    ingestionIds.length ? client.from("media_fingerprints").select("ingestion_id, fingerprint_type, hash_value, embedding").in("ingestion_id", ingestionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  throwDb(previousSourceError, "candidate_source_load_failed");
  throwDb(previousSegmentError, "candidate_text_load_failed");
  throwDb(previousFingerprintError, "candidate_fingerprint_load_failed");

  const matches = rankCandidateMatches({
    candidateId,
    title: candidate.title,
    rightsMode: ingestion.ingest_mode,
    source,
    text: currentSegments.map((item) => item.normalized_text || item.raw_text),
    fingerprints: currentFingerprints,
    memes: memes.map((meme) => {
      const ids = new Set((previousCandidates ?? []).filter((item) => item.target_meme_id === meme.id).map((item) => item.ingestion_id));
      const sources = new Set((previousIngestions ?? []).filter((item) => ids.has(item.id)).flatMap((item) => item.source_id ? [item.source_id] : []));
      return {
        ...meme,
        sources: (previousSources ?? []).filter((item) => sources.has(item.id)),
        text: withoutSttSegments(previousSegments ?? []).filter((item) => ids.has(item.ingestion_id)).map((item) => item.normalized_text || item.raw_text),
        fingerprints: (previousFingerprints ?? []).filter((item) => ids.has(item.ingestion_id)),
      };
    }),
  });

  const { data: savedMatches, error: replaceError } = await client.rpc("replace_mpe_candidate_matches", {
    p_candidate_id: candidateId,
    p_matches: matches.map((match) => ({
      meme_id: match.meme_id,
      rank: match.rank,
      overall_score: match.overall_score,
      text_score: match.text_score,
      visual_score: match.visual_score,
      audio_score: match.audio_score,
      classification: match.classification,
      evidence_json: match.evidence_json,
    })),
  });
  throwDb(replaceError, "candidate_match_replace_failed");
  return savedMatches ?? [];
}

export async function listCandidateMatches(candidateId: string, providedClient?: MpeClient) {
  const client = providedClient ?? await createClient();
  await requireOperator(client);
  const { data, error } = await client.from("candidate_matches").select("*").eq("candidate_id", candidateId).order("rank");
  throwDb(error, "candidate_match_list_failed");
  return data ?? [];
}

export async function discardCreatedCandidate(candidateId: string, providedClient?: MpeClient, providedAdmin?: AdminClient) {
  const client = providedClient ?? await createClient();
  await requireOperator(client);
  const admin = providedAdmin ?? createAdminClient();
  const { error } = await admin.from("meme_candidates").delete().eq("id", candidateId);
  throwDb(error, "candidate_cleanup_failed");
}
