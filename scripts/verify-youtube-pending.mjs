#!/usr/bin/env node
/**
 * 검수 대기 YouTube/Shorts 출처를 videos.list 배치로 검증한다.
 *
 * 사용: node scripts/verify-youtube-pending.mjs [--limit=3000] [--dry-run]
 */
import { pathToFileURL } from "node:url";

import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";
import {
  applyYouTubePrivateMetadataPolicy,
  buildYouTubeMaintenanceRecoveryBlocks,
  classifyYouTubeMaintenanceSource,
  validateYouTubeVideoBatchExternalIds,
  validateYouTubeVideosListResponse,
  validateYouTubeVideoStatusItems,
} from "../lib/sources/youtube-response.mjs";

const BATCH_SIZE = 50;
const METADATA_TTL_MS = 30 * 86_400_000;
const MAX_REPORTED_ERRORS = 20;

function parseDuration(value) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

async function safeRest(rest, path, options) {
  try {
    return await rest(path, options);
  } catch {
    throw new Error("youtube_source_write_failed");
  }
}

async function fetchValidatedBatch(fetchImpl, apiKey, requestedVideoIds) {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({
    part: "snippet,status,contentDetails",
    id: [...requestedVideoIds].join(","),
    key: apiKey,
  }).toString();
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) }).catch(() => {
    throw new Error("videos.list request failed");
  });
  if (!response.ok) throw new Error(`videos.list HTTP ${response.status}`);
  const data = await response.json().catch(() => {
    throw new Error("videos.list invalid JSON");
  });
  return validateYouTubeVideoStatusItems(
    validateYouTubeVideosListResponse(data, requestedVideoIds),
  );
}

/**
 * @param {{
 *   sources: Array<{ id: string, platform: string, external_id: unknown, canonical_url: unknown }>,
 *   recoveryBlocks?: ReadonlyMap<string, "youtube_source_active_quarantine" | "youtube_source_retry_deferred">,
 *   apiKey: string,
 *   fetchImpl?: typeof fetch,
 *   rest: Function,
 *   dryRun?: boolean,
 *   limit?: number,
 *   now?: string,
 *   onProgress?: (completed: number, total: number) => void,
 * }} options
 */
export async function runVerifyYouTubePending({
  sources,
  recoveryBlocks = new Map(),
  apiKey,
  fetchImpl = fetch,
  rest,
  dryRun = false,
  limit = 3000,
  now = new Date().toISOString(),
  onProgress = () => {},
}) {
  const expires = new Date(Date.parse(now) + METADATA_TTL_MS).toISOString();
  const stats = {
    checked: 0,
    verified: 0,
    unembeddable: 0,
    removed: 0,
    failed: 0,
    apiCalls: 0,
    errors: [],
    errorsTruncated: 0,
  };
  const validSources = [];

  for (const source of sources) {
    const sourceError = classifyYouTubeMaintenanceSource(
      source,
      normalizeSourceUrl(source.canonical_url),
      recoveryBlocks,
    );
    if (sourceError) {
      stats.checked += 1;
      stats.failed += 1;
      if (stats.errors.length < MAX_REPORTED_ERRORS) {
        stats.errors.push(`${sourceError}:${source.id}`);
      } else {
        stats.errorsTruncated += 1;
      }
      continue;
    }
    validSources.push(source);
  }
  const validTargets = validSources.slice(0, limit);

  for (let index = 0; index < validTargets.length; index += BATCH_SIZE) {
    const batch = validTargets.slice(index, index + BATCH_SIZE);
    const requestedVideoIds = validateYouTubeVideoBatchExternalIds(
      batch.map((source) => source.external_id),
    );
    const items = await fetchValidatedBatch(fetchImpl, apiKey, requestedVideoIds);
    stats.apiCalls += 1;
    const byId = new Map(items.map((item) => [item.id, item]));

    for (const source of batch) {
      const video = byId.get(source.external_id);
      stats.checked += 1;
      if (!video) {
        stats.removed += 1;
        if (!dryRun) {
          await safeRest(rest, `media_sources?id=eq.${source.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              removed_at: now,
              last_checked_at: now,
              title: null,
              thumbnail_url: null,
              metadata_expires_at: null,
            }),
          });
        }
        continue;
      }

      const embeddable =
        video.status.privacyStatus === "public" && video.status.embeddable;
      const isPrivate = video.status.privacyStatus === "private";
      if (isPrivate) stats.removed += 1;
      else if (embeddable) stats.verified += 1;
      else stats.unembeddable += 1;

      if (!dryRun) {
        const thumbnails = video.snippet?.thumbnails ?? {};
        await safeRest(rest, `media_sources?id=eq.${source.id}`, {
          method: "PATCH",
          body: JSON.stringify(
            applyYouTubePrivateMetadataPolicy(
              {
                title: video.snippet?.title ?? null,
                channel_name: video.snippet?.channelTitle ?? null,
                channel_id: video.snippet?.channelId ?? null,
                platform_published_at: video.snippet?.publishedAt ?? null,
                duration_seconds: parseDuration(video.contentDetails?.duration),
                public_status: video.status.privacyStatus,
                embeddable,
                license_code: video.status.license ?? null,
                made_for_kids: video.status.madeForKids ?? null,
                thumbnail_url:
                  thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
                metadata_refreshed_at: now,
                metadata_expires_at: expires,
                last_checked_at: now,
              },
              video.status.privacyStatus,
              now,
            ),
          ),
        });
      }
    }
    onProgress(Math.min(index + BATCH_SIZE, validTargets.length), validTargets.length);
  }

  return { dryRun, ...stats };
}

function parseArgs(args) {
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  return {
    limit: Math.max(50, Number(limitArg?.slice(8) ?? 3000)),
    dryRun: args.includes("--dry-run"),
  };
}

async function main(args = process.argv.slice(2)) {
  const { limit, dryRun } = parseArgs(args);
  const env = loadEnv();
  if (!env.YOUTUBE_API_KEY) throw new Error("youtube_api_key_missing");
  const rest = createRestClient(env);
  const activeRecovery = await restAll(
    rest,
    "source_acquisition_recovery?select=source_key,source_id,last_error_code,last_error_retryable,next_retry_at&resolved_at=is.null&source_id=not.is.null",
  ).catch(() => {
    throw new Error("youtube_source_quarantine_read_failed");
  });
  const recoveryBlocks = buildYouTubeMaintenanceRecoveryBlocks(activeRecovery, Date.now());
  const pendingLinks = await restAll(
    rest,
    "meme_media?select=source_id&review_state=eq.pending",
  ).catch(() => {
    throw new Error("youtube_source_read_failed");
  });
  const pendingIds = new Set(pendingLinks.map((row) => row.source_id));
  const sources = await restAll(
    rest,
    "media_sources?select=id,platform,external_id,canonical_url&platform=in.(youtube,youtube_shorts)&embeddable=is.null&removed_at=is.null",
  ).catch(() => {
    throw new Error("youtube_source_read_failed");
  });
  const result = await runVerifyYouTubePending({
    sources: sources.filter((source) => pendingIds.has(source.id)),
    recoveryBlocks,
    apiKey: env.YOUTUBE_API_KEY,
    rest,
    limit,
    dryRun,
    onProgress: (completed, total) => console.error(`진행 ${completed}/${total}`),
  });
  console.log(JSON.stringify(result));
  if (result.failed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("youtube_pending_verification_failed");
    process.exitCode = 1;
  });
}
