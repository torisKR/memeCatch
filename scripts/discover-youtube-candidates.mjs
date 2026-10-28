#!/usr/bin/env node
/**
 * 검수된 영상이 없는 비(非)용어형 밈을 찾아 YouTube 후보를 검수 큐에 적재한다.
 *
 * 이 작업은 운영자 명시 실행 전용이다. 공개·임베드 가능·한국 재생 가능 상태를
 * YouTube 원시 메타데이터로 확인한 뒤에도 `pending` + `rights_basis=unknown`으로만
 * 적재하며, 점수 계산·플랫폼 결합·자동 공개는 수행하지 않는다.
 *
 * YouTube 공식 할당량 문서(2026-10-08 확인): search 요청은 별도 일 100회
 * 버킷에서 요청당 1회, videos.list는 표준 할당량 1단위를 사용한다. 이 스크립트는
 * 실행당 검색 대상을 최대 20개로 제한하고 실제 요청 횟수를 결과에 출력한다.
 *
 * 특정 밈·운영 채널 계획:
 * node scripts/discover-youtube-candidates.mjs --plan-only --max=1 \
 *   --meme-id=<uuid> --channel-id=<UC...>
 * 실제 API 호출은 특정 밈 UUID, --execute --max=1, --channel-id를 모두
 * 명시한 단일 운영 채널 canary에서만 수행한다.
 * 전체 카탈로그의 읽기 전용 분류 보고서는 `--audit-only`로 실행하며,
 * 두 페이지네이션 GET 사이의 변경은 막지 않는 best-effort snapshot이다.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMemeContentEnv } from "./meme-content-env.mjs";
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PENDING_BACKLOG_WINDOW_MS = 7 * 86_400_000;
export const MAX_DISCOVERY_MEMES = 20;
export const DISCOVERY_AUDIT_BUCKETS = [
  "published_media",
  "projection_repair_or_reviewed_source",
  "missing_source_or_replacement",
  "classification_review",
  "recent_pending_backlog",
  "excluded/nonvisual",
];
export const USABLE_RIGHTS_BASES = new Set([
  "official_embed",
  "creator_permission",
  "creative_commons",
  "public_data",
]);

const PUBLIC_MEME_STATUSES = new Set(["approved", "limited"]);
const VIDEO_MEDIA_TYPES = new Set(["video", "embed"]);
const CLASSIFICATION_REVIEW_CATEGORIES = new Set(["challenge", "dance", "song"]);
const YOUTUBE_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/u;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const MEME_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function pairKey(memeId, platform, externalId) {
  return `${memeId}\u0000${platform}\u0000${externalId}`;
}

function sourceRecord(link) {
  const source = link.media_sources;
  return source && !Array.isArray(source) ? source : null;
}

export function isEligibleVideoMeme(meme, editorVideoClassified = false) {
  if (!meme || !PUBLIC_MEME_STATUSES.has(meme.moderation_status)) return false;
  if (typeof meme.category !== "string" || typeof meme.media_type !== "string") return false;
  if (meme.category === "phrase") return false;
  return VIDEO_MEDIA_TYPES.has(meme.media_type) || editorVideoClassified === true;
}

export function isUsablePublishedContent(content) {
  return (
    content?.production_id == null &&
    VIDEO_MEDIA_TYPES.has(content?.type) &&
    content?.moderation_status === "approved" &&
    content?.availability === "live"
  );
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
  const age = now.getTime() - createdAt;
  return Number.isFinite(createdAt) && age >= 0 && age < PENDING_BACKLOG_WINDOW_MS;
}

function normalizedPlatform(value) {
  const platform = String(value ?? "").toLowerCase();
  if (platform.includes("youtube shorts") || platform === "youtube_shorts") return "youtube_shorts";
  if (platform.includes("youtube")) return "youtube";
  if (platform.includes("instagram") || platform.includes("인스타")) return "instagram";
  if (platform.includes("tiktok") || platform.includes("틱톡")) return "tiktok";
  return null;
}

function isValidPlatformId(platform, externalId) {
  if (typeof externalId !== "string") return false;
  if (platform === "youtube" || platform === "youtube_shorts") return YOUTUBE_VIDEO_ID.test(externalId);
  if (platform === "tiktok") return /^\d{10,25}$/u.test(externalId);
  if (platform === "instagram") return /^[A-Za-z0-9_-]{5,80}$/u.test(externalId);
  return false;
}

function identity(platform, externalId) {
  if (!isValidPlatformId(platform, externalId)) return null;
  return `${platform === "youtube_shorts" ? "youtube" : platform}:${externalId}`;
}

function normalizedIdentity(value) {
  const normalized = normalizeSourceUrl(value);
  return normalized ? identity(normalized.platform, normalized.externalId) : null;
}

function contentIdentityState(content) {
  const urlIdentity = normalizedIdentity(content?.url);
  const declaredPlatform = normalizedPlatform(content?.platform)
    ?? normalizeSourceUrl(content?.url)?.platform
    ?? null;
  const hasPlaybackId = typeof content?.content_id === "string" && content.content_id.length > 0;
  const playbackIdentity = hasPlaybackId && declaredPlatform
    ? identity(declaredPlatform, content.content_id)
    : null;
  const invalidPlaybackIdentity = hasPlaybackId && declaredPlatform !== null && playbackIdentity === null;
  const inconsistent = invalidPlaybackIdentity || Boolean(
    playbackIdentity && urlIdentity && playbackIdentity !== urlIdentity,
  );
  return {
    primary: playbackIdentity ?? urlIdentity,
    identities: [...new Set([playbackIdentity, urlIdentity].filter(Boolean))],
    inconsistent,
  };
}

function sourceIdentity(source) {
  const platform = normalizedPlatform(source?.platform);
  if (!platform) return null;
  if (source?.external_id != null) return identity(platform, source.external_id);
  const parsed = normalizeSourceUrl(source?.canonical_url);
  if (!parsed) return null;
  const declaredIdentity = identity(platform, parsed.externalId);
  const parsedIdentity = identity(parsed.platform, parsed.externalId);
  return declaredIdentity === parsedIdentity ? declaredIdentity : null;
}

function hasStrictSourceIdentity(source) {
  const platform = normalizedPlatform(source?.platform);
  if (!platform || !isValidPlatformId(platform, source?.external_id)) return false;
  const id = source.external_id;
  if (platform === "youtube") return source.canonical_url === `https://www.youtube.com/watch?v=${id}`;
  if (platform === "youtube_shorts") return source.canonical_url === `https://www.youtube.com/shorts/${id}`;
  if (platform === "tiktok") {
    return new RegExp(`^https://www\\.tiktok\\.com/@[^/?#]+/video/${id}$`, "u").test(source.canonical_url ?? "");
  }
  return new RegExp(`^https://www\\.instagram\\.com/(p|reel|tv)/${id}/$`, "u").test(source.canonical_url ?? "");
}

function isExplicitlyUnavailableSource(source) {
  return (
    source?.removed_at != null ||
    source?.embeddable === false ||
    source?.public_status === "private" ||
    source?.public_status === "unlisted"
  );
}

function isFreshReviewedSource(source, now) {
  const refreshedAt = Date.parse(source?.metadata_refreshed_at ?? "");
  const checkedAt = Date.parse(source?.last_checked_at ?? "");
  const expiresAt = Date.parse(source?.metadata_expires_at ?? "");
  const nowMs = now.getTime();
  const futureTolerance = 5 * 60_000;
  const freshnessWindow = 30 * 86_400_000;
  return (
    Number.isFinite(refreshedAt) &&
    Number.isFinite(checkedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt > nowMs &&
    refreshedAt >= nowMs - freshnessWindow &&
    refreshedAt <= nowMs + futureTolerance &&
    checkedAt >= nowMs - freshnessWindow &&
    checkedAt <= nowMs + futureTolerance &&
    expiresAt <= refreshedAt + freshnessWindow + futureTolerance
  );
}

function isAuditRepairReadyReviewedSource(link, now) {
  const source = sourceRecord(link);
  return isUsableReviewedSource(link) && hasStrictSourceIdentity(source) && isFreshReviewedSource(source, now);
}

function projectedPlatform(source) {
  switch (normalizedPlatform(source?.platform)) {
    case "youtube": return "YouTube";
    case "youtube_shorts": return "YouTube Shorts";
    case "tiktok": return "TikTok";
    case "instagram": return "Instagram";
    default: return null;
  }
}

function matchingProjectionContents(meme, source) {
  return (meme?.meme_contents ?? []).filter((content) => (
    content?.content_id === source?.external_id || content?.url === source?.canonical_url
  ));
}

function projectionConflictReasons(contents, source) {
  if (contents.length === 0) return [];
  const reasons = new Set();
  const expectedPlatform = projectedPlatform(source);
  if (contents.length > 1) reasons.add("stored_content_duplicate_collision");
  for (const content of contents) {
    if (content?.production_id != null) reasons.add("stored_content_production_linked");
    if (content?.type !== "embed") reasons.add("stored_content_type_inconsistent");
    if (content?.platform !== expectedPlatform) reasons.add("stored_content_platform_inconsistent");
    if (content?.content_id !== source?.external_id) reasons.add("stored_content_identity_inconsistent");
    if (content?.url !== source?.canonical_url) reasons.add("stored_content_url_inconsistent");
    if (content?.availability !== "live") {
      if (["dead", "region_blocked", "unchecked"].includes(content?.availability)) {
        reasons.add(`stored_content_${content.availability}`);
      } else {
        reasons.add("stored_content_availability_inconsistent");
      }
    }
    if (content?.moderation_status !== "approved") {
      if (["pending", "rejected"].includes(content?.moderation_status)) {
        reasons.add(`stored_content_${content.moderation_status}`);
      } else {
        reasons.add("stored_content_moderation_inconsistent");
      }
    }
  }
  return reasons.size > 0
    ? ["existing_publication_requires_revalidation", ...reasons]
    : [];
}

function auditProjectionState(meme, memeLinks, now) {
  const repairReadyLinks = memeLinks.filter((link) => isAuditRepairReadyReviewedSource(link, now));
  const repairCandidates = [];
  const conflicts = [];
  for (const link of repairReadyLinks) {
    const source = sourceRecord(link);
    const matchingContents = matchingProjectionContents(meme, source);
    if (matchingContents.length === 0) repairCandidates.push(link);
    else conflicts.push(...projectionConflictReasons(matchingContents, source));
  }
  return {
    repairCandidate: repairCandidates.length > 0,
    conflictReasons: [...new Set(conflicts)],
  };
}

function reviewedSourceNeedsRevalidation(link, now) {
  const source = sourceRecord(link);
  return (
    link?.review_state === "approved" &&
    USABLE_RIGHTS_BASES.has(link?.rights_basis) &&
    source != null &&
    !isExplicitlyUnavailableSource(source) &&
    !isAuditRepairReadyReviewedSource(link, now)
  );
}

function hasUsablePublishedContent(meme, memeLinks) {
  return (meme.meme_contents ?? []).some((content) => {
    if (!isUsablePublishedContent(content)) return false;
    const contentState = contentIdentityState(content);
    if (contentState.inconsistent) return false;
    if (!contentState.primary) return true;
    const hasExplicitUnavailableMatch = memeLinks.some((link) => {
      const source = sourceRecord(link);
      return contentState.identities.includes(sourceIdentity(source)) && isExplicitlyUnavailableSource(source);
    });
    return !hasExplicitUnavailableMatch;
  });
}

function unavailablePublishedReasons(meme, memeLinks) {
  const reasons = new Set();
  for (const content of meme.meme_contents ?? []) {
    if (!isUsablePublishedContent(content)) continue;
    const contentState = contentIdentityState(content);
    if (contentState.inconsistent) reasons.add("published_content_identity_inconsistent");
    if (contentState.identities.length === 0) continue;
    for (const link of memeLinks) {
      const source = sourceRecord(link);
      if (!contentState.identities.includes(sourceIdentity(source)) || !isExplicitlyUnavailableSource(source)) continue;
      if (source.removed_at != null) reasons.add("confirmed_bad_source_removed");
      if (source.public_status === "private") reasons.add("confirmed_bad_source_private");
      if (source.public_status === "unlisted") reasons.add("confirmed_bad_source_unlisted");
      if (source.embeddable === false) reasons.add("confirmed_bad_source_unembeddable");
    }
  }
  return [...reasons];
}

function linkedUnavailableReasons(memeLinks) {
  const reasons = new Set();
  for (const link of memeLinks) {
    const source = sourceRecord(link);
    if (!source) continue;
    if (source.removed_at != null) reasons.add("linked_source_removed");
    if (source.public_status === "private") reasons.add("linked_source_private");
    if (source.public_status === "unlisted") reasons.add("linked_source_unlisted");
    if (source.embeddable === false) reasons.add("linked_source_unembeddable");
  }
  return [...reasons];
}

function auditRow(meme, reasons) {
  return {
    id: typeof meme?.id === "string" ? meme.id : null,
    title: typeof meme?.title === "string" ? meme.title : null,
    category: typeof meme?.category === "string" ? meme.category : null,
    media_type: typeof meme?.media_type === "string" ? meme.media_type : null,
    reasons: [...new Set(reasons)],
  };
}

/**
 * Produces an uncapped, sanitized catalog report. Buckets are mutually exclusive;
 * classification warnings remain attached to published rows so existing playback
 * is not mistaken for missing media.
 */
export function classifyDiscoveryAudit(memes, links, now = new Date(), memeId = null) {
  if (memeId && !MEME_ID.test(memeId)) throw new Error("invalid --meme-id UUID");
  const buckets = Object.fromEntries(DISCOVERY_AUDIT_BUCKETS.map((bucket) => [bucket, []]));
  const linksByMeme = new Map();
  for (const link of Array.isArray(links) ? links : []) {
    if (typeof link?.meme_id !== "string") continue;
    const current = linksByMeme.get(link.meme_id) ?? [];
    current.push(link);
    linksByMeme.set(link.meme_id, current);
  }

  const uniqueMemes = [];
  const memesById = new Map();
  for (const meme of Array.isArray(memes) ? memes : []) {
    if (typeof meme?.id !== "string") {
      uniqueMemes.push(meme);
      continue;
    }
    const existing = memesById.get(meme.id);
    if (!existing) {
      const copy = { ...meme, meme_contents: [...(meme.meme_contents ?? [])] };
      memesById.set(meme.id, copy);
      uniqueMemes.push(copy);
      continue;
    }
    existing.meme_contents.push(...(meme.meme_contents ?? []));
  }

  for (const meme of uniqueMemes) {
    if (memeId && meme?.id !== memeId) continue;

    const memeLinks = linksByMeme.get(meme?.id) ?? [];
    const classificationMismatch = (
      CLASSIFICATION_REVIEW_CATEGORIES.has(meme?.category) &&
      !VIDEO_MEDIA_TYPES.has(meme?.media_type)
    );
    const suppressedReasons = unavailablePublishedReasons(meme ?? {}, memeLinks);
    const linkedReasons = linkedUnavailableReasons(memeLinks);
    const needsRevalidation = memeLinks.some((link) => reviewedSourceNeedsRevalidation(link, now));
    const projectionState = auditProjectionState(meme ?? {}, memeLinks, now);
    const published = hasUsablePublishedContent(meme ?? {}, memeLinks);

    if (meme?.category === "phrase") {
      buckets["excluded/nonvisual"].push(auditRow(meme, ["phrase_excluded"]));
      continue;
    }
    if (!PUBLIC_MEME_STATUSES.has(meme?.moderation_status)) {
      buckets["excluded/nonvisual"].push(auditRow(meme, ["not_approved_or_limited"]));
      continue;
    }
    if (typeof meme?.category !== "string" || typeof meme?.media_type !== "string") {
      buckets["excluded/nonvisual"].push(auditRow(meme, ["invalid_or_missing_catalog_classification"]));
      continue;
    }
    if (published) {
      buckets.published_media.push(auditRow(meme, [
        "usable_published_media",
        ...(classificationMismatch ? ["classification_review_required"] : []),
        ...suppressedReasons,
        ...linkedReasons,
      ]));
      continue;
    }
    if (classificationMismatch) {
      buckets.classification_review.push(auditRow(meme, [
        "video_semantic_category_with_nonvideo_media_type",
        ...suppressedReasons,
        ...linkedReasons,
        ...(projectionState.repairCandidate
          ? ["usable_reviewed_source_without_published_media"] : []),
        ...projectionState.conflictReasons,
        ...(needsRevalidation ? ["reviewed_source_needs_revalidation"] : []),
      ]));
      continue;
    }
    if (!VIDEO_MEDIA_TYPES.has(meme?.media_type)) {
      buckets["excluded/nonvisual"].push(auditRow(meme, ["nonvideo_or_unclassified"]));
      continue;
    }
    if (projectionState.repairCandidate) {
      buckets.projection_repair_or_reviewed_source.push(auditRow(meme, [
        "usable_reviewed_source_without_published_media",
        ...suppressedReasons,
        ...linkedReasons,
      ]));
      continue;
    }
    if (projectionState.conflictReasons.length > 0) {
      buckets.missing_source_or_replacement.push(auditRow(meme, [
        ...projectionState.conflictReasons,
        ...suppressedReasons,
        ...linkedReasons,
      ]));
      continue;
    }
    if (needsRevalidation) {
      buckets.missing_source_or_replacement.push(auditRow(meme, [
        "reviewed_source_needs_revalidation",
        ...suppressedReasons,
        ...linkedReasons,
        ...(memeLinks.some((link) => hasRecentPendingBacklog(link, now)) ? ["recent_pending_backlog"] : []),
      ]));
      continue;
    }
    if (memeLinks.some((link) => hasRecentPendingBacklog(link, now))) {
      buckets.recent_pending_backlog.push(auditRow(meme, [
        "recent_pending_backlog",
        ...suppressedReasons,
        ...linkedReasons,
      ]));
      continue;
    }
    buckets.missing_source_or_replacement.push(auditRow(meme, [
      ...(suppressedReasons.length > 0 || linkedReasons.length > 0
        ? suppressedReasons
        : [memeLinks.length === 0 ? "source_missing" : "source_state_unknown_or_not_usable"]),
      ...linkedReasons,
      ...(memeLinks.some((link) => link?.review_state === "pending") ? ["pending_backlog_stale_or_invalid"] : []),
    ]));
  }

  return {
    auditOnly: true,
    memeId,
    counts: Object.fromEntries(DISCOVERY_AUDIT_BUCKETS.map((bucket) => [bucket, buckets[bucket].length])),
    buckets,
  };
}

/** Catalog order is retained and the cap is applied after duplicate joins collapse. */
export function selectDiscoveryMemes(
  memes,
  links,
  now,
  max,
  memeId = null,
  editorVideoClassified = false,
) {
  if (!Number.isInteger(max) || max <= 0) return [];
  const boundedMax = Math.min(max, MAX_DISCOVERY_MEMES);
  const linksByMeme = new Map();
  for (const link of links) {
    const current = linksByMeme.get(link.meme_id) ?? [];
    current.push(link);
    linksByMeme.set(link.meme_id, current);
  }

  const selected = [];
  for (const meme of memes) {
    if (memeId && meme.id !== memeId) continue;
    if (!isEligibleVideoMeme(meme, editorVideoClassified)) continue;
    const memeLinks = linksByMeme.get(meme.id) ?? [];
    if (hasUsablePublishedContent(meme, memeLinks)) continue;
    if (memeLinks.some(isUsableReviewedSource)) continue;
    if (memeLinks.some((link) => hasRecentPendingBacklog(link, now))) continue;
    selected.push(meme);
    if (selected.length >= boundedMax) break;
  }
  return selected;
}

function parseDuration(value) {
  const match = value?.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u);
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
  if (!response.ok) throw new Error(`YouTube ${path} HTTP ${response.status}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`YouTube ${path} returned invalid JSON`);
  }
}

export function validateYouTubeChannelId(value) {
  if (!YOUTUBE_CHANNEL_ID.test(value ?? "")) throw new Error("invalid YouTube channel ID");
  return value;
}

function isAvailableInKr(video) {
  const restriction = video.contentDetails?.regionRestriction;
  if (restriction?.blocked?.includes("KR")) return false;
  if (Array.isArray(restriction?.allowed) && !restriction.allowed.includes("KR")) return false;
  return true;
}

export function validateYouTubeVideos(videos, { channelId = null } = {}) {
  if (!Array.isArray(videos)) throw new Error("YouTube videos response items must be an array");
  return videos.filter((video) => (
    YOUTUBE_VIDEO_ID.test(video?.id ?? "") &&
    typeof video?.snippet?.title === "string" && video.snippet.title.length > 0 &&
    typeof video?.snippet?.channelTitle === "string" && video.snippet.channelTitle.length > 0 &&
    typeof video?.snippet?.channelId === "string" &&
    typeof video?.snippet?.publishedAt === "string" && Number.isFinite(Date.parse(video.snippet.publishedAt)) &&
    parseDuration(video?.contentDetails?.duration) !== null &&
    video?.status?.privacyStatus === "public" &&
    video?.status?.embeddable === true &&
    (!channelId || video.snippet.channelId === channelId) &&
    isAvailableInKr(video)
  ));
}

function responseItems(body, endpoint) {
  if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
    throw new Error(`YouTube ${endpoint} response items must be an array`);
  }
  return body.items;
}

export function createYouTubeSearcher({ apiKey, channelId = null, request = youtubeRequest }) {
  if (!apiKey) throw new Error("YOUTUBE_API_KEY missing");
  if (channelId) validateYouTubeChannelId(channelId);
  const usage = { searchRequests: 0, videosRequests: 0, apiRequests: 0 };

  return {
    usage,
    async search(meme) {
      usage.searchRequests += 1;
      usage.apiRequests += 1;
      const search = await request(apiKey, "search", {
        part: "snippet",
        q: `"${meme.title}" 원본`,
        type: "video",
        maxResults: "5",
        regionCode: "KR",
        relevanceLanguage: "ko",
        videoEmbeddable: "true",
        safeSearch: "moderate",
        ...(channelId ? { channelId } : {}),
      });
      const ids = [...new Set(responseItems(search, "search")
        .map((item) => item?.id?.videoId)
        .filter((id) => YOUTUBE_VIDEO_ID.test(id ?? "")))];
      if (ids.length === 0) return [];

      usage.videosRequests += 1;
      usage.apiRequests += 1;
      const videos = await request(apiKey, "videos", {
        part: "snippet,status,contentDetails",
        id: ids.join(","),
      });
      const requested = new Set(ids);
      return validateYouTubeVideos(responseItems(videos, "videos"), { channelId })
        .filter((video) => requested.has(video.id));
    },
  };
}

function numericArg(args, prefix, fallback) {
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${prefix.slice(2, -1)} must be a non-negative integer`);
  return value;
}

export function parseDiscoveryArgs(args, env = process.env) {
  void env;
  const allowedFlags = new Set([
    "--audit-only",
    "--execute",
    "--plan-only",
    "--dry-run",
    "--editor-video-classified",
  ]);
  const allowedPrefixes = ["--max=", "--delay=", "--channel-id=", "--meme-id="];
  const seen = new Set();
  for (const arg of args) {
    const key = allowedPrefixes.find((prefix) => arg.startsWith(prefix)) ?? arg;
    if ((!allowedFlags.has(key) && !allowedPrefixes.includes(key)) || seen.has(key)) {
      throw new Error(`unknown or repeated argument: ${arg}`);
    }
    seen.add(key);
  }
  const execute = args.includes("--execute");
  const auditOnly = args.includes("--audit-only");
  const explicitMax = args.some((arg) => arg.startsWith("--max="));
  const explicitPlanOnly = args.includes("--plan-only");
  const dryRun = args.includes("--dry-run");
  if (auditOnly) {
    const incompatible = args.find((arg) => (
      arg !== "--audit-only" && !arg.startsWith("--meme-id=")
    ));
    if (incompatible) throw new Error(`--audit-only cannot be combined with ${incompatible}`);
  }
  if (execute && explicitPlanOnly) throw new Error("--execute and --plan-only are mutually exclusive");
  if (execute && !explicitMax) throw new Error("--execute requires an explicit --max=N budget");
  if (dryRun && !execute) throw new Error("--dry-run still calls YouTube and requires --execute --max=N");
  const channelArg = args.find((arg) => arg.startsWith("--channel-id="));
  const channelValue = channelArg?.slice("--channel-id=".length) || null;
  if (execute && !channelValue) throw new Error("--execute requires explicit --channel-id");
  const memeArg = args.find((arg) => arg.startsWith("--meme-id="));
  const memeId = memeArg?.slice("--meme-id=".length) || null;
  if (memeId && !MEME_ID.test(memeId)) throw new Error("invalid --meme-id UUID");
  const editorVideoClassified = args.includes("--editor-video-classified");
  if (editorVideoClassified && !memeId) {
    throw new Error("--editor-video-classified requires explicit --meme-id");
  }
  const max = Math.min(MAX_DISCOVERY_MEMES, numericArg(args, "--max=", MAX_DISCOVERY_MEMES));
  if (execute && max !== 1) throw new Error("canary execution requires --max=1");
  if (execute && !memeId) throw new Error("canary execution requires explicit --meme-id");
  return {
    max: auditOnly ? null : max,
    delayMs: auditOnly ? null : Math.max(200, numericArg(args, "--delay=", 400)),
    dryRun,
    planOnly: !execute && !auditOnly,
    execute,
    auditOnly,
    channelId: channelValue ? validateYouTubeChannelId(channelValue) : null,
    memeId,
    editorVideoClassified,
  };
}

export function buildDiscoveryQueries(memeId = null, { auditOnly = false } = {}) {
  if (memeId && !MEME_ID.test(memeId)) throw new Error("invalid --meme-id UUID");
  const encodedId = memeId ? encodeURIComponent(memeId) : null;
  return {
    links: `meme_media?select=meme_id,source_id,review_state,rights_basis,created_at,media_sources(platform,external_id,canonical_url,embeddable,public_status,removed_at,metadata_refreshed_at,metadata_expires_at,last_checked_at)${encodedId ? `&meme_id=eq.${encodedId}` : ""}${auditOnly ? "&order=meme_id.asc,source_id.asc" : ""}`,
    memes: `memes?select=id,title,slug,aliases,origin_year,korea_viral_year,category,media_type,moderation_status,meme_contents(type,platform,availability,moderation_status,production_id,content_id,url)&moderation_status=in.(approved,limited)${encodedId ? `&id=eq.${encodedId}` : ""}&order=${auditOnly ? "trend_score.desc,id.asc" : "trend_score.desc"}`,
  };
}

export async function runDiscoveryAudit({
  rest,
  memeId = null,
  now = new Date(),
  readAll = restAll,
}) {
  const queries = buildDiscoveryQueries(memeId, { auditOnly: true });
  const linked = await readAll(rest, queries.links);
  const memes = await readAll(rest, queries.memes);
  return {
    ...classifyDiscoveryAudit(memes, linked, now, memeId),
    snapshotConsistency: "best_effort_nontransactional_two_query_snapshot",
  };
}

export async function loadDiscoveryEnv({
  root = PROJECT_ROOT,
  loader = loadMemeContentEnv,
} = {}) {
  return loader({ root });
}

export function assertYouTubeRawOnlyPolicy(policies) {
  const policy = policies.find((row) => row?.policy_key === "youtube" && row?.platform === "youtube");
  if (!policy) throw new Error("YouTube source policy is missing");
  if (policy.enabled !== true) throw new Error("YouTube source policy is not enabled");
  if (policy.derived_analysis_allowed !== false || policy.cross_platform_combination_allowed !== false) {
    throw new Error("YouTube source policy is not raw-only");
  }
  if (!Number.isFinite(Date.parse(policy.verified_at ?? ""))) throw new Error("YouTube source policy is not verified");
  return policy;
}

export async function runDiscovery({
  rest,
  memes,
  links,
  searchYouTube,
  now = new Date(),
  max = MAX_DISCOVERY_MEMES,
  delayMs = 400,
  dryRun = false,
  planOnly = false,
  channelId = null,
  memeId = null,
  editorVideoClassified = false,
  wait = sleep,
}) {
  const selected = selectDiscoveryMemes(
    memes,
    links,
    now,
    max,
    memeId,
    editorVideoClassified,
  );
  const existingPairs = new Set(
    links.flatMap((link) => {
      const source = sourceRecord(link);
      return source?.platform && source.external_id
        ? [pairKey(link.meme_id, source.platform, source.external_id)]
        : [];
    }),
  );
  const stats = {
    planned: selected.length,
    searched: 0,
    apiRequests: 0,
    candidates: 0,
    linked: 0,
    wouldLink: 0,
    skippedExisting: 0,
    rejectedMetadata: 0,
    replacementAbsent: 0,
    zeroResults: 0,
    errors: 0,
  };
  const boundedMax = Math.min(Math.max(max, 0), MAX_DISCOVERY_MEMES);
  const budget = {
    maxMemes: boundedMax,
    maxSearchRequests: boundedMax,
    maxVideosRequests: boundedMax,
    maxApiRequests: boundedMax * 2,
  };
  if (planOnly) return { selected, stats, errors: [], budget };

  const errors = [];
  const expires = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  for (const [index, meme] of selected.entries()) {
    try {
      stats.searched += 1;
      stats.apiRequests += 1;
      const rawVideos = await searchYouTube(meme);
      const videos = validateYouTubeVideos(rawVideos, { channelId });
      stats.rejectedMetadata += rawVideos.length - videos.length;
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
          stats.wouldLink += 1;
          continue;
        }

        const thumbnails = video.snippet.thumbnails ?? {};
        const sourceRows = await rest("media_sources?on_conflict=canonical_url", {
          method: "POST",
          headers: { Prefer: "return=representation,resolution=merge-duplicates" },
          body: JSON.stringify({
            platform: normalized.platform,
            external_id: normalized.externalId,
            canonical_url: normalized.canonicalUrl,
            title: video.snippet.title,
            channel_name: video.snippet.channelTitle,
            channel_id: video.snippet.channelId,
            platform_published_at: video.snippet.publishedAt,
            duration_seconds: parseDuration(video.contentDetails.duration),
            public_status: "public",
            embeddable: true,
            license_code: video.status.license ?? null,
            made_for_kids: video.status.madeForKids ?? null,
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
      if (videos.length > 0 && stats.linked === linkedBefore && !dryRun) stats.replacementAbsent += 1;
    } catch (error) {
      stats.errors += 1;
      errors.push({ title: meme.title, message: error instanceof Error ? error.message : String(error) });
    }
    if (index < selected.length - 1) await wait(delayMs);
  }
  return { selected, stats, errors, budget };
}

async function main() {
  const options = parseDiscoveryArgs(process.argv.slice(2));
  const env = await loadDiscoveryEnv();
  const rest = createRestClient(env);
  if (options.auditOnly) {
    const report = await runDiscoveryAudit({ rest, memeId: options.memeId });
    console.log(JSON.stringify(report));
    return;
  }
  const queries = buildDiscoveryQueries(options.memeId);
  const policies = await restAll(rest, "radar_source_policies?select=policy_key,platform,enabled,derived_analysis_allowed,cross_platform_combination_allowed,verified_at&policy_key=eq.youtube");
  assertYouTubeRawOnlyPolicy(policies);
  const linked = await restAll(rest, queries.links);
  const memes = await restAll(rest, queries.memes);

  if (options.planOnly) {
    const result = await runDiscovery({ rest, memes, links: linked, searchYouTube: null, ...options });
    console.log(JSON.stringify({
      planOnly: true,
      channelId: options.channelId,
      memeId: options.memeId,
      editorVideoClassified: options.editorVideoClassified,
      ...result.stats,
      budget: result.budget,
    }));
    return;
  }

  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY 누락 (.env.local 또는 환경변수)");
  const searcher = createYouTubeSearcher({ apiKey, channelId: options.channelId });
  const result = await runDiscovery({
    rest,
    memes,
    links: linked,
    searchYouTube: searcher.search,
    ...options,
  });
  result.stats.apiRequests = searcher.usage.apiRequests;
  if (result.errors.length) console.error(JSON.stringify(result.errors));
  console.log(JSON.stringify({
    dryRun: options.dryRun,
    channelId: options.channelId,
    ...result.stats,
    apiUsage: searcher.usage,
    budget: result.budget,
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(`file://${process.argv[1]}`)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
