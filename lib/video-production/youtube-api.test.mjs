import test from "node:test";
import assert from "node:assert/strict";
import { YouTubePublicationClient, buildPrivateVideoMetadata, validateUploadSessionUri,
  retryAfterMilliseconds, resumePublicationUpload } from "./youtube-api.mjs";

const CHANNEL = "UCabcdefghijklmnopqrstuv";
const VIDEO = "abcdefghi_1";
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=opaque";
const HASH = "a".repeat(64);
const metadata = buildPrivateVideoMetadata({ title: "밈캐치 자체 해설", description: "출처와 가상 예시", containsSyntheticMedia: false, madeForKids: false });
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const channels = () => json({ items: [{ id: CHANNEL, snippet: { title: "밈캐치" } }] });
const video = (visibility = "private", processing = "succeeded", extra = {}) => json({ items: [{ id: VIDEO,
  snippet: { channelId: CHANNEL, title: "해설" }, processingDetails: { processingStatus: processing },
  status: { privacyStatus: visibility, embeddable: true, license: "youtube", publicStatsViewable: false,
    selfDeclaredMadeForKids: false, containsSyntheticMedia: true, ...extra } }] });

function protocol(replies) {
  const calls = [];
  const client = new YouTubePublicationClient({ getAccessToken: async () => "server-secret", fetchImpl: async (url, options) => {
    calls.push({ url, ...options });
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    const next = replies.shift();
    if (next instanceof Error) throw next;
    assert.ok(next, "unexpected external request");
    return next;
  } });
  return { client, calls };
}

test("private upload requires explicit audience/synthetic disclosures and bounded metadata", () => {
  assert.equal(metadata.status.privacyStatus, "private");
  assert.throws(() => buildPrivateVideoMetadata({ title: "x", description: "" }), /video_disclosure_required/);
  assert.throws(() => buildPrivateVideoMetadata({ title: "<x>", description: "", containsSyntheticMedia: false, madeForKids: false }), /invalid_video_title/);
  assert.throws(() => buildPrivateVideoMetadata({ title: "x", description: "한".repeat(1700), containsSyntheticMedia: false, madeForKids: false }), /invalid_video_description/);
});

test("session URI cannot exfiltrate OAuth tokens or follow redirects", () => {
  assert.equal(validateUploadSessionUri(SESSION), SESSION);
  for (const value of ["http://www.googleapis.com/upload/youtube/v3/videos?upload_id=x", "https://www.googleapis.com.evil.test/upload/youtube/v3/videos?upload_id=x",
    "https://token@www.googleapis.com/upload/youtube/v3/videos?upload_id=x", "https://www.googleapis.com/else?upload_id=x", SESSION + "#x", "https://127.0.0.1/a"]) {
    assert.throws(() => validateUploadSessionUri(value), /invalid_upload_session/);
  }
});

test("upload is private and session creation binds to the one actual OAuth channel", async () => {
  const { client, calls } = protocol([channels(), new Response(null, { status: 200, headers: { location: SESSION } })]);
  assert.equal(await client.initializePrivateUpload({ expectedChannelId: CHANNEL, size: 42, metadata }), SESSION);
  assert.equal(calls[1].headers["X-Upload-Content-Length"], "42");
  assert.equal(JSON.parse(calls[1].body).status.privacyStatus, "private");
  assert.match(calls[1].url, /notifySubscribers=false/);
  const wrong = protocol([json({ items: [{ id: "UCxxxxxxxxxxxxxxxxxxxxxx" }] })]);
  await assert.rejects(wrong.client.initializePrivateUpload({ expectedChannelId: CHANNEL, size: 42, metadata }), /youtube_channel_mismatch/);
  assert.equal(wrong.calls.length, 1);
});

test("recovery queries existing session and interprets inclusive Range with Retry-After", async () => {
  const { client, calls } = protocol([new Response(null, { status: 308, headers: { range: "bytes=0-262143", "retry-after": "9" } })]);
  assert.deepEqual(await client.queryUploadSession({ sessionUri: SESSION, totalSize: 800000 }), { state: "incomplete", offset: 262144, retryAfterMs: 9000 });
  assert.equal(calls[0].headers["Content-Range"], "bytes */800000");
  assert.equal(calls[0].headers["Content-Length"], "0");
  assert.equal(retryAfterMilliseconds("Mon, 12 Oct 2026 14:00:05 GMT", Date.parse("2026-10-12T14:00:00Z")), 5000);
  assert.equal(retryAfterMilliseconds("nonsense"), 0);
});

test("missing Range resumes at zero; impossible/malformed ranges never skip file bytes", async () => {
  const missing = protocol([new Response(null, { status: 308 })]);
  assert.equal((await missing.client.queryUploadSession({ sessionUri: SESSION, totalSize: 100 })).offset, 0);
  for (const range of ["bytes=1-20", "bytes=0-100", "bytes=0-nope"]) {
    const { client } = protocol([new Response(null, { status: 308, headers: { range } })]);
    await assert.rejects(client.queryUploadSession({ sessionUri: SESSION, totalSize: 100 }), /invalid_upload_range/);
  }
});

test("final response and expired session are distinct from ordinary retry", async () => {
  const complete = protocol([json({ id: VIDEO }, 201)]);
  assert.deepEqual(await complete.client.uploadChunk({ sessionUri: SESSION, totalSize: 2, offset: 0, bytes: new Uint8Array(2) }), { state: "complete", videoId: VIDEO });
  const expired = protocol([new Response(null, { status: 404 })]);
  await assert.rejects(expired.client.queryUploadSession({ sessionUri: SESSION, totalSize: 2 }), (error) => error.code === "upload_session_expired" && error.ambiguous);
  const unknown = protocol([json({}, 201)]);
  await assert.rejects(unknown.client.uploadChunk({ sessionUri: SESSION, totalSize: 2, offset: 0, bytes: new Uint8Array(2) }), (error) => error.ambiguous);
});

test("quota, auth, retryable server, transport failures have safe codes with no body/token leak", async () => {
  for (const [response, expected, retryable] of [[json({ error: { errors: [{ reason: "quotaExceeded" }], message: "SECRET" } }, 403), "youtube_quota_blocked", false],
    [json({ message: "server-secret" }, 401), "youtube_reauthentication_required", false], [json({}, 503, { "retry-after": "2" }), "youtube_request_failed", true],
    [new Error("https://opaque-session secret"), "youtube_transport_unavailable", true]]) {
    const { client } = protocol([response]);
    await assert.rejects(client.uploadChunk({ sessionUri: SESSION, totalSize: 2, offset: 0, bytes: new Uint8Array(2) }), (error) => {
      assert.equal(error.code, expected); assert.equal(error.retryable, retryable);
      assert.doesNotMatch(error.message, /SECRET|server-secret|opaque-session/);
      return true;
    });
  }
});

test("visibility change preserves status fields and verifies actual post-update state", async () => {
  const { client, calls } = protocol([channels(), video("private", "succeeded", { publishAt: "2026-10-13T10:00:00Z" }), json({ id: VIDEO }), video("public")]);
  const result = await client.setVisibility({ videoId: VIDEO, expectedChannelId: CHANNEL, visibility: "public" });
  assert.equal(result.privacyStatus, "public");
  const body = JSON.parse(calls[2].body);
  assert.equal(body.status.publicStatsViewable, false);
  assert.equal(body.status.containsSyntheticMedia, true);
  assert.equal(body.status.selfDeclaredMadeForKids, false);
  assert.equal(body.status.license, "youtube");
  assert.equal(body.status.publishAt, undefined);
  const restricted = protocol([channels(), video(), json({ id: VIDEO }), video("private")]);
  await assert.rejects(restricted.client.setVisibility({ videoId: VIDEO, expectedChannelId: CHANNEL, visibility: "unlisted" }), /youtube_privacy_restricted/);
  const processing = protocol([channels(), video("private", "processing")]);
  await assert.rejects(processing.client.setVisibility({ videoId: VIDEO, expectedChannelId: CHANNEL, visibility: "public" }), /youtube_processing_incomplete/);
});

test("video status exposes only bounded API-derived metadata for the exact video", async () => {
  const publishedAt = "2026-10-12T04:05:06Z";
  const { client } = protocol([json({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL,
    title: "API 원본 제목", description: "API 원본 설명", publishedAt,
    thumbnails: { default: { url: `https://i.ytimg.com/vi/${VIDEO}/default.jpg`, width: 120, height: 90 },
      high: { url: `https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`, width: 480, height: 360 } } },
    processingDetails: { processingStatus: "succeeded" }, status: { privacyStatus: "public", embeddable: true } }] })]);
  assert.deepEqual((await client.videoStatus(VIDEO, CHANNEL)).videoMetadata, {
    name: "API 원본 제목", description: "API 원본 설명",
    thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`, uploadDate: publishedAt,
  });

  for (const thumbnail of [
    { url: `https://i.ytimg.com/vi/${VIDEO}/default.jpg`, width: 59, height: 30 },
    { url: `https://i.ytimg.com/vi/${VIDEO}/default.jpg` },
  ]) {
    const undersized = protocol([json({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL,
      title: "API 원본 제목", description: "API 원본 설명", publishedAt, thumbnails: { default: thumbnail } },
      processingDetails: { processingStatus: "succeeded" }, status: { privacyStatus: "public", embeddable: true } }] })]);
    assert.equal((await undersized.client.videoStatus(VIDEO, CHANNEL)).videoMetadata, null);
  }

  const unsafe = protocol([json({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, title: "정상 제목",
    description: "x".repeat(5_001), publishedAt: "2099-01-01T00:00:00Z",
    thumbnails: { high: { url: "https://i.ytimg.com/vi/other-video/hqdefault.jpg" } } },
    processingDetails: { processingStatus: "succeeded" }, status: { privacyStatus: "public", embeddable: true } }] })]);
  assert.equal((await unsafe.client.videoStatus(VIDEO, CHANNEL)).videoMetadata, null);

  const missingName = protocol([json({ items: [{ id: VIDEO, snippet: { channelId: CHANNEL, title: "" }, status: {} }] })]);
  assert.equal((await missingName.client.videoStatus(VIDEO, CHANNEL)).videoMetadata, null);
});

function coordinator(client, record, overrides = {}) {
  return resumePublicationUpload({ client, record: { id: "pub1", artifactHash: HASH, size: 3, ...record }, metadata, expectedChannelId: CHANNEL, artifactHash: HASH,
    readChunk: async (_offset, length) => new Uint8Array(length), saveSession: async () => {}, saveOffset: async () => {}, saveVideoId: async () => {}, ...overrides });
}

test("persisted final video ID avoids ALL uploads; missing session after intent requires reconciliation", async () => {
  const { client, calls } = protocol([]);
  assert.deepEqual(await coordinator(client, { videoId: VIDEO }), { state: "complete", videoId: VIDEO });
  assert.equal(calls.length, 0);
  const ambiguous = protocol([channels()]);
  await assert.rejects(coordinator(ambiguous.client, { uploadStarted: true }), /upload_reconciliation_required/);
  assert.equal(ambiguous.calls.filter((request) => request.method === "POST").length, 0);
});

test("resumption recovers successful upload after DB failure without a second videos.insert", async () => {
  const first = protocol([channels(), json({ id: VIDEO }, 201)]);
  await assert.rejects(coordinator(first.client, { sessionUri: SESSION }, { saveVideoId: async () => { throw new Error("DB down"); } }),
    (error) => error.code === "upload_result_persistence_failed" && error.ambiguous);
  const retry = protocol([channels(), json({ id: VIDEO }, 201)]);
  assert.equal((await coordinator(retry.client, { sessionUri: SESSION })).videoId, VIDEO);
  assert.equal(retry.calls.some((request) => request.method === "POST"), false);
  assert.equal(retry.calls[1].headers["Content-Range"], "bytes */3");
});

test("session persistence failure never sends any media bytes", async () => {
  const { client, calls } = protocol([channels(), channels(), new Response(null, { status: 200, headers: { location: SESSION } })]);
  await assert.rejects(coordinator(client, {}, { saveSession: async () => { throw new Error("DB failure"); } }), /upload_session_persistence_failed/);
  assert.equal(calls.some((request) => request.method === "PUT"), false);
});

test("existing-session retry is query-then-bytes and validates artifact/checkpoint/chunk bounds", async () => {
  const { client, calls } = protocol([channels(), new Response(null, { status: 308 }), json({ id: VIDEO }, 201)]);
  let persisted = "";
  const result = await coordinator(client, { sessionUri: SESSION }, { saveVideoId: async (id) => { persisted = id; } });
  assert.equal(result.videoId, VIDEO); assert.equal(persisted, VIDEO);
  assert.equal(calls[1].headers["Content-Range"], "bytes */3");
  assert.equal(calls[2].headers["Content-Range"], "bytes 0-2/3");
  await assert.rejects(coordinator(client, { artifactHash: "b".repeat(64) }), /publication_artifact_mismatch/);
  await assert.rejects(coordinator(client, {}, { chunkSize: 13 }), /invalid_upload_limits/);
});

test("query, final chunk, and recorded-ID completion checkpoint identity then full byte count", async () => {
  for (const sequence of [[channels(), json({ id: VIDEO }, 201)],
    [channels(), new Response(null, { status: 308 }), json({ id: VIDEO }, 201)], []]) {
    const { client, calls } = protocol(sequence);
    const saved = [];
    const record = sequence.length ? { sessionUri: SESSION } : { videoId: VIDEO };
    await coordinator(client, record, { saveVideoId: async (id) => saved.push(["id", id]), saveOffset: async (offset) => saved.push(["offset", offset]) });
    assert.deepEqual(saved.slice(-2), [["id", VIDEO], ["offset", 3]]);
    assert.equal(calls.some((request) => request.method === "POST"), false);
  }
  const { client } = protocol([channels(), json({ id: VIDEO }, 201)]);
  let knownVideo;
  await assert.rejects(coordinator(client, { sessionUri: SESSION }, {
    saveVideoId: async (id) => { knownVideo = id; }, saveOffset: async () => { throw new Error("DB down"); },
  }), (error) => error.code === "upload_result_persistence_failed" && error.ambiguous);
  assert.equal(knownVideo, VIDEO);
});
