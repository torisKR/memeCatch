import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { parseVideoScript } from "../lib/video-production/core.mjs";
import { inspectMedia } from "./mpe-media-worker.mjs";
import { hashBoundedRegularFile, LOCAL_TTS_IDENTITY, parseReviewedCandidateIdentity,
  readBoundedRegularFile } from "./video-production-local-candidate.mjs";
import { requestNarrationFromProvider } from "./video-production-worker.mjs";

const exec = promisify(execFile);
const TTS_TIMEOUT_MS = 300_000;
const FFMPEG_TIMEOUT_MS = 120_000;
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_CANDIDATE_BYTES = 512 * 1024;
const MAX_HEALTH_BYTES = 16 * 1024;
const MAX_MODEL_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_TOKENIZER_BYTES = 2 * 1024 * 1024 * 1024;
const MIN_DURATION_MS = 30_000;
const MAX_DURATION_MS = 45_000;
const MAX_COMBINED_DURATION_DRIFT_MS = 250;
const SAFE_VALUE = /^[^\r\n\0]{1,500}$/u;
const SAFE_CODE = /^[a-z0-9_:-]{1,100}$/iu;

export class LocalNarrationPreparationError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalNarrationPreparationError";
    this.code = code;
  }
}

function fail(code) {
  throw new LocalNarrationPreparationError(code);
}

function required(value, code) {
  if (typeof value !== "string" || !SAFE_VALUE.test(value.trim())) fail(code);
  return value.trim();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeCode(error) {
  const value = error?.code ?? error?.message;
  return typeof value === "string" && SAFE_CODE.test(value) ? value : "local_narration_preparation_failed";
}

function validateWaveInspection(metadata) {
  if (!metadata || metadata.hasAudio !== true || !Number.isInteger(metadata.durationMs) || metadata.durationMs <= 0
      || typeof metadata.formatName !== "string" || !metadata.formatName.split(",").includes("wav")) {
    fail("invalid_narration_wav");
  }
  return metadata.durationMs;
}

export function parseLocalNarrationArgs(argv) {
  if (!Array.isArray(argv)) fail("invalid_cli_arguments");
  const allowed = new Set(["--script", "--candidate", "--output-dir", "--voice-asset-id"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || values.has(flag) || typeof value !== "string" || value.startsWith("--")) {
      fail("invalid_cli_arguments");
    }
    values.set(flag, value);
  }
  if (values.size !== allowed.size) fail("invalid_cli_arguments");
  return Object.freeze({
    scriptPath: resolve(required(values.get("--script"), "script_path_required")),
    candidatePath: resolve(required(values.get("--candidate"), "candidate_path_required")),
    outputDir: resolve(required(values.get("--output-dir"), "output_directory_required")),
    voiceAssetId: required(values.get("--voice-asset-id"), "voice_asset_id_required"),
  });
}

async function defaultSynthesize({ narration, voiceAssetId }) {
  return requestNarrationFromProvider({
    provider: "toris-qwen",
    url: LOCAL_TTS_IDENTITY.endpoint,
    voiceAssetId,
    narration,
    model: LOCAL_TTS_IDENTITY.model,
    speaker: LOCAL_TTS_IDENTITY.speaker,
    language: LOCAL_TTS_IDENTITY.language,
    timeoutMs: TTS_TIMEOUT_MS,
  });
}

async function boundedResponseBytes(response, maximum) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) fail("tts_health_response_too_large");
  const reader = response.body?.getReader();
  if (!reader) fail("tts_health_response_invalid");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) fail("tts_health_response_too_large");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, size);
}

async function defaultProbeHealth() {
  let response;
  try {
    response = await fetch(LOCAL_TTS_IDENTITY.healthEndpoint, {
      method: "GET", redirect: "error", cache: "no-store",
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(5_000),
    });
  } catch {
    fail("tts_health_unavailable");
  }
  if (!response.ok || !/^application\/json\b/iu.test(response.headers.get("content-type") ?? "")) {
    fail("tts_health_response_invalid");
  }
  try {
    return JSON.parse((await boundedResponseBytes(response, MAX_HEALTH_BYTES)).toString("utf8"));
  } catch (error) {
    if (error instanceof LocalNarrationPreparationError) throw error;
    fail("tts_health_response_invalid");
  }
}

function normalizeHealth(value) {
  const expected = LOCAL_TTS_IDENTITY;
  if (!value || value.ok !== true || value.provider !== expected.provider || value.backend !== expected.backend
      || value.model !== expected.model || value.model_path !== expected.modelPath || value.speaker !== expected.speaker
      || value.language !== expected.language || value.sample_rate !== expected.sampleRate
      || !Number.isInteger(value.pid) || value.pid <= 0) fail("tts_runtime_identity_mismatch");
  return Object.freeze({
    ok: true,
    provider: value.provider,
    backend: value.backend,
    model: value.model,
    modelPath: value.model_path,
    pid: value.pid,
    speaker: value.speaker,
    preset: value.speaker,
    language: value.language,
    sampleRate: value.sample_rate,
  });
}

async function defaultFingerprintModel() {
  const modelPath = join(LOCAL_TTS_IDENTITY.modelPath, LOCAL_TTS_IDENTITY.modelFile);
  const tokenizerPath = join(LOCAL_TTS_IDENTITY.modelPath, LOCAL_TTS_IDENTITY.tokenizerFile);
  const [modelSha256, tokenizerSha256] = await Promise.all([
    hashBoundedRegularFile(modelPath, MAX_MODEL_BYTES, "tts_model_file_size_invalid"),
    hashBoundedRegularFile(tokenizerPath, MAX_TOKENIZER_BYTES, "tts_tokenizer_file_size_invalid"),
  ]);
  return Object.freeze({
    modelFile: LOCAL_TTS_IDENTITY.modelFile,
    modelSha256,
    tokenizerFile: LOCAL_TTS_IDENTITY.tokenizerFile,
    tokenizerSha256,
  });
}

function validateModelFingerprint(value) {
  const expected = LOCAL_TTS_IDENTITY;
  if (!value || value.modelFile !== expected.modelFile || value.modelSha256 !== expected.modelSha256
      || value.tokenizerFile !== expected.tokenizerFile || value.tokenizerSha256 !== expected.tokenizerSha256) {
    fail("tts_model_fingerprint_mismatch");
  }
  return Object.freeze({ ...value });
}

async function defaultCommandExecutor(command, args, options) {
  return exec(command, args, options);
}

export async function prepareLocalNarration({ scriptPath, candidatePath, outputDir, voiceAssetId }, dependencies = {}) {
  const inputPath = resolve(required(scriptPath, "script_path_required"));
  const reviewedCandidatePath = resolve(required(candidatePath, "candidate_path_required"));
  const destination = resolve(required(outputDir, "output_directory_required"));
  const reviewedVoiceAssetId = required(voiceAssetId, "voice_asset_id_required");
  const synthesize = dependencies.synthesize ?? defaultSynthesize;
  const inspect = dependencies.inspect ?? inspectMedia;
  const commandExecutor = dependencies.commandExecutor ?? defaultCommandExecutor;
  const probeHealth = dependencies.probeHealth ?? defaultProbeHealth;
  const fingerprintModel = dependencies.fingerprintModel ?? defaultFingerprintModel;
  const now = dependencies.now ?? (() => new Date());
  if (typeof synthesize !== "function" || typeof inspect !== "function" || typeof commandExecutor !== "function"
      || typeof probeHealth !== "function" || typeof fingerprintModel !== "function" || typeof now !== "function") {
    fail("invalid_dependencies");
  }
  try {
    await stat(destination);
    fail("output_directory_exists");
  } catch (error) {
    if (error instanceof LocalNarrationPreparationError) throw error;
    if (error?.code !== "ENOENT") fail("output_directory_check_failed");
  }

  let inputBytes;
  let candidateBytes;
  try {
    [inputBytes, candidateBytes] = await Promise.all([
      readBoundedRegularFile(inputPath, MAX_INPUT_BYTES),
      readBoundedRegularFile(reviewedCandidatePath, MAX_CANDIDATE_BYTES),
    ]);
  } catch {
    fail("candidate_input_read_failed");
  }
  let input;
  let candidate;
  try {
    input = JSON.parse(inputBytes.toString("utf8"));
    candidate = JSON.parse(candidateBytes.toString("utf8"));
  } catch {
    fail("invalid_candidate_input_json");
  }
  let candidateIdentity;
  try { candidateIdentity = parseReviewedCandidateIdentity(candidate); }
  catch { fail("invalid_reviewed_candidate"); }
  let script;
  try {
    script = parseVideoScript(input, { allowedSourceIds: candidateIdentity.sourceIds });
  } catch {
    fail("invalid_video_script");
  }
  if (script.title !== candidateIdentity.title || script.source_ids.length !== candidateIdentity.sourceIds.length
      || !script.source_ids.every((id) => candidateIdentity.sourceIds.includes(id))) fail("candidate_script_identity_mismatch");

  const modelFingerprint = validateModelFingerprint(await fingerprintModel());
  const healthBefore = normalizeHealth(await probeHealth());

  try {
    await mkdir(destination, { recursive: false, mode: 0o700 });
  } catch (error) {
    fail(error?.code === "EEXIST" ? "output_directory_exists" : "output_directory_create_failed");
  }

  const sceneEvidence = [];
  const measuredScenes = [];
  let cursorMs = 0;
  for (const [index, scene] of script.scenes.entries()) {
    let audio;
    try {
      audio = await synthesize({
        narration: scene.narration,
        voiceAssetId: reviewedVoiceAssetId,
        provider: "toris-qwen",
        url: LOCAL_TTS_IDENTITY.endpoint,
        model: LOCAL_TTS_IDENTITY.model,
        speaker: LOCAL_TTS_IDENTITY.speaker,
        language: LOCAL_TTS_IDENTITY.language,
        timeoutMs: TTS_TIMEOUT_MS,
      });
    } catch (error) {
      throw new LocalNarrationPreparationError(safeCode(error));
    }
    const bytes = Buffer.from(audio);
    if (bytes.byteLength === 0) fail("empty_narration_wav");
    const file = `scene-${String(index + 1).padStart(2, "0")}.wav`;
    const path = join(destination, file);
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
    let metadata;
    try {
      metadata = await inspect(path);
    } catch {
      fail("narration_wav_inspection_failed");
    }
    const durationMs = validateWaveInspection(metadata);
    const startMs = cursorMs;
    cursorMs += durationMs;
    measuredScenes.push({ ...scene, start_ms: startMs, end_ms: cursorMs });
    sceneEvidence.push(Object.freeze({
      sceneId: scene.id,
      file,
      narrationSha256: sha256(Buffer.from(scene.narration, "utf8")),
      wavSha256: sha256(bytes),
      durationMs,
      startMs,
      endMs: cursorMs,
    }));
  }

  const healthAfter = normalizeHealth(await probeHealth());
  if (JSON.stringify(healthBefore) !== JSON.stringify(healthAfter)) fail("tts_runtime_session_changed");
  const runtimeSessionId = sha256(Buffer.from(JSON.stringify(healthBefore), "utf8"));

  if (cursorMs < MIN_DURATION_MS || cursorMs > MAX_DURATION_MS) fail("measured_narration_duration_out_of_range");

  let measuredScript;
  try {
    measuredScript = parseVideoScript({ ...script, scenes: measuredScenes });
  } catch {
    fail("measured_script_invalid");
  }
  const measuredScriptBytes = jsonBytes(measuredScript);
  const measuredScriptPath = join(destination, "measured-script.json");
  await writeFile(measuredScriptPath, measuredScriptBytes, { flag: "wx", mode: 0o600 });

  const narrationPath = join(destination, "narration.wav");
  const inputArgs = sceneEvidence.flatMap(({ file }) => ["-i", join(destination, file)]);
  const concatInputs = sceneEvidence.map((_, index) => `[${index}:a:0]`).join("");
  const ffmpegArgs = [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-n",
    ...inputArgs,
    "-filter_complex", `${concatInputs}concat=n=${sceneEvidence.length}:v=0:a=1[outa]`,
    "-map", "[outa]", "-vn", "-c:a", "pcm_s16le", narrationPath,
  ];
  try {
    await commandExecutor("ffmpeg", ffmpegArgs, {
      timeout: FFMPEG_TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    fail("narration_concat_failed");
  }

  let combinedMetadata;
  try {
    combinedMetadata = await inspect(narrationPath);
  } catch {
    fail("combined_narration_inspection_failed");
  }
  const combinedDurationMs = validateWaveInspection(combinedMetadata);
  if (Math.abs(combinedDurationMs - cursorMs) > MAX_COMBINED_DURATION_DRIFT_MS) {
    fail("combined_narration_duration_mismatch");
  }
  const narrationSha256 = await hashBoundedRegularFile(narrationPath, 256 * 1024 * 1024,
    "combined_narration_size_invalid");
  const createdAt = now();
  if (!(createdAt instanceof Date) || !Number.isFinite(createdAt.valueOf())) fail("invalid_evidence_time");

  const evidence = Object.freeze({
    version: 2,
    kind: "local_narration_candidate",
    createdAt: createdAt.toISOString(),
    provider: Object.freeze({
      name: "toris-qwen",
      provider: LOCAL_TTS_IDENTITY.provider,
      backend: LOCAL_TTS_IDENTITY.backend,
      endpoint: LOCAL_TTS_IDENTITY.endpoint,
      model: LOCAL_TTS_IDENTITY.model,
      modelPath: LOCAL_TTS_IDENTITY.modelPath,
      speaker: LOCAL_TTS_IDENTITY.speaker,
      preset: LOCAL_TTS_IDENTITY.preset,
      language: LOCAL_TTS_IDENTITY.language,
      sampleRate: LOCAL_TTS_IDENTITY.sampleRate,
    }),
    modelFingerprint,
    runtime: Object.freeze({
      healthEndpoint: LOCAL_TTS_IDENTITY.healthEndpoint,
      before: healthBefore,
      after: healthAfter,
      sessionId: runtimeSessionId,
      continuous: true,
    }),
    voiceAsset: Object.freeze({
      id: reviewedVoiceAssetId,
      role: "input_identity_only",
      rightsProof: false,
    }),
    inputScript: Object.freeze({ file: basename(inputPath), sha256: sha256(inputBytes) }),
    reviewedCandidate: Object.freeze({
      file: basename(reviewedCandidatePath),
      id: candidateIdentity.id,
      title: candidateIdentity.title,
      sourceIds: candidateIdentity.sourceIds,
      sha256: sha256(candidateBytes),
    }),
    scenes: Object.freeze(sceneEvidence),
    measuredScript: Object.freeze({ file: "measured-script.json", sha256: sha256(measuredScriptBytes) }),
    narration: Object.freeze({
      file: "narration.wav",
      sha256: narrationSha256,
      durationMs: combinedDurationMs,
      codec: combinedMetadata.audioCodec ?? "pcm_s16le",
    }),
    operatorReviewRequired: true,
    uploadConsent: false,
    publicationApproval: false,
    assetRightsApproved: false,
    productionApproved: false,
  });
  const evidenceBytes = jsonBytes(evidence);
  await writeFile(join(destination, "preparation-evidence.json"), evidenceBytes, { flag: "wx", mode: 0o600 });
  return evidence;
}

async function main() {
  const options = parseLocalNarrationArgs(process.argv.slice(2));
  const result = await prepareLocalNarration(options);
  console.log(JSON.stringify({
    outputDirectory: options.outputDir,
    durationMs: result.narration.durationMs,
    operatorReviewRequired: result.operatorReviewRequired,
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(safeCode(error));
    process.exitCode = 1;
  });
}
