import assert from "node:assert/strict";
import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LOCAL_TTS_IDENTITY, validateLocalCandidatePreparation } from "./video-production-local-candidate.mjs";
import { prepareLocalNarration } from "./video-production-narration-local.mjs";

function candidate(overrides = {}) {
  return { id: "candidate-1", title: "로컬 내레이션 후보", sources: [
    { id: "source-1", title: "검토 출처", url: "https://example.test/source", approved: true },
  ], ...overrides };
}

function script(overrides = {}) {
  const scenes = Array.from({ length: 5 }, (_, index) => ({
    id: `scene-${index + 1}`,
    kind: ["hook", "meaning", "example", "context", "caution"][index],
    heading: `장면 ${index + 1}`,
    caption: index === 2 ? "자체 작성한 가상 예시입니다" : `설명 ${index + 1}`,
    narration: index === 2 ? "이 문장은 자체 작성한 가상 예시입니다." : `검토한 사실을 설명하는 정확한 문장 ${index + 1}입니다.`,
    start_ms: index * 6_000, end_ms: (index + 1) * 6_000,
    source_ids: index === 0 || index === 2 || index === 4 ? [] : ["source-1"],
  }));
  return { title: "로컬 내레이션 후보", description: "로컬 검토용 내레이션 후보 영상 설명입니다.",
    narration: scenes.map((scene) => scene.narration).join(" "),
    original_observation: "원본 미디어 없이 자체 그래픽만 사용하는 관찰입니다.", scenes,
    source_ids: ["source-1"], uncertain_claims: [], asset_requirements: [
      { kind: "voice", description: "로컬 합성 음성" }, { kind: "font", description: "검토 글꼴" },
      { kind: "graphic", description: "자체 그래픽" },
    ], contains_synthetic_media: true, ...overrides };
}

const health = (overrides = {}) => ({ ok: true, provider: LOCAL_TTS_IDENTITY.provider,
  backend: LOCAL_TTS_IDENTITY.backend, model: LOCAL_TTS_IDENTITY.model, model_path: LOCAL_TTS_IDENTITY.modelPath,
  pid: 12345, speaker: LOCAL_TTS_IDENTITY.speaker, language: LOCAL_TTS_IDENTITY.language,
  sample_rate: LOCAL_TTS_IDENTITY.sampleRate, ...overrides });

async function preparedFixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "memecatch-bound-candidate-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scriptPath = join(root, "script.json");
  const candidatePath = join(root, "candidate.json");
  const outputDir = join(root, "narration");
  await writeFile(scriptPath, `${JSON.stringify(options.script ?? script())}\n`);
  await writeFile(candidatePath, `${JSON.stringify(options.candidate ?? candidate())}\n`);
  const durations = [6_000, 6_000, 6_000, 6_000, 6_000];
  await prepareLocalNarration({ scriptPath, candidatePath, outputDir, voiceAssetId: "qwen3-sohee-preset-license-review" }, {
    synthesize: async ({ narration }) => Buffer.from(`WAV:${narration}`),
    inspect: async (path) => ({ formatName: "wav", hasAudio: true,
      durationMs: path.endsWith("narration.wav") ? 30_000 : durations[Number(path.match(/scene-(\d+)/u)?.[1]) - 1],
      audioCodec: "pcm_s16le" }),
    commandExecutor: async (_command, args) => writeFile(args.at(-1), "COMBINED", { flag: "wx" }),
    probeHealth: async () => options.health ?? health(),
    fingerprintModel: async () => options.fingerprint ?? ({
      modelFile: LOCAL_TTS_IDENTITY.modelFile, modelSha256: LOCAL_TTS_IDENTITY.modelSha256,
      tokenizerFile: LOCAL_TTS_IDENTITY.tokenizerFile, tokenizerSha256: LOCAL_TTS_IDENTITY.tokenizerSha256,
    }),
    now: () => new Date("2026-10-13T00:00:00Z"),
  });
  return { root, scriptPath, candidatePath, outputDir };
}

test("validates the exact candidate, scripts, scene WAVs, and voice identity", async (t) => {
  const paths = await preparedFixture(t);
  const result = await validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
    inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath,
    expectedVoiceAssetId: "qwen3-sohee-preset-license-review" });
  assert.equal(result.inputScript.title, result.candidate.title);
  assert.equal(result.preparation.modelFingerprint.modelSha256, LOCAL_TTS_IDENTITY.modelSha256);
  assert.equal(result.preparation.runtime.continuous, true);
});

test("rejects missing or mismatched provider, model, speaker, and fingerprint identity", async (t) => {
  for (const [field, value, expected] of [
    ["provider", "wrong-provider", /tts_runtime_identity_mismatch/],
    ["model", "wrong-model", /tts_runtime_identity_mismatch/],
    ["speaker", "wrong-speaker", /tts_runtime_identity_mismatch/],
  ]) {
    const paths = await preparedFixture(t);
    const evidencePath = join(paths.outputDir, "preparation-evidence.json");
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    evidence.runtime.after[field] = value;
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
      inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath }), expected);
  }
  const paths = await preparedFixture(t);
  const evidencePath = join(paths.outputDir, "preparation-evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  evidence.modelFingerprint.modelSha256 = "0".repeat(64);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
    inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath }), /tts_model_fingerprint_mismatch/);
});

test("rejects a swapped candidate or input script even when both parse", async (t) => {
  const paths = await preparedFixture(t);
  await writeFile(paths.candidatePath, `${JSON.stringify(candidate({ id: "candidate-2" }))}\n`);
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
    inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath }), /reviewed_candidate_hash_mismatch/);

  const second = await preparedFixture(t);
  const changed = script({ description: "바꿔 끼운 스크립트도 형식 자체는 유효하지만 준비 증거와 일치하지 않습니다." });
  await writeFile(second.scriptPath, `${JSON.stringify(changed)}\n`);
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: second.outputDir,
    inputScriptPath: second.scriptPath, candidatePath: second.candidatePath }), /input_script_hash_mismatch/);
});

test("rejects legacy preparation evidence without immutable fingerprints", async (t) => {
  const paths = await preparedFixture(t);
  const evidencePath = join(paths.outputDir, "preparation-evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  evidence.version = 1;
  delete evidence.modelFingerprint;
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
    inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath }), /preparation_fingerprint_required/);
});

test("rejects oversized sparse scene and combined WAV files before hashing", async (t) => {
  const scenePaths = await preparedFixture(t);
  const scene = await open(join(scenePaths.outputDir, "scene-01.wav"), "r+");
  await scene.truncate(20 * 1024 * 1024 + 1);
  await scene.close();
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: scenePaths.outputDir,
    inputScriptPath: scenePaths.scriptPath, candidatePath: scenePaths.candidatePath }), /scene_wav_size_invalid/);

  const combinedPaths = await preparedFixture(t);
  const combined = await open(join(combinedPaths.outputDir, "narration.wav"), "r+");
  await combined.truncate(256 * 1024 * 1024 + 1);
  await combined.close();
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: combinedPaths.outputDir,
    inputScriptPath: combinedPaths.scriptPath, candidatePath: combinedPaths.candidatePath }),
  /combined_narration_size_invalid/);
});

test("rejects oversized sparse candidate JSON before parsing", async (t) => {
  const paths = await preparedFixture(t);
  const candidateFile = await open(paths.candidatePath, "w");
  await candidateFile.truncate(512 * 1024 + 1);
  await candidateFile.close();
  await assert.rejects(validateLocalCandidatePreparation({ narrationDirectory: paths.outputDir,
    inputScriptPath: paths.scriptPath, candidatePath: paths.candidatePath }), /local_candidate_file_size_invalid/);
});
