// LOCAL TEST ONLY. The macOS voice and system font used here are not production rights evidence.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { renderOriginalProduction } from "./video-production-renderer.mjs";

const exec = promisify(execFile);
const outputDirectory = resolve(process.argv[2] ?? "artifacts/video-production/local-render-smoke");
const narrationPath = join(outputDirectory, "localtest-narration.aiff");
const fontPath = "/System/Library/Fonts/AppleSDGothicNeo.ttc";
const scenes = [
  { id: "hook", kind: "hook", heading: "새삥, 언제 쓰는 말일까요?", caption: "새로운 시작을 강조하는 표현", narration: "이 표현은 새로운 시작을 강조할 때 가볍게 쓰입니다. 하지만 상대와 상황에 따라 느낌이 달라질 수 있습니다.", start_ms: 0, end_ms: 6_000, source_ids: [] },
  { id: "meaning", kind: "meaning", heading: "핵심 뜻", caption: "새것처럼 산뜻한 느낌", narration: "먼저 핵심 뜻을 확인합니다. 새것처럼 산뜻하거나 새롭게 시작하는 분위기를 나타냅니다.", start_ms: 6_000, end_ms: 12_000, source_ids: ["source-1"] },
  { id: "example", kind: "example", heading: "밈캐치 자체 작성 가상 예시", caption: "오늘 발표 완전 새삥인데?", narration: "친한 사이에서 사용할 수 있는 가상 예시입니다. 이 예시는 밈캐치가 직접 작성했으며 실제 인물이나 사건을 묘사하지 않습니다.", start_ms: 12_000, end_ms: 18_000, source_ids: [] },
  { id: "context", kind: "context", heading: "유래와 맥락", caption: "승인된 출처와 자체 해설을 구분", narration: "유래와 확산 맥락은 승인된 출처를 기준으로 구분해서 설명합니다. 자체 영상은 유래의 근거로 다시 사용하지 않습니다.", start_ms: 18_000, end_ms: 24_000, source_ids: ["source-1"] },
  { id: "caution", kind: "caution", heading: "사용 주의", caption: "공식 자리에서는 쉬운 설명을 함께", narration: "공식 자리에서는 모두가 이해할 수 있는 평범한 표현을 함께 덧붙이는 것이 안전합니다. 밈캐치는 출처와 자체 해설을 분리해 기록합니다.", start_ms: 24_000, end_ms: 30_000, source_ids: [] },
];
const script = {
  title: "새삥 표현 30초 설명",
  description: "검수된 설명과 자체 작성 가상 예시로 새삥 표현의 쓰임을 안내하는 밈캐치 로컬 테스트 영상입니다.",
  narration: scenes.map(scene => scene.narration).join(" "),
  original_observation: "같은 표현도 관계와 상황에 따라 받아들이는 온도가 달라질 수 있습니다.",
  scenes,
  source_ids: ["source-1"],
  uncertain_claims: [],
  asset_requirements: [
    { kind: "graphic", description: "밈캐치 자체 도형 기반 그래픽" },
    { kind: "voice", description: "LOCAL TEST 전용 macOS 음성" },
    { kind: "font", description: "LOCAL TEST 전용 macOS 시스템 한글 글꼴" },
  ],
  contains_synthetic_media: false,
};
const localTestAsset = (id, kind) => ({
  id, kind, source_url: null, owner: "LOCAL TEST fixture", acquisition_method: "self_created",
  allow_edit: true, allow_youtube: true, allow_commercial: true,
  attribution: "LOCAL TEST ONLY — never upload or publish",
  valid_until: null, territories: ["worldwide"],
  evidence: "Test fixture flags exercise the rights gate only; they are not production rights evidence.",
  reviewed_by: "local-render-smoke", reviewed_at: "2026-10-12T00:00:00.000Z",
});
const hashFile = async (path) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

await mkdir(outputDirectory, { recursive: true });
await exec("say", ["-r", "255", "-o", narrationPath, script.narration]);
const [voiceSha256, fontSha256] = await Promise.all([hashFile(narrationPath), hashFile(fontPath)]);
const result = await renderOriginalProduction({
  script,
  assets: [localTestAsset("local-graphic", "graphic"), localTestAsset("local-voice", "voice"), localTestAsset("local-font", "font")],
  assetBindings: {
    voiceAssetId: "local-voice", fontAssetId: "local-font", graphicAssetId: "local-graphic",
    voiceSha256, fontSha256,
  },
  sources: [{ id: "source-1", title: "밈캐치 로컬 테스트 출처", url: "https://catchmeme.com/editorial", approved: true }],
  narrationPath,
  outputDirectory,
  fontPath,
  fontFamily: "Apple SD Gothic Neo",
  now: new Date("2026-10-12T12:00:00.000Z"),
});
process.stdout.write(`${JSON.stringify({ localTestOnly: true, ...result }, null, 2)}\n`);

