import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { parseVideoScript } from "../lib/video-production/core.mjs";

export const LOCAL_TTS_IDENTITY = Object.freeze({
  provider: "qwen3-tts-mlx",
  backend: "mlx",
  endpoint: "http://127.0.0.1:50010/synthesize",
  healthEndpoint: "http://127.0.0.1:50010/health",
  model: "model",
  modelPath: "/Users/toris/.local/share/toris-studio/qwen3-tts-mlx/model",
  speaker: "Sohee",
  preset: "Sohee",
  language: "Korean",
  sampleRate: 24_000,
  modelFile: "model.safetensors",
  modelSha256: "b696f4bf45f54497b6de758981e76f1410bd68af05a657477dee466b0202df1a",
  tokenizerFile: "speech_tokenizer/model.safetensors",
  tokenizerSha256: "836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258",
});

const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_JSON_BYTES = 512 * 1024;
const MAX_SCENE_WAV_BYTES = 20 * 1024 * 1024;
const MAX_COMBINED_WAV_BYTES = 256 * 1024 * 1024;

export class LocalCandidateValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalCandidateValidationError";
    this.code = code;
  }
}

function fail(code) {
  throw new LocalCandidateValidationError(code);
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function regularBounded(metadata, maximum, code) {
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maximum) fail(code);
}

function sameFileState(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size
    && before.mtimeMs === after.mtimeMs;
}

export async function readBoundedRegularFile(path, maximum = MAX_JSON_BYTES) {
  let handle;
  try {
    handle = await open(path, "r");
    const before = await handle.stat();
    regularBounded(before, maximum, "local_candidate_file_size_invalid");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (bytes.byteLength !== before.size || !sameFileState(before, after)) fail("local_candidate_file_changed_during_read");
    return bytes;
  } catch (error) {
    if (error instanceof LocalCandidateValidationError) throw error;
    fail("local_candidate_file_read_failed");
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function hashBoundedRegularFile(path, maximum, sizeCode = "local_candidate_artifact_size_invalid") {
  let handle;
  try {
    handle = await open(path, "r");
    const before = await handle.stat();
    regularBounded(before, maximum, sizeCode);
    const digest = createHash("sha256");
    let observed = 0;
    const stream = handle.createReadStream({ autoClose: false, highWaterMark: 1024 * 1024 });
    for await (const chunk of stream) {
      observed += chunk.byteLength;
      if (observed > maximum) fail(sizeCode);
      digest.update(chunk);
    }
    const after = await handle.stat();
    if (observed !== before.size || !sameFileState(before, after)) fail("local_candidate_artifact_changed_during_hash");
    return digest.digest("hex");
  } catch (error) {
    if (error instanceof LocalCandidateValidationError) throw error;
    fail("local_candidate_artifact_read_failed");
  } finally {
    await handle?.close().catch(() => {});
  }
}

function parseJson(bytes, code) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(code);
  }
}

export function parseReviewedCandidateIdentity(candidate) {
  if (!candidate || typeof candidate !== "object" || typeof candidate.id !== "string" || !candidate.id.trim()
      || typeof candidate.title !== "string" || !candidate.title.trim() || !Array.isArray(candidate.sources)
      || candidate.sources.length === 0) fail("reviewed_candidate_invalid");
  const sourceIds = candidate.sources.map((source) => {
    if (!source || typeof source !== "object" || typeof source.id !== "string" || !source.id.trim()
        || source.approved !== true) fail("reviewed_candidate_source_invalid");
    return source.id.trim();
  });
  if (new Set(sourceIds).size !== sourceIds.length) fail("reviewed_candidate_source_invalid");
  return Object.freeze({ id: candidate.id.trim(), title: candidate.title.trim(), sourceIds: Object.freeze(sourceIds) });
}

function equalStringSets(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function withoutTiming(script) {
  return {
    ...script,
    scenes: script.scenes.map((scene) => {
      const content = { ...scene };
      delete content.start_ms;
      delete content.end_ms;
      return content;
    }),
  };
}

function validateRuntimeIdentity(runtime) {
  const expected = LOCAL_TTS_IDENTITY;
  if (!runtime || runtime.healthEndpoint !== expected.healthEndpoint || runtime.continuous !== true
      || typeof runtime.sessionId !== "string" || !SHA256.test(runtime.sessionId)) fail("tts_runtime_identity_missing");
  for (const observation of [runtime.before, runtime.after]) {
    if (!observation || observation.ok !== true || observation.provider !== expected.provider
        || observation.backend !== expected.backend || observation.model !== expected.model
        || observation.modelPath !== expected.modelPath || observation.speaker !== expected.speaker
        || observation.preset !== expected.preset || observation.language !== expected.language
        || observation.sampleRate !== expected.sampleRate || !Number.isInteger(observation.pid) || observation.pid <= 0) {
      fail("tts_runtime_identity_mismatch");
    }
  }
  if (runtime.before.pid !== runtime.after.pid) fail("tts_runtime_session_changed");
  if (runtime.sessionId !== hash(Buffer.from(JSON.stringify(runtime.before), "utf8"))) {
    fail("tts_runtime_session_mismatch");
  }
}

function validateProviderIdentity(provider) {
  const expected = LOCAL_TTS_IDENTITY;
  if (!provider || provider.name !== "toris-qwen" || provider.provider !== expected.provider
      || provider.backend !== expected.backend || provider.endpoint !== expected.endpoint
      || provider.model !== expected.model || provider.modelPath !== expected.modelPath
      || provider.speaker !== expected.speaker || provider.preset !== expected.preset
      || provider.language !== expected.language || provider.sampleRate !== expected.sampleRate) {
    fail("tts_provider_identity_mismatch");
  }
}

function validateModelFingerprint(fingerprint) {
  const expected = LOCAL_TTS_IDENTITY;
  if (!fingerprint || fingerprint.modelFile !== expected.modelFile
      || fingerprint.modelSha256 !== expected.modelSha256
      || fingerprint.tokenizerFile !== expected.tokenizerFile
      || fingerprint.tokenizerSha256 !== expected.tokenizerSha256) fail("tts_model_fingerprint_mismatch");
}

export async function validateLocalCandidatePreparation({ narrationDirectory, inputScriptPath, candidatePath,
  expectedVoiceAssetId }) {
  const directory = resolve(narrationDirectory);
  const inputPath = resolve(inputScriptPath);
  const reviewedCandidatePath = resolve(candidatePath);
  const [preparationBytes, inputBytes, candidateBytes, measuredBytes] = await Promise.all([
    readBoundedRegularFile(join(directory, "preparation-evidence.json")),
    readBoundedRegularFile(inputPath),
    readBoundedRegularFile(reviewedCandidatePath),
    readBoundedRegularFile(join(directory, "measured-script.json")),
  ]);
  const preparation = parseJson(preparationBytes, "preparation_evidence_invalid");
  const input = parseJson(inputBytes, "input_script_invalid");
  const candidate = parseJson(candidateBytes, "reviewed_candidate_invalid");
  const measured = parseJson(measuredBytes, "measured_script_invalid");
  const identity = parseReviewedCandidateIdentity(candidate);

  if (preparation?.version !== 2 || preparation.kind !== "local_narration_candidate") {
    fail("preparation_fingerprint_required");
  }
  if (preparation.operatorReviewRequired !== true || preparation.uploadConsent !== false
      || preparation.publicationApproval !== false || preparation.assetRightsApproved !== false
      || preparation.productionApproved !== false) fail("preparation_approval_state_invalid");
  validateProviderIdentity(preparation.provider);
  validateModelFingerprint(preparation.modelFingerprint);
  validateRuntimeIdentity(preparation.runtime);
  if (!preparation.voiceAsset || preparation.voiceAsset.role !== "input_identity_only"
      || preparation.voiceAsset.rightsProof !== false || typeof preparation.voiceAsset.id !== "string"
      || !preparation.voiceAsset.id) fail("voice_asset_identity_invalid");
  if (expectedVoiceAssetId && preparation.voiceAsset.id !== expectedVoiceAssetId) fail("voice_asset_identity_mismatch");

  if (preparation.inputScript?.file !== basename(inputPath) || preparation.inputScript.sha256 !== hash(inputBytes)) {
    fail("input_script_hash_mismatch");
  }
  if (preparation.reviewedCandidate?.file !== basename(reviewedCandidatePath)
      || preparation.reviewedCandidate.sha256 !== hash(candidateBytes)
      || preparation.reviewedCandidate.id !== identity.id || preparation.reviewedCandidate.title !== identity.title
      || !equalStringSets(preparation.reviewedCandidate.sourceIds ?? [], identity.sourceIds)) {
    fail("reviewed_candidate_hash_mismatch");
  }
  if (preparation.measuredScript?.file !== "measured-script.json"
      || preparation.measuredScript.sha256 !== hash(measuredBytes)) fail("measured_script_hash_mismatch");

  let inputScript;
  let measuredScript;
  try {
    inputScript = parseVideoScript(input, { allowedSourceIds: identity.sourceIds });
    measuredScript = parseVideoScript(measured, { allowedSourceIds: identity.sourceIds });
  } catch {
    fail("bound_video_script_invalid");
  }
  if (inputScript.title !== identity.title || measuredScript.title !== identity.title
      || !equalStringSets(inputScript.source_ids, identity.sourceIds)
      || !equalStringSets(measuredScript.source_ids, identity.sourceIds)) fail("candidate_script_identity_mismatch");
  if (JSON.stringify(withoutTiming(inputScript)) !== JSON.stringify(withoutTiming(measuredScript))) {
    fail("measured_script_content_mismatch");
  }

  if (!Array.isArray(preparation.scenes) || preparation.scenes.length !== measuredScript.scenes.length) {
    fail("scene_evidence_mismatch");
  }
  for (const [index, scene] of measuredScript.scenes.entries()) {
    const evidence = preparation.scenes[index];
    const expectedFile = `scene-${String(index + 1).padStart(2, "0")}.wav`;
    if (!evidence || evidence.sceneId !== scene.id || evidence.file !== expectedFile
        || evidence.narrationSha256 !== hash(Buffer.from(scene.narration, "utf8"))
        || evidence.startMs !== scene.start_ms || evidence.endMs !== scene.end_ms
        || evidence.durationMs !== scene.end_ms - scene.start_ms) fail("scene_evidence_mismatch");
    const sceneHash = await hashBoundedRegularFile(join(directory, expectedFile), MAX_SCENE_WAV_BYTES,
      "scene_wav_size_invalid");
    if (evidence.wavSha256 !== sceneHash) fail("scene_wav_hash_mismatch");
  }
  const narrationHash = await hashBoundedRegularFile(join(directory, "narration.wav"), MAX_COMBINED_WAV_BYTES,
    "combined_narration_size_invalid");
  if (!preparation.narration || preparation.narration.file !== "narration.wav"
      || preparation.narration.sha256 !== narrationHash
      || preparation.narration.durationMs !== measuredScript.scenes.at(-1).end_ms
      || preparation.narration.codec !== "pcm_s16le") {
    fail("combined_narration_evidence_mismatch");
  }

  return Object.freeze({
    preparation,
    preparationSha256: hash(preparationBytes),
    inputScript,
    inputScriptSha256: hash(inputBytes),
    measuredScript,
    measuredScriptSha256: hash(measuredBytes),
    candidate,
    candidateSha256: hash(candidateBytes),
    candidateIdentity: identity,
    narrationSha256: preparation.narration.sha256,
    voiceAssetId: preparation.voiceAsset.id,
  });
}
