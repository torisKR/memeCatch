import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyYouTubePrivateMetadataPolicy,
  classifyYouTubeRefreshAvailability,
  validateYouTubeVideoBatchExternalIds,
  validateYouTubeVideosListResponse,
  validateYouTubeVideoStatusItems,
} from "../lib/sources/youtube-response.mjs";

const requested = new Set(["requested-a", "requested-b"]);
const publicEmbeddableStatus = { privacyStatus: "public", embeddable: true };

test("accepts explicit empty and partial videos.list results", () => {
  const empty = { items: [] };
  const partial = {
    items: [{ id: "requested-b", status: publicEmbeddableStatus, snippet: { title: "kept" } }],
  };

  assert.strictEqual(validateYouTubeVideosListResponse(empty, requested), empty.items);
  assert.strictEqual(validateYouTubeVideosListResponse(partial, requested), partial.items);
});

test("rejects a batch with a missing external ID before it can be requested", () => {
  assert.throws(
    () => validateYouTubeVideoBatchExternalIds(["requested-a", null]),
    /^Error: youtube_video_list_inconclusive$/,
  );
  assert.throws(
    () => validateYouTubeVideoBatchExternalIds(["requested-a", ""]),
    /^Error: youtube_video_list_inconclusive$/,
  );
  assert.deepEqual(
    [...validateYouTubeVideoBatchExternalIds(["requested-a", "requested-a"])],
    ["requested-a"],
  );
});

test("rejects missing or non-array items as inconclusive", () => {
  for (const response of [null, {}, { items: null }, { items: {} }]) {
    assert.throws(
      () => validateYouTubeVideosListResponse(response, requested),
      /^Error: youtube_video_list_inconclusive$/,
    );
  }
});

test("requires explicit valid privacyStatus and boolean embeddable before status writes", () => {
  const invalidItems = [
    { id: "requested-a" },
    { id: "requested-a", status: null },
    { id: "requested-a", status: {} },
    { id: "requested-a", status: { privacyStatus: "unknown", embeddable: true } },
    { id: "requested-a", status: { privacyStatus: "public" } },
    { id: "requested-a", status: { privacyStatus: "public", embeddable: "true" } },
  ];

  for (const item of invalidItems) {
    assert.throws(
      () => validateYouTubeVideoStatusItems([item]),
      /^Error: youtube_video_list_inconclusive$/,
    );
  }

  const validItems = [
    { id: "requested-a", status: { privacyStatus: "public", embeddable: false } },
    { id: "requested-b", status: { privacyStatus: "private", embeddable: true } },
  ];
  assert.strictEqual(validateYouTubeVideoStatusItems(validItems), validItems);
});

test("keeps public non-embeddable videos live as links", () => {
  assert.equal(
    classifyYouTubeRefreshAvailability({ privacyStatus: "public", embeddable: false }, false),
    "live",
  );
  assert.equal(
    classifyYouTubeRefreshAvailability(publicEmbeddableStatus, false),
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
});

test("clears private metadata while preserving unlisted link metadata", () => {
  const now = "2026-11-18T01:00:00.000Z";
  const metadata = {
    title: "private title",
    thumbnail_url: "https://example.test/private.jpg",
    channel_name: "retained channel",
    metadata_expires_at: "2026-12-18T01:00:00.000Z",
  };

  assert.deepEqual(
    applyYouTubePrivateMetadataPolicy(metadata, "private", now),
    {
      title: null,
      thumbnail_url: null,
      channel_name: "retained channel",
      metadata_expires_at: null,
      removed_at: now,
    },
  );
  assert.deepEqual(
    applyYouTubePrivateMetadataPolicy(metadata, "unlisted", now),
    { ...metadata, removed_at: null },
  );
});

test("rejects malformed, unrequested, and duplicate item IDs", () => {
  for (const response of [
    { items: [null] },
    { items: [{}] },
    { items: [{ id: 123 }] },
    { items: [{ id: "not-requested" }] },
    { items: [{ id: "requested-a" }, { id: "requested-a" }] },
  ]) {
    assert.throws(
      () => validateYouTubeVideosListResponse(response, requested),
      /^Error: youtube_video_list_inconclusive$/,
    );
  }
});

test("validation errors do not expose response bodies or API keys", () => {
  const secretKey = "secret-api-key";
  const secretBody = "upstream-private-body";
  let error;

  try {
    validateYouTubeVideosListResponse(
      { items: [{ id: "unexpected", body: secretBody, key: secretKey }] },
      requested,
    );
  } catch (caught) {
    error = caught;
  }

  assert(error instanceof Error);
  assert.equal(error.message, "youtube_video_list_inconclusive");
  assert.doesNotMatch(error.message, new RegExp(`${secretKey}|${secretBody}`));
});

test("both database scripts validate each batch before iterating its writes", async () => {
  for (const relativePath of [
    "./refresh-youtube-sources.mjs",
    "./verify-youtube-pending.mjs",
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const batchValidationIndex = source.indexOf("validateYouTubeVideoBatchExternalIds(");
    const fetchIndex = source.indexOf("await fetch(url");
    const validationIndex = source.indexOf("validateYouTubeVideosListResponse(data, requestedVideoIds)");
    const statusValidationIndex = source.indexOf("validateYouTubeVideoStatusItems(");
    const writeLoopIndex = source.indexOf("for (const source of batch)");

    assert(batchValidationIndex >= 0, `${relativePath} must validate all external IDs`);
    assert(fetchIndex > batchValidationIndex, `${relativePath} must validate IDs before requesting`);
    assert(validationIndex >= 0, `${relativePath} must validate the videos.list response`);
    assert(statusValidationIndex >= 0, `${relativePath} must validate status fields`);
    assert(writeLoopIndex > validationIndex, `${relativePath} must validate before DB writes`);
    assert(writeLoopIndex > statusValidationIndex, `${relativePath} must validate status before DB writes`);
    assert.doesNotMatch(source, /await res\.text\(\)/, `${relativePath} must not expose response bodies`);
    assert.match(source, /videos\.list request failed/, `${relativePath} must sanitize request errors`);
    assert.match(source, /videos\.list invalid JSON/, `${relativePath} must sanitize JSON errors`);
    assert.match(
      source,
      /applyYouTubePrivateMetadataPolicy\(/,
      `${relativePath} must clear private cached metadata`,
    );
    assert.match(source, /const isPrivate =/, `${relativePath} must distinguish private status`);
  }

  const refreshSource = await readFile(
    new URL("./refresh-youtube-sources.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    refreshSource,
    /if \(isPrivate\) \{\s*stats\.removed \+= 1;\s*\} else if \(availability === "dead"\) \{\s*stats\.hidden \+= 1;/,
    "refresh must count private as removed and unlisted dead projection as hidden",
  );

  const pendingSource = await readFile(
    new URL("./verify-youtube-pending.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    pendingSource,
    /if \(isPrivate\) stats\.removed \+= 1;/,
    "pending verification must count confirmed private videos as removed",
  );
});
