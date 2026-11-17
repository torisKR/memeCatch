#!/usr/bin/env node
/**
 * 기존 YouTube/Shorts 출처 일괄 상태 재확인.
 *
 * 사용: node scripts/refresh-youtube-sources.mjs [--limit=500] [--dry-run]
 * 필요 환경변수: YOUTUBE_API_KEY (+ DATABASE_URL)
 */
import { pathToFileURL } from "node:url";

import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";
import { isYouTubeRegionBlocked } from "../lib/sources/youtube-region.mjs";
import {
  applyYouTubePrivateMetadataPolicy,
  classifyYouTubeRefreshAvailability,
  validateYouTubeVideoBatchExternalIds,
  validateYouTubeVideosListResponse,
  validateYouTubeVideoStatusItems,
} from "../lib/sources/youtube-response.mjs";

const DISPLAY_PLATFORM = { youtube: "YouTube", youtube_shorts: "YouTube Shorts" };
const BATCH_SIZE = 50;
const METADATA_TTL_MS = 30 * 86_400_000;
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function parseDuration(value) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function validExternalId(value) {
  return typeof value === "string" && YOUTUBE_VIDEO_ID_PATTERN.test(value);
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
 *   sources: Array<{ id: string, platform: string, external_id: unknown }>,
 *   apiKey: string,
 *   fetchImpl?: typeof fetch,
 *   rest: Function,
 *   dryRun?: boolean,
 *   limit?: number,
 *   now?: string,
 *   onProgress?: (completed: number, total: number) => void,
 * }} options
 */
export async function runRefreshYouTubeSources({
  sources,
  apiKey,
  fetchImpl = fetch,
  rest,
  dryRun = false,
  limit = 2000,
  now = new Date().toISOString(),
  onProgress = () => {},
}) {
  const expires = new Date(Date.parse(now) + METADATA_TTL_MS).toISOString();
  const stats = {
    checked: 0,
    removed: 0,
    hidden: 0,
    failed: 0,
    apiCalls: 0,
    errors: [],
  };
  const targets = sources.slice(0, limit);
  const validTargets = [];

  for (const source of targets) {
    if (!validExternalId(source.external_id)) {
      stats.checked += 1;
      stats.failed += 1;
      stats.errors.push(`youtube_source_external_id_inconclusive:${source.id}`);
      continue;
    }
    validTargets.push(source);
  }

  const syncAvailability = async (source, availability) => {
    if (dryRun) return;
    await safeRest(
      rest,
      `meme_contents?platform=eq.${encodeURIComponent(DISPLAY_PLATFORM[source.platform])}&content_id=eq.${source.external_id}&type=eq.embed`,
      { method: "PATCH", body: JSON.stringify({ availability }) },
    );
  };

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
        await syncAvailability(source, "dead");
        continue;
      }

      const isPublic = video.status.privacyStatus === "public";
      const isPrivate = video.status.privacyStatus === "private";
      const embeddable = isPublic && video.status.embeddable;
      const blockedKr = isYouTubeRegionBlocked(video.contentDetails?.regionRestriction);
      const availability = classifyYouTubeRefreshAvailability(video.status, blockedKr);
      const thumbnails = video.snippet?.thumbnails ?? {};

      if (!dryRun) {
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

      if (isPrivate) {
        stats.removed += 1;
      } else if (!isPublic || (!blockedKr && !embeddable)) {
        stats.hidden += 1;
      }
      await syncAvailability(source, availability);
    }
    onProgress(Math.min(index + BATCH_SIZE, validTargets.length), validTargets.length);
  }

  return { dryRun, ...stats };
}

function parseArgs(args) {
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  return {
    limit: Math.max(50, Number(limitArg?.slice(8) ?? 2000)),
    dryRun: args.includes("--dry-run"),
  };
}

async function main(args = process.argv.slice(2)) {
  const { limit, dryRun } = parseArgs(args);
  const env = loadEnv();
  if (!env.YOUTUBE_API_KEY) throw new Error("youtube_api_key_missing");
  const rest = createRestClient(env);
  const sources = await restAll(
    rest,
    "media_sources?select=id,platform,external_id,canonical_url&platform=in.(youtube,youtube_shorts)&removed_at=is.null&order=last_checked_at.asc.nullsfirst",
  ).catch(() => {
    throw new Error("youtube_source_read_failed");
  });
  const result = await runRefreshYouTubeSources({
    sources,
    apiKey: env.YOUTUBE_API_KEY,
    rest,
    limit,
    dryRun,
    onProgress: (completed, total) => console.error(`진행 ${completed}/${total}`),
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("youtube_source_refresh_failed");
    process.exitCode = 1;
  });
}
