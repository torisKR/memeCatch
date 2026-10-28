import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArgs,
  parseMaxLimit,
  planYoutubeSourceRefresh,
  refreshYoutubeSources,
} from "./refresh-youtube-sources.mjs";

const VIDEO_ID = "abcdefghijk";

function response(body, { ok = true, status = 200, text = "secret response body" } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => text,
  };
}

function harness({ sources, apiBody, apiResponse, dryRun = false }) {
  const writes = [];
  const rest = async (path, options = {}) => {
    writes.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
  };
  const fetch = async () => apiResponse ?? response(apiBody);
  const restAll = async () => sources;
  return { writes, rest, fetch, restAll, dryRun };
}

test("parseMaxLimit accepts only finite positive limits", () => {
  assert.equal(parseMaxLimit(undefined, 50), 50);
  assert.equal(parseMaxLimit("1", 2000), 1);
  assert.equal(parseMaxLimit("1.9", 2000), 1);
  for (const value of ["0", "0.5", "-1", "Infinity", "NaN", "nope"]) {
    assert.throws(() => parseMaxLimit(value, 50), /positive finite/);
  }
  assert.throws(() => parseMaxLimit("51", 50), /at most 50/);
});

test("parseArgs defaults to plan-only and execute requires an explicit bounded limit", () => {
  assert.deepEqual(parseArgs([]), { execute: false, dryRun: false, limit: 50 });
  assert.deepEqual(parseArgs(["--limit=12"]), { execute: false, dryRun: false, limit: 12 });
  assert.deepEqual(parseArgs(["--execute", "--limit=12", "--dry-run"]), {
    execute: true,
    dryRun: true,
    limit: 12,
  });
  for (const argv of [
    ["--execute"],
    ["--dry-run"],
    ["--execute", "--limit=51"],
    ["--execute", "--limit=1", "--limit=2"],
    ["--unknown"],
  ]) {
    assert.throws(() => parseArgs(argv));
  }
});

test("plan reads source inventory without API calls or DB writes", async () => {
  const writes = [];
  const plan = await planYoutubeSourceRefresh({
    rest: async (...args) => writes.push(args),
    restAll: async () => [
      { id: "valid", platform: "youtube", external_id: VIDEO_ID },
      { id: "invalid", platform: "youtube", external_id: "short" },
    ],
    limit: 50,
  });
  assert.deepEqual(plan, {
    mode: "plan",
    total: 2,
    selected: 2,
    eligible: 1,
    invalid: 1,
    externalApiCalls: 0,
    dbWrites: 0,
  });
  assert.deepEqual(writes, []);
});

test("missing or malformed videos.items fails closed without DB writes", async () => {
  for (const apiBody of [{}, { items: null }, { items: {} }]) {
    const h = harness({ sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }], apiBody });
    await assert.rejects(() => refreshYoutubeSources({ ...h, apiKey: "test", logger: null }), /items array/);
    assert.deepEqual(h.writes, []);
  }
});

test("an omitted requested ID is uncertain and does not mutate status or availability", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: { items: [] },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.equal(stats.removed, 0);
  assert.deepEqual(h.writes, []);
});

test("blank, malformed, and URL-mismatched source IDs are skipped before the API request", async () => {
  let fetched = false;
  const h = harness({
    sources: [
      { id: "blank", platform: "youtube", external_id: " " },
      { id: "short", platform: "youtube", external_id: "too-short" },
      {
        id: "mismatch",
        platform: "youtube",
        external_id: VIDEO_ID,
        canonical_url: "https://youtu.be/lmnopqrstuv",
      },
    ],
    apiBody: { items: [] },
  });
  h.fetch = async () => { fetched = true; return response({ items: [] }); };
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.invalid, 3);
  assert.equal(stats.checked, 0);
  assert.equal(fetched, false);
  assert.deepEqual(h.writes, []);
});

test("unknown status preserves current availability", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: { items: [{ id: VIDEO_ID, snippet: { title: "title" }, status: {} }] },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.equal(h.writes.some((w) => w.path.startsWith("meme_contents?")), false);
  const sourceWrite = h.writes.find((w) => w.path === "media_sources?id=eq.s1");
  assert.equal("embeddable" in sourceWrite.body, false);
  assert.equal("public_status" in sourceWrite.body, false);
});

test("unknown privacy status is uncertain and preserves availability", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: {
      items: [{ id: VIDEO_ID, status: { privacyStatus: "provider_future_state", embeddable: false } }],
    },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.equal(h.writes.some((write) => write.path.startsWith("meme_contents?")), false);
  const sourceWrite = h.writes.find((write) => write.path === "media_sources?id=eq.s1");
  assert.equal("embeddable" in sourceWrite.body, false);
  assert.equal("public_status" in sourceWrite.body, false);
});

test("definite private and unlisted statuses hide even when embeddable is omitted", async () => {
  const h = harness({
    sources: [
      { id: "private", platform: "youtube", external_id: "privat00001" },
      { id: "unlisted", platform: "youtube", external_id: "unlist00001" },
    ],
    apiBody: {
      items: [
        { id: "privat00001", status: { privacyStatus: "private" } },
        { id: "unlist00001", status: { privacyStatus: "unlisted" } },
      ],
    },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.hidden, 2);
  assert.equal(
    h.writes.filter((write) => write.path.startsWith("meme_contents?")).length,
    4
  );
});

test("explicit private, deleted, and KR restriction hide only their linked media", async () => {
  const sources = [
    { id: "private", platform: "youtube", external_id: "privat00001" },
    { id: "deleted", platform: "youtube", external_id: "delete00001" },
    { id: "blocked", platform: "youtube", external_id: "blocke00001" },
    { id: "allowed", platform: "youtube", external_id: "allowe00001" },
  ];
  const h = harness({
    sources,
    apiBody: { items: [
      { id: "privat00001", status: { privacyStatus: "private", embeddable: false } },
      { id: "delete00001", status: { uploadStatus: "deleted" } },
      { id: "blocke00001", status: { privacyStatus: "public", embeddable: true }, contentDetails: { regionRestriction: { blocked: ["KR"] } } },
      { id: "allowe00001", status: { privacyStatus: "public", embeddable: true }, contentDetails: { regionRestriction: { allowed: ["US", "JP"] } } },
    ] },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.hidden, 1);
  assert.equal(stats.removed, 1);
  assert.equal(stats.regionBlocked, 2);
  const availabilityWrites = h.writes.filter((w) => w.path.startsWith("meme_contents?"));
  assert.deepEqual(availabilityWrites.map((w) => w.body.availability), [
    "dead", "dead", "dead", "dead",
    "region_blocked", "region_blocked", "region_blocked", "region_blocked",
  ]);
  assert.ok(availabilityWrites.every((w) => !w.path.includes("content_id=eq.undefined")));
});

test("availability sync covers legacy YouTube and YouTube Shorts rows sharing an ID", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: { items: [{ id: VIDEO_ID, status: { privacyStatus: "private" } }] },
  });
  await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  const availabilityPaths = h.writes
    .filter((write) => write.path.startsWith("meme_contents?"))
    .map((write) => decodeURIComponent(write.path));
  assert.equal(availabilityPaths.some((path) => path.includes("platform=eq.YouTube&")), true);
  assert.equal(availabilityPaths.some((path) => path.includes("platform=eq.YouTube Shorts&")), true);
});

test("region-blocked source metadata remains ineligible for later approval", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: {
      items: [{
        id: VIDEO_ID,
        status: { privacyStatus: "public", embeddable: true },
        contentDetails: { regionRestriction: { blocked: ["KR"] } },
      }],
    },
  });
  await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  const sourceWrite = h.writes.find((write) => write.path === "media_sources?id=eq.s1");
  assert.equal(sourceWrite.body.embeddable, false);
});

test("HTTP errors do not include response body secrets", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiResponse: response({}, { ok: false, status: 403, text: "API_KEY=super-secret" }),
  });
  await assert.rejects(
    () => refreshYoutubeSources({ ...h, apiKey: "test", logger: null }),
    (error) => error.message === "videos.list HTTP 403"
  );
});

test("dry-run still calls the API but performs no DB writes", async () => {
  const h = harness({
    dryRun: true,
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    apiBody: { items: [{ id: VIDEO_ID, status: { privacyStatus: "private", embeddable: false } }] },
  });
  const stats = await refreshYoutubeSources({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.apiCalls, 1);
  assert.deepEqual(h.writes, []);
});
