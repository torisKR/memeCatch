import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArgs,
  parseMaxLimit,
  planYoutubePendingVerification,
  verifyYoutubePending,
} from "./verify-youtube-pending.mjs";

const VIDEO_ID = "abcdefghijk";

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => "credential=must-not-leak",
});

function harness({ links = [{ source_id: "s1" }], sources, body, status = 200, dryRun = false }) {
  const writes = [];
  let reads = 0;
  const restAll = async () => (++reads === 1 ? links : sources);
  const rest = async (path, options = {}) => writes.push({ path, body: JSON.parse(options.body) });
  const fetch = async () => response(body, status);
  return { restAll, rest, fetch, writes, dryRun };
}

test("parseMaxLimit rejects non-positive and non-finite limits", () => {
  assert.equal(parseMaxLimit(undefined, 50), 50);
  assert.equal(parseMaxLimit("2", 50), 2);
  assert.throws(() => parseMaxLimit("0", 50), /positive finite/);
  assert.throws(() => parseMaxLimit("0.5", 50), /positive finite/);
  assert.throws(() => parseMaxLimit("Infinity", 50), /positive finite/);
  assert.throws(() => parseMaxLimit("51", 50), /at most 50/);
});

test("parseArgs is plan-only by default and gates every API request", () => {
  assert.deepEqual(parseArgs([]), { execute: false, dryRun: false, limit: 50 });
  assert.deepEqual(parseArgs(["--execute", "--limit=1"]), {
    execute: true,
    dryRun: false,
    limit: 1,
  });
  assert.throws(() => parseArgs(["--execute"]));
  assert.throws(() => parseArgs(["--dry-run"]));
  assert.throws(() => parseArgs(["--execute", "--limit=100"]));
  assert.throws(() => parseArgs(["--wat"]));
});

test("pending plan performs reads only and reports zero external calls/writes", async () => {
  let reads = 0;
  const writes = [];
  const plan = await planYoutubePendingVerification({
    rest: async (...args) => writes.push(args),
    restAll: async () => {
      reads += 1;
      if (reads === 1) return [{ source_id: "valid" }, { source_id: "invalid" }];
      return [
        { id: "valid", platform: "youtube", external_id: VIDEO_ID },
        { id: "invalid", platform: "youtube", external_id: "bad" },
      ];
    },
    limit: 50,
  });
  assert.deepEqual(plan, {
    mode: "plan",
    totalPending: 2,
    candidates: 2,
    selected: 2,
    eligible: 1,
    invalid: 1,
    externalApiCalls: 0,
    dbWrites: 0,
  });
  assert.equal(reads, 2);
  assert.deepEqual(writes, []);
});

test("malformed items fails closed", async () => {
  const h = harness({ sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }], body: {} });
  await assert.rejects(() => verifyYoutubePending({ ...h, apiKey: "test", logger: null }), /items array/);
  assert.deepEqual(h.writes, []);
});

test("API-omitted IDs remain pending and are reported uncertain", async () => {
  const h = harness({ sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }], body: { items: [] } });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.equal(stats.removed, 0);
  assert.deepEqual(h.writes, []);
});

test("blank, malformed, and URL-mismatched source IDs are skipped", async () => {
  let fetched = false;
  const h = harness({
    links: [{ source_id: "s1" }, { source_id: "s2" }, { source_id: "s3" }],
    sources: [
      { id: "s1", platform: "youtube", external_id: "" },
      { id: "s2", platform: "youtube", external_id: "short" },
      { id: "s3", platform: "youtube", external_id: VIDEO_ID, canonical_url: "https://youtu.be/lmnopqrstuv" },
    ],
    body: { items: [] },
  });
  h.fetch = async () => { fetched = true; return response({ items: [] }); };
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.invalid, 3);
  assert.equal(fetched, false);
  assert.deepEqual(h.writes, []);
});

test("unknown status keeps embeddable null and pending reviewable", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    body: { items: [{ id: VIDEO_ID, status: {} }] },
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.deepEqual(h.writes, []);
});

test("unknown privacy status remains pending and unmodified", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    body: {
      items: [{ id: VIDEO_ID, status: { privacyStatus: "provider_future_state", embeddable: false } }],
    },
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.uncertain, 1);
  assert.deepEqual(h.writes, []);
});

test("definite private and unlisted statuses are ineligible without embeddable field", async () => {
  const h = harness({
    links: [{ source_id: "s1" }, { source_id: "s2" }],
    sources: [
      { id: "s1", platform: "youtube", external_id: "privat00001" },
      { id: "s2", platform: "youtube", external_id: "unlist00001" },
    ],
    body: {
      items: [
        { id: "privat00001", status: { privacyStatus: "private" } },
        { id: "unlist00001", status: { privacyStatus: "unlisted" } },
      ],
    },
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.unembeddable, 2);
  assert.deepEqual(h.writes.map((write) => write.body.embeddable), [false, false]);
});

test("explicit public embeddable and explicit private are persisted", async () => {
  const h = harness({
    links: [{ source_id: "s1" }, { source_id: "s2" }],
    sources: [
      { id: "s1", platform: "youtube", external_id: VIDEO_ID },
      { id: "s2", platform: "youtube_shorts", external_id: "lmnopqrstuv" },
    ],
    body: { items: [
      { id: VIDEO_ID, status: { privacyStatus: "public", embeddable: true } },
      { id: "lmnopqrstuv", status: { privacyStatus: "private", embeddable: false } },
    ] },
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.verified, 1);
  assert.equal(stats.unembeddable, 1);
  assert.deepEqual(h.writes.map((w) => w.body.embeddable), [true, false]);
});

test("explicit deleted and either form of KR restriction stay ineligible", async () => {
  const h = harness({
    links: [{ source_id: "s1" }, { source_id: "s2" }, { source_id: "s3" }],
    sources: [
      { id: "s1", platform: "youtube", external_id: "delete00001" },
      { id: "s2", platform: "youtube", external_id: "blocke00001" },
      { id: "s3", platform: "youtube", external_id: "allowe00001" },
    ],
    body: { items: [
      { id: "delete00001", status: { uploadStatus: "deleted" } },
      { id: "blocke00001", status: { privacyStatus: "public", embeddable: true }, contentDetails: { regionRestriction: { blocked: ["KR"] } } },
      { id: "allowe00001", status: { privacyStatus: "public", embeddable: true }, contentDetails: { regionRestriction: { allowed: ["US"] } } },
    ] },
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.removed, 1);
  assert.equal(stats.regionBlocked, 2);
  assert.equal(h.writes[0].body.removed_at.length > 0, true);
  assert.deepEqual(h.writes.slice(1).map((w) => w.body.embeddable), [false, false]);
});

test("HTTP failure message excludes response body", async () => {
  const h = harness({ sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }], body: {}, status: 500 });
  await assert.rejects(
    () => verifyYoutubePending({ ...h, apiKey: "test", logger: null }),
    (error) => error.message === "videos.list HTTP 500"
  );
});

test("dry-run uses YouTube API and never writes DB", async () => {
  const h = harness({
    sources: [{ id: "s1", platform: "youtube", external_id: VIDEO_ID }],
    body: { items: [{ id: VIDEO_ID, status: { privacyStatus: "public", embeddable: true } }] },
    dryRun: true,
  });
  const stats = await verifyYoutubePending({ ...h, apiKey: "test", logger: null });
  assert.equal(stats.apiCalls, 1);
  assert.deepEqual(h.writes, []);
});
