import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import { LOCAL_TTS_IDENTITY } from "./video-production-local-candidate.mjs";
import { parseLocalNarrationArgs, prepareLocalNarration } from "./video-production-narration-local.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");

function script() {
  const scenes = Array.from({ length: 5 }, (_, index) => ({
    id: `scene-${index + 1}`,
    kind: ["hook", "meaning", "example", "context", "caution"][index],
    heading: `장면 ${index + 1}`,
    caption: index === 2 ? "자체 작성한 가상 예시입니다" : `설명 ${index + 1}`,
    narration: index === 2 ? "이 문장은 자체 작성한 가상 예시입니다." : `검토한 사실을 설명하는 정확한 문장 ${index + 1}입니다.`,
    start_ms: index * 6_000,
    end_ms: (index + 1) * 6_000,
    source_ids: index === 0 || index === 2 || index === 4 ? [] : ["source-1"],
  }));
  return {
    title: "로컬 내레이션 후보",
    description: "로컬에서 검토할 내레이션 후보를 만드는 테스트 영상입니다.",
    narration: scenes.map((scene) => scene.narration).join(" "),
    original_observation: "원본 미디어 대신 자체 제작 그래픽을 사용한다는 관찰 내용입니다.",
    scenes,
    source_ids: ["source-1"],
    uncertain_claims: [],
    asset_requirements: [
      { kind: "voice", description: "검토할 로컬 음성 후보" },
      { kind: "font", description: "별도 검토가 필요한 글꼴" },
      { kind: "graphic", description: "별도 검토가 필요한 자체 그래픽" },
    ],
    contains_synthetic_media: true,
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "memecatch-local-narration-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const scriptPath = join(root, "script.json");
  const candidatePath = join(root, "candidate.json");
  await writeFile(scriptPath, JSON.stringify(script()), "utf8");
  await writeFile(candidatePath, JSON.stringify({ id: "candidate-1", title: script().title,
    sources: [{ id: "source-1", title: "검토 출처", url: "https://example.test", approved: true }] }), "utf8");
  return { root, scriptPath, candidatePath, outputDir: join(root, "output") };
}

function dependencies({ durations = [6_000, 6_100, 6_200, 6_300, 6_400] } = {}) {
  const synthCalls = [];
  const commandCalls = [];
  const synthesize = async (input) => {
    synthCalls.push(input);
    return Buffer.from(`WAV:${input.narration}`, "utf8");
  };
  const inspect = async (path) => {
    if (basename(path) === "narration.wav") {
      return { formatName: "wav", hasAudio: true, durationMs: durations.reduce((sum, value) => sum + value, 0), audioCodec: "pcm_s16le" };
    }
    const index = Number(basename(path).slice(6, 8)) - 1;
    return { formatName: "wav", hasAudio: true, durationMs: durations[index], audioCodec: "pcm_s16le" };
  };
  const commandExecutor = async (command, args, options) => {
    commandCalls.push({ command, args, options });
    await writeFile(args.at(-1), Buffer.from("COMBINED_PCM_WAV"), { flag: "wx" });
  };
  return { synthCalls, commandCalls, synthesize, inspect, commandExecutor,
    probeHealth: async () => ({ ok: true, provider: LOCAL_TTS_IDENTITY.provider, backend: LOCAL_TTS_IDENTITY.backend,
      model: LOCAL_TTS_IDENTITY.model, model_path: LOCAL_TTS_IDENTITY.modelPath, pid: 12345,
      speaker: LOCAL_TTS_IDENTITY.speaker, language: LOCAL_TTS_IDENTITY.language,
      sample_rate: LOCAL_TTS_IDENTITY.sampleRate }),
    fingerprintModel: async () => ({ modelFile: LOCAL_TTS_IDENTITY.modelFile,
      modelSha256: LOCAL_TTS_IDENTITY.modelSha256, tokenizerFile: LOCAL_TTS_IDENTITY.tokenizerFile,
      tokenizerSha256: LOCAL_TTS_IDENTITY.tokenizerSha256 }),
    now: () => new Date("2026-10-13T00:00:00.000Z") };
}

test("prepares exact sequential scene narration and a measured contiguous timeline", async (t) => {
  const paths = await fixture(t);
  const deps = dependencies();
  const evidence = await prepareLocalNarration({ ...paths, voiceAssetId: "toris-sohee-local-v1" }, deps);
  const source = script();
  assert.deepEqual(deps.synthCalls.map((call) => call.narration), source.scenes.map((scene) => scene.narration));
  assert.equal(deps.synthCalls.every((call) => call.provider === "toris-qwen"
    && call.url === LOCAL_TTS_IDENTITY.endpoint && call.model === "model"
    && call.speaker === "Sohee" && call.language === "Korean"), true);
  const measured = JSON.parse(await readFile(join(paths.outputDir, "measured-script.json"), "utf8"));
  assert.deepEqual(measured.scenes.map(({ start_ms, end_ms }) => [start_ms, end_ms]),
    [[0, 6_000], [6_000, 12_100], [12_100, 18_300], [18_300, 24_600], [24_600, 31_000]]);
  assert.equal(measured.narration, source.narration);
  assert.equal(deps.commandCalls.length, 1);
  assert.equal(deps.commandCalls[0].command, "ffmpeg");
  assert.equal(deps.commandCalls[0].args.includes("pcm_s16le"), true);
  assert.equal(deps.commandCalls[0].args.includes("-n"), true);
  assert.equal(evidence.narration.durationMs, 31_000);
  assert.equal(evidence.version, 2);
  assert.equal(evidence.runtime.continuous, true);
  assert.equal(evidence.reviewedCandidate.id, "candidate-1");
});

test("writes real artifact hashes but never records approval or consent", async (t) => {
  const paths = await fixture(t);
  const deps = dependencies();
  const evidence = await prepareLocalNarration({ ...paths, voiceAssetId: "voice-input-identity" }, deps);
  const onDisk = JSON.parse(await readFile(join(paths.outputDir, "preparation-evidence.json"), "utf8"));
  assert.deepEqual(onDisk, evidence);
  assert.equal(evidence.operatorReviewRequired, true);
  assert.equal(evidence.uploadConsent, false);
  assert.equal(evidence.publicationApproval, false);
  assert.equal(evidence.assetRightsApproved, false);
  assert.equal(evidence.productionApproved, false);
  assert.deepEqual(evidence.voiceAsset, { id: "voice-input-identity", role: "input_identity_only", rightsProof: false });
  assert.equal(evidence.modelFingerprint.modelSha256, LOCAL_TTS_IDENTITY.modelSha256);
  assert.equal(evidence.narration.sha256, hash(await readFile(join(paths.outputDir, "narration.wav"))));
  for (const scene of evidence.scenes) {
    assert.equal(scene.wavSha256, hash(await readFile(join(paths.outputDir, scene.file))));
  }
});

test("rejects measured duration outside 30-45 seconds before final ffmpeg render", async (t) => {
  const paths = await fixture(t);
  const deps = dependencies({ durations: [5_000, 5_000, 5_000, 5_000, 5_000] });
  await assert.rejects(
    prepareLocalNarration({ ...paths, voiceAssetId: "voice-input-identity" }, deps),
    /measured_narration_duration_out_of_range/,
  );
  assert.equal(deps.synthCalls.length, 5);
  assert.equal(deps.commandCalls.length, 0);
});

test("requires a fresh output directory and does not synthesize when it exists", async (t) => {
  const paths = await fixture(t);
  await mkdir(paths.outputDir);
  const deps = dependencies();
  await assert.rejects(
    prepareLocalNarration({ ...paths, voiceAssetId: "voice-input-identity" }, deps),
    /output_directory_exists/,
  );
  assert.equal(deps.synthCalls.length, 0);
});

test("CLI exposes no generic or remote narration URL option", () => {
  assert.throws(() => parseLocalNarrationArgs([
    "--script", "script.json", "--candidate", "candidate.json", "--output-dir", "output",
    "--voice-asset-id", "voice", "--url", "https://example.test",
  ]), /invalid_cli_arguments/);
  const parsed = parseLocalNarrationArgs([
    "--script", "script.json", "--candidate", "candidate.json", "--output-dir", "output", "--voice-asset-id", "voice",
  ]);
  assert.equal(parsed.voiceAssetId, "voice");
});

test("rejects runtime identity changes and model fingerprint mismatches before rendering", async (t) => {
  const changedRuntime = await fixture(t);
  const runtimeDeps = dependencies();
  let probes = 0;
  runtimeDeps.probeHealth = async () => ({ ok: true, provider: LOCAL_TTS_IDENTITY.provider,
    backend: LOCAL_TTS_IDENTITY.backend, model: LOCAL_TTS_IDENTITY.model, model_path: LOCAL_TTS_IDENTITY.modelPath,
    pid: probes++ === 0 ? 12345 : 54321, speaker: LOCAL_TTS_IDENTITY.speaker,
    language: LOCAL_TTS_IDENTITY.language, sample_rate: LOCAL_TTS_IDENTITY.sampleRate });
  await assert.rejects(prepareLocalNarration({ ...changedRuntime, voiceAssetId: "voice" }, runtimeDeps),
    /tts_runtime_session_changed/);
  assert.equal(runtimeDeps.commandCalls.length, 0);

  const badFingerprint = await fixture(t);
  const fingerprintDeps = dependencies();
  fingerprintDeps.fingerprintModel = async () => ({ modelFile: LOCAL_TTS_IDENTITY.modelFile,
    modelSha256: "0".repeat(64), tokenizerFile: LOCAL_TTS_IDENTITY.tokenizerFile,
    tokenizerSha256: LOCAL_TTS_IDENTITY.tokenizerSha256 });
  await assert.rejects(prepareLocalNarration({ ...badFingerprint, voiceAssetId: "voice" }, fingerprintDeps),
    /tts_model_fingerprint_mismatch/);
  assert.equal(fingerprintDeps.synthCalls.length, 0);
});

test("rejects an oversized sparse script before reading or synthesizing it", async (t) => {
  const paths = await fixture(t);
  const handle = await open(paths.scriptPath, "w");
  await handle.truncate(256 * 1024 + 1);
  await handle.close();
  const deps = dependencies();
  await assert.rejects(prepareLocalNarration({ ...paths, voiceAssetId: "voice" }, deps),
    /candidate_input_read_failed/);
  assert.equal(deps.synthCalls.length, 0);
});
