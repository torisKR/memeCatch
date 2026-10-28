import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateAssetRights, parseVideoScript, productionReadiness, publicationEligibility,
  publicAttributionUrl } from "../lib/video-production/core.mjs";
import { refreshAccessToken } from "../lib/video-production/oauth-protocol.mjs";
import { decryptSecret, encryptSecret } from "../lib/video-production/secrets.mjs";
import { buildPrivateVideoMetadata, resumePublicationUpload, YOUTUBE_PUBLICATION_SCOPE, YouTubeApiError, YouTubePublicationClient } from "../lib/video-production/youtube-api.mjs";
import { renderOriginalProduction } from "./video-production-renderer.mjs";

const BUCKET = "video-production-private";
const DEFAULT_CHANNEL_ID = "UCBxN8lUb-5dDuOPv-szpF4g";
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_NARRATION_BYTES = 20 * 1024 * 1024;
const MAX_NARRATION_HEALTH_BYTES = 16 * 1024;
const DEFAULT_TORIS_QWEN_URL = "http://127.0.0.1:50010/synthesize";
const DEFAULT_TORIS_QWEN_MODEL = "model";
const DEFAULT_TORIS_QWEN_SPEAKER = "Sohee";
const DEFAULT_TORIS_QWEN_LANGUAGE = "Korean";
const NARRATION_PROVIDERS = new Set(["generic-https", "toris-qwen"]);
const YOUTUBE_PROCESSING_STATUSES = new Set(["pending", "processing", "succeeded", "failed", "terminated"]);
const YOUTUBE_UPLOAD_STATUSES = new Set(["deleted", "failed", "processed", "rejected", "uploaded"]);
const YOUTUBE_REJECTION_REASONS = new Set([
  "claim", "copyright", "duplicate", "inappropriate", "length", "termsOfUse", "trademark",
  "uploaderAccountClosed", "uploaderAccountSuspended",
]);
const GENERIC_NARRATION_TIMEOUT_MS = 90_000;
const TORIS_QWEN_NARRATION_TIMEOUT_MS = 300_000;
const MAX_NARRATION_TIMEOUT_MS = 600_000;
const LEASE_HEARTBEAT_MS = 60_000;
const SAFE_CODE = /^[a-z0-9_:-]{1,100}$/i;
const PERMANENT_CODES = new Set([
  "youtube_reauthentication_required", "youtube_quota_blocked", "youtube_permission_denied",
  "youtube_privacy_restricted", "youtube_channel_mismatch", "upload_reconciliation_required",
  "upload_session_persistence_failed", "upload_result_persistence_failed", "youtube_visibility_withdrawn",
  "youtube_resource_unavailable", "remote_content_unavailable",
  "publication_revoked_during_publish", "publication_state_recheck_failed", "asset_rights_expired",
]);

export class VideoProductionWorkerError extends Error {
  constructor(code, { reconcileRequired = false, retryAfterMs = 0 } = {}) {
    super(code);
    this.name = "VideoProductionWorkerError";
    this.code = code;
    this.reconcileRequired = reconcileRequired;
    this.retryAfterMs = retryAfterMs;
  }
}

function fail(code, options) { throw new VideoProductionWorkerError(code, options); }
function safeCode(error) {
  const value = error?.code ?? error?.message;
  return typeof value === "string" && SAFE_CODE.test(value) ? value : "video_worker_failed";
}
function required(value, code) {
  if (typeof value !== "string" || !value.trim() || /[\r\n\0]/u.test(value)) fail(code);
  return value.trim();
}
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function boundedRetryAfterMs(value) {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) ? Math.max(0, Math.min(24 * 60 * 60 * 1_000, Math.ceil(milliseconds))) : 0;
}
function observedCode(value, allowed) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && value.length <= 64 && allowed.has(value) ? value : "unknown";
}
function observedStatusOutput(observed) {
  return {
    processingStatus: observedCode(observed.processingStatus, YOUTUBE_PROCESSING_STATUSES),
    uploadStatus: observedCode(observed.uploadStatus, YOUTUBE_UPLOAD_STATUSES),
    rejectionReason: observedCode(observed.rejectionReason, YOUTUBE_REJECTION_REASONS),
  };
}
async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
function localSupabase(url) {
  const parsed = new URL(url);
  return parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
}

export function loadWorkerConfig(env = process.env, argv = process.argv.slice(2)) {
  const url = required(env.NEXT_PUBLIC_SUPABASE_URL, "supabase_url_required");
  if (!argv.includes("--allow-remote") && !localSupabase(url)) fail("remote_supabase_requires_allow_remote");
  const mode = argv.includes("--watch") ? "watch" : argv.includes("--drain") ? "drain" : "once";
  const channelId = env.YOUTUBE_EXPECTED_CHANNEL_ID?.trim() || DEFAULT_CHANNEL_ID;
  if (!CHANNEL_ID.test(channelId)) fail("invalid_youtube_channel_id");
  const narrationProvider = env.VIDEO_NARRATION_PROVIDER?.trim() || "generic-https";
  if (!NARRATION_PROVIDERS.has(narrationProvider)) fail("invalid_narration_provider");
  const configuredNarrationTimeout = env.VIDEO_NARRATION_TIMEOUT_MS?.trim();
  const narrationTimeoutMs = configuredNarrationTimeout
    ? Number(configuredNarrationTimeout)
    : narrationProvider === "toris-qwen" ? TORIS_QWEN_NARRATION_TIMEOUT_MS : GENERIC_NARRATION_TIMEOUT_MS;
  if (!Number.isInteger(narrationTimeoutMs) || narrationTimeoutMs < 1_000 || narrationTimeoutMs > MAX_NARRATION_TIMEOUT_MS) {
    fail("invalid_narration_timeout");
  }
  return Object.freeze({
    mode, url,
    serviceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, "supabase_service_role_required"),
    workerId: (env.VIDEO_WORKER_ID || `video-worker-${process.pid}`).slice(0, 200),
    channelId,
    encryptionKey: env.YOUTUBE_TOKEN_ENCRYPTION_KEY?.trim() || "",
    youtubeClientId: env.YOUTUBE_OAUTH_CLIENT_ID?.trim() || "",
    youtubeClientSecret: env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim() || "",
    narrationProvider,
    narrationUrl: env.VIDEO_NARRATION_URL?.trim()
      || (narrationProvider === "toris-qwen" ? DEFAULT_TORIS_QWEN_URL : ""),
    narrationApiKey: env.VIDEO_NARRATION_API_KEY?.trim() || "",
    narrationModel: env.VIDEO_NARRATION_MODEL?.trim() || DEFAULT_TORIS_QWEN_MODEL,
    narrationSpeaker: env.VIDEO_NARRATION_SPEAKER?.trim() || DEFAULT_TORIS_QWEN_SPEAKER,
    narrationLanguage: env.VIDEO_NARRATION_LANGUAGE?.trim() || DEFAULT_TORIS_QWEN_LANGUAGE,
    narrationInstruct: env.VIDEO_NARRATION_INSTRUCT?.trim() || "",
    narrationTimeoutMs,
    voiceAssetId: env.VIDEO_VOICE_ASSET_ID?.trim() || "",
    fontAssetId: env.VIDEO_FONT_ASSET_ID?.trim() || "",
    fontSha256: env.VIDEO_FONT_ASSET_SHA256?.trim() || "",
    fontFamily: env.VIDEO_FONT_FAMILY?.trim() || "Noto Sans CJK KR",
    graphicAssetId: env.VIDEO_GRAPHIC_ASSET_ID?.trim() || "",
    fontPath: env.VIDEO_FONT_PATH?.trim() || "",
    siteSyncUrl: env.VIDEO_SITE_SYNC_URL?.trim() || "",
    webhookSecret: env.VIDEO_WORKER_WEBHOOK_SECRET?.trim() || "",
    pollMs: Math.max(1_000, Math.min(60_000, Number(env.VIDEO_WORKER_POLL_MS) || 2_000)),
  });
}

async function boundedBytes(response, maximum = MAX_NARRATION_BYTES) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) fail("narration_response_too_large");
  const reader = response.body?.getReader();
  if (!reader) fail("narration_response_empty");
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) fail("narration_response_too_large");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!size) fail("narration_response_empty");
  return Buffer.concat(chunks.map((value) => Buffer.from(value)), size);
}

export async function requestNarration({ url, apiKey, voiceAssetId, narration, fetchImpl = fetch, timeoutMs = 90_000 }) {
  return requestNarrationFromProvider({ provider: "generic-https", url, apiKey, voiceAssetId, narration, fetchImpl, timeoutMs });
}

function torisQwenEndpoint(value) {
  const endpoint = new URL(required(value, "narration_provider_not_configured"));
  if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1" || endpoint.pathname !== "/synthesize"
      || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) fail("invalid_narration_url");
  return endpoint;
}

async function fetchNarration(fetchImpl, input, init) {
  try { return await fetchImpl(input, init); }
  catch { fail("narration_transport_unavailable"); }
}

export async function requestNarrationFromProvider({ provider = "generic-https", url, apiKey, voiceAssetId, narration,
  model = DEFAULT_TORIS_QWEN_MODEL, speaker = DEFAULT_TORIS_QWEN_SPEAKER,
  language = DEFAULT_TORIS_QWEN_LANGUAGE, instruct = "", fetchImpl = fetch, timeoutMs }) {
  if (!NARRATION_PROVIDERS.has(provider)) fail("invalid_narration_provider");
  const requestTimeoutMs = timeoutMs ?? (provider === "toris-qwen" ? TORIS_QWEN_NARRATION_TIMEOUT_MS : GENERIC_NARRATION_TIMEOUT_MS);
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1_000 || requestTimeoutMs > MAX_NARRATION_TIMEOUT_MS) {
    fail("invalid_narration_timeout");
  }
  const reviewedVoiceAssetId = required(voiceAssetId, "voice_asset_binding_not_configured");
  const reviewedNarration = required(narration, "narration_text_required");
  if (provider === "toris-qwen") {
    const endpoint = torisQwenEndpoint(url || DEFAULT_TORIS_QWEN_URL);
    const expectedModel = required(model, "narration_model_not_configured");
    const expectedSpeaker = required(speaker, "narration_speaker_not_configured");
    const expectedLanguage = required(language, "narration_language_not_configured");
    const healthUrl = new URL("/health", endpoint.origin);
    const healthResponse = await fetchNarration(fetchImpl, healthUrl, { method: "GET", redirect: "error", cache: "no-store",
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(Math.min(requestTimeoutMs, 5_000)) });
    if (!healthResponse.ok || !/^application\/json\b/iu.test(healthResponse.headers.get("content-type") ?? "")) {
      fail("narration_health_check_failed");
    }
    let health;
    try { health = JSON.parse((await boundedBytes(healthResponse, MAX_NARRATION_HEALTH_BYTES)).toString("utf8")); }
    catch (error) {
      if (error instanceof VideoProductionWorkerError) throw error;
      fail("narration_health_check_failed");
    }
    if (health?.ok !== true || health.provider !== "qwen3-tts-mlx" || health.backend !== "mlx"
        || health.model !== expectedModel || health.speaker !== expectedSpeaker || health.language !== expectedLanguage) {
      fail("narration_provider_identity_mismatch");
    }
    const response = await fetchNarration(fetchImpl, endpoint, { method: "POST", redirect: "error", cache: "no-store",
      headers: { "content-type": "application/json", accept: "audio/wav", "x-memecatch-voice-asset-id": reviewedVoiceAssetId },
      body: JSON.stringify({ text: reviewedNarration, speaker: expectedSpeaker, language: expectedLanguage,
        ...(instruct ? { instruct } : {}) }), signal: AbortSignal.timeout(requestTimeoutMs) });
    if (!response.ok) fail("narration_request_failed");
    if (!/^audio\/wav\b/iu.test(response.headers.get("content-type") ?? "")) fail("narration_response_not_audio");
    if (response.headers.get("x-tts-provider") !== "qwen3-tts-mlx"
        || response.headers.get("x-tts-speaker") !== expectedSpeaker) fail("narration_provider_identity_mismatch");
    return boundedBytes(response);
  }
  const endpoint = new URL(required(url, "narration_provider_not_configured"));
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash) fail("invalid_narration_url");
  required(apiKey, "narration_provider_not_configured");
  const response = await fetchNarration(fetchImpl, endpoint, { method: "POST", redirect: "error", cache: "no-store",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", accept: "audio/*",
        "x-memecatch-voice-asset-id": reviewedVoiceAssetId },
      body: JSON.stringify({ text: reviewedNarration }), signal: AbortSignal.timeout(requestTimeoutMs) });
  if (!response.ok) fail(response.status === 401 || response.status === 403 ? "narration_authentication_failed" : "narration_request_failed");
  if (!/^audio\//iu.test(response.headers.get("content-type") ?? "")) fail("narration_response_not_audio");
  return boundedBytes(response);
}

export function createLeaseGuard(repository, job, options = {}) {
  const intervalMs = options.intervalMs ?? LEASE_HEARTBEAT_MS;
  let lost = false;
  let stopped = false;
  let renewing = null;
  const renew = async () => {
    if (stopped || lost) return;
    try { await repository.renew(job.id, job.lease_token); }
    catch { lost = true; }
  };
  const timer = (options.setIntervalImpl ?? setInterval)(() => { renewing = renew(); }, intervalMs);
  timer?.unref?.();
  return {
    async ensure() {
      if (renewing) await renewing;
      if (lost || stopped) fail("video_job_lease_lost");
      try { await repository.renew(job.id, job.lease_token); }
      catch { lost = true; fail("video_job_lease_lost"); }
    },
    assert() { if (lost || stopped) fail("video_job_lease_lost"); },
    stop() { stopped = true; (options.clearIntervalImpl ?? clearInterval)(timer); },
    get lost() { return lost; },
  };
}

function rowResult(result, code) {
  if (result?.error) fail(code);
  if (!result?.data) fail(code);
  return result.data;
}
function queryOne(query, code) { return query.single().then((result) => rowResult(result, code)); }

export function createSupabaseWorkerRepository(supabase, encryptionKey) {
  const storage = supabase.storage.from(BUCKET);
  return {
    async claim(workerId) {
      const result = await supabase.rpc("claim_video_production_job", { p_worker_id: workerId });
      if (result.error) fail("video_job_claim_failed");
      return result.data ?? null;
    },
    async renew(id, token) {
      return rowResult(await supabase.rpc("renew_video_production_job", { p_job_id: id, p_lease_token: token }), "video_job_lease_invalid");
    },
    async complete(job, output) {
      return rowResult(await supabase.rpc("complete_video_production_job", { p_job_id: job.id, p_lease_token: job.lease_token, p_output_json: output }), "video_job_completion_failed");
    },
    async fail(job, code, reconcileRequired, retryAfterMs = 0) {
      return rowResult(await supabase.rpc("fail_video_production_job", { p_job_id: job.id, p_lease_token: job.lease_token,
        p_error_code: code.slice(0, 200), p_reconcile_required: reconcileRequired,
        p_retry_after_ms: boundedRetryAfterMs(retryAfterMs) }), "video_job_failure_record_failed");
    },
    loadProduction(id) {
      return queryOne(supabase.from("video_productions").select("*").eq("id", id), "video_production_not_found");
    },
    async loadPublication(id) {
      const publication = await queryOne(supabase.from("youtube_publications").select("*").eq("id", id), "youtube_publication_not_found");
      const channel = await queryOne(supabase.from("youtube_channel_connections").select("*").eq("id", publication.channel_connection_id), "youtube_channel_not_found");
      return { publication, channel };
    },
    async downloadArtifact(key) {
      const result = await storage.download(key);
      if (result.error || !result.data) fail("artifact_download_failed");
      return new Uint8Array(await result.data.arrayBuffer());
    },
    async putImmutable(key, bytes, contentType, expectedHash) {
      const result = await storage.upload(key, bytes, { contentType, upsert: false });
      if (!result.error) return;
      const existing = await storage.download(key);
      if (existing.error || !existing.data || sha256(new Uint8Array(await existing.data.arrayBuffer())) !== expectedHash) fail("durable_artifact_conflict");
    },
    async loadUploadSession(publicationId) {
      const result = await supabase.from("youtube_upload_sessions_private").select("*").eq("publication_id", publicationId).maybeSingle();
      if (result.error) fail("upload_session_query_failed");
      return result.data;
    },
    async markUploadIntent(publicationId, totalBytes) {
      const result = await supabase.from("youtube_upload_sessions_private").upsert({ publication_id: publicationId,
        encrypted_session_uri: null, bytes_uploaded: 0, total_bytes: totalBytes,
        upload_intent_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "publication_id", ignoreDuplicates: true });
      if (result.error) fail("upload_intent_persistence_failed", { reconcileRequired: true });
    },
    async saveUploadSession(publicationId, sessionUri, totalBytes) {
      const encrypted = encryptSecret(sessionUri, `youtube-upload:${publicationId}`, encryptionKey);
      const result = await supabase.from("youtube_upload_sessions_private").update({ encrypted_session_uri: encrypted,
        total_bytes: totalBytes, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("publication_id", publicationId);
      if (result.error) fail("upload_session_persistence_failed", { reconcileRequired: true });
    },
    async saveUploadOffset(publicationId, offset, chunkStarted = false) {
      const values = { bytes_uploaded: offset, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (chunkStarted) values.last_chunk_started_at = new Date().toISOString();
      const result = await supabase.from("youtube_upload_sessions_private").update(values).eq("publication_id", publicationId);
      if (result.error) fail("upload_offset_persistence_failed", { reconcileRequired: true });
    },
    async saveVideoId(publicationId, videoId) {
      const result = await supabase.from("youtube_publications").update({ youtube_video_id: videoId, updated_at: new Date().toISOString() })
        .eq("id", publicationId).is("youtube_video_id", null).select("id,youtube_video_id").maybeSingle();
      if (result.error || (result.data && result.data.youtube_video_id !== videoId)) fail("upload_result_persistence_failed", { reconcileRequired: true });
      if (!result.data) {
        const current = await queryOne(supabase.from("youtube_publications").select("youtube_video_id").eq("id", publicationId), "upload_result_persistence_failed");
        if (current.youtube_video_id !== videoId) fail("upload_result_persistence_failed", { reconcileRequired: true });
      }
    },
    async markChannelReauth(channelConnectionId) {
      const result = await supabase.from("youtube_channel_connections").update({ connection_status: "reauth_required", updated_at: new Date().toISOString() })
        .eq("id", channelConnectionId);
      if (result.error) fail("youtube_connection_update_failed", { reconcileRequired: true });
    },
    async queueSyncRetry(job) {
      const result = await supabase.from("video_production_jobs").insert({ production_id: job.production_id,
        publication_id: job.publication_id, kind: "sync", input_hash: job.input_hash, status: "retry_wait",
        retry_after: new Date(Date.now() + 60_000).toISOString(), max_attempts: 5,
        output_json: { reason: "site_cache_refresh_pending" } });
      if (result.error && result.error.code !== "23505") fail("site_sync_retry_queue_failed");
      return !result.error;
    },
    async queueWithdraw(job) {
      const result = await supabase.from("video_production_jobs").insert({ production_id: job.production_id,
        publication_id: job.publication_id, kind: "withdraw", input_hash: job.input_hash,
        max_attempts: 10, output_json: { reason: "publish_compensation_required" } });
      if (result.error && result.error.code !== "23505") fail("withdraw_queue_failed", { reconcileRequired: true });
    },
  };
}

async function accessToken(connection, config, deps) {
  if (connection.connection_status !== "connected" || !connection.scopes?.includes(YOUTUBE_PUBLICATION_SCOPE)) {
    fail("youtube_reauthentication_required", { reconcileRequired: true });
  }
  const token = decryptSecret(connection.encrypted_refresh_token, `youtube-channel:${connection.channel_id}`, required(config.encryptionKey, "video_encryption_key_required"));
  const result = await refreshAccessToken({ clientId: required(config.youtubeClientId, "youtube_oauth_not_configured"),
    clientSecret: required(config.youtubeClientSecret, "youtube_oauth_not_configured"), refreshToken: token, fetchImpl: deps.fetchImpl });
  if (result.scope !== undefined && !result.scope.split(/\s+/u).includes(YOUTUBE_PUBLICATION_SCOPE)) {
    fail("youtube_reauthentication_required", { reconcileRequired: true });
  }
  return result.access_token;
}

function assertChannel(channel, config) {
  if (channel.channel_id !== config.channelId) fail("youtube_channel_mismatch", { reconcileRequired: true });
}

function assertCurrentAssetRights(production) {
  const rights = evaluateAssetRights(production.assets_json, new Date());
  if (!rights.allowed) fail("asset_rights_expired", { reconcileRequired: true });
}

async function renderJob(context) {
  const { repository, job, production, config, deps, lease } = context;
  const sources = production.source_snapshot?.sources;
  const script = parseVideoScript(production.script_json, { allowedSourceIds: sources?.map((source) => source.id) });
  const rights = evaluateAssetRights(production.assets_json);
  if (!rights.allowed) fail("asset_rights_not_approved");
  const ids = [config.voiceAssetId, config.fontAssetId, config.graphicAssetId].map((value) => required(value, "video_asset_binding_not_configured"));
  for (const [id, kind] of ids.map((id, index) => [id, ["voice", "font", "graphic"][index]])) {
    if (!production.assets_json.some((asset) => asset.id === id && asset.kind === kind)) fail("video_asset_binding_mismatch");
  }
  const directory = await mkdtemp(join(tmpdir(), "memecatch-video-worker-"));
  try {
    const narration = await (deps.requestNarration ?? requestNarrationFromProvider)({ provider: config.narrationProvider,
      url: config.narrationUrl, apiKey: config.narrationApiKey, model: config.narrationModel,
      speaker: config.narrationSpeaker, language: config.narrationLanguage, instruct: config.narrationInstruct,
      voiceAssetId: config.voiceAssetId, narration: script.narration, fetchImpl: deps.fetchImpl,
      timeoutMs: config.narrationTimeoutMs });
    const narrationSha256 = sha256(narration);
    const expectedNarrationSha256 = job.output_json?.expectedVoiceSha256;
    if (expectedNarrationSha256 !== undefined
        && (!SHA256.test(expectedNarrationSha256) || narrationSha256 !== expectedNarrationSha256)) {
      fail("voice_asset_hash_mismatch");
    }
    if (await sha256File(required(config.fontPath, "font_path_not_configured")) !== required(config.fontSha256, "font_asset_hash_not_configured")) fail("font_asset_hash_mismatch");
    const narrationPath = join(directory, "narration.audio");
    await writeFile(narrationPath, narration, { flag: "wx", mode: 0o600 });
    const rendered = await (deps.renderOriginalProduction ?? renderOriginalProduction)({ script, assets: production.assets_json,
      assetBindings: { voiceAssetId: config.voiceAssetId, fontAssetId: config.fontAssetId, graphicAssetId: config.graphicAssetId,
        voiceSha256: narrationSha256, fontSha256: config.fontSha256 }, sources, narrationPath,
      outputDirectory: directory, fontPath: config.fontPath, fontFamily: config.fontFamily });
    await lease.ensure();
    const [video, poster] = await Promise.all([readFile(rendered.mp4Path), readFile(rendered.posterPath)]);
    if (sha256(video) !== rendered.sha256) fail("rendered_artifact_hash_mismatch");
    const artifactKey = `${production.id}/${rendered.sha256}.mp4`;
    const posterHash = sha256(poster);
    const posterKey = `${production.id}/${posterHash}.png`;
    await lease.ensure();
    await repository.putImmutable(artifactKey, video, "video/mp4", rendered.sha256);
    await lease.ensure();
    await repository.putImmutable(posterKey, poster, "image/png", posterHash);
    return { artifactHash: rendered.sha256, artifactKey, artifactSize: rendered.byteSize, posterKey,
      technicalCheck: rendered.technicalCheck, assetBindings: rendered.assetBindings };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

function descriptionFor(production) {
  const sourceById = new Map(production.source_snapshot.sources.map((source) => [source.id, source]));
  const usedSources = production.script_json.source_ids.map((id) => sourceById.get(id));
  if (usedSources.some((source) => !source)) fail("source_mapping_incomplete");
  const sourceLines = usedSources.map((source, index) =>
    `[${index + 1}] ${source.title}\n${publicAttributionUrl(source.url)}`).join("\n");
  const attributions = [...new Set(production.assets_json
    .map((asset) => typeof asset.attribution === "string" ? asset.attribution.trim() : "")
    .filter(Boolean))];
  const assetCredits = attributions.length ? `\n\n제작 자산 표기\n${attributions.map((value) => `- ${value}`).join("\n")}` : "";
  return `${production.script_json.description}\n\n자료\n${sourceLines}${assetCredits}`;
}

async function publicationClient(context, connection) {
  if (context.deps.createYouTubeClient) return context.deps.createYouTubeClient(connection, context);
  let token;
  try { token = await accessToken(connection, context.config, context.deps); }
  catch (error) {
    if (safeCode(error) === "youtube_reauthentication_required") await context.repository.markChannelReauth?.(connection.id);
    throw error;
  }
  return new YouTubePublicationClient({ getAccessToken: async () => token, fetchImpl: context.deps.fetchImpl });
}

async function uploadJob(context) {
  const { repository, production, publication, channel, config, lease } = context;
  assertChannel(channel, config);
  const technicalCheck = production.technical_check && {
    duration_ms: production.technical_check.duration_ms, width: production.technical_check.width,
    height: production.technical_check.height, has_audio: production.technical_check.has_audio,
    decodable: production.technical_check.decodable, captions_safe: production.technical_check.captions_safe,
    passed: production.technical_check.passed,
  };
  const readiness = productionReadiness({ script: production.script_json, assets: production.assets_json,
    blocked: production.status === "blocked", artifactHash: production.artifact_hash,
    approvedArtifactHash: production.approved_artifact_hash, technicalCheck });
  if (!readiness.ready || publication.artifact_hash !== production.artifact_hash) fail("production_not_ready_for_upload");
  const metadata = buildPrivateVideoMetadata({ title: production.script_json.title,
    description: descriptionFor(production), containsSyntheticMedia: production.script_json.contains_synthetic_media,
    madeForKids: publication.made_for_kids });
  const artifact = await repository.downloadArtifact(production.artifact_key);
  if (sha256(artifact) !== publication.artifact_hash || artifact.byteLength !== Number(production.artifact_size)) fail("durable_artifact_mismatch");
  const stored = await repository.loadUploadSession(publication.id);
  let sessionUri = null;
  if (stored?.encrypted_session_uri) {
    sessionUri = decryptSecret(stored.encrypted_session_uri, `youtube-upload:${publication.id}`,
      required(config.encryptionKey, "video_encryption_key_required"));
  }
  const client = await publicationClient(context, channel);
  const guardedClient = Object.create(client);
  guardedClient.assertChannel = (...args) => client.assertChannel(...args);
  guardedClient.queryUploadSession = async (...args) => { await lease.ensure(); return client.queryUploadSession(...args); };
  guardedClient.uploadChunk = async (...args) => { await lease.ensure(); await repository.saveUploadOffset(publication.id, args[0].offset, true); return client.uploadChunk(...args); };
  guardedClient.initializePrivateUpload = async (...args) => {
    await lease.ensure();
    await repository.markUploadIntent(publication.id, artifact.byteLength);
    return client.initializePrivateUpload(...args);
  };
  const result = await resumePublicationUpload({ client: guardedClient, expectedChannelId: channel.channel_id,
    artifactHash: publication.artifact_hash, metadata,
    record: { id: publication.id, size: artifact.byteLength, artifactHash: publication.artifact_hash,
      videoId: publication.youtube_video_id, sessionUri, uploadStarted: Boolean(stored?.upload_intent_at), reconcileRequired: publication.status === "reconcile_required" },
    readChunk: async (offset, length) => artifact.slice(offset, offset + length),
    saveSession: async (uri) => { await lease.ensure(); await repository.saveUploadSession(publication.id, uri, artifact.byteLength); },
    saveOffset: async (offset) => { await lease.ensure(); await repository.saveUploadOffset(publication.id, offset); },
    saveVideoId: async (videoId) => { await lease.ensure(); await repository.saveVideoId(publication.id, videoId); },
  });
  if (result.state !== "complete") fail("youtube_upload_incomplete", { retryAfterMs: result.retryAfterMs });
  await lease.ensure();
  const observed = await client.videoStatus(result.videoId, channel.channel_id);
  if (observed.privacyStatus !== "private") fail("private_upload_confirmation_required", { reconcileRequired: true });
  return { youtubeVideoId: result.videoId, channelId: channel.channel_id, privacyStatus: "private",
    processingStatus: observed.processingStatus, embeddable: observed.embeddable };
}

async function observeJob(context) {
  const { publication, channel, config, lease, job, deps, repository } = context;
  if (job.kind === "monitor" && publication.status === "site_linked") assertCurrentAssetRights(context.production);
  assertChannel(channel, config);
  const client = await publicationClient(context, channel);
  await lease.ensure();
  let observed;
  try { observed = await client.videoStatus(publication.youtube_video_id, channel.channel_id); }
  catch (error) {
    if (error instanceof YouTubeApiError && error.code === "youtube_resource_unavailable") {
      fail("remote_content_unavailable", { reconcileRequired: true });
    }
    throw error;
  }
  if (job.kind === "monitor" && publication.status === "site_linked" &&
      (observed.privacyStatus !== publication.approved_visibility
        || observed.embeddable !== true || observed.processingStatus !== "succeeded")) {
    fail("youtube_visibility_withdrawn", { reconcileRequired: true });
  }
  const output = { youtubeVideoId: observed.videoId, channelId: observed.channelId, ...observedStatusOutput(observed),
    privacyStatus: observed.privacyStatus, embeddable: observed.embeddable };
  if (job.kind !== "monitor" || publication.status !== "site_linked") return { output };
  const verify = deps.verifyYouTubeEmbed ?? (await import("./youtube-embed-probe.mjs")).verifyYouTubeEmbed;
  await lease.ensure();
  try {
    const evidence = await verify({ videoId: publication.youtube_video_id, channelId: channel.channel_id,
      artifactHash: publication.artifact_hash });
    output.embedVerified = evidence?.verified === true && evidence.videoId === publication.youtube_video_id
      && evidence.artifactHash === publication.artifact_hash;
  } catch { output.embedVerified = false; }
  if (output.embedVerified && observed.videoMetadata) output.videoMetadata = observed.videoMetadata;
  return { output, afterComplete: output.embedVerified ? undefined : async () => {
    try { await sendSiteSyncCallback(context, { requireLease: false }); }
    catch { await repository.queueSyncRetry(job); }
  } };
}

async function compensatePublishedVisibility(context, existingClient) {
  const { publication, channel, lease, repository, job } = context;
  const client = existingClient ?? await publicationClient(context, channel);
  try {
    await lease.ensure();
    await client.setVisibility({ videoId: publication.youtube_video_id,
      expectedChannelId: channel.channel_id, visibility: "private" });
  } finally {
    await repository.queueWithdraw(job);
  }
}

async function publishJob(context) {
  const { production, publication, channel, config, lease, repository, job } = context;
  assertChannel(channel, config);
  assertCurrentAssetRights(production);
  const eligibility = publicationEligibility({ channel: config.channelId, uploadedChannel: channel.channel_id,
    hash: { artifact: production.artifact_hash, approved: production.approved_artifact_hash, uploaded: publication.artifact_hash },
    privacy: publication.approved_visibility, processing: publication.processing_status, embeddable: publication.embeddable,
    publicApproval: Boolean(publication.public_approved_at), studioReviewed: Boolean(publication.studio_reviewed_at),
    blocked: production.status === "blocked" || ["blocked", "unavailable"].includes(publication.status) });
  if (!eligibility.eligible) fail("publication_not_eligible");
  const client = await publicationClient(context, channel);
  await lease.ensure();
  context.externalMutationStarted = true;
  const observed = await client.setVisibility({ videoId: publication.youtube_video_id,
    expectedChannelId: channel.channel_id, visibility: publication.approved_visibility });
  await lease.ensure();
  let freshProduction;
  let freshPublicationContext;
  try {
    [freshProduction, freshPublicationContext] = await Promise.all([
      repository.loadProduction(job.production_id), repository.loadPublication(job.publication_id),
    ]);
    assertCurrentAssetRights(freshProduction);
  } catch {
    await compensatePublishedVisibility(context, client);
    fail("publication_state_recheck_failed", { reconcileRequired: true });
  }
  const freshPublication = freshPublicationContext.publication;
  const authorizationStillCurrent = freshProduction.status === "approved"
    && freshProduction.artifact_hash === job.input_hash
    && freshProduction.approved_artifact_hash === job.input_hash
    && !["blocked", "unavailable", "reconcile_required"].includes(freshPublication.status)
    && freshPublication.artifact_hash === job.input_hash
    && freshPublication.approved_publication_hash === job.input_hash
    && freshPublication.approved_visibility === publication.approved_visibility
    && Boolean(freshPublication.public_approved_at) && Boolean(freshPublication.studio_reviewed_at)
    && freshPublicationContext.channel.channel_id === config.channelId
    && freshPublicationContext.channel.connection_status === "connected";
  if (!authorizationStillCurrent) {
    await compensatePublishedVisibility(context, client);
    fail("publication_revoked_during_publish", { reconcileRequired: true });
  }
  return { youtubeVideoId: observed.videoId, channelId: observed.channelId, processingStatus: observed.processingStatus,
    privacyStatus: observed.privacyStatus, embeddable: observed.embeddable };
}

async function withdrawJob(context) {
  const { publication, channel, config, lease } = context;
  assertChannel(channel, config);
  const client = await publicationClient(context, channel);
  await lease.ensure();
  const observed = await client.setVisibility({ videoId: publication.youtube_video_id, expectedChannelId: channel.channel_id, visibility: "private" });
  return { youtubeVideoId: observed.videoId, channelId: observed.channelId, privacyStatus: "private",
    processingStatus: observed.processingStatus, embeddable: observed.embeddable };
}

function validateSiteSync(url, secret) {
  const endpoint = new URL(required(url, "site_sync_not_configured"));
  if (endpoint.protocol !== "https:" || !(endpoint.hostname === "catchmeme.com" || endpoint.hostname.endsWith(".catchmeme.com"))
      || endpoint.username || endpoint.password || endpoint.hash || endpoint.search
      || endpoint.pathname !== "/api/admin/video-productions/worker-sync") fail("invalid_site_sync_url");
  const webhookSecret = required(secret, "site_sync_not_configured");
  if (Buffer.byteLength(webhookSecret, "utf8") < 32) fail("site_sync_secret_too_short");
  return { endpoint, secret: webhookSecret };
}

function isCacheOnlySync(job) {
  return job.kind === "sync" && job.output_json?.reason === "site_cache_refresh_pending";
}

function assertCacheSyncAuthority({ production, publication, job }) {
  if (!isCacheOnlySync(job) || publication.id !== job.publication_id
      || publication.production_id !== production.id || publication.artifact_hash !== job.input_hash
      || production.artifact_hash !== job.input_hash || !SHA256.test(job.input_hash)) {
    fail("site_cache_refresh_not_authorized", { reconcileRequired: true });
  }
}

async function sendSiteSyncCallback(context, { requireLease = true } = {}) {
  const { production, publication, config, deps, lease } = context;
  if (production.id !== publication.production_id || publication.artifact_hash !== context.job.input_hash) {
    fail("site_cache_refresh_not_authorized", { reconcileRequired: true });
  }
  const { endpoint, secret } = validateSiteSync(config.siteSyncUrl, config.webhookSecret);
  const body = JSON.stringify({ publicationId: publication.id, artifactHash: publication.artifact_hash });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  if (requireLease) await lease.ensure();
  let response;
  try {
    response = await (deps.fetchImpl ?? fetch)(endpoint, { method: "POST", redirect: "error", cache: "no-store",
      headers: { "content-type": "application/json", "x-video-worker-timestamp": timestamp,
        "x-video-worker-signature": signature }, body, signal: AbortSignal.timeout(15_000) });
  } catch { fail("site_sync_callback_failed"); }
  if (!response.ok) fail("site_sync_callback_failed");
  return { cacheRefreshCompleted: true };
}

async function syncJob(context) {
  const { production, publication, channel, config, lease, deps, repository, job } = context;
  if (isCacheOnlySync(job)) {
    assertCacheSyncAuthority(context);
    return { output: { cacheOnly: true, publicationId: publication.id, artifactHash: publication.artifact_hash,
      ...(await sendSiteSyncCallback(context)) } };
  }
  assertChannel(channel, config);
  assertCurrentAssetRights(production);
  const eligibility = publicationEligibility({ channel: config.channelId, uploadedChannel: channel.channel_id,
    hash: { artifact: production.artifact_hash, approved: production.approved_artifact_hash, uploaded: publication.artifact_hash },
    privacy: publication.privacy_status, processing: publication.processing_status, embeddable: publication.embeddable,
    publicApproval: Boolean(publication.public_approved_at), studioReviewed: Boolean(publication.studio_reviewed_at), blocked: false });
  if (!eligibility.eligible) fail("publication_not_eligible");
  const verify = deps.verifyYouTubeEmbed ?? (await import("./youtube-embed-probe.mjs")).verifyYouTubeEmbed;
  await lease.ensure();
  const evidence = await verify({ videoId: publication.youtube_video_id, channelId: channel.channel_id, artifactHash: publication.artifact_hash });
  if (!evidence?.verified || evidence.artifactHash !== publication.artifact_hash || evidence.videoId !== publication.youtube_video_id) fail("youtube_embed_verification_failed");
  const client = await publicationClient(context, channel);
  await lease.ensure();
  const observed = await client.videoStatus(publication.youtube_video_id, channel.channel_id);
  if (observed.videoId !== publication.youtube_video_id || observed.channelId !== channel.channel_id
      || observed.processingStatus !== "succeeded" || observed.privacyStatus !== publication.approved_visibility
      || !["public", "unlisted"].includes(observed.privacyStatus) || observed.embeddable !== true) {
    fail("youtube_visibility_withdrawn", { reconcileRequired: true });
  }
  const output = { youtubeVideoId: observed.videoId, channelId: observed.channelId,
    processingStatus: observed.processingStatus, privacyStatus: observed.privacyStatus,
    embeddable: true, embedVerified: true, embedSmokeVerified: true, embedSmokeHash: publication.artifact_hash,
    cacheRefreshQueued: true };
  if (observed.videoMetadata) output.videoMetadata = observed.videoMetadata;
  return { output, afterComplete: async () => {
    try { await sendSiteSyncCallback(context, { requireLease: false }); }
    catch { await repository.queueSyncRetry(job); }
  } };
}

async function loadContext(repository, job, config, deps, lease) {
  const production = await repository.loadProduction(job.production_id);
  if (job.kind === "render") {
    if (production.status === "blocked") fail("video_production_blocked", { reconcileRequired: true });
    return { repository, job, production, config, deps, lease };
  }
  const { publication, channel } = await repository.loadPublication(job.publication_id);
  const allowedBlockedOperation = job.kind === "withdraw" || isCacheOnlySync(job);
  if ((production.status === "blocked" || ["blocked", "unavailable"].includes(publication.status)) && !allowedBlockedOperation) {
    fail("video_production_blocked", { reconcileRequired: true });
  }
  return { repository, job, production, publication, channel, config, deps, lease };
}

export async function processClaimedVideoProductionJob({ repository, job, config, deps = {} }) {
  const lease = createLeaseGuard(repository, job, deps.leaseOptions);
  let completed = false;
  let context;
  try {
    context = await loadContext(repository, job, config, deps, lease);
    let result;
    if (job.kind === "render") result = { output: await renderJob(context) };
    else if (job.kind === "upload") result = { output: await uploadJob(context) };
    else if (["check", "monitor"].includes(job.kind)) result = await observeJob(context);
    else if (job.kind === "publish") result = { output: await publishJob(context) };
    else if (job.kind === "withdraw") result = { output: await withdrawJob(context) };
    else if (job.kind === "sync") result = await syncJob(context);
    else fail("unsupported_video_job_kind");
    await lease.ensure();
    await repository.complete(job, result.output);
    completed = true;
    await result.afterComplete?.();
    return { processed: true, completed: true, output: result.output };
  } catch (error) {
    if (completed) return { processed: true, completed: true, output: { cacheRefreshQueued: true } };
    const code = safeCode(error);
    if (lease.lost || code === "video_job_lease_lost") return { processed: true, completed: false, leaseLost: true, errorCode: code };
    if (context && job.kind === "publish" && context.externalMutationStarted
        && !["publication_revoked_during_publish", "publication_state_recheck_failed"].includes(code)) {
      try { await compensatePublishedVisibility(context); }
      catch { await repository.queueWithdraw(job); }
    }
    const externalMutationMayHaveSucceeded = ["upload", "publish", "withdraw"].includes(job.kind)
      && ["video_job_completion_failed", "video_job_failure_record_failed"].includes(code);
    const reconcile = error?.reconcileRequired === true || error?.ambiguous === true || PERMANENT_CODES.has(code)
      || externalMutationMayHaveSucceeded;
    const retryAfterMs = boundedRetryAfterMs(error?.retryAfterMs);
    try { await lease.ensure(); await repository.fail(job, code, reconcile, retryAfterMs); }
    catch (failure) {
      if (safeCode(failure) === "video_job_lease_lost") return { processed: true, completed: false, leaseLost: true, errorCode: code };
      throw failure;
    }
    let cacheRefreshQueued = false;
    if (context && job.kind === "monitor"
        && ["remote_content_unavailable", "youtube_visibility_withdrawn", "asset_rights_expired"].includes(code)) {
      try { await sendSiteSyncCallback(context, { requireLease: false }); }
      catch {
        await repository.queueSyncRetry(job);
        cacheRefreshQueued = true;
      }
    }
    return { processed: true, completed: false, errorCode: code, reconcileRequired: reconcile,
      retryAfterMs, cacheRefreshQueued };
  } finally { lease.stop(); }
}

export async function processOneVideoProductionJob({ repository, config, deps = {} }) {
  const job = await repository.claim(config.workerId);
  if (!job) return { processed: false };
  return processClaimedVideoProductionJob({ repository, job, config, deps });
}

export async function runVideoProductionWorker({ repository, config, deps = {}, shouldStop = () => false,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (config.mode === "once") return processOneVideoProductionJob({ repository, config, deps });
  let processed = 0;
  while (!shouldStop()) {
    const result = await processOneVideoProductionJob({ repository, config, deps });
    if (result.processed) { processed += 1; continue; }
    if (config.mode === "drain") break;
    await wait(config.pollMs);
  }
  return { processed };
}

async function main() {
  const config = loadWorkerConfig();
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(config.url, config.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const repository = createSupabaseWorkerRepository(supabase, config.encryptionKey);
  let stopping = false;
  process.once("SIGTERM", () => { stopping = true; });
  process.once("SIGINT", () => { stopping = true; });
  const result = await runVideoProductionWorker({ repository, config, shouldStop: () => stopping });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => { console.error(safeCode(error)); process.exitCode = 1; });
}
