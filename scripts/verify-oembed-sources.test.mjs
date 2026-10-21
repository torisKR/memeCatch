import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, planOEmbedVerification, verifyOEmbedSources } from "./verify-oembed-sources.mjs";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const TIKTOK_ID = "1234567890123456789";
const INSTAGRAM_ID = "ABCDE_123";
const pending = [{ source_id: SOURCE_ID }];
const tiktok = {
  id: SOURCE_ID,
  platform: "tiktok",
  external_id: TIKTOK_ID,
  canonical_url: `https://www.tiktok.com/@creator/video/${TIKTOK_ID}`,
};
const instagram = {
  id: SOURCE_ID,
  platform: "instagram",
  external_id: INSTAGRAM_ID,
  canonical_url: `https://www.instagram.com/reel/${INSTAGRAM_ID}/`,
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function harness({
  source = tiktok,
  response = jsonResponse({
    html: `<blockquote cite=\"${tiktok.canonical_url}\" data-video-id=\"${TIKTOK_ID}\"></blockquote>`,
  }),
  fetchError,
} = {}) {
  const writes = [];
  const calls = [];
  let reads = 0;
  const restAll = async (_rest, path) => {
    calls.push({ kind: "read", path });
    reads += 1;
    return reads === 1 ? pending : [source];
  };
  const rest = async (path, options = {}) => {
    writes.push({ path, options, body: JSON.parse(options.body) });
  };
  const fetch = async (url, options) => {
    calls.push({ kind: "provider", url: url.toString(), options });
    if (fetchError) throw fetchError;
    return response;
  };
  return { rest, restAll, fetch, writes, calls };
}

test("CLI is plan-only by default and execution is one bounded UUID", () => {
  assert.deepEqual(parseArgs([]), { execute: false, dryRun: false, limit: 2, sourceId: null });
  assert.deepEqual(parseArgs(["--execute", "--limit=1", `--source-id=${SOURCE_ID}`]), {
    execute: true, dryRun: false, limit: 1, sourceId: SOURCE_ID,
  });
  for (const argv of [
    ["--execute"],
    ["--execute", "--limit=2", `--source-id=${SOURCE_ID}`],
    ["--execute", "--limit=1"],
    ["--limit=3"],
    ["--dry-run"],
    ["--source-id=nope"],
    ["--unknown"],
  ]) assert.throws(() => parseArgs(argv));
});

test("plan reads inventory without provider calls or DB writes", async () => {
  const h = harness();
  const result = await planOEmbedVerification({ rest: h.rest, restAll: h.restAll, limit: 2 });
  assert.deepEqual(result, {
    mode: "plan", totalPending: 1, candidates: 1, selected: 1, eligible: 1,
    reviewRequired: 0, invalid: 0, providerCalls: 0, dbWrites: 0,
  });
  assert.equal(h.calls.some((call) => call.kind === "provider"), false);
  assert.deepEqual(h.writes, []);
});

test("invalid platform, ID, canonical URL, and tracking variants never reach a provider", async () => {
  for (const source of [
    { ...tiktok, platform: "instagram" },
    { ...tiktok, external_id: "9999999999" },
    { ...tiktok, canonical_url: "https://evil.example/video/1234567890123456789" },
    { ...tiktok, canonical_url: `${tiktok.canonical_url}?tracking=1` },
  ]) {
    const h = harness({ source });
    const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
    assert.equal(result.invalid, 1);
    assert.equal(result.providerCalls, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("all TikTok oEmbed errors including 404 stay deferred without writes", async () => {
  const cases = [
    { response: jsonResponse({}, 400) },
    { response: jsonResponse({}, 401) },
    { response: jsonResponse({}, 403) },
    { response: jsonResponse({}, 404) },
    { response: jsonResponse({}, 429) },
    { response: jsonResponse({}, 500) },
    { fetchError: new Error("timeout") },
    { response: new Response("not-json", { status: 200 }) },
    { response: jsonResponse({ title: "no html" }) },
    { response: jsonResponse({ html: "wrong-content" }) },
  ];
  for (const testCase of cases) {
    const h = harness(testCase);
    const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
    assert.equal(result.deferred, 1);
    assert.equal(result.removed, 0);
    assert.equal(result.dbWrites, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("TikTok identity must be an exact blockquote data-video-id and normalized cite pair", async () => {
  const otherId = "9999999999999999999";
  for (const html of [
    `<p>${TIKTOK_ID}</p>`,
    `<script>const id = \"${TIKTOK_ID}\"</script>`,
    `<iframe src=\"https://example.test/${TIKTOK_ID}\"></iframe>`,
    `<blockquote cite=\"${tiktok.canonical_url}\" data-video-id=\"${TIKTOK_ID}0\"></blockquote>`,
    `<blockquote cite=\"https://www.tiktok.com/@other/video/${otherId}\" data-video-id=\"${TIKTOK_ID}\"></blockquote>`,
    `<blockquote data-video-id=\"${TIKTOK_ID}\"></blockquote>`,
  ]) {
    const h = harness({ response: jsonResponse({ html }) });
    const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
    assert.equal(result.deferred, 1);
    assert.equal(result.verified, 0);
    assert.equal(result.dbWrites, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("oversize provider response is cancelled before the complete body is buffered", async () => {
  const totalChunks = 12;
  let pulls = 0;
  let cancellations = 0;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls > totalChunks) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(96 * 1024).fill(120));
    },
    cancel() {
      cancellations += 1;
    },
  });
  const h = harness({ response: new Response(body, { status: 200 }) });
  const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
  assert.equal(result.deferred, 1);
  assert.equal(result.dbWrites, 0);
  assert.equal(cancellations, 1);
  assert.ok(pulls < totalChunks, `expected early cancellation, read ${pulls}/${totalChunks} chunks`);
});

test("Instagram is review-required and never calls oEmbed or writes, including a mocked 404", async () => {
  for (const response of [
    jsonResponse({ html: `permalink/${INSTAGRAM_ID}` }),
    jsonResponse({}, 400),
    jsonResponse({}, 404),
    jsonResponse({}, 500),
  ]) {
    const h = harness({ source: instagram, response });
    const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
    assert.equal(result.reviewRequired, 1);
    assert.equal(result.checked, 0);
    assert.equal(result.removed, 0);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.dbWrites, 0);
    assert.equal(h.calls.some((call) => call.kind === "provider"), false);
    assert.deepEqual(h.writes, []);
  }
});

test("valid TikTok response stores only frontend embed validation fields", async () => {
  const h = harness({
    response: jsonResponse({
      html: `<blockquote cite=\"${tiktok.canonical_url}\" data-video-id=\"${TIKTOK_ID}\"></blockquote>`,
      title: "must not persist",
      author_name: "must not persist",
    }),
  });
  const result = await verifyOEmbedSources({ ...h, limit: 1, sourceId: SOURCE_ID });
  assert.equal(result.verified, 1);
  assert.equal(result.dbWrites, 1);
  const providerCall = h.calls.find((call) => call.kind === "provider");
  assert.equal(new URL(providerCall.url).origin, "https://www.tiktok.com");
  assert.equal(providerCall.options.redirect, "error");
  assert.deepEqual(Object.keys(h.writes[0].body).sort(), [
    "embeddable", "last_checked_at", "metadata_expires_at", "metadata_refreshed_at",
  ]);
  assert.equal(h.writes[0].body.embeddable, true);
  assert.equal("title" in h.writes[0].body, false);
  assert.equal("channel_name" in h.writes[0].body, false);
  assert.equal("review_state" in h.writes[0].body, false);
  assert.equal("rights_basis" in h.writes[0].body, false);
});

test("direct execution helper rejects broad limits and missing source scope before any read", async () => {
  const h = harness();
  await assert.rejects(() => verifyOEmbedSources({ ...h, limit: 2, sourceId: SOURCE_ID }));
  await assert.rejects(() => verifyOEmbedSources({ ...h, limit: 1, sourceId: null }));
  assert.equal(h.calls.length, 0);
});
