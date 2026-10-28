import { parseProducedVideoMetadata } from "./video-schema.mjs";

/** Server/worker protocol adapter. No token, session URI or API response is logged. */
export const YOUTUBE_PUBLICATION_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const MAX_JSON_BYTES = 1024 * 1024;

export class YouTubeApiError extends Error {
  constructor(code, { status = 0, retryable = false, ambiguous = false, retryAfterMs = 0 } = {}) {
    super(code);
    this.name = "YouTubeApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
    this.retryAfterMs = retryAfterMs;
  }
}

function fail(code, options) { throw new YouTubeApiError(code, options); }
function byteLength(value) { return new TextEncoder().encode(value).length; }
function validateSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > 256 * 1024 ** 3) fail("invalid_artifact_size");
}
function videoId(value) { if (!VIDEO_ID.test(value ?? "")) fail("invalid_video_id"); return value; }
function channelId(value) { if (!CHANNEL_ID.test(value ?? "")) fail("invalid_channel_id"); return value; }

function apiThumbnailUrl(thumbnails) {
  if (!thumbnails || typeof thumbnails !== "object") return null;
  const entries = Object.values(thumbnails).filter((entry) => entry && typeof entry.url === "string");
  const suitablySized = entries.filter((entry) => Number(entry.width) >= 60 && Number(entry.height) >= 30)
    .sort((left, right) => (Number(right.width) * Number(right.height)) - (Number(left.width) * Number(left.height)));
  return suitablySized[0]?.url ?? null;
}

export function validateUploadSessionUri(value) {
  let url;
  try { url = new URL(value); } catch { fail("invalid_upload_session"); }
  // A persisted URL is a credential-bearing capability, never an arbitrary fetch target.
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || url.port ||
      url.username || url.password || url.hash || url.pathname !== "/upload/youtube/v3/videos" ||
      !url.searchParams.get("upload_id")) fail("invalid_upload_session");
  return url.href;
}

export function retryAfterMilliseconds(value, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(milliseconds) ? Math.max(0, Math.min(milliseconds, 24 * 60 * 60 * 1000)) : 0;
}

async function readJson(response) {
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_JSON_BYTES) fail("youtube_response_too_large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes) || "{}"); }
  catch { fail("invalid_youtube_response"); }
}

async function responseError(response, { ambiguous = false } = {}) {
  let reason;
  try { reason = (await readJson(response))?.error?.errors?.[0]?.reason; } catch { /* Never echo a remote body. */ }
  const code = response.status === 401 ? "youtube_reauthentication_required"
    : reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "uploadLimitExceeded" ? "youtube_quota_blocked"
    : reason === "forbiddenPrivacySetting" ? "youtube_privacy_restricted"
    : response.status === 403 ? "youtube_permission_denied"
    : response.status === 404 ? "youtube_resource_unavailable"
    : "youtube_request_failed";
  fail(code, { status: response.status, retryable: [429, 500, 502, 503, 504].includes(response.status),
    ambiguous, retryAfterMs: retryAfterMilliseconds(response.headers.get("retry-after")) });
}

export function buildPrivateVideoMetadata({ title, description, containsSyntheticMedia, madeForKids, categoryId = "22" }) {
  if (typeof title !== "string" || !title.trim() || [...title].length > 100 || /[<>\u0000-\u001f]/u.test(title)) fail("invalid_video_title");
  if (typeof description !== "string" || byteLength(description) > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(description)) fail("invalid_video_description");
  if (typeof containsSyntheticMedia !== "boolean" || typeof madeForKids !== "boolean") fail("video_disclosure_required");
  if (!/^\d{1,3}$/.test(categoryId)) fail("invalid_video_category");
  return { snippet: { title: title.trim(), description, categoryId, defaultLanguage: "ko" },
    status: { privacyStatus: "private", embeddable: true, license: "youtube", publicStatsViewable: true,
      selfDeclaredMadeForKids: madeForKids, containsSyntheticMedia } };
}

export class YouTubePublicationClient {
  #getToken;
  #fetch;
  #timeoutMs;
  constructor({ getAccessToken, fetchImpl = fetch, timeoutMs = 60_000 }) {
    if (typeof getAccessToken !== "function" || typeof fetchImpl !== "function" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("invalid_youtube_client");
    this.#getToken = getAccessToken;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
  }

  async #request(url, options = {}, mutation = false) {
    const token = await this.#getToken();
    if (typeof token !== "string" || !token || /[\r\n]/.test(token)) fail("youtube_reauthentication_required");
    try {
      return await this.#fetch(url, { ...options, redirect: "error", cache: "no-store",
        headers: { ...options.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(this.#timeoutMs) });
    } catch { fail("youtube_transport_unavailable", { retryable: true, ambiguous: mutation }); }
  }

  async ownedChannels() {
    const response = await this.#request(`${API}/channels?part=id,snippet&mine=true&maxResults=50`);
    if (!response.ok) await responseError(response);
    const data = await readJson(response);
    if (!Array.isArray(data.items) || data.nextPageToken) fail("youtube_channel_selection_required");
    return data.items.map((item) => ({ id: channelId(item.id), title: String(item.snippet?.title ?? "").slice(0, 200) }));
  }

  async assertChannel(expectedChannelId) {
    channelId(expectedChannelId);
    const channels = await this.ownedChannels();
    // Standard uploads use the OAuth channel; do not guess among multiple identities.
    if (channels.length !== 1 || channels[0].id !== expectedChannelId) fail("youtube_channel_mismatch");
    return channels[0];
  }

  async initializePrivateUpload({ expectedChannelId, size, metadata }) {
    validateSize(size);
    if (metadata?.status?.privacyStatus !== "private") fail("private_upload_required");
    const checkedMetadata = buildPrivateVideoMetadata({ title: metadata.snippet?.title, description: metadata.snippet?.description,
      categoryId: metadata.snippet?.categoryId, containsSyntheticMedia: metadata.status?.containsSyntheticMedia,
      madeForKids: metadata.status?.selfDeclaredMadeForKids });
    await this.assertChannel(expectedChannelId);
    const response = await this.#request(`${UPLOAD}?uploadType=resumable&part=snippet,status&notifySubscribers=false`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/mp4" },
      body: JSON.stringify(checkedMetadata),
    }, true);
    if (!response.ok) await responseError(response, { ambiguous: response.status >= 500 });
    return validateUploadSessionUri(response.headers.get("location"));
  }

  async #uploadResponse(response, totalSize) {
    if (response.status === 308) {
      const range = response.headers.get("range");
      let offset = 0;
      if (range) {
        const match = /^bytes=0-(\d+)$/.exec(range);
        if (!match) fail("invalid_upload_range", { ambiguous: true });
        offset = Number(match[1]) + 1;
        if (!Number.isSafeInteger(offset) || offset > totalSize) fail("invalid_upload_range", { ambiguous: true });
      }
      // An acknowledged full range without a video ID is not proof of completion.
      return { state: "incomplete", offset, retryAfterMs: retryAfterMilliseconds(response.headers.get("retry-after")) };
    }
    if (response.status === 200 || response.status === 201) {
      let id;
      try { id = videoId((await readJson(response)).id); }
      catch { fail("upload_completion_unconfirmed", { ambiguous: true }); }
      return { state: "complete", videoId: id };
    }
    if (response.status === 404 || response.status === 410) fail("upload_session_expired", { ambiguous: true });
    await responseError(response, { ambiguous: response.status >= 500 });
  }

  async queryUploadSession({ sessionUri, totalSize }) {
    validateSize(totalSize);
    const response = await this.#request(validateUploadSessionUri(sessionUri), { method: "PUT",
      headers: { "Content-Length": "0", "Content-Range": `bytes */${totalSize}` } });
    return this.#uploadResponse(response, totalSize);
  }

  async uploadChunk({ sessionUri, totalSize, offset, bytes }) {
    validateSize(totalSize);
    if (!(bytes instanceof Uint8Array) || !Number.isSafeInteger(offset) || offset < 0 || !bytes.length || offset + bytes.length > totalSize ||
      (offset + bytes.length < totalSize && bytes.length % (256 * 1024) !== 0)) fail("invalid_upload_chunk");
    const response = await this.#request(validateUploadSessionUri(sessionUri), { method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.length), "Content-Range": `bytes ${offset}-${offset + bytes.length - 1}/${totalSize}` },
      body: bytes,
    }, true);
    const result = await this.#uploadResponse(response, totalSize);
    if (result.state === "incomplete" && (result.offset < offset || result.offset > offset + bytes.length)) fail("upload_offset_mismatch", { ambiguous: true });
    return result;
  }

  async videoStatus(id, expectedChannelId) {
    videoId(id); channelId(expectedChannelId);
    const response = await this.#request(`${API}/videos?part=snippet,status,processingDetails,contentDetails&id=${encodeURIComponent(id)}`);
    if (!response.ok) await responseError(response);
    const data = await readJson(response);
    const item = data.items?.find((value) => value.id === id);
    if (!item) fail("youtube_resource_unavailable", { status: 404 });
    if (item.snippet?.channelId !== expectedChannelId) fail("youtube_channel_mismatch");
    return { videoId: id, channelId: item.snippet.channelId, title: String(item.snippet.title ?? "").slice(0, 100),
      videoMetadata: parseProducedVideoMetadata({ name: item.snippet.title, description: item.snippet.description,
        thumbnailUrl: apiThumbnailUrl(item.snippet.thumbnails), uploadDate: item.snippet.publishedAt }, id),
      processingStatus: item.processingDetails?.processingStatus ?? null,
      privacyStatus: item.status?.privacyStatus ?? null, embeddable: item.status?.embeddable === true,
      uploadStatus: item.status?.uploadStatus ?? null, rejectionReason: item.status?.rejectionReason ?? null,
      regionRestriction: item.contentDetails?.regionRestriction ?? null,
      mutableStatus: Object.fromEntries(["license", "publicStatsViewable", "selfDeclaredMadeForKids", "containsSyntheticMedia", "publishAt"]
        .filter((key) => Object.hasOwn(item.status ?? {}, key)).map((key) => [key, item.status[key]])) };
  }

  async setVisibility({ videoId: id, expectedChannelId, visibility }) {
    if (!["public", "unlisted", "private"].includes(visibility)) fail("invalid_publication_visibility");
    await this.assertChannel(expectedChannelId);
    const before = await this.videoStatus(id, expectedChannelId);
    if (visibility !== "private" && before.processingStatus !== "succeeded") fail("youtube_processing_incomplete");
    // Preserve mutable status; never preserve a scheduled publishAt while publishing now.
    const preserved = { ...before.mutableStatus };
    delete preserved.publishAt;
    const status = { ...preserved, privacyStatus: visibility, embeddable: visibility === "private" ? before.embeddable : true };
    const response = await this.#request(`${API}/videos?part=status`, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }) }, true);
    if (!response.ok) await responseError(response, { ambiguous: response.status >= 500 });
    await readJson(response);
    // The response body alone is not a durable visibility/processing confirmation.
    const after = await this.videoStatus(id, expectedChannelId);
    if (after.privacyStatus !== visibility) fail("youtube_privacy_restricted");
    return after;
  }
}

/** Upload recovery coordinator: the caller must persist a session before ANY media PUT. */
export async function resumePublicationUpload({ client, record, metadata, expectedChannelId, artifactHash,
  readChunk, saveSession, saveOffset, saveVideoId, chunkSize = 8 * 1024 * 1024, maxChunks = 256 }) {
  validateSize(record.size);
  if (!record.id || !/^[a-f0-9]{64}$/.test(artifactHash ?? "") || record.artifactHash !== artifactHash) fail("publication_artifact_mismatch");
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 256 * 1024 || chunkSize > 32 * 1024 * 1024 || chunkSize % (256 * 1024) !== 0 ||
      !Number.isSafeInteger(maxChunks) || maxChunks < 1 || maxChunks > 4096) fail("invalid_upload_limits");
  const checkpointCompletion = async (id) => {
    // Save identity first: a later offset-write failure must never cause a new insert.
    try { await saveVideoId(id); await saveOffset(record.size); }
    catch { fail("upload_result_persistence_failed", { ambiguous: true }); }
    return { state: "complete", videoId: id };
  };
  if (record.videoId) return checkpointCompletion(videoId(record.videoId));
  await client.assertChannel(expectedChannelId);
  let sessionUri = record.sessionUri;
  if (!sessionUri) {
    if (record.uploadStarted || record.reconcileRequired) fail("upload_reconciliation_required", { ambiguous: true });
    sessionUri = await client.initializePrivateUpload({ expectedChannelId, size: record.size, metadata });
    try { await saveSession(sessionUri); }
    catch { fail("upload_session_persistence_failed", { ambiguous: true }); }
  }
  let status = await client.queryUploadSession({ sessionUri, totalSize: record.size });
  for (let count = 0; count < maxChunks; count++) {
    if (status.state === "complete") {
      return checkpointCompletion(status.videoId);
    }
    await saveOffset(status.offset);
    if (status.retryAfterMs) return { ...status, sessionUri };
    if (status.offset >= record.size) fail("upload_completion_unconfirmed", { ambiguous: true });
    const length = Math.min(chunkSize, record.size - status.offset);
    const bytes = await readChunk(status.offset, length);
    if (!(bytes instanceof Uint8Array) || bytes.length !== length) fail("artifact_read_failed");
    const previousOffset = status.offset;
    status = await client.uploadChunk({ sessionUri, totalSize: record.size, offset: status.offset, bytes });
    if (status.state === "incomplete" && status.offset === previousOffset) return { ...status, sessionUri, retryAfterMs: Math.max(status.retryAfterMs, 1000) };
  }
  if (status.state === "complete") {
    return checkpointCompletion(status.videoId);
  }
  return { ...status, sessionUri };
}
