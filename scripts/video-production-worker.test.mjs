import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { encryptSecret } from "../lib/video-production/secrets.mjs";
import { YouTubeApiError } from "../lib/video-production/youtube-api.mjs";
import { loadWorkerConfig, processClaimedVideoProductionJob, requestNarration,
  requestNarrationFromProvider } from "./video-production-worker.mjs";

const HASH = "a".repeat(64);
const CHANNEL = "UCBxN8lUb-5dDuOPv-szpF4g";
const KEY = Buffer.alloc(32, 7).toString("base64");
const leaseOptions = { setIntervalImpl: () => ({ unref() {} }), clearIntervalImpl: () => {} };
const hash = (value) => createHash("sha256").update(value).digest("hex");

function script(overrides = {}) {
  const scenes = Array.from({ length: 5 }, (_, index) => ({
    id: `scene-${index + 1}`,
    kind: ["hook", "meaning", "example", "context", "caution"][index],
    heading: `장면 ${index + 1}`,
    caption: index === 2 ? "가상 예시입니다" : `설명 ${index + 1}`,
    narration: index === 2 ? "이 장면은 가상 예시로 직접 작성했습니다." : `검토된 자료를 바탕으로 설명하는 문장 ${index + 1}입니다.`,
    start_ms: index * 6_000, end_ms: (index + 1) * 6_000,
    source_ids: index === 0 || index === 2 || index === 4 ? [] : ["source-1"],
  }));
  return { title: "테스트 밈 설명", description: "테스트 밈의 뜻과 사용 맥락을 안전하게 설명합니다.",
    narration: scenes.map((scene) => scene.narration).join(" "), original_observation: "원본 미디어를 재사용하지 않고 자체 그래픽으로 설명합니다.",
    scenes, source_ids: ["source-1"], uncertain_claims: [], asset_requirements: [
      { kind: "voice", description: "검토된 내레이션" }, { kind: "font", description: "허가된 글꼴" },
      { kind: "graphic", description: "자체 그래픽" },
    ], contains_synthetic_media: true, ...overrides };
}

function assets() {
  return ["voice", "font", "graphic"].map((kind) => ({ id: `${kind}-asset`, kind, source_url: null,
    owner: "MemeCatch", acquisition_method: "self_created", allow_edit: true, allow_youtube: true,
    allow_commercial: true, attribution: "MemeCatch", valid_until: null, territories: ["worldwide"],
    evidence: "내부 제작 원장", reviewed_by: "operator", reviewed_at: "2026-10-01T00:00:00Z" }));
}

function production(overrides = {}) {
  return { id: "production-1", status: "approved", script_json: script(), assets_json: assets(),
    source_snapshot: { sources: [{ id: "source-1", title: "검토 자료", url: "https://example.com/source", approved: true }] },
    artifact_key: `production-1/${HASH}.mp4`, artifact_hash: HASH, approved_artifact_hash: HASH,
    artifact_size: 4, technical_check: { duration_ms: 30_000, width: 1080, height: 1920,
      has_audio: true, decode_ok: true, decodable: true, captions_safe: true, passed: true }, ...overrides };
}

function publication(overrides = {}) {
  return { id: "publication-1", production_id: "production-1", channel_connection_id: "channel-row",
    artifact_hash: HASH, made_for_kids: false, status: "processing", youtube_video_id: "abcdefghijk",
    processing_status: "succeeded", privacy_status: "private", embeddable: true,
    approved_visibility: null, approved_publication_hash: null, public_approved_at: null, studio_reviewed_at: null, ...overrides };
}

function channel(overrides = {}) {
  return { id: "channel-row", channel_id: CHANNEL, connection_status: "connected", scopes: ["https://www.googleapis.com/auth/youtube.force-ssl"],
    encrypted_refresh_token: encryptSecret("refresh", `youtube-channel:${CHANNEL}`, KEY, () => Buffer.alloc(12, 1)), ...overrides };
}

function config(overrides = {}) {
  return { workerId: "test-worker", channelId: CHANNEL, encryptionKey: KEY, youtubeClientId: "client",
    youtubeClientSecret: "secret", narrationProvider: "generic-https",
    narrationUrl: "https://voice.example.test/render", narrationApiKey: "key",
    narrationModel: "model",
    narrationSpeaker: "Sohee", narrationLanguage: "Korean", narrationInstruct: "",
    voiceAssetId: "voice-asset", fontAssetId: "font-asset", fontSha256: HASH,
    graphicAssetId: "graphic-asset", fontPath: "/tmp/font", fontFamily: "Noto Sans CJK KR",
    siteSyncUrl: "https://catchmeme.com/api/admin/video-productions/worker-sync",
    webhookSecret: "0123456789abcdef0123456789abcdef", ...overrides };
}

function job(kind, overrides = {}) {
  return { id: `job-${kind}`, production_id: "production-1", publication_id: kind === "render" ? null : "publication-1",
    kind, lease_token: "lease-token", input_hash: HASH, ...overrides };
}

function repositoryFixture({ productionRow = production(), publicationRow = publication(), channelRow = channel(), completeError } = {}) {
  const events = [];
  const repository = {
    events,
    renew: async () => { events.push("renew"); },
    complete: async (_job, output) => { events.push(["complete", output]); if (completeError) throw completeError; },
    fail: async (_job, code, reconcile, retryAfterMs) => { events.push(["fail", code, reconcile, retryAfterMs]); },
    loadProduction: async () => productionRow,
    loadPublication: async () => ({ publication: publicationRow, channel: channelRow }),
    markChannelReauth: async () => { events.push("mark-reauth"); },
    queueSyncRetry: async () => { events.push("queue-sync-retry"); },
    queueWithdraw: async () => { events.push("queue-withdraw"); },
  };
  return repository;
}

test("loadWorkerConfig is local-only unless remote access is explicit", () => {
  const base = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "service",
    YOUTUBE_TOKEN_ENCRYPTION_KEY: KEY, YOUTUBE_OAUTH_CLIENT_ID: "client", YOUTUBE_OAUTH_CLIENT_SECRET: "secret" };
  const loaded = loadWorkerConfig(base, []);
  assert.equal(loaded.mode, "once");
  assert.equal(loaded.encryptionKey, KEY);
  assert.equal(loaded.youtubeClientId, "client");
  assert.equal(loaded.youtubeClientSecret, "secret");
  assert.equal(loaded.channelId, CHANNEL);
  assert.equal(loaded.narrationProvider, "generic-https");
  assert.equal(loaded.narrationUrl, "");
  assert.equal(loaded.narrationTimeoutMs, 90_000);
  const localVoice = loadWorkerConfig({ ...base, VIDEO_NARRATION_PROVIDER: "toris-qwen" }, []);
  assert.equal(localVoice.narrationUrl, "http://127.0.0.1:50010/synthesize");
  assert.equal(localVoice.narrationModel, "model");
  assert.equal(localVoice.narrationSpeaker, "Sohee");
  assert.equal(localVoice.narrationLanguage, "Korean");
  assert.equal(localVoice.narrationApiKey, "");
  assert.equal(localVoice.narrationTimeoutMs, 300_000);
  assert.equal(loadWorkerConfig({ ...base, VIDEO_NARRATION_PROVIDER: "toris-qwen",
    VIDEO_NARRATION_TIMEOUT_MS: "450000" }, []).narrationTimeoutMs, 450_000);
  assert.throws(() => loadWorkerConfig({ ...base, VIDEO_NARRATION_PROVIDER: "unknown" }, []), /invalid_narration_provider/);
  assert.throws(() => loadWorkerConfig({ ...base, VIDEO_NARRATION_TIMEOUT_MS: "0" }, []), /invalid_narration_timeout/);
  assert.throws(() => loadWorkerConfig({ ...base, VIDEO_NARRATION_TIMEOUT_MS: "999999" }, []), /invalid_narration_timeout/);
  assert.throws(() => loadWorkerConfig({ ...base, YOUTUBE_EXPECTED_CHANNEL_ID: "not-a-channel" }, []), /invalid_youtube_channel_id/);
  assert.throws(() => loadWorkerConfig({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }, []), /remote_supabase_requires_allow_remote/);
  assert.equal(loadWorkerConfig({ ...base, NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" }, ["--allow-remote", "--drain"]).mode, "drain");
});

test("toris-qwen narration is loopback-only and verifies health plus response identity", async () => {
  const calls = [];
  const bytes = await requestNarrationFromProvider({ provider: "toris-qwen",
    url: "http://127.0.0.1:50010/synthesize", voiceAssetId: "voice-asset", narration: "검토 문장",
    model: "model", speaker: "Sohee", language: "Korean",
    instruct: "차분하게", fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      if (init.method === "GET") return Response.json({ ok: true, provider: "qwen3-tts-mlx",
        model: "model", speaker: "Sohee", language: "Korean", backend: "mlx" });
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { "content-type": "audio/wav",
        "x-tts-provider": "qwen3-tts-mlx", "x-tts-speaker": "Sohee" } });
    } });
  assert.deepEqual([...bytes], [82, 73, 70, 70]);
  assert.equal(calls[0].url, "http://127.0.0.1:50010/health");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "http://127.0.0.1:50010/synthesize");
  assert.equal(calls[1].init.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[1].init.body), { text: "검토 문장", speaker: "Sohee", language: "Korean", instruct: "차분하게" });
});

test("toris-qwen rejects non-loopback endpoints and identity mismatches before accepting audio", async () => {
  let requested = false;
  await assert.rejects(requestNarrationFromProvider({ provider: "toris-qwen", url: "http://localhost:50010/synthesize",
    voiceAssetId: "voice-asset", narration: "검토 문장", fetchImpl: async () => { requested = true; } }), /invalid_narration_url/);
  assert.equal(requested, false);
  await assert.rejects(requestNarrationFromProvider({ provider: "toris-qwen", url: "http://127.0.0.1:50010/synthesize",
    voiceAssetId: "voice-asset", narration: "검토 문장", fetchImpl: async () => Response.json({ ok: true,
      provider: "qwen3-tts-mlx", model: "wrong-model", speaker: "Sohee", language: "Korean", backend: "mlx" }) }),
  /narration_provider_identity_mismatch/);
  await assert.rejects(requestNarrationFromProvider({ provider: "toris-qwen", url: "http://127.0.0.1:50010/synthesize",
    voiceAssetId: "voice-asset", narration: "검토 문장", fetchImpl: async (_url, init) => init.method === "GET"
      ? Response.json({ ok: true, provider: "qwen3-tts-mlx", model: "model",
        speaker: "Sohee", language: "Korean", backend: "mlx" })
      : new Response(new Uint8Array([1]), { headers: { "content-type": "audio/wav",
        "x-tts-provider": "another-provider", "x-tts-speaker": "Sohee" } }) }), /narration_provider_identity_mismatch/);
});

test("requestNarration sends the exact reviewed narration and rejects oversized or non-audio responses", async () => {
  let sent;
  let voiceAssetId;
  const bytes = await requestNarration({ url: "https://voice.example.test/render", apiKey: "secret", voiceAssetId: "voice-asset", narration: "검토 문장",
    fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); voiceAssetId = init.headers["x-memecatch-voice-asset-id"];
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }); } });
  assert.deepEqual(sent, { text: "검토 문장" });
  assert.equal(voiceAssetId, "voice-asset");
  assert.deepEqual([...bytes], [1, 2, 3]);
  await assert.rejects(requestNarration({ url: "https://voice.example.test/render", apiKey: "secret", voiceAssetId: "voice-asset", narration: "검토 문장",
    fetchImpl: async () => new Response("json", { headers: { "content-type": "application/json" } }) }), /narration_response_not_audio/);
  await assert.rejects(requestNarration({ url: "https://voice.example.test/render", apiKey: "secret", voiceAssetId: "voice-asset", narration: "검토 문장",
    fetchImpl: async () => new Response(null, { headers: { "content-type": "audio/mpeg", "content-length": String(21 * 1024 * 1024) } }) }), /narration_response_too_large/);
});

test("normal upload verifies immutable bytes, resumes privately, checkpoints ID, then completes", async () => {
  const artifact = new Uint8Array([1, 2, 3, 4]);
  const artifactHash = hash(artifact);
  const creditedAssets = assets().map((asset) => ({ ...asset, attribution: asset.kind === "voice"
    ? "보이스 제공: 성우 A" : asset.kind === "font" ? "글꼴: 테스트 폰트" : "글꼴: 테스트 폰트" }));
  const prod = production({ artifact_hash: artifactHash, approved_artifact_hash: artifactHash,
    artifact_key: `production-1/${artifactHash}.mp4`, assets_json: creditedAssets,
    source_snapshot: { sources: [
      { id: "source-1", title: "사용한 검토 자료", url: "https://example.com/used", approved: true },
      { id: "source-unused", title: "사용하지 않은 자료", url: "https://example.com/unused", approved: true },
    ] } });
  const pub = publication({ artifact_hash: artifactHash, youtube_video_id: null });
  const repository = repositoryFixture({ productionRow: prod, publicationRow: pub });
  Object.assign(repository, {
    downloadArtifact: async () => artifact,
    loadUploadSession: async () => null,
    markUploadIntent: async () => { repository.events.push("intent"); },
    saveUploadSession: async () => { repository.events.push("session"); },
    saveUploadOffset: async (_id, offset, started) => { repository.events.push(["offset", offset, Boolean(started)]); },
    saveVideoId: async (_id, id) => { repository.events.push(["video-id", id]); },
  });
  let uploaded = false;
  let initializedDescription;
  const client = {
    assertChannel: async () => {},
    initializePrivateUpload: async ({ metadata }) => {
      initializedDescription = metadata.snippet.description;
      return "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc";
    },
    queryUploadSession: async () => ({ state: "incomplete", offset: 0, retryAfterMs: 0 }),
    uploadChunk: async () => { uploaded = true; return { state: "complete", videoId: "abcdefghijk" }; },
    videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL, processingStatus: "processing", privacyStatus: "private", embeddable: true }),
  };
  const result = await processClaimedVideoProductionJob({ repository, job: job("upload"),
    config: config(), deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.completed, true);
  assert.equal(uploaded, true);
  assert.ok(repository.events.indexOf("intent") < repository.events.indexOf("session"));
  const videoCheckpoint = repository.events.findIndex((event) => Array.isArray(event) && event[0] === "video-id");
  const completedOffset = repository.events.findIndex((event, index) => index > videoCheckpoint
    && Array.isArray(event) && event[0] === "offset" && event[1] === artifact.byteLength);
  assert.ok(videoCheckpoint >= 0 && completedOffset > videoCheckpoint);
  assert.equal(repository.events.at(-1)[0], "complete");
  assert.match(initializedDescription, /자료\n\[1\] 사용한 검토 자료\nhttps:\/\/example\.com\/used/u);
  assert.doesNotMatch(initializedDescription, /사용하지 않은 자료|example\.com\/unused/u);
  assert.match(initializedDescription, /제작 자산 표기\n- 보이스 제공: 성우 A\n- 글꼴: 테스트 폰트/u);
  assert.equal(initializedDescription.match(/글꼴: 테스트 폰트/gu)?.length, 1);
  assert.doesNotMatch(initializedDescription, /라이선스 확보|사용 허가|권리 보유/u);
});

test("upload strips source fragments while preserving an ordinary watch query", async () => {
  const artifact = new Uint8Array([1, 2, 3, 4]);
  const artifactHash = hash(artifact);
  const prod = production({ artifact_hash: artifactHash, approved_artifact_hash: artifactHash,
    artifact_key: `production-1/${artifactHash}.mp4`,
    source_snapshot: { sources: [{ id: "source-1", title: "영상 자료",
      url: "https://www.youtube.com/watch?v=abc123#private-note", approved: true }] } });
  const repository = repositoryFixture({ productionRow: prod,
    publicationRow: publication({ artifact_hash: artifactHash, youtube_video_id: null }) });
  Object.assign(repository, {
    downloadArtifact: async () => artifact, loadUploadSession: async () => null,
    markUploadIntent: async () => {}, saveUploadSession: async () => {}, saveUploadOffset: async () => {}, saveVideoId: async () => {},
  });
  let description;
  const client = {
    assertChannel: async () => {},
    initializePrivateUpload: async ({ metadata }) => { description = metadata.snippet.description;
      return "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=public-url"; },
    queryUploadSession: async () => ({ state: "incomplete", offset: 0, retryAfterMs: 0 }),
    uploadChunk: async () => ({ state: "complete", videoId: "abcdefghijk" }),
    videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
      processingStatus: "processing", privacyStatus: "private", embeddable: true }),
  };
  const result = await processClaimedVideoProductionJob({ repository, job: job("upload"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.completed, true);
  assert.match(description, /https:\/\/www\.youtube\.com\/watch\?v=abc123/u);
  assert.doesNotMatch(description, /private-note|#/u);
});

test("upload rejects credential and signed source URLs before YouTube initialization", async () => {
  const artifact = new Uint8Array([1, 2, 3, 4]);
  const artifactHash = hash(artifact);
  for (const url of ["https://editor:secret@example.com/source", "https://example.com/source?token=secret",
    "https://example.com/source?X-Goog-Signature=secret"]) {
    const prod = production({ artifact_hash: artifactHash, approved_artifact_hash: artifactHash,
      artifact_key: `production-1/${artifactHash}.mp4`,
      source_snapshot: { sources: [{ id: "source-1", title: "수동 검토 자료", url, approved: true }] } });
    const repository = repositoryFixture({ productionRow: prod,
      publicationRow: publication({ artifact_hash: artifactHash, youtube_video_id: null }) });
    let initialized = false;
    const result = await processClaimedVideoProductionJob({ repository, job: job("upload"), config: config(),
      deps: { leaseOptions, createYouTubeClient: () => ({
        initializePrivateUpload: async () => { initialized = true; },
      }) } });
    assert.equal(result.errorCode, "unsafe_public_attribution_url");
    assert.equal(initialized, false);
    assert.deepEqual(repository.events.at(-1), ["fail", "unsafe_public_attribution_url", false, 0]);
  }
});

test("incomplete upload preserves provider Retry-After in the durable retry decision", async () => {
  const artifact = new Uint8Array([1, 2, 3, 4]);
  const artifactHash = hash(artifact);
  const repository = repositoryFixture({ productionRow: production({ artifact_hash: artifactHash,
    approved_artifact_hash: artifactHash, artifact_key: `production-1/${artifactHash}.mp4` }),
  publicationRow: publication({ artifact_hash: artifactHash, youtube_video_id: null }) });
  Object.assign(repository, {
    downloadArtifact: async () => artifact, loadUploadSession: async () => null,
    markUploadIntent: async () => {}, saveUploadSession: async () => {}, saveUploadOffset: async () => {}, saveVideoId: async () => {},
  });
  const client = {
    assertChannel: async () => {},
    initializePrivateUpload: async () => "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=retry",
    queryUploadSession: async () => ({ state: "incomplete", offset: 0, retryAfterMs: 125_000 }),
  };
  const result = await processClaimedVideoProductionJob({ repository, job: job("upload"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.errorCode, "youtube_upload_incomplete");
  assert.equal(result.retryAfterMs, 125_000);
  assert.deepEqual(repository.events.at(-1), ["fail", "youtube_upload_incomplete", false, 125_000]);
});

test("YouTube 429 Retry-After is forwarded to the failure RPC", async () => {
  const repository = repositoryFixture();
  const client = { videoStatus: async () => { throw new YouTubeApiError("youtube_request_failed",
    { status: 429, retryable: true, retryAfterMs: 180_000 }); } };
  const result = await processClaimedVideoProductionJob({ repository, job: job("check"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.retryAfterMs, 180_000);
  assert.deepEqual(repository.events.at(-1), ["fail", "youtube_request_failed", false, 180_000]);
});

test("token expiry becomes a permanent reconciliation stop without an upload retry loop", async () => {
  const repository = repositoryFixture();
  const result = await processClaimedVideoProductionJob({ repository, job: job("check"), config: config(), deps: { leaseOptions,
    fetchImpl: async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "content-type": "application/json" } }) } });
  assert.equal(result.errorCode, "youtube_reauthentication_required");
  assert.equal(result.reconcileRequired, true);
  assert.ok(repository.events.includes("mark-reauth"));
  assert.deepEqual(repository.events.at(-1), ["fail", "youtube_reauthentication_required", true, 0]);
});

test("successful external observation followed by DB completion failure is recorded, not reported complete", async () => {
  const repository = repositoryFixture({ completeError: Object.assign(new Error("video_job_completion_failed"), { code: "video_job_completion_failed" }) });
  const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
    processingStatus: "succeeded", privacyStatus: "private", embeddable: true }) };
  const result = await processClaimedVideoProductionJob({ repository, job: job("check"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.completed, false);
  assert.equal(result.errorCode, "video_job_completion_failed");
  assert.deepEqual(repository.events.at(-1), ["fail", "video_job_completion_failed", false, 0]);
});

test("check reports bounded authoritative upload fields and lets the completion RPC terminalize", async () => {
  for (const observed of [
    { processingStatus: "failed", uploadStatus: "uploaded", rejectionReason: null },
    { processingStatus: "processing", uploadStatus: "rejected", rejectionReason: "copyright" },
  ]) {
    const repository = repositoryFixture();
    const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
      privacyStatus: "private", embeddable: true, ...observed }) };
    const result = await processClaimedVideoProductionJob({ repository, job: job("check"), config: config(),
      deps: { leaseOptions, createYouTubeClient: () => client } });
    assert.equal(result.completed, true);
    assert.equal(result.output.processingStatus, observed.processingStatus);
    assert.equal(result.output.uploadStatus, observed.uploadStatus);
    assert.equal(result.output.rejectionReason, observed.rejectionReason);
    assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "fail"), false);
  }
});

test("check never copies unbounded provider status or rejection text into job output", async () => {
  const secretDetail = `provider-stack-${"x".repeat(500)}`;
  const repository = repositoryFixture();
  const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
    processingStatus: secretDetail, uploadStatus: secretDetail, rejectionReason: secretDetail,
    privacyStatus: "private", embeddable: true }) };
  const result = await processClaimedVideoProductionJob({ repository, job: job("check"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.completed, true);
  assert.equal(result.output.processingStatus, "unknown");
  assert.equal(result.output.uploadStatus, "unknown");
  assert.equal(result.output.rejectionReason, "unknown");
  assert.doesNotMatch(JSON.stringify(result.output), /provider-stack/u);
});

test("render failure never writes a completion and remains bounded by the job ledger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-worker-test-"));
  try {
    const voice = Buffer.from("voice");
    const font = Buffer.from("font");
    const fontPath = join(directory, "font.ttf");
    await writeFile(fontPath, font);
    const repository = repositoryFixture({ productionRow: production({ status: "rendering", artifact_hash: null,
      approved_artifact_hash: null, artifact_key: null, artifact_size: null, technical_check: {} }) });
    const result = await processClaimedVideoProductionJob({ repository, job: job("render"),
      config: config({ fontPath, fontSha256: hash(font) }), deps: { leaseOptions,
        requestNarration: async () => voice,
        renderOriginalProduction: async () => { throw new Error("ffmpeg_render_failed"); } } });
    assert.equal(result.errorCode, "ffmpeg_render_failed");
    assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "complete"), false);
    assert.deepEqual(repository.events.at(-1), ["fail", "ffmpeg_render_failed", false, 0]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("two reviewed scripts may render different narration bytes under the same licensed voice identity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-worker-voice-test-"));
  try {
    const font = Buffer.from("font");
    const fontPath = join(directory, "font.ttf");
    await writeFile(fontPath, font);
    const outputs = [];
    for (const [index, voice] of [Buffer.from("voice-one"), Buffer.from("voice-two")].entries()) {
      const currentProduction = production({ id: `production-${index + 1}`, status: "rendering", script_json: script({
        title: `테스트 밈 설명 ${index + 1}` }), artifact_hash: null, approved_artifact_hash: null,
        artifact_key: null, artifact_size: null, technical_check: {} });
      const repository = repositoryFixture({ productionRow: currentProduction });
      repository.putImmutable = async () => {};
      const currentJob = job("render", { id: `job-render-${index + 1}`, production_id: currentProduction.id, output_json: {} });
      const result = await processClaimedVideoProductionJob({ repository, job: currentJob,
        config: config({ fontPath, fontSha256: hash(font) }), deps: { leaseOptions,
          requestNarration: async ({ voiceAssetId, narration }) => {
            assert.equal(voiceAssetId, "voice-asset");
            assert.equal(narration, currentProduction.script_json.narration);
            return voice;
          },
          renderOriginalProduction: async ({ assetBindings, outputDirectory, fontFamily }) => {
            assert.equal(assetBindings.voiceSha256, hash(voice));
            assert.equal(fontFamily, "Noto Sans CJK KR");
            const mp4Path = join(outputDirectory, "production.mp4");
            const posterPath = join(outputDirectory, "poster.png");
            await writeFile(mp4Path, voice);
            await writeFile(posterPath, Buffer.from(`poster-${index}`));
            return { mp4Path, posterPath, sha256: hash(voice), byteSize: voice.byteLength,
              technicalCheck: { duration_ms: 30_000, width: 1080, height: 1920, has_audio: true,
                decodable: true, captions_safe: true, passed: true }, assetBindings };
          } } });
      assert.equal(result.completed, true);
      outputs.push(repository.events.find((event) => Array.isArray(event) && event[0] === "complete")[1]);
    }
    assert.notEqual(outputs[0].assetBindings.voiceSha256, outputs[1].assetBindings.voiceSha256);
    assert.equal(outputs[0].assetBindings.voiceAssetId, outputs[1].assetBindings.voiceAssetId);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("publish is denied before YouTube mutation when approval/privacy gates are incomplete", async () => {
  const repository = repositoryFixture({ publicationRow: publication({ approved_visibility: null }) });
  let called = false;
  const result = await processClaimedVideoProductionJob({ repository, job: job("publish"), config: config(), deps: { leaseOptions,
    createYouTubeClient: () => ({ setVisibility: async () => { called = true; } }) } });
  assert.equal(result.errorCode, "publication_not_eligible");
  assert.equal(called, false);
});

test("expired voice rights block publish and sync before any YouTube or embed operation", async () => {
  const expiredAssets = assets().map((asset) => asset.kind === "voice"
    ? { ...asset, valid_until: "2026-10-11T00:00:00Z" } : asset);
  const productionRow = production({ assets_json: expiredAssets });
  const publicationRow = publication({ status: "ready_for_review", approved_visibility: "public",
    approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z", studio_reviewed_at: "2026-10-12T00:00:00Z",
    privacy_status: "public" });
  for (const kind of ["publish", "sync"]) {
    const repository = repositoryFixture({ productionRow, publicationRow });
    let youtubeCalled = false;
    let embedCalled = false;
    const result = await processClaimedVideoProductionJob({ repository, job: job(kind), config: config(), deps: { leaseOptions,
      createYouTubeClient: () => { youtubeCalled = true; }, verifyYouTubeEmbed: async () => { embedCalled = true; } } });
    assert.equal(result.errorCode, "asset_rights_expired");
    assert.equal(result.reconcileRequired, true);
    assert.equal(youtubeCalled, false);
    assert.equal(embedCalled, false);
  }
});

test("publish compensates to private and queues withdrawal when approval is revoked during the mutation", async () => {
  const approvedPublication = publication({ status: "ready_for_review", approved_visibility: "public",
    approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z", studio_reviewed_at: "2026-10-12T00:00:00Z" });
  const repository = repositoryFixture({ publicationRow: approvedPublication });
  let productionReads = 0;
  repository.loadProduction = async () => (++productionReads === 1 ? production() : production({ status: "blocked", approved_artifact_hash: null }));
  repository.queueWithdraw = async () => { repository.events.push("queue-withdraw"); };
  const visibilities = [];
  const client = { setVisibility: async ({ visibility }) => {
    visibilities.push(visibility);
    return { videoId: "abcdefghijk", channelId: CHANNEL, processingStatus: "succeeded",
      privacyStatus: visibility, embeddable: true };
  } };
  const result = await processClaimedVideoProductionJob({ repository, job: job("publish"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.deepEqual(visibilities, ["public", "private"]);
  assert.ok(repository.events.includes("queue-withdraw"));
  assert.equal(result.errorCode, "publication_revoked_during_publish");
  assert.equal(result.reconcileRequired, true);
  assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "complete"), false);
});

test("monitor takedown records atomic DB invalidation before cache refresh retry", async () => {
  const repository = repositoryFixture({ publicationRow: publication({ status: "site_linked", privacy_status: "public" }) });
  const client = { videoStatus: async () => { throw new YouTubeApiError("youtube_resource_unavailable", { status: 404 }); } };
  const result = await processClaimedVideoProductionJob({ repository, job: job("monitor"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client, fetchImpl: async () => new Response(null, { status: 503 }) } });
  assert.equal(result.errorCode, "remote_content_unavailable");
  const failure = repository.events.findIndex((event) => Array.isArray(event) && event[0] === "fail");
  const cacheRetry = repository.events.indexOf("queue-sync-retry");
  assert.ok(failure >= 0 && cacheRetry > failure);
  assert.deepEqual(repository.events[failure], ["fail", "remote_content_unavailable", true, 0]);
  assert.equal(result.cacheRefreshQueued, true);
  assert.ok(repository.events.includes("queue-sync-retry"));
});

test("healthy linked monitor requires a hash-bound embed proof", async () => {
  const pub = publication({ status: "site_linked", privacy_status: "public", approved_visibility: "public" });
  const repository = repositoryFixture({ publicationRow: pub });
  let proofInput;
  const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
    processingStatus: "succeeded", uploadStatus: "processed", rejectionReason: null,
    privacyStatus: "public", embeddable: true, videoMetadata: { name: "API 제목", description: null,
      thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", uploadDate: "2026-10-12T00:00:00Z" } }) };
  const result = await processClaimedVideoProductionJob({ repository, job: job("monitor"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client, verifyYouTubeEmbed: async (input) => {
      proofInput = input;
      return { verified: true, videoId: input.videoId, artifactHash: input.artifactHash };
    } } });
  assert.equal(result.completed, true);
  assert.deepEqual(proofInput, { videoId: "abcdefghijk", channelId: CHANNEL, artifactHash: HASH });
  assert.equal(result.output.embedVerified, true);
  assert.equal(result.output.videoMetadata.name, "API 제목");
  assert.equal(repository.events.at(-1)[0], "complete");
});

test("failed linked monitor embed proof completes an authoritative false observation then refreshes cache", async () => {
  const pub = publication({ status: "site_linked", privacy_status: "public", approved_visibility: "public" });
  const repository = repositoryFixture({ publicationRow: pub });
  let callbacks = 0;
  const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
    processingStatus: "succeeded", uploadStatus: "processed", rejectionReason: null,
    privacyStatus: "public", embeddable: true, videoMetadata: { name: "숨겨야 할 제목", description: null,
      thumbnailUrl: null, uploadDate: null } }) };
  const result = await processClaimedVideoProductionJob({ repository, job: job("monitor"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client,
      verifyYouTubeEmbed: async () => ({ verified: false, videoId: "abcdefghijk", artifactHash: HASH }),
      fetchImpl: async () => { callbacks += 1; return new Response(null, { status: 204 }); } } });
  assert.equal(result.completed, true);
  assert.equal(result.output.embedVerified, false);
  assert.equal(result.output.videoMetadata, undefined);
  assert.equal(callbacks, 1);
  assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "fail"), false);
  assert.equal(repository.events.find((event) => Array.isArray(event) && event[0] === "complete")[1].embedVerified, false);
});

test("monitor expires linked rights through the atomic failure RPC before cache refresh", async () => {
  const expiredAssets = assets().map((asset) => asset.kind === "font"
    ? { ...asset, valid_until: "2026-10-11T00:00:00Z" } : asset);
  const repository = repositoryFixture({ productionRow: production({ assets_json: expiredAssets }),
    publicationRow: publication({ status: "site_linked", approved_visibility: "public", privacy_status: "public" }) });
  let youtubeCalled = false;
  const result = await processClaimedVideoProductionJob({ repository, job: job("monitor"), config: config(), deps: { leaseOptions,
    createYouTubeClient: () => { youtubeCalled = true; }, fetchImpl: async () => new Response(null, { status: 204 }) } });
  assert.equal(result.errorCode, "asset_rights_expired");
  assert.equal(youtubeCalled, false);
  const failure = repository.events.findIndex((event) => Array.isArray(event) && event[0] === "fail");
  assert.ok(failure >= 0);
  assert.equal(repository.events.includes("queue-withdraw"), false);
});

for (const [approvedVisibility, observedVisibility] of [["public", "unlisted"], ["unlisted", "public"]]) {
test(`monitor invalidates linked publication when approved ${approvedVisibility} visibility drifts to ${observedVisibility}`, async () => {
  const repository = repositoryFixture({ publicationRow: publication({ status: "site_linked", privacy_status: "public",
    approved_visibility: approvedVisibility, approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z",
    studio_reviewed_at: "2026-10-12T00:00:00Z" }) });
  const client = { videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
    processingStatus: "succeeded", privacyStatus: observedVisibility, embeddable: true }) };
  const result = await processClaimedVideoProductionJob({ repository, job: job("monitor"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client, fetchImpl: async () => new Response(null, { status: 204 }) } });
  assert.equal(result.errorCode, "youtube_visibility_withdrawn");
  assert.equal(result.reconcileRequired, true);
  assert.deepEqual(repository.events.find((event) => Array.isArray(event) && event[0] === "fail"),
    ["fail", "youtube_visibility_withdrawn", true, 0]);
  assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "complete"), false);
});
}

test("blocked production may execute its authorized private withdrawal", async () => {
  const repository = repositoryFixture({ productionRow: production({ status: "blocked", approved_artifact_hash: null }),
    publicationRow: publication({ status: "blocked", privacy_status: "public" }) });
  let visibility;
  const client = { setVisibility: async (input) => { visibility = input.visibility; return { videoId: "abcdefghijk",
    channelId: CHANNEL, processingStatus: "succeeded", privacyStatus: "private", embeddable: true }; } };
  const result = await processClaimedVideoProductionJob({ repository, job: job("withdraw"), config: config(),
    deps: { leaseOptions, createYouTubeClient: () => client } });
  assert.equal(result.completed, true);
  assert.equal(visibility, "private");
  assert.equal(repository.events.at(-1)[0], "complete");
});

test("cache-only retry for unavailable publication skips embed and YouTube work", async () => {
  const repository = repositoryFixture({ productionRow: production({ status: "blocked", approved_artifact_hash: null }),
    publicationRow: publication({ status: "unavailable", privacy_status: "private" }) });
  let embedCalled = false;
  let youtubeCalled = false;
  const result = await processClaimedVideoProductionJob({ repository,
    job: job("sync", { output_json: { reason: "site_cache_refresh_pending" } }), config: config(), deps: { leaseOptions,
      verifyYouTubeEmbed: async () => { embedCalled = true; }, createYouTubeClient: () => { youtubeCalled = true; },
      fetchImpl: async () => new Response(null, { status: 204 }) } });
  assert.equal(result.completed, true);
  assert.equal(embedCalled, false);
  assert.equal(youtubeCalled, false);
  const output = repository.events.find((event) => Array.isArray(event) && event[0] === "complete")[1];
  assert.equal(output.cacheOnly, true);
  assert.equal(output.cacheRefreshCompleted, true);
});

test("sync links only after embed proof and persists a bounded cache callback retry", async () => {
  const pub = publication({ status: "published", privacy_status: "public", approved_visibility: "public",
    approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z", studio_reviewed_at: "2026-10-12T00:00:00Z" });
  const repository = repositoryFixture({ publicationRow: pub });
  let callback;
  const apiMetadata = { name: "API 제목", description: "API 설명",
    thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", uploadDate: "2026-10-12T00:00:00Z" };
  const result = await processClaimedVideoProductionJob({ repository, job: job("sync", { output_json: {} }), config: config(), deps: { leaseOptions,
    verifyYouTubeEmbed: async (input) => ({ verified: true, videoId: input.videoId, artifactHash: input.artifactHash,
      checkedAt: "2026-10-12T00:00:00Z" }),
    createYouTubeClient: () => ({ videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL,
      processingStatus: "succeeded", privacyStatus: "public", embeddable: true, videoMetadata: apiMetadata }) }),
    fetchImpl: async (url, init) => { callback = { url: String(url), init }; return new Response(null, { status: 503 }); } } });
  assert.equal(result.completed, true);
  const completed = repository.events.findIndex((event) => Array.isArray(event) && event[0] === "complete");
  const queued = repository.events.indexOf("queue-sync-retry");
  assert.ok(completed >= 0 && queued > completed);
  assert.equal(repository.events[completed][1].embedVerified, true);
  assert.deepEqual(repository.events[completed][1].videoMetadata, apiMetadata);
  assert.equal(repository.events[completed][1].cacheRefreshQueued, true);
  assert.equal(callback.url, "https://catchmeme.com/api/admin/video-productions/worker-sync");
  assert.deepEqual(JSON.parse(callback.init.body), { publicationId: "publication-1", artifactHash: HASH });
  assert.match(callback.init.headers["x-video-worker-timestamp"], /^\d+$/u);
  const expectedSignature = createHmac("sha256", config().webhookSecret)
    .update(`${callback.init.headers["x-video-worker-timestamp"]}.${callback.init.body}`).digest("hex");
  assert.equal(callback.init.headers["x-video-worker-signature"], expectedSignature);
});

test("sync cannot link when the anonymous embed proof fails", async () => {
  const pub = publication({ status: "published", privacy_status: "public", approved_visibility: "public",
    approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z", studio_reviewed_at: "2026-10-12T00:00:00Z" });
  const repository = repositoryFixture({ publicationRow: pub });
  let apiCalled = false;
  const result = await processClaimedVideoProductionJob({ repository, job: job("sync", { output_json: {} }), config: config(), deps: { leaseOptions,
    verifyYouTubeEmbed: async (input) => ({ verified: false, videoId: input.videoId, artifactHash: input.artifactHash }),
    createYouTubeClient: () => { apiCalled = true; return { videoStatus: async () => ({}) }; },
  } });
  assert.equal(result.errorCode, "youtube_embed_verification_failed");
  assert.equal(apiCalled, false);
  assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "complete"), false);
});

test("sync rejects stale stored publication state when the post-embed API status is no longer publishable", async () => {
  for (const observed of [
    { processingStatus: "processing", privacyStatus: "public", embeddable: true },
    { processingStatus: "succeeded", privacyStatus: "private", embeddable: true },
    { processingStatus: "succeeded", privacyStatus: "public", embeddable: false },
  ]) {
    const pub = publication({ status: "published", privacy_status: "public", approved_visibility: "public",
      approved_publication_hash: HASH, public_approved_at: "2026-10-12T00:00:00Z", studio_reviewed_at: "2026-10-12T00:00:00Z" });
    const repository = repositoryFixture({ publicationRow: pub });
    const result = await processClaimedVideoProductionJob({ repository, job: job("sync", { output_json: {} }), config: config(), deps: { leaseOptions,
      verifyYouTubeEmbed: async (input) => ({ verified: true, videoId: input.videoId, artifactHash: input.artifactHash }),
      createYouTubeClient: () => ({ videoStatus: async () => ({ videoId: "abcdefghijk", channelId: CHANNEL, ...observed }) }),
    } });
    assert.equal(result.errorCode, "youtube_visibility_withdrawn");
    assert.equal(result.reconcileRequired, true);
    assert.equal(repository.events.some((event) => Array.isArray(event) && event[0] === "complete"), false);
  }
});
