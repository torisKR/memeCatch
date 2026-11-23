#!/usr/bin/env node
// Rewrites tests/fixtures/mpe_candidates.json from the real TypeScript of
// POST /api/admin/mpe-candidates, for src/routes/mpe/fixture_tests.rs:
//
//   - the functions of lib/mpe/candidates.ts and the pure ones of
//     candidates.server.ts on chosen inputs (normalization, similarity, the
//     text embedding, Math.hypot, hashes, job checks, ranking, discovery);
//   - parseEvidenceDraftClaims and getAbstentionNotes;
//   - generateEvidenceDraft run on a stub client (rows handed to it) with
//     fetch caught: every request body it sends to OpenRouter, how many
//     budget reservations it makes, what it would store, and how it ends.
//
// Nothing leaves this process. Run it after a change there, with the Node of
// the Next image:
//
//   node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/mpe-candidates-fixture.mjs > server/tests/fixtures/mpe_candidates.json
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.version.startsWith("v22.")) {
  console.error(`run this with Node 22, the Next image's (this is ${process.version})`);
  process.exit(2);
}
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
// lib/db/server.ts imports next/headers; the stub client below replaces what it gives.
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === "next/headers") return { url: "data:text/javascript,export async function cookies(){return {get(){},getAll(){return []}}};export async function headers(){return new Headers()}", shortCircuit: true };
  return next(specifier, context);
}`));
Object.assign(process.env, { OPENROUTER_API_KEY: " fixture-key ", NODE_ENV: "production" });
delete process.env.OPENROUTER_BASE_URL;
delete process.env.OPENROUTER_MPE_MODEL;
const candidates = await import(path.join(ROOT, "lib/mpe/candidates.ts"));
const server = await import(path.join(ROOT, "lib/mpe/candidates.server.ts"));
const contract = await import(path.join(ROOT, "lib/mpe/evidence-draft-contract.ts"));
const draft = await import(path.join(ROOT, "lib/mpe/evidence-draft.server.ts"));

const texts = [
  "중꺾마 그 장면!", "  꺾이지 않는 마음  ", "ＡＢＣ　１２３ abc", "Café Ǆ ß", "😀 emoji only 😀", "가", "가나",
  "𠀀𠀁𠀂 한자", "ㄱㄴㄷ ㅏㅑ", "a_b-c.d", "ΟΔΟΣ", "İstanbul", "", "   ", "١٢٣ arabic", "ⅫⅢ",
];
const vector = (seed) => Array.from({ length: 64 }, (_, i) => ((i * seed) % 7) - 3);
const fingerprints = {
  current: [
    { fingerprint_type: "SHA256", hash_value: "a".repeat(64) },
    { fingerprint_type: "PHASH", hash_value: "ffff0000ffff0000" },
    { fingerprint_type: "AUDIO", hash_value: "audio-1" },
    { fingerprint_type: "TEXT_EMBEDDING", hash_value: "x", embedding: candidates.deterministicTextEmbedding("중꺾마 후보 중꺾마 그 장면") },
  ],
};
const meme = (id, extra = {}) => ({ id, title: "중꺾마 후보밈", aliases: ["중꺾마", null], summary: "중꺾마 요약", description: "설명", sources: [], text: [], fingerprints: [], ...extra });
const source = (id, extra = {}) => ({ id, platform: "youtube", external_id: null, channel_name: "채널A", title: "첫 영상", ...extra });
const rankInputs = [
  {
    candidateId: "c", title: "중꺾마 후보", rightsMode: "USER_UPLOADED", source: source("s2", { platform: "tiktok", external_id: "tt-2", channel_name: null, title: "Second" }),
    text: ["중꺾마 그 장면", "캡션 문장 Caption", "꺾이지 않는 마음"], fingerprints: fingerprints.current,
    memes: [
      meme("m1", { sources: [source("s1")], text: ["꺾이지 않는 마음 영상"], fingerprints: [
        { fingerprint_type: "PHASH", hash_value: "fFff0000fff00000" }, { fingerprint_type: "AUDIO", hash_value: "audio-1" },
        { fingerprint_type: "TEXT_EMBEDDING", hash_value: "e", embedding: vector(5) }] }),
      meme("m2", { title: "중꺾마 다른밈", aliases: [], summary: "다른 요약", description: "Description 2" }),
      meme("m3", { title: "해시전용 사진", aliases: [], summary: "", description: "", fingerprints: [{ fingerprint_type: "SHA256", hash_value: "a".repeat(64) }] }),
      meme("m4", { sources: [source("s9", { platform: "tiktok", external_id: "tt-2" })] }),
      meme("m5", { title: "Completely different", aliases: [], summary: "", description: "" }),
      meme("m6", { title: "중꺾마", aliases: ["후보"], fingerprints: [{ fingerprint_type: "TEXT_EMBEDDING", hash_value: "z", embedding: [] }] }),
    ],
  },
  { candidateId: "c", title: "Video candidate", rightsMode: "NOT_AUTHORIZED", source: null, text: [], fingerprints: [{ fingerprint_type: "PHASH", hash_value: "0f" }], memes: [meme("m1"), meme("m2", { title: "Video candidate" })] },
  { candidateId: "c", title: "같음", rightsMode: "LICENSED_MEDIA", source: source("s1", { channel_name: "" }), text: [], fingerprints: [], memes: [meme("a", { title: "같음" }), meme("b", { title: "같음" })] },
];
const job = (job_type, status, output_json = {}, extra = {}) => ({ job_type, status, processor_version: "1", error_code: null, output_json, ...extra });
const scene = (extra = {}) => job("scene_frames", "completed", { provider: "openrouter", model: "stealth/ox-alpha", providerBacked: true, segmentsWritten: 2, ...extra }, { processor_version: "1.1.0" });
const image = [job("inspect", "completed"), job("fingerprint", "completed"), job("ocr", "completed")];
const jobCases = [
  ["image", image], ["image", [...image, job("draft", "failed")]], ["image", image.slice(0, 2)],
  ["image", [...image.slice(0, 2), job("ocr", "completed", { reason: "ocr_not_configured" })]],
  ["image", [...image.slice(0, 2), job("ocr", "completed", { reason: ["x_not_configured"] })]],
  ["image", [...image.slice(0, 2), job("ocr", "completed", { reason: { not_configured: 1 } })]],
  ["image", [...image.slice(0, 2), job("ocr", "completed", {}, { error_code: "a_not_configured_b" })]],
  ["image", [...image.slice(0, 2), job("ocr", "queued")]], ["audio", image],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), scene({ segmentsWritten: 0 }), job("stt", "skipped", { reason: "no_audio" })]],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), scene(), job("stt", "skipped", { reason: "no_audio", segmentsWritten: 0, audioDetected: false })]],
  ["video", [job("inspect", "completed", { hasAudio: true }), job("fingerprint", "completed"), scene(), job("stt", "skipped", { reason: "audio_stt_disabled", provider: "openrouter", model: "stealth/ox-alpha", providerBacked: false, segmentsWritten: 0, audioDetected: true })]],
  ["video", [job("inspect", "completed", { hasAudio: true }), job("fingerprint", "completed"), scene(), job("stt", "skipped", { reason: "no_audio" })]],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), scene({ segmentsWritten: 1.5 }), job("stt", "skipped", { reason: "no_audio" })]],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), scene(), job("stt", "skipped", { reason: "no_audio", extra: true })]],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), { ...scene(), processor_version: "1.0.0" }, job("stt", "skipped", { reason: "no_audio" })]],
  ["video", [job("inspect", "completed", { hasAudio: false }), job("fingerprint", "completed"), scene(), job("stt", "completed")]],
];
const validate = ([kind, jobs]) => {
  try { server.validateCandidateJobs(kind, jobs); return "ok"; } catch (error) { return `${error.status} ${error.message}`; }
};

const evidence = [
  { id: "s1", kind: "source", sourceId: "s1", text: "youtube | 첫 영상" },
  { id: "t1", kind: "text_segment", textSegmentId: "t1", origin: "OCR", text: "중꺾마" },
  { id: "t2", kind: "text_segment", textSegmentId: "t2", origin: "CAPTION", text: "   " },
  { id: "i1", kind: "ingestion", ingestionId: "i1", text: "MIME: image/png" },
];
const claim = (extra = {}) => ({ field: "MEANING", text: " 뜻 ", evidenceIds: [" t1 "], confidence: 0.5, needsReview: false, ...extra });
const claimCases = [
  [claim()], [claim({ support: "direct", abstentionReason: " 이유 " })], [claim(), claim({ field: "ORIGIN", evidenceIds: [], support: "abstained" })],
  [claim({ evidenceIds: [] })], [claim({ support: "unsupported" })], [claim({ evidenceIds: ["i1"] })], [claim({ evidenceIds: ["t2"] })],
  [claim({ evidenceIds: ["s1", "i1"] })], [claim({ evidenceIds: ["nope"] })], [claim({ extra: 1 })], [claim({ confidence: 1.5 })],
  [claim({ field: "meaning" })], [claim({ text: "  " })], [claim({ support: null })], [claim({ abstentionReason: "x".repeat(501) })],
  [], "not an array", null, [claim({ needsReview: "yes" })], [claim({ confidence: 1 }), claim({ evidenceIds: ["s1"], confidence: 0 })],
];
const claims = claimCases.map((input) => {
  let result;
  try { result = JSON.stringify(contract.parseEvidenceDraftClaims(input, evidence)); } catch (error) { result = error.message; }
  return { input: JSON.stringify(input), result, notes: JSON.stringify(contract.getAbstentionNotes(input)) };
});

// generateEvidenceDraft on a stub client.
const rows = {
  meme_candidates: { id: "f5c10000-0000-4000-8000-000000000001", ingestion_id: "c5c00000-0000-4000-8000-000000000001", title: "중꺾마 \"후보\"" },
  media_ingestions: { id: "c5c00000-0000-4000-8000-000000000001", source_id: "a5c00000-0000-4000-8000-000000000002", ingest_mode: "USER_UPLOADED", mime_type: "image/png", sha256: "1".repeat(64), rights_attested_at: "2026-11-01T00:00:00.123456+00:00" },
  media_sources: { id: "a5c00000-0000-4000-8000-000000000002", platform: "tiktok", canonical_url: "https://tiktok.example/@b/2", channel_name: null, title: "Second \"video\"" },
  text_segments: [
    { id: "e5c10000-0000-4000-8000-000000000001", raw_text: "중꺾마 그 장면!", normalized_text: "중꺾마 그 장면", origin: "OCR" },
    { id: "e5c10000-0000-4000-8000-000000000002", raw_text: "캡션 문장 Caption", normalized_text: null, origin: "CAPTION" },
    { id: "e5c10000-0000-4000-8000-000000000004", raw_text: "  꺾이지 않는 마음  ", normalized_text: "", origin: "METADATA" },
  ],
};
let stored = null;
let reservations = 0;
let reserveError = null;
const builder = (table) => {
  let single = false;
  const chain = new Proxy({}, {
    get(_, name) {
      if (name === "single") return () => { single = true; return chain; };
      if (name === "then") {
        const data = rows[table];
        return (resolve) => resolve({ data: single ? data : data, error: null });
      }
      return () => chain;
    },
  });
  return chain;
};
const client = {
  auth: { getUser: async () => ({ data: { user: { id: "operator" } } }) },
  from: builder,
  rpc: async (name, args) => {
    if (name === "is_operator") return { data: true, error: null };
    if (name === "reserve_openrouter_daily_request") {
      reservations += 1;
      return { data: reservations, error: reserveError };
    }
    stored = JSON.stringify(args);
    return { data: null, error: null };
  },
};
let replies = [];
let sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), body: init.body });
  const reply = replies.shift() ?? { status: 500, body: "{}" };
  if (reply.throws) throw new TypeError("fetch failed");
  return new Response(reply.body, { status: reply.status, headers: reply.headers ?? {} });
};
const content = (text) => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: text } }] }) });
const good = JSON.stringify({ claims: [
  { field: "MEANING", text: "뜻", evidenceIds: ["e5c10000-0000-4000-8000-000000000001", "c5c00000-0000-4000-8000-000000000001"], confidence: 0.75, needsReview: false, support: "direct" },
  { field: "ORIGIN", text: "모름", evidenceIds: [], confidence: 0, needsReview: true, support: "abstained" },
  { field: "SAFETY", text: "주의", evidenceIds: ["a5c00000-0000-4000-8000-000000000002"], confidence: 0.1, needsReview: true, support: "unsupported", abstentionReason: "  근거 없음 " },
] });
const draftCases = [
  ["claims", [content(good)]],
  ["claims in prose", [content(`설명입니다 ${good} 끝`)]],
  ["two objects, then claims", [content("{\"a\":1} {\"b\":2}"), content(good)]],
  ["no object twice", [content("none"), content("still none")]],
  ["503 then claims", [{ status: 503, body: "{}" }, content(good)]],
  ["shared-pool 429 then claims", [{ status: 429, body: JSON.stringify({ error: { message: "Shared pool busy" } }) }, content(good)]],
  ["a plain 429", [{ status: 429, body: JSON.stringify({ error: { message: "slow down" } }) }]],
  ["500", [{ status: 500, body: "{\"error\":{}}" }]],
  ["three 502s", [{ status: 502, body: "" }, { status: 502, body: "" }, { status: 502, body: "" }]],
  ["network errors", [{ throws: true }, { throws: true }, { throws: true }]],
  ["a body that is not JSON", [{ status: 200, body: "nope" }]],
  ["empty content", [content("   ")]],
  ["invalid claims", [content(JSON.stringify({ claims: [{ field: "x" }] }))]],
  ["no supported claim", [content(JSON.stringify({ claims: [{ field: "ORIGIN", text: "t", evidenceIds: [], confidence: 0, needsReview: true, support: "abstained" }] }))]],
  ["a claim on ingestion metadata only", [content(JSON.stringify({ claims: [{ field: "TITLE", text: "t", evidenceIds: ["c5c00000-0000-4000-8000-000000000001"], confidence: 0.2, needsReview: true }] }))]],
  ["no claims key", [content("{\"other\":1}")]],
];
const drafts = [];
for (const [label, script] of draftCases) {
  replies = [...script];
  sent = [];
  stored = null;
  reservations = 0;
  let outcome;
  try { outcome = JSON.stringify(await draft.generateEvidenceDraft(rows.meme_candidates.id, client)); }
  catch (error) { outcome = error instanceof draft.EvidenceDraftError ? `${error.status} ${error.message}` : "plain"; }
  drafts.push({ label, replies: script, requests: sent, reservations, stored, outcome });
}
reserveError = { message: "openrouter_daily_budget_exhausted", code: "P0001" };
replies = [];
sent = [];
let exhausted;
try { await draft.generateEvidenceDraft(rows.meme_candidates.id, client); } catch (error) { exhausted = `${error.status} ${error.message} ${sent.length}`; }

process.stdout.write(`${JSON.stringify({
  normalize: texts.map((text) => [text, candidates.normalizeKoreanText(text)]),
  similarity: texts.flatMap((left) => texts.slice(0, 6).map((right) => [left, right, candidates.koreanTextSimilarity(left, right)])),
  embedding: texts.map((text) => [text, candidates.deterministicTextEmbedding(text)]),
  hypot: [[3, 4], [1e300, 1e300], [0.1, 0.2, 0.3], vector(3), [], [0, -0]].map((values) => [values, Math.hypot(...values)]),
  cosine: [[vector(3), vector(5)], [vector(3), vector(3)], [[1, 0], [0, 1]], [[1, 2], [1]], [[], []], [[0, 0], [1, 1]], [[-1, 0], [1, 0]]].map(([l, r]) => [l, r, candidates.cosineSimilarity(l, r)]),
  phash: [["ffff", "fffe"], [" FFFF ", "ffff"], ["ff", "fff"], ["gg", "gg"], ["", ""], ["0f0f0f0f0f0f0f0f", "0f0f0f0f0f0f0f0e"]].map(([l, r]) => [l, r, candidates.perceptualHashSimilarity(l, r)]),
  jobs: jobCases.map((input) => ({ kind: input[0], jobs: input[1], result: validate(input) })),
  rank: rankInputs.map((input) => ({ input, output: JSON.stringify(server.rankCandidateMatches(input)) })),
  discover: [{
    current: fingerprints.current,
    candidates: [{ ingestion_id: "p1", target_meme_id: "m3" }, { ingestion_id: "p2", target_meme_id: "m1" }, { ingestion_id: "p3", target_meme_id: null }, { ingestion_id: "p4", target_meme_id: "m0" }, { ingestion_id: "p5", target_meme_id: "m1" }],
    previous: [
      { ingestion_id: "p1", fingerprint_type: "SHA256", hash_value: "a".repeat(64) },
      { ingestion_id: "p2", fingerprint_type: "PHASH", hash_value: "ffff0000ffff0001" },
      { ingestion_id: "p3", fingerprint_type: "SHA256", hash_value: "a".repeat(64) },
      { ingestion_id: "p4", fingerprint_type: "PHASH", hash_value: "0000ffff0000ffff" },
      { ingestion_id: "p5", fingerprint_type: "FRAME_PHASH", hash_value: "ffff0000ffff0000" },
    ],
  }].map((input) => ({ ...input, output: server.discoverHashCandidateIds(input.current, input.candidates, input.previous) })),
  claims,
  draft: { rows, cases: drafts, exhausted },
}, null, 1)}\n`);
