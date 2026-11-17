import assert from "node:assert/strict";
import test from "node:test";

import {
  applyYouTubePrivateMetadataPolicy,
  classifyYouTubeRefreshAvailability,
  validateYouTubeVideoBatchExternalIds,
  validateYouTubeVideosListResponse,
  validateYouTubeVideoStatusItems,
} from "../lib/sources/youtube-response.mjs";
import { runRefreshYouTubeSources } from "./refresh-youtube-sources.mjs";
import { runVerifyYouTubePending } from "./verify-youtube-pending.mjs";

const NOW = "2026-11-18T01:00:00.000Z";
const API_KEY = "test-api-key";
const runners = [
  ["refresh", runRefreshYouTubeSources],
  ["pending", runVerifyYouTubePending],
];

function source(index, externalId = videoId(index)) {
  return {
    id: sourceId(index),
    platform: index % 2 === 0 ? "youtube" : "youtube_shorts",
    external_id: externalId,
    canonical_url: `https://provider.example/watch/${String(externalId)}`,
  };
}

function sourceId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function videoId(index) {
  return `vid${String(index).padStart(8, "0")}`;
}

function video(id, privacyStatus = "public", embeddable = true, extras = {}) {
  return {
    id,
    status: { privacyStatus, embeddable, license: "youtube", madeForKids: false },
    snippet: {
      title: `title-${id}`,
      channelId: "channel-id",
      channelTitle: "channel-title",
      publishedAt: "2026-01-01T00:00:00.000Z",
      thumbnails: { high: { url: `https://example.test/${id}.jpg` } },
    },
    contentDetails: { duration: "PT1M30S" },
    ...extras,
  };
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function restRecorder() {
  const calls = [];
  const rest = async (path, options) => {
    calls.push({ path, options, body: options?.body ? JSON.parse(options.body) : undefined });
    return {};
  };
  return { rest, calls };
}

function sourcePatch(calls, id) {
  return calls.find((call) => call.path === `media_sources?id=eq.${id}`)?.body;
}

function availabilityPatch(calls, externalId) {
  return calls.find((call) => call.path.includes(`content_id=eq.${externalId}`))?.body;
}

test("accepts explicit empty and partial videos.list results", () => {
  const requested = new Set(["requested-a", "requested-b"]);
  const empty = { items: [] };
  const partial = { items: [video("requested-b")] };

  assert.strictEqual(validateYouTubeVideosListResponse(empty, requested), empty.items);
  assert.strictEqual(validateYouTubeVideosListResponse(partial, requested), partial.items);
});

test("validates batch IDs and explicit status fields", () => {
  assert.throws(
    () => validateYouTubeVideoBatchExternalIds(["requested-a", null]),
    /^Error: youtube_video_list_inconclusive$/,
  );
  assert.throws(
    () => validateYouTubeVideoStatusItems([
      { id: "requested-a", status: { privacyStatus: "public" } },
    ]),
    /^Error: youtube_video_list_inconclusive$/,
  );
  assert.strictEqual(
    validateYouTubeVideoStatusItems([video("requested-a")]).length,
    1,
  );
});

test("keeps link-only public live and clears only private cached metadata", () => {
  assert.equal(
    classifyYouTubeRefreshAvailability({ privacyStatus: "public", embeddable: false }, false),
    "live",
  );
  assert.equal(
    classifyYouTubeRefreshAvailability({ privacyStatus: "public", embeddable: false }, true),
    "region_blocked",
  );
  assert.equal(
    classifyYouTubeRefreshAvailability({ privacyStatus: "unlisted", embeddable: true }, false),
    "dead",
  );

  const metadata = {
    title: "private title",
    thumbnail_url: "https://example.test/private.jpg",
    channel_name: "retained channel",
    metadata_expires_at: "2026-12-18T01:00:00.000Z",
  };
  assert.deepEqual(applyYouTubePrivateMetadataPolicy(metadata, "private", NOW), {
    title: null,
    thumbnail_url: null,
    channel_name: "retained channel",
    metadata_expires_at: null,
    removed_at: NOW,
  });
  assert.deepEqual(
    applyYouTubePrivateMetadataPolicy(metadata, "unlisted", NOW),
    { ...metadata, removed_at: null },
  );
});

for (const [name, run] of runners) {
  test(`${name}: malformed or incomplete status writes no PATCH`, async () => {
    for (const body of [
      { items: {} },
      { items: [{ id: videoId(0), status: { privacyStatus: "public" } }] },
    ]) {
      const { rest, calls } = restRecorder();
      await assert.rejects(
        run({
          sources: [source(0)],
          apiKey: API_KEY,
          fetchImpl: async () => response(body),
          rest,
          now: NOW,
        }),
        /youtube_video_list_inconclusive/,
      );
      assert.equal(calls.length, 0);
    }
  });

  test(`${name}: null, empty, and malformed IDs are deferred while valid IDs continue`, async () => {
    const { rest, calls } = restRecorder();
    let requestedIds;
    const malformedId = "bad/id";
    const result = await run({
      sources: [
        source(0, null),
        source(1, ""),
        source(2, malformedId),
        source(3, "too-short"),
        source(4),
      ],
      apiKey: API_KEY,
      fetchImpl: async (input) => {
        requestedIds = new URL(input).searchParams.get("id");
        return response({ items: [video(videoId(4))] });
      },
      rest,
      now: NOW,
    });

    assert.equal(requestedIds, videoId(4));
    assert.equal(result.checked, 5);
    assert.equal(result.failed, 4);
    assert.deepEqual(result.errors, [
      `youtube_source_external_id_inconclusive:${sourceId(0)}`,
      `youtube_source_external_id_inconclusive:${sourceId(1)}`,
      `youtube_source_external_id_inconclusive:${sourceId(2)}`,
      `youtube_source_external_id_inconclusive:${sourceId(3)}`,
    ]);
    assert.doesNotMatch(JSON.stringify(result.errors), /provider\.example|bad\/id|test-api-key/);
    assert.equal(sourcePatch(calls, sourceId(0)), undefined);
    assert.equal(sourcePatch(calls, sourceId(1)), undefined);
    assert.equal(sourcePatch(calls, sourceId(2)), undefined);
    assert.equal(sourcePatch(calls, sourceId(3)), undefined);
    assert(sourcePatch(calls, sourceId(4)));
  });

  test(`${name}: dry-run computes results without PATCH`, async () => {
    const { rest, calls } = restRecorder();
    const result = await run({
      sources: [source(0)],
      apiKey: API_KEY,
      fetchImpl: async () => response({ items: [video(videoId(0))] }),
      rest,
      dryRun: true,
      now: NOW,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.checked, 1);
    assert.equal(result.apiCalls, 1);
    assert.equal(calls.length, 0);
  });

  test(`${name}: a malformed second batch writes nothing from that batch`, async () => {
    const sources = Array.from({ length: 51 }, (_, index) => source(index));
    const { rest, calls } = restRecorder();
    let fetchCount = 0;
    await assert.rejects(
      run({
        sources,
        apiKey: API_KEY,
        fetchImpl: async (input) => {
          fetchCount += 1;
          const ids = new URL(input).searchParams.get("id").split(",");
          if (fetchCount === 1) return response({ items: ids.map((id) => video(id)) });
          return response({ items: [{ id: ids[0], status: { privacyStatus: "public" } }] });
        },
        rest,
        now: NOW,
      }),
      /youtube_video_list_inconclusive/,
    );

    assert.equal(fetchCount, 2);
    assert(sourcePatch(calls, sourceId(49)));
    assert.equal(sourcePatch(calls, sourceId(50)), undefined);
  });
}

test("refresh: empty and partial results perform authoritative removal PATCHes", async () => {
  const emptyRecorder = restRecorder();
  const emptyResult = await runRefreshYouTubeSources({
    sources: [source(0)],
    apiKey: API_KEY,
    fetchImpl: async () => response({ items: [] }),
    rest: emptyRecorder.rest,
    now: NOW,
  });
  assert.equal(emptyResult.removed, 1);
  assert.deepEqual(sourcePatch(emptyRecorder.calls, sourceId(0)), {
    removed_at: NOW,
    last_checked_at: NOW,
    title: null,
    thumbnail_url: null,
    metadata_expires_at: null,
  });
  assert.deepEqual(availabilityPatch(emptyRecorder.calls, videoId(0)), { availability: "dead" });

  const partialRecorder = restRecorder();
  const partialResult = await runRefreshYouTubeSources({
    sources: [source(0), source(1)],
    apiKey: API_KEY,
    fetchImpl: async () => response({ items: [video(videoId(0))] }),
    rest: partialRecorder.rest,
    now: NOW,
  });
  assert.equal(partialResult.checked, 2);
  assert.equal(partialResult.removed, 1);
  assert.equal(sourcePatch(partialRecorder.calls, sourceId(0)).removed_at, null);
  assert.equal(sourcePatch(partialRecorder.calls, sourceId(1)).removed_at, NOW);
});

test("refresh: private, unlisted, link-only, and region-blocked PATCHes match cron policy", async () => {
  const sources = [source(0), source(1), source(2), source(3)];
  const items = [
    video(videoId(0), "private", false),
    video(videoId(1), "unlisted", false),
    video(videoId(2), "public", false),
    video(videoId(3), "public", false, {
      contentDetails: { duration: "PT1M30S", regionRestriction: { blocked: ["KR"] } },
    }),
  ];
  const { rest, calls } = restRecorder();
  const result = await runRefreshYouTubeSources({
    sources,
    apiKey: API_KEY,
    fetchImpl: async () => response({ items }),
    rest,
    now: NOW,
  });

  assert.deepEqual(
    { checked: result.checked, removed: result.removed, hidden: result.hidden, failed: result.failed },
    { checked: 4, removed: 1, hidden: 2, failed: 0 },
  );
  assert.match(sourcePatch(calls, sourceId(0)).removed_at, /^2026-11-18/);
  assert.equal(sourcePatch(calls, sourceId(0)).title, null);
  assert.equal(sourcePatch(calls, sourceId(0)).thumbnail_url, null);
  assert.equal(sourcePatch(calls, sourceId(1)).removed_at, null);
  assert.equal(sourcePatch(calls, sourceId(1)).title, `title-${videoId(1)}`);
  assert.equal(sourcePatch(calls, sourceId(2)).embeddable, false);
  assert.deepEqual(availabilityPatch(calls, videoId(0)), { availability: "dead" });
  assert.deepEqual(availabilityPatch(calls, videoId(1)), { availability: "dead" });
  assert.deepEqual(availabilityPatch(calls, videoId(2)), { availability: "live" });
  assert.deepEqual(availabilityPatch(calls, videoId(3)), { availability: "region_blocked" });
});

test("pending: an explicit empty result performs an authoritative removal PATCH", async () => {
  const { rest, calls } = restRecorder();
  const result = await runVerifyYouTubePending({
    sources: [source(0)],
    apiKey: API_KEY,
    fetchImpl: async () => response({ items: [] }),
    rest,
    now: NOW,
  });

  assert.equal(result.checked, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(sourcePatch(calls, sourceId(0)), {
    removed_at: NOW,
    last_checked_at: NOW,
    title: null,
    thumbnail_url: null,
    metadata_expires_at: null,
  });
});

test("pending: partial, private, unlisted, and link-only produce safe PATCHes and stats", async () => {
  const { rest, calls } = restRecorder();
  const result = await runVerifyYouTubePending({
    sources: [source(0), source(1), source(2), source(3)],
    apiKey: API_KEY,
    fetchImpl: async () => response({
      items: [
        video(videoId(0), "private", false),
        video(videoId(1), "unlisted", false),
        video(videoId(2), "public", false),
      ],
    }),
    rest,
    now: NOW,
  });

  assert.deepEqual(
    {
      checked: result.checked,
      removed: result.removed,
      unembeddable: result.unembeddable,
      failed: result.failed,
    },
    { checked: 4, removed: 2, unembeddable: 2, failed: 0 },
  );
  assert.equal(sourcePatch(calls, sourceId(0)).removed_at, NOW);
  assert.equal(sourcePatch(calls, sourceId(0)).title, null);
  assert.equal(sourcePatch(calls, sourceId(1)).removed_at, null);
  assert.equal(sourcePatch(calls, sourceId(1)).title, `title-${videoId(1)}`);
  assert.equal(sourcePatch(calls, sourceId(2)).embeddable, false);
  assert.equal(sourcePatch(calls, sourceId(3)).removed_at, NOW);
});

test("runner errors do not expose API keys, response bodies, or database errors", async () => {
  const secretKey = "secret-api-key";
  const secretBody = "private-upstream-body";
  await assert.rejects(
    runRefreshYouTubeSources({
      sources: [source(0)],
      apiKey: secretKey,
      fetchImpl: async () => new Response(secretBody, { status: 403 }),
      rest: async () => {},
      now: NOW,
    }),
    (error) => {
      assert.equal(error.message, "videos.list HTTP 403");
      assert.doesNotMatch(error.message, new RegExp(`${secretKey}|${secretBody}`));
      return true;
    },
  );

  await assert.rejects(
    runVerifyYouTubePending({
      sources: [source(0)],
      apiKey: API_KEY,
      fetchImpl: async () => response({ items: [video(videoId(0))] }),
      rest: async () => {
        throw new Error("private-database-body");
      },
      now: NOW,
    }),
    /^Error: youtube_source_write_failed$/,
  );
});
