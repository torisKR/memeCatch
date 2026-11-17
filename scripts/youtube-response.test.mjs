import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

async function spawnRunnerCli(scriptName) {
  const temp = await mkdtemp(join(tmpdir(), "memecatch-youtube-cli-"));
  const fixturePath = join(temp, "source-pipeline-rest-fixture.mjs");
  const hooksPath = join(temp, "hooks.mjs");
  const registerPath = join(temp, "register.mjs");
  const writesPath = join(temp, "writes.log");
  const invalidSource = source(0, null);
  const validSource = source(1);

  await writeFile(fixturePath, `
import { appendFileSync } from "node:fs";
const sources = ${JSON.stringify([invalidSource, validSource])};
export function loadEnv() { return { YOUTUBE_API_KEY: "cli-test-key" }; }
export function createRestClient() {
  return async (path) => { appendFileSync(${JSON.stringify(writesPath)}, path + "\\n"); return {}; };
}
export async function restAll(_rest, path) {
  if (path.startsWith("meme_media")) return sources.map((row) => ({ source_id: row.id }));
  return sources;
}
`);
  await writeFile(hooksPath, `
const fixtureUrl = ${JSON.stringify(new URL(`file://${fixturePath}`).href)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith("/source-pipeline-rest.mjs")) {
    return { url: fixtureUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`);
  await writeFile(registerPath, `
import { register } from "node:module";
register(${JSON.stringify(new URL(`file://${hooksPath}`).href)}, import.meta.url);
globalThis.fetch = async (input) => {
  const ids = new URL(input).searchParams.get("id").split(",");
  return new Response(JSON.stringify({ items: ids.map((id) => ({
    id,
    status: { privacyStatus: "public", embeddable: true },
  })) }), { status: 200 });
};
`);

  const scriptPath = new URL(`./${scriptName}`, import.meta.url).pathname;
  const spawned = spawnSync(process.execPath, ["--import", registerPath, scriptPath], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: { ...process.env },
  });
  const writes = await readFile(writesPath, "utf8");
  await rm(temp, { recursive: true, force: true });
  return { spawned, writes, validSource };
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

  test(`${name}: invalid rows cannot starve later valid rows and error output is bounded`, async () => {
    const invalidSources = Array.from({ length: 50 }, (_, index) =>
      source(index, index % 2 === 0 ? null : `bad/${index}`),
    );
    const validSource = source(50);
    const { rest, calls } = restRecorder();
    let requestedIds;
    const result = await run({
      sources: [...invalidSources, validSource],
      apiKey: API_KEY,
      fetchImpl: async (input) => {
        requestedIds = new URL(input).searchParams.get("id");
        return response({ items: [video(videoId(50))] });
      },
      rest,
      limit: 1,
      now: NOW,
    });

    assert.equal(requestedIds, videoId(50));
    assert(sourcePatch(calls, sourceId(50)));
    assert.equal(result.checked, 51);
    assert.equal(result.failed, 50);
    assert.equal(result.errors.length, 20);
    assert.equal(result.errorsTruncated, 30);
    assert.equal(result.errors[0], `youtube_source_external_id_inconclusive:${sourceId(0)}`);
    assert.equal(result.errors[19], `youtube_source_external_id_inconclusive:${sourceId(19)}`);
    assert.doesNotMatch(JSON.stringify(result.errors), /bad\//);
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

for (const { name, items, availability, removed, hidden, removedAt } of [
  { name: "missing", items: [], availability: "dead", removed: 1, hidden: 0, removedAt: NOW },
  {
    name: "private",
    items: [video(videoId(0), "private", false)],
    availability: "dead",
    removed: 1,
    hidden: 0,
    removedAt: NOW,
  },
  {
    name: "unlisted",
    items: [video(videoId(0), "unlisted", false)],
    availability: "dead",
    removed: 0,
    hidden: 1,
    removedAt: null,
  },
  {
    name: "region-blocked",
    items: [video(videoId(0), "public", true, {
      contentDetails: { duration: "PT1M30S", regionRestriction: { blocked: ["KR"] } },
    })],
    availability: "region_blocked",
    removed: 0,
    hidden: 0,
    removedAt: null,
  },
]) {
  test(`refresh: ${name} retries after source status PATCH fails`, async () => {
    const firstCalls = [];
    const failingRest = async (path, options) => {
      firstCalls.push({ path, body: JSON.parse(options.body) });
      if (path.startsWith("media_sources")) throw new Error("database unavailable");
      return {};
    };

    await assert.rejects(
      runRefreshYouTubeSources({
        sources: [source(0)],
        apiKey: API_KEY,
        fetchImpl: async () => response({ items }),
        rest: failingRest,
        now: NOW,
      }),
      /^Error: youtube_source_write_failed$/,
    );
    assert.match(firstCalls[0].path, /^meme_contents\?/);
    assert.deepEqual(firstCalls[0].body, { availability });
    assert.equal(firstCalls[1].path, `media_sources?id=eq.${sourceId(0)}`);

    const retryRecorder = restRecorder();
    const retryResult = await runRefreshYouTubeSources({
      sources: [source(0)],
      apiKey: API_KEY,
      fetchImpl: async () => response({ items }),
      rest: retryRecorder.rest,
      now: NOW,
    });
    assert.equal(retryResult.removed, removed);
    assert.equal(retryResult.hidden, hidden);
    assert.match(retryRecorder.calls[0].path, /^meme_contents\?/);
    assert.equal(retryRecorder.calls[1].path, `media_sources?id=eq.${sourceId(0)}`);
    assert.equal(sourcePatch(retryRecorder.calls, sourceId(0)).removed_at, removedAt);
  });
}

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

test("both runner CLIs finish valid work and exit nonzero for partial failures", async () => {
  for (const scriptName of [
    "refresh-youtube-sources.mjs",
    "verify-youtube-pending.mjs",
  ]) {
    const { spawned, writes, validSource } = await spawnRunnerCli(scriptName);
    assert.equal(spawned.status, 1, `${scriptName} must report partial failure`);
    const output = JSON.parse(spawned.stdout.trim().split("\n").at(-1));
    assert.equal(output.failed, 1);
    assert.equal(output.checked, 2);
    assert.match(writes, new RegExp(`media_sources\\?id=eq\\.${validSource.id}`));
    assert.doesNotMatch(
      `${spawned.stdout}\n${spawned.stderr}`,
      /cli-test-key|provider\.example/,
    );
  }
});

test("daily discovery spawn preserves both failures and suppresses success text", async () => {
  const temp = await mkdtemp(join(tmpdir(), "memecatch-daily-source-"));
  const binDir = join(temp, "bin");
  const outputDir = join(temp, "logs");
  await mkdir(binDir, { recursive: true });
  const fakeNode = join(binDir, "node");
  await writeFile(fakeNode, `#!/bin/bash
if [[ "$1" == *"discover-youtube-candidates.mjs"* ]]; then
  echo "discover stdout preserved"
  echo "discover stderr preserved" >&2
  exit 7
fi
echo "verify stdout preserved"
echo "verify stderr preserved" >&2
exit 9
`);
  await chmod(fakeNode, 0o755);

  const scriptPath = new URL("./daily-source-discovery.sh", import.meta.url).pathname;
  const spawned = spawnSync("bash", [scriptPath], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      SOURCE_DISCOVERY_OUTPUT_DIR: outputDir,
    },
  });
  const [logName] = await readdir(outputDir);
  const log = await readFile(join(outputDir, logName), "utf8");
  await rm(temp, { recursive: true, force: true });

  assert.equal(spawned.status, 1);
  assert.match(log, /discover stdout preserved/);
  assert.match(log, /discover stderr preserved/);
  assert.match(log, /YouTube 후보 수집 실패 \(exit=7\)/);
  assert.match(log, /verify stdout preserved/);
  assert.match(log, /verify stderr preserved/);
  assert.match(log, /YouTube pending 검증 실패 \(exit=9\)/);
  assert.match(log, /후보 수집·검증 실패/);
  assert.doesNotMatch(log, /후보 수집·검증 완료/);
});

test("daily discovery exits before running steps when the log directory is unavailable", async () => {
  const temp = await mkdtemp(join(tmpdir(), "memecatch-daily-log-failure-"));
  const binDir = join(temp, "bin");
  const marker = join(temp, "node-ran");
  await mkdir(binDir, { recursive: true });
  const fakeNode = join(binDir, "node");
  await writeFile(fakeNode, `#!/bin/bash
touch ${JSON.stringify(marker)}
exit 0
`);
  await chmod(fakeNode, 0o755);

  const scriptPath = new URL("./daily-source-discovery.sh", import.meta.url).pathname;
  const spawned = spawnSync("bash", [scriptPath], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      SOURCE_DISCOVERY_OUTPUT_DIR: "/dev/null",
    },
  });
  const tempEntries = await readdir(temp);
  await rm(temp, { recursive: true, force: true });

  assert.notEqual(spawned.status, 0);
  assert.match(spawned.stderr, /source discovery log directory unavailable/);
  assert.equal(tempEntries.includes("node-ran"), false);
});
