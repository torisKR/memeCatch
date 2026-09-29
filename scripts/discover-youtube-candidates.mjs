#!/usr/bin/env node
/**
 * YouTube Data API 후보 발견 → 출처 검수 큐 적재.
 *
 * Discovery is deliberately separate from factual and rights review. Only an
 * approved, explicitly public, embeddable, non-removed source with an accepted
 * rights basis satisfies supply. Recent pending candidates suppress repeat
 * searches for a bounded window; rejected/removed/unusable rows remain eligible
 * for recovery.
 */
import { fileURLToPath } from "node:url";
import { createRestClient, restAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

export const PENDING_BACKLOG_WINDOW_MS = 7 * 86_400_000;
export const USABLE_RIGHTS_BASES = new Set([
  "official_embed",
  "creator_permission",
  "creative_commons",
  "public_data",
]);

function pairKey(memeId, platform, externalId) {
  return `${memeId}\u0000${platform}\u0000${externalId}`;
}

function sourceRecord(link) {
  const source = link.media_sources;
  return source && !Array.isArray(source) ? source : null;
}

export function isUsableReviewedSource(link) {
  const source = sourceRecord(link);
  return (
    link.review_state === "approved" &&
    USABLE_RIGHTS_BASES.has(link.rights_basis) &&
    source?.public_status === "public" &&
    source?.embeddable === true &&
    source.removed_at === null
  );
}

export function hasRecentPendingBacklog(link, now) {
  if (link.review_state !== "pending" || typeof link.created_at !== "string") return false;
  const createdAt = Date.parse(link.created_at);
  return Number.isFinite(createdAt) && now.getTime() - createdAt < PENDING_BACKLOG_WINDOW_MS;
}

/**
 * Selects discovery work without conflating reviewed supply and review queue.
 * Rows are already returned in the catalog's trend order; this function keeps
 * that order and applies max after duplicate joins are collapsed.
 */
export function selectDiscoveryMemes(memes, links, now, max) {
  const linksByMeme = new Map();
  for (const link of links) {
    const current = linksByMeme.get(link.meme_id) ?? [];
    current.push(link);
    linksByMeme.set(link.meme_id, current);
  }

  const selected = [];
  for (const meme of memes) {
    const memeLinks = linksByMeme.get(meme.id) ?? [];
    if (memeLinks.some((link) => isUsableReviewedSource(link))) continue;
    if (memeLinks.some((link) => hasRecentPendingBacklog(link, now))) continue;
    selected.push(meme);
    if (selected.length >= max) break;
  }
  return selected;
}

function parseDuration(value) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function youtubeRequest(apiKey, path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.search = new URLSearchParams({ ...params, key: apiKey }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`YouTube ${path} HTTP ${response.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function parseArgs(args) {
  const maxArg = args.find((arg) => arg.startsWith("--max="));
  const delayArg = args.find((arg) => arg.startsWith("--delay="));
  return {
    max: Math.max(1, Math.min(100, Number(maxArg?.slice(6) ?? 20))),
    delayMs: Math.max(200, Number(delayArg?.slice(8) ?? 400)),
    dryRun: args.includes("--dry-run"),
  };
}

export async function runDiscovery({
  rest,
  memes,
  links,
  searchYouTube,
  now = new Date(),
  max = 20,
  delayMs = 400,
  dryRun = false,
  wait = sleep,
}) {
  const selected = selectDiscoveryMemes(memes, links, now, max);
  const existingPairs = new Set(
    links.flatMap((link) => {
      const source = sourceRecord(link);
      return source?.platform && source.external_id
        ? [pairKey(link.meme_id, source.platform, source.external_id)]
        : [];
    }),
  );
  const stats = {
    searched: 0,
    candidates: 0,
    linked: 0,
    skippedExisting: 0,
    replacementAbsent: 0,
    zeroResults: 0,
    errors: 0,
  };
  const errors = [];
  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  for (const [index, meme] of selected.entries()) {
    try {
      stats.searched += 1;
      const videos = await searchYouTube(meme);
      if (videos.length === 0) stats.zeroResults += 1;
      const linkedBefore = stats.linked;
      for (const video of videos) {
        const normalized = normalizeSourceUrl(`https://www.youtube.com/watch?v=${video.id}`);
        if (!normalized) continue;
        stats.candidates += 1;
        const candidateKey = pairKey(meme.id, normalized.platform, normalized.externalId);
        if (existingPairs.has(candidateKey)) {
          stats.skippedExisting += 1;
          continue;
        }
        if (dryRun) {
          console.log(`[dry-run] ${meme.title} ← ${video.snippet?.title ?? ""}`);
          continue;
        }

        const thumbnails = video.snippet?.thumbnails ?? {};
        const sourceRows = await rest("media_sources?on_conflict=canonical_url", {
          method: "POST",
          headers: { Prefer: "return=representation,resolution=merge-duplicates" },
          body: JSON.stringify({
            platform: normalized.platform,
            external_id: normalized.externalId,
            canonical_url: normalized.canonicalUrl,
            title: video.snippet?.title ?? null,
            channel_name: video.snippet?.channelTitle ?? null,
            channel_id: video.snippet?.channelId ?? null,
            platform_published_at: video.snippet?.publishedAt ?? null,
            duration_seconds: parseDuration(video.contentDetails?.duration),
            public_status: video.status?.privacyStatus ?? "unknown",
            embeddable: true,
            license_code: video.status?.license ?? null,
            made_for_kids: video.status?.madeForKids ?? null,
            thumbnail_url: thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
            metadata_refreshed_at: now.toISOString(),
            metadata_expires_at: expires,
            last_checked_at: now.toISOString(),
          }),
        });
        const source = Array.isArray(sourceRows) ? sourceRows[0] : sourceRows;
        if (!source?.id) continue;
        await rest("meme_media", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({
            meme_id: meme.id,
            source_id: source.id,
            source_role: "usage_example",
            rights_basis: "unknown",
            review_state: "pending",
          }),
        });
        existingPairs.add(candidateKey);
        stats.linked += 1;
      }
      if (videos.length > 0 && stats.linked === linkedBefore) stats.replacementAbsent += 1;
    } catch (error) {
      stats.errors += 1;
      errors.push({ title: meme.title, message: error instanceof Error ? error.message : String(error) });
    }
    if (index < selected.length - 1) await wait(delayMs);
  }
  return { selected, stats, errors };
}

async function main() {
  const { max, delayMs, dryRun } = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 누락 (.env.local 또는 환경변수)");
  const rest = createRestClient(env);
  const linked = await restAll(rest, "meme_media?select=meme_id,source_id,review_state,rights_basis,created_at,media_sources(platform,external_id,canonical_url,embeddable,removed_at)");
  const memes = await restAll(rest, "memes?select=id,title,slug,aliases,origin_year,korea_viral_year&moderation_status=in.(approved,limited)&order=trend_score.desc");
  const searchYouTube = async (meme) => {
    const search = await youtubeRequest(apiKey, "search", {
      part: "snippet", q: `"${meme.title}" 원본`, type: "video", maxResults: "5",
      regionCode: "KR", relevanceLanguage: "ko", videoEmbeddable: "true", safeSearch: "moderate",
    });
    const ids = (search.items ?? []).map((item) => item.id?.videoId).filter(Boolean);
    if (ids.length === 0) return [];
    const videos = await youtubeRequest(apiKey, "videos", { part: "snippet,status,contentDetails", id: ids.join(",") });
    return (videos.items ?? []).filter((video) => video.status?.privacyStatus === "public" && video.status?.embeddable === true);
  };
  const result = await runDiscovery({ rest, memes, links: linked, searchYouTube, max, delayMs, dryRun });
  console.error(`검색 대상 밈 ${result.selected.length}개`);
  if (result.errors.length) console.error(JSON.stringify(result.errors));
  console.log(JSON.stringify({ dryRun, ...result.stats }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(`file://${process.argv[1]}`)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
