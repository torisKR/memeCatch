#!/usr/bin/env node
/**
 * 검수 대기 YouTube/Shorts 출처 중 API 미검증(embeddable IS NULL)분을
 * videos.list 배치로 검증한다.
 * - 공개+임베드 가능 → 메타데이터 채우고 embeddable=true
 * - 명시적 비공개/임베드 불가 → embeddable=false
 * - 응답에서 요청 ID가 누락되거나 상태가 불완전함 → pending을 유지하고 uncertain 집계
 *
 * 기본 실행은 DB에서 대상 수만 읽는 계획 모드이며 외부 API 호출과 DB 쓰기를 하지 않는다.
 * 실행: node scripts/verify-youtube-pending.mjs --execute --limit=50 [--dry-run]
 * --dry-run은 DB 쓰기만 막으며, --execute와 함께 쓰면 YouTube API 호출은 수행한다.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRestClient, restAll as defaultRestAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const BATCH_SIZE = 50;
const MAX_EXECUTION_LIMIT = 50;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const KNOWN_UNAVAILABLE_PRIVACY = new Set(["private", "unlisted"]);

export function parseMaxLimit(value, fallback, maximum = MAX_EXECUTION_LIMIT) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || Math.floor(parsed) < 1) {
    throw new Error("--limit must be a positive finite number");
  }
  if (Math.floor(parsed) > maximum) {
    throw new Error(`--limit must be at most ${maximum}`);
  }
  return Math.floor(parsed);
}

export function parseArgs(argv) {
  let execute = false;
  let dryRun = false;
  let limit = MAX_EXECUTION_LIMIT;
  let hasLimit = false;
  const seen = new Set();
  for (const arg of argv) {
    const key = arg.startsWith("--limit=") ? "--limit" : arg;
    if (!["--execute", "--dry-run", "--limit"].includes(key) || seen.has(key)) {
      throw new Error(`Unknown or repeated argument: ${arg}`);
    }
    seen.add(key);
    if (key === "--execute") execute = true;
    if (key === "--dry-run") dryRun = true;
    if (key === "--limit") {
      hasLimit = true;
      limit = parseMaxLimit(arg.slice("--limit=".length), MAX_EXECUTION_LIMIT);
    }
  }
  if (execute && !hasLimit) {
    throw new Error("--execute requires an explicit --limit=N budget");
  }
  if (dryRun && !execute) {
    throw new Error("--dry-run requires --execute --limit=N because it still calls YouTube");
  }
  return { execute, dryRun, limit };
}

function parseDuration(value) {
  const m = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function validSource(source) {
  if (!(
    typeof source?.id === "string" &&
    source.id.trim().length > 0 &&
    typeof source?.external_id === "string" &&
    YOUTUBE_VIDEO_ID.test(source.external_id)
  )) return false;
  if (source.canonical_url == null) return true;
  const normalized = normalizeSourceUrl(source.canonical_url);
  return normalized?.externalId === source.external_id;
}

async function readPendingInventory({ rest, restAll, limit }) {
  const pendingLinks = await restAll(rest, "meme_media?select=source_id&review_state=eq.pending");
  const pendingIds = new Set(pendingLinks.map((row) => row.source_id));
  const candidateSources = (
    await restAll(
      rest,
      "media_sources?select=id,platform,external_id,canonical_url&platform=in.(youtube,youtube_shorts)&embeddable=is.null&removed_at=is.null"
    )
  ).filter((source) => pendingIds.has(source.id));
  const selected = candidateSources.slice(0, limit);
  const targets = selected.filter(validSource);
  return { pendingLinks, candidateSources, selected, targets };
}

export async function planYoutubePendingVerification({
  rest,
  restAll = defaultRestAll,
  limit = MAX_EXECUTION_LIMIT,
}) {
  const max = parseMaxLimit(limit, MAX_EXECUTION_LIMIT);
  const { pendingLinks, candidateSources, selected, targets } = await readPendingInventory({
    rest,
    restAll,
    limit: max,
  });
  return {
    mode: "plan",
    totalPending: pendingLinks.length,
    candidates: candidateSources.length,
    selected: selected.length,
    eligible: targets.length,
    invalid: selected.length - targets.length,
    externalApiCalls: 0,
    dbWrites: 0,
  };
}

function validateItems(data) {
  if (!data || !Array.isArray(data.items)) {
    throw new Error("videos.list response must contain an items array");
  }
  for (const item of data.items) {
    if (!item || typeof item.id !== "string" || !YOUTUBE_VIDEO_ID.test(item.id)) {
      throw new Error("videos.list response contains an invalid item ID");
    }
  }
  return data.items;
}

function classifyVideo(video) {
  const status = video.status;
  if (!status || typeof status !== "object") return { kind: "uncertain" };
  if (status.uploadStatus === "deleted") return { kind: "deleted" };
  if (KNOWN_UNAVAILABLE_PRIVACY.has(status.privacyStatus)) {
    return { kind: "unavailable", privacy: status.privacyStatus, embeddable: false };
  }
  if (status.privacyStatus !== "public" || typeof status.embeddable !== "boolean") {
    return { kind: "uncertain" };
  }
  if (status.embeddable === false) {
    return { kind: "unavailable", privacy: status.privacyStatus, embeddable: false };
  }
  const restriction = video.contentDetails?.regionRestriction;
  const blockedKr = Array.isArray(restriction?.blocked) && restriction.blocked.includes("KR");
  const excludedByAllowList =
    Array.isArray(restriction?.allowed) && !restriction.allowed.includes("KR");
  return {
    kind: blockedKr || excludedByAllowList ? "region_blocked" : "verified",
    privacy: status.privacyStatus,
    embeddable: blockedKr || excludedByAllowList ? false : true,
  };
}

function metadataPatch(video, classification, now, expires) {
  const thumbnails = video.snippet?.thumbnails ?? {};
  return {
    title: video.snippet?.title ?? null,
    channel_name: video.snippet?.channelTitle ?? null,
    channel_id: video.snippet?.channelId ?? null,
    platform_published_at: video.snippet?.publishedAt ?? null,
    duration_seconds: parseDuration(video.contentDetails?.duration),
    public_status: classification.privacy ?? "unknown",
    embeddable: classification.embeddable,
    license_code: video.status?.license ?? null,
    made_for_kids: video.status?.madeForKids ?? null,
    thumbnail_url:
      thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    metadata_refreshed_at: now,
    metadata_expires_at: expires,
    last_checked_at: now,
  };
}

export async function verifyYoutubePending({
  apiKey,
  rest,
  restAll = defaultRestAll,
  fetch: fetchImpl = globalThis.fetch,
  limit = MAX_EXECUTION_LIMIT,
  dryRun = false,
  now = new Date(),
  logger = console.error,
}) {
  if (!apiKey) throw new Error("YOUTUBE_API_KEY missing");
  const max = parseMaxLimit(limit, MAX_EXECUTION_LIMIT);
  const { candidateSources, selected, targets } = await readPendingInventory({
    rest,
    restAll,
    limit: max,
  });
  const stats = {
    checked: 0,
    verified: 0,
    unembeddable: 0,
    regionBlocked: 0,
    removed: 0,
    uncertain: 0,
    invalid: selected.length - targets.length,
    apiCalls: 0,
  };
  logger?.(`미검증 YouTube 후보 ${candidateSources.length}건 중 ${targets.length}건 검사 (유효하지 않은 ID ${stats.invalid})`);

  const checkedAt = now instanceof Date ? now : new Date(now);
  const nowIso = checkedAt.toISOString();
  const expires = new Date(checkedAt.getTime() + 30 * 86_400_000).toISOString();

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.search = new URLSearchParams({
      part: "snippet,status,contentDetails",
      id: batch.map((source) => source.external_id).join(","),
      key: apiKey,
    }).toString();
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`videos.list HTTP ${response.status}`);
    const items = validateItems(await response.json());
    stats.apiCalls += 1;
    const requestedIds = new Set(batch.map((source) => source.external_id));
    const byId = new Map(items.filter((item) => requestedIds.has(item.id)).map((item) => [item.id, item]));

    for (const source of batch) {
      const video = byId.get(source.external_id);
      stats.checked += 1;
      if (!video) {
        stats.uncertain += 1;
        continue;
      }
      const classification = classifyVideo(video);
      if (classification.kind === "uncertain") {
        stats.uncertain += 1;
        continue;
      }
      if (classification.kind === "deleted") {
        stats.removed += 1;
        if (!dryRun) {
          await rest(`media_sources?id=eq.${encodeURIComponent(source.id)}`, {
            method: "PATCH",
            body: JSON.stringify({
              removed_at: nowIso,
              last_checked_at: nowIso,
              title: null,
              thumbnail_url: null,
              metadata_expires_at: null,
              public_status: "unknown",
              embeddable: false,
            }),
          });
        }
        continue;
      }
      if (classification.kind === "verified") stats.verified += 1;
      else if (classification.kind === "region_blocked") stats.regionBlocked += 1;
      else stats.unembeddable += 1;
      if (!dryRun) {
        await rest(`media_sources?id=eq.${encodeURIComponent(source.id)}`, {
          method: "PATCH",
          body: JSON.stringify(metadataPatch(video, classification, nowIso, expires)),
        });
      }
    }
    logger?.(`진행 ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`);
  }

  return stats;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const env = loadEnv();
  const rest = createRestClient(env);
  if (!options.execute) {
    const plan = await planYoutubePendingVerification({ rest, limit: options.limit });
    console.log(JSON.stringify(plan));
    return plan;
  }
  if (!env.YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY missing");
  const stats = await verifyYoutubePending({
    apiKey: env.YOUTUBE_API_KEY,
    rest,
    limit: options.limit,
    dryRun: options.dryRun,
  });
  const result = { mode: options.dryRun ? "execute-dry-run" : "execute", ...stats };
  console.log(JSON.stringify(result));
  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "YouTube pending verification failed");
    process.exitCode = 1;
  });
}
