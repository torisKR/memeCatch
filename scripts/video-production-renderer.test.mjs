import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { buildSceneSvg, renderOriginalProduction, wrapUnicodeText } from "./video-production-renderer.mjs";

const NOW = new Date("2026-10-12T00:00:00.000Z");
const require = createRequire(import.meta.url);
const TEST_FONT_PATH = join(dirname(require.resolve("next/package.json")), "dist/compiled/@vercel/og/Geist-Regular.ttf");

function rightsAsset(id, kind, overrides = {}) {
  return {
    id,
    kind,
    source_url: null,
    owner: "MemeCatch",
    acquisition_method: "self_created",
    allow_edit: true,
    allow_youtube: true,
    allow_commercial: true,
    attribution: "MemeCatch original production",
    valid_until: null,
    territories: ["worldwide"],
    evidence: "Original asset ledger entry reviewed for this local test.",
    reviewed_by: "operator-test",
    reviewed_at: "2026-10-11T00:00:00.000Z",
    ...overrides,
  };
}

function validScript(overrides = {}) {
  const scenes = [
    { id: "hook", kind: "hook", heading: "이 표현, 언제 쓸까요?", caption: "먼저 분위기를 확인해요", narration: "이 표현을 쓰기 전에 대화의 분위기부터 확인해 봅니다.", start_ms: 0, end_ms: 6_000, source_ids: [] },
    { id: "meaning", kind: "meaning", heading: "핵심 뜻", caption: "새롭게 시작하는 느낌", narration: "검수된 출처를 기준으로 새롭게 시작하는 분위기를 가볍게 강조하는 표현입니다.", start_ms: 6_000, end_ms: 12_000, source_ids: ["source-1"] },
    { id: "example", kind: "example", heading: "자체 작성 가상 예시", caption: "오늘 발표 완전 새삥인데?", narration: "이 장면은 밈캐치가 자체 작성한 가상 예시입니다. 친한 사이에서 새롭다는 뜻으로 씁니다.", start_ms: 12_000, end_ms: 18_000, source_ids: [] },
    { id: "context", kind: "context", heading: "맥락", caption: "유행의 배경도 확인해요", narration: "실제 유래와 확산 맥락은 승인된 출처 기록을 바탕으로 확인합니다.", start_ms: 18_000, end_ms: 24_000, source_ids: ["source-1"] },
    { id: "caution", kind: "caution", heading: "사용 주의", caption: "공식 자리에서는 설명을 보태요", narration: "상대가 표현을 모를 수 있는 공식 자리에서는 평범한 말로 설명을 덧붙이는 편이 안전합니다.", start_ms: 24_000, end_ms: 30_000, source_ids: [] },
  ];
  return {
    title: "새삥 표현 30초 설명",
    description: "검수된 설명과 자체 작성 가상 예시로 새삥 표현의 쓰임을 안내하는 밈캐치 영상입니다.",
    narration: scenes.map((scene) => scene.narration).join(" "),
    original_observation: "같은 표현도 관계와 상황에 따라 받아들이는 온도가 달라질 수 있습니다.",
    scenes,
    source_ids: ["source-1"],
    uncertain_claims: [],
    asset_requirements: [
      { kind: "graphic", description: "밈캐치가 직접 제작한 도형 기반 세로 그래픽" },
      { kind: "voice", description: "상업 이용과 YouTube 업로드가 승인된 전체 내레이션" },
      { kind: "font", description: "상업 영상 사용과 임베딩이 승인된 한글 글꼴" },
    ],
    contains_synthetic_media: false,
    ...overrides,
  };
}

const sources = [{ id: "source-1", title: "공식 인터뷰", url: "https://example.com/interview", approved: true }];
const assets = [rightsAsset("graphic-1", "graphic"), rightsAsset("voice-1", "voice"), rightsAsset("font-1", "font")];
const VOICE_HASH = "a".repeat(64);
const FONT_HASH = createHash("sha256").update(await readFile(TEST_FONT_PATH)).digest("hex");
const assetBindings = { voiceAssetId: "voice-1", fontAssetId: "font-1", graphicAssetId: "graphic-1", voiceSha256: VOICE_HASH, fontSha256: FONT_HASH };

test("Unicode wrapping preserves long words and scene SVG escapes untrusted text", () => {
  const value = "초장문단어ABCDEFGHIJKLMNOPQRSTUVWXYZ끝";
  const lines = wrapUnicodeText(value, 5);
  assert.equal(lines.join(""), value);
  assert.ok(lines.length > 2);
  const svg = buildSceneSvg({
    kind: "example",
    heading: "<script>alert('x')</script>",
    caption: "A&B",
    narration: '"quoted" > unsafe',
    source_ids: [],
  }, { title: "위험 <제목>", originalObservation: "관찰 & 설명" });
  assert.doesNotMatch(svg, /<script>/u);
  assert.match(svg, /&lt;script&gt;/u);
  assert.match(svg, /A&amp;B/u);
  assert.match(svg, /자체 작성 가상 예시/u);
  const cited = buildSceneSvg({ kind: "meaning", heading: "뜻", caption: "설명", narration: "근거 설명", source_ids: ["source-2"] }, {
    sourceOrdinals: new Map([["source-2", 2]]), originalObservation: "충분히 긴 자체 관찰 설명입니다.",
  });
  assert.match(cited, /검수 자료 \[2\]/u);
});

test("licensed scene layout wraps Korean once inside the actual pixel boxes without orphan syllables", async () => {
  const renderer = await import("./video-production-renderer.mjs");
  assert.equal(typeof renderer.layoutSceneTextForRender, "function");
  const layout = renderer.layoutSceneTextForRender({
    kind: "context",
    heading: "안무 출처",
    caption: "스맨파 리더 계급 미션곡\n지코 프로듀싱",
    narration: "공식 댄스 영상은 위댐보이즈 바타의 안무를 명시해요.",
    source_ids: ["source-1"],
  }, {
    index: 0,
    originalObservation: "단어 풀이보다 참여 제안이 핵심입니다.",
    sourceOrdinals: new Map([["source-1", 1]]),
  });
  assert.deepEqual(layout.caption, ["스맨파 리더 계급 미션곡", "지코 프로듀싱"]);
  assert.equal(layout.explanation.join(" ").replaceAll(/\s+/gu, " "),
    "공식 댄스 영상은 위댐보이즈 바타의 안무를 명시해요.");
  assert.equal(layout.explanation.some((line) => [...line.trim()].length === 1), false);
  assert.ok(layout.explanation.every((line) => renderer.displayTextWidth(line) * layout.explanationSize <= 856));
});

test("rights failure happens before media commands or local asset reads", async () => {
  let commands = 0;
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(),
    assets: assets.map((asset) => asset.kind === "voice" ? { ...asset, allow_youtube: false } : asset),
    assetBindings,
    sources,
    narrationPath: "/definitely/not/read.aiff",
    outputDirectory: "/definitely/not/created",
    fontPath: TEST_FONT_PATH,
    commandExecutor: async () => { commands += 1; return { stdout: "", stderr: "" }; },
    now: NOW,
  }), (error) => error.message === "asset_rights_not_approved" && error.reasons.some((reason) => reason.includes("allow_youtube")));
  assert.equal(commands, 0);
});

test("rejects an unapproved or unmapped script source", async () => {
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(), assets, assetBindings, sources: [{ ...sources[0], approved: false }],
    narrationPath: "/not-used", outputDirectory: "/not-used", now: NOW,
    fontPath: TEST_FONT_PATH,
  }), /invalid_or_unapproved_source/u);
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(), assets, assetBindings,
    sources: [{ id: "different", title: "다른 출처", url: "https://example.com/other", approved: true }],
    narrationPath: "/not-used", outputDirectory: "/not-used", now: NOW,
    fontPath: TEST_FONT_PATH,
  }), /unknown source ID/u);
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(), assets, assetBindings,
    sources: [{ ...sources[0], url: "https://editor:secret@example.com/interview" }],
    narrationPath: "/not-used", outputDirectory: "/not-used", now: NOW,
    fontPath: TEST_FONT_PATH,
  }), /unsafe_public_attribution_url/u);
  for (const url of ["https://example.com/source?token=secret", "https://example.com/source?X-Amz-Signature=secret"]) {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings, sources: [{ ...sources[0], url }],
      narrationPath: "/not-used", outputDirectory: "/not-used", now: NOW,
      fontPath: TEST_FONT_PATH,
    }), /unsafe_public_attribution_url/u);
  }
});

test("requires a real non-silent narrated audio stream", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-audio-gate-"));
  const narrationPath = join(directory, "voice.wav");
  await writeFile(narrationPath, "audio gate fixture", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  const commandExecutor = async () => ({ stdout: "", stderr: "max_volume: -inf dB\n" });
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
      narrationPath, outputDirectory: join(directory, "silent-out"), commandExecutor,
      fontPath: TEST_FONT_PATH,
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
      inspectArtifact: async () => ({ width: null, height: null, durationMs: 29_000, hasAudio: true }),
      now: NOW,
    }), /narration_audio_is_silent/u);
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
      narrationPath, outputDirectory: join(directory, "no-audio-out"), commandExecutor,
      fontPath: TEST_FONT_PATH,
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
      inspectArtifact: async () => ({ width: 1080, height: 1920, durationMs: 30_000, hasAudio: false }),
      now: NOW,
    }), /narration_audio_required/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("narration duration permits only the inclusive two-second timeline tolerance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-duration-gate-"));
  const narrationPath = join(directory, "voice.wav");
  await writeFile(narrationPath, "duration gate fixture", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  try {
    for (const durationMs of [28_000, 32_000]) {
      let volumeChecks = 0;
      await assert.rejects(() => renderOriginalProduction({
        script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
        narrationPath, outputDirectory: join(directory, "boundary-out"), fontPath: TEST_FONT_PATH,
        fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
        inspectArtifact: async () => ({ width: null, height: null, durationMs, hasAudio: true }),
        commandExecutor: async (_command, args) => {
          if (args.includes("volumedetect")) volumeChecks += 1;
          throw new Error("duration_boundary_accepted");
        },
        now: NOW,
      }), /duration_boundary_accepted/u);
      assert.equal(volumeChecks, 1);
    }
    for (const durationMs of [27_999, 32_001]) {
      let commands = 0;
      await assert.rejects(() => renderOriginalProduction({
        script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
        narrationPath, outputDirectory: join(directory, "outside-out"), fontPath: TEST_FONT_PATH,
        fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
        inspectArtifact: async () => ({ width: null, height: null, durationMs, hasAudio: true }),
        commandExecutor: async () => { commands += 1; return { stdout: "", stderr: "" }; },
        now: NOW,
      }), /narration_duration_mismatch/u);
      assert.equal(commands, 0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects text that cannot fit without truncation before invoking FFmpeg", async () => {
  let commands = 0;
  const script = validScript();
  script.scenes[0] = { ...script.scenes[0], narration: "긴설명".repeat(170) };
  script.narration = script.scenes.map((scene) => scene.narration).join(" ");
  await assert.rejects(() => renderOriginalProduction({
    script, assets, assetBindings, sources, narrationPath: "/not-read", outputDirectory: "/not-created",
    fontPath: TEST_FONT_PATH, commandExecutor: async () => { commands += 1; return { stdout: "", stderr: "" }; }, now: NOW,
  }), /scene_text_exceeds_safe_layout:hook/u);
  assert.equal(commands, 0);
});

test("binds the narrated audio and font bytes to their approved rights assets", async () => {
  let commands = 0;
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(), assets, assetBindings, sources,
    narrationPath: "/voice", outputDirectory: "/not-created", fontPath: TEST_FONT_PATH,
    fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : "c".repeat(64),
    commandExecutor: async () => { commands += 1; return { stdout: "", stderr: "" }; }, now: NOW,
  }), /voice_asset_hash_mismatch/u);
  assert.equal(commands, 0);
  await assert.rejects(() => renderOriginalProduction({
    script: validScript(), assets,
    assetBindings: { ...assetBindings, voiceAssetId: "font-1" }, sources,
    narrationPath: "/voice", outputDirectory: "/not-created", fontPath: TEST_FONT_PATH, now: NOW,
  }), /asset_binding_mismatch:voiceAssetId/u);
});

test("rejects a font replaced after the initial hash check before rendering any scene", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-font-race-"));
  const narrationPath = join(directory, "voice.wav");
  await writeFile(narrationPath, "approved narration", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  let artifactCalls = 0;
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets,
      assetBindings: { ...assetBindings, voiceSha256, fontSha256: "b".repeat(64) }, sources,
      narrationPath, outputDirectory: join(directory, "out"), fontPath: TEST_FONT_PATH, fontFamily: "Geist",
      fileHasher: async (path) => path === TEST_FONT_PATH ? "b".repeat(64) : voiceSha256,
      inspectArtifact: async () => ({ width: null, height: null, durationMs: 30_000, hasAudio: true }),
      commandExecutor: async (_command, args) => args.includes("volumedetect")
        ? { stdout: "", stderr: "max_volume: -2.0 dB\n" } : { stdout: "", stderr: "" },
      renderArtifact: async () => { artifactCalls += 1; },
      now: NOW,
    }), /font_asset_copy_hash_mismatch/u);
    assert.equal(artifactCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("renders through argv-only protocol and returns verified artifact metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-test-"));
  const narrationPath = join(directory, "voice weird ' name.aiff");
  await writeFile(narrationPath, "narration fixture", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  const commands = [];
  let renderRequest;
  let inspectedNarrationPath = null;
  const commandExecutor = async (command, args) => {
    commands.push({ command, args: [...args] });
    if (args.includes("volumedetect")) return { stdout: "", stderr: "max_volume: -2.4 dB\n" };
    const output = args.at(-1);
    if (typeof output === "string" && output.endsWith(".png")) await writeFile(output, "poster", "utf8");
    if (typeof output === "string" && output.endsWith("production.mp4")) await writeFile(output, "verified final mp4 bytes", "utf8");
    return { stdout: "", stderr: "" };
  };
  const renderArtifact = async (_basePath, outputPath, request) => {
    renderRequest = request;
    await writeFile(outputPath, "verified mp4 bytes", "utf8");
    return { width: 1080, height: 1920,
      captionLayoutVerified: true,
      fontSelection: { verified: true, family: "Geist", renderer: "libass", sha256: FONT_HASH } };
  };
  const inspectArtifact = async (path) => {
    if (/memecatch-original-render-[^/]+\/narration-input$/u.test(path)) {
      inspectedNarrationPath = path;
      return { width: null, height: null, durationMs: 28_000, hasAudio: true };
    }
    return { width: 1080, height: 1920, durationMs: 30_000, hasAudio: true };
  };
  try {
    const dangerous = validScript();
    dangerous.scenes[0] = { ...dangerous.scenes[0], heading: "$(touch /tmp/nope) & <위험>", caption: "'자막'; rm -rf nope" };
    dangerous.narration = dangerous.scenes.map((scene) => scene.narration).join(" ");
    const result = await renderOriginalProduction({
      script: dangerous, assets, assetBindings: { ...assetBindings, voiceSha256 }, sources, narrationPath,
      outputDirectory: join(directory, "out folder"),
      commandExecutor, renderArtifact, inspectArtifact, now: NOW,
      fontPath: TEST_FONT_PATH,
      fontFamily: "Geist",
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
    });
    assert.equal(result.technicalCheck.passed, true);
    assert.equal(result.technicalCheck.duration_ms, 30_000);
    assert.match(result.sha256, /^[a-f0-9]{64}$/u);
    assert.equal(result.byteSize, Buffer.byteLength("verified final mp4 bytes"));
    assert.equal(result.retention.requiresPrivateDurableUpload, true);
    assert.equal((await readFile(result.posterPath, "utf8")), "poster");
    assert.equal(renderRequest.preset, "vertical");
    assert.equal(renderRequest.attribution, "자료 [1] · 설명란");
    assert.notEqual(renderRequest.fontPath, TEST_FONT_PATH);
    assert.match(renderRequest.fontPath, /memecatch-fontconfig-[^/]+\/fonts\/licensed-font\.ttf$/u);
    assert.equal(renderRequest.fontFamily, "Geist");
    assert.equal(renderRequest.segments[0].text, "'자막'; rm -rf nope");
    assert.ok(commands.every(({ args }) => Array.isArray(args)));
    assert.ok(commands.every(({ args }) => !args.some((arg) => arg === "$(touch /tmp/nope) & <위험>")));
    assert.notEqual(inspectedNarrationPath, narrationPath);
    assert.match(inspectedNarrationPath, /memecatch-original-render-[^/]+\/narration-input$/u);
    assert.equal(commands.some(({ args }) => args.includes(narrationPath)), false);
    const baseRender = commands.find(({ args }) => args.includes("-filter_complex")
      && args.some((arg) => String(arg).includes("concat=n=5")));
    assert.ok(baseRender);
    assert.ok(baseRender.args.some((arg) => /memecatch-original-render-[^/]+\/narration-input$/u.test(String(arg))));
    assert.equal(baseRender.args.includes(narrationPath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects output that is corrupt, silent, or outside the vertical contract", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-bad-output-"));
  const narrationPath = join(directory, "voice.aiff");
  await writeFile(narrationPath, "voice", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  const commandExecutor = async (_command, args) => {
    if (args.includes("volumedetect")) return { stdout: "", stderr: "max_volume: -3.0 dB\n" };
    const output = args.at(-1);
    if (typeof output === "string" && output.endsWith(".png")) await writeFile(output, "poster", "utf8");
    if (typeof output === "string" && output.endsWith("production.mp4")) await writeFile(output, "bad final video", "utf8");
    return { stdout: "", stderr: "" };
  };
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources, narrationPath,
      outputDirectory: join(directory, "out"),
      commandExecutor,
      renderArtifact: async (_base, output) => {
        await writeFile(output, "bad video", "utf8");
        return { captionLayoutVerified: true,
          fontSelection: { verified: true, family: "Geist", renderer: "libass", sha256: FONT_HASH } };
      },
      inspectArtifact: async (path) => path === narrationPath
        ? { width: null, height: null, durationMs: 28_000, hasAudio: true }
        : { width: 720, height: 1280, durationMs: 30_000, hasAudio: true },
      now: NOW,
      fontPath: TEST_FONT_PATH,
      fontFamily: "Geist",
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
    }), /rendered_media_failed_technical_check/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("propagates a full-stream decode failure instead of accepting corrupt media", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-decode-failure-"));
  const narrationPath = join(directory, "voice.aiff");
  await writeFile(narrationPath, "voice", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  const commandExecutor = async (_command, args) => {
    if (args.includes("volumedetect")) return { stdout: "", stderr: "max_volume: -3.0 dB\n" };
    if (args.includes("0:v:0") && args.at(-1) === "-") throw new Error("decode_failed_fixture");
    const output = args.at(-1);
    if (typeof output === "string" && output.endsWith("production.mp4")) await writeFile(output, "corrupt", "utf8");
    if (typeof output === "string" && output.endsWith(".png")) await writeFile(output, "poster", "utf8");
    return { stdout: "", stderr: "" };
  };
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources, narrationPath,
      outputDirectory: join(directory, "out"),
      fontPath: TEST_FONT_PATH, commandExecutor,
      renderArtifact: async (_base, output) => {
        await writeFile(output, "captioned", "utf8");
        return { captionLayoutVerified: true,
          fontSelection: { verified: true, family: "Geist", renderer: "libass", sha256: FONT_HASH } };
      },
      inspectArtifact: async (path) => path === narrationPath
        ? { width: null, height: null, durationMs: 28_000, hasAudio: true }
        : { width: 1080, height: 1920, durationMs: 30_000, hasAudio: true },
      now: NOW,
      fontFamily: "Geist",
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
    }), /decode_failed_fixture/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects caption output when it reports different pinned font bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-caption-font-"));
  const narrationPath = join(directory, "voice.wav");
  await writeFile(narrationPath, "caption narration", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
      narrationPath, outputDirectory: join(directory, "out"), fontPath: TEST_FONT_PATH, fontFamily: "Geist",
      commandExecutor: async (_command, args) => args.includes("volumedetect")
        ? { stdout: "", stderr: "max_volume: -3.0 dB\n" } : { stdout: "", stderr: "" },
      renderArtifact: async (_base, output) => {
        await writeFile(output, "captioned", "utf8");
        return { captionLayoutVerified: true,
          fontSelection: { verified: true, family: "Geist", renderer: "pango-fontconfig",
          sha256: "c".repeat(64) } };
      },
      inspectArtifact: async () => ({ width: null, height: null, durationMs: 30_000, hasAudio: true }),
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
      now: NOW,
    }), /caption_font_hash_mismatch/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("does not claim captions_safe without measured licensed caption layout evidence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "video-renderer-caption-layout-proof-"));
  const narrationPath = join(directory, "voice.wav");
  await writeFile(narrationPath, "caption proof narration", "utf8");
  const voiceSha256 = createHash("sha256").update(await readFile(narrationPath)).digest("hex");
  try {
    await assert.rejects(() => renderOriginalProduction({
      script: validScript(), assets, assetBindings: { ...assetBindings, voiceSha256 }, sources,
      narrationPath, outputDirectory: join(directory, "out"), fontPath: TEST_FONT_PATH, fontFamily: "Geist",
      commandExecutor: async (_command, args) => args.includes("volumedetect")
        ? { stdout: "", stderr: "max_volume: -3.0 dB\n" } : { stdout: "", stderr: "" },
      renderArtifact: async (_base, output) => {
        await writeFile(output, "captioned", "utf8");
        return { fontSelection: { verified: true, family: "Geist", renderer: "pango-fontconfig", sha256: FONT_HASH } };
      },
      inspectArtifact: async () => ({ width: 1080, height: 1920, durationMs: 30_000, hasAudio: true }),
      fileHasher: async (path) => path === TEST_FONT_PATH ? FONT_HASH : voiceSha256,
      now: NOW,
    }), /licensed_caption_layout_unverified/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

