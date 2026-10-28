import "server-only";

/**
 * YouTube Data API v3 클라이언트.
 *
 * 정책 가드레일:
 * - 영상·음원·자막·썸네일 파일은 절대 다운로드하지 않는다(메타데이터만).
 * - 조회수·좋아요는 요청하지 않는다 — 파생 지표 생성이 정책상 제한된다.
 * - 공개 데이터는 30일 안에 갱신하거나 삭제해야 한다(metadata_expires_at 참조).
 * - search.list는 별도 일일 Search Queries 버킷에서 요청당 1회이며 발견에만 쓰고,
 *   상태 재확인은 videos.list(호출당 1 단위, 최대 50 ID)만 사용한다.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";
const BATCH_SIZE = 50;

export type YouTubeVideoStatus = {
  id: string;
  title: string | null;
  channelId: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  privacyStatus: "public" | "private" | "unlisted" | null;
  uploadStatus: "deleted" | "failed" | "processed" | "rejected" | "uploaded" | null;
  license: string | null;
  embeddable: boolean | null;
  madeForKids: boolean | null;
  regionBlocked: string[] | null;
  regionAllowed: string[] | null;
};

type YouTubeVideosApiResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
    contentDetails?: {
      duration?: string;
      regionRestriction?: { blocked?: string[]; allowed?: string[] };
    };
    status?: {
      privacyStatus?: "public" | "private" | "unlisted";
      uploadStatus?: "deleted" | "failed" | "processed" | "rejected" | "uploaded";
      license?: string;
      embeddable?: boolean;
      madeForKids?: boolean;
    };
  }>;
};

type YouTubeSearchApiResponse = {
  items?: Array<{ id?: { videoId?: string } }>;
};

/** ISO 8601 기간(PT1H2M3S) → 초. */
export function parseIso8601Duration(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY가 설정되지 않았습니다.");
  }
  return key;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`YouTube API HTTP ${response.status}`);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new Error("youtube_api_response_invalid");
  }
}

function videoItems(
  data: YouTubeVideosApiResponse,
  requestedIds: readonly string[],
): NonNullable<YouTubeVideosApiResponse["items"]> {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error("youtube_videos_response_invalid");
  }
  const requested = new Set(requestedIds);
  const seen = new Set<string>();
  for (const item of data.items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id ||
      !requested.has(item.id) ||
      seen.has(item.id)
    ) {
      throw new Error("youtube_videos_response_invalid");
    }
    seen.add(item.id);
  }
  return data.items;
}

function knownValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function mapVideo(item: NonNullable<YouTubeVideosApiResponse["items"]>[number]) {
  if (!item.id) return null;
  const thumbnails = item.snippet?.thumbnails ?? {};
  const thumbnailUrl =
    thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
  return {
    id: item.id,
    title: item.snippet?.title ?? null,
    channelId: item.snippet?.channelId ?? null,
    channelTitle: item.snippet?.channelTitle ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    thumbnailUrl,
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration),
    privacyStatus: knownValue(
      item.status?.privacyStatus,
      ["public", "private", "unlisted"] as const,
    ),
    uploadStatus: knownValue(
      item.status?.uploadStatus,
      ["deleted", "failed", "processed", "rejected", "uploaded"] as const,
    ),
    license: item.status?.license ?? null,
    embeddable: booleanValue(item.status?.embeddable),
    madeForKids: booleanValue(item.status?.madeForKids),
    regionBlocked: stringArray(item.contentDetails?.regionRestriction?.blocked),
    regionAllowed: stringArray(item.contentDetails?.regionRestriction?.allowed),
  } satisfies YouTubeVideoStatus;
}

/**
 * videos.list 일괄 상태 확인. 50개씩 배치한다.
 * 반환 Map에 없는 ID는 공개 API만으로 원인을 확정할 수 없으므로 호출자가
 * 삭제·비공개로 단정하지 않고 검수 대기 상태로 다뤄야 한다.
 */
export async function fetchYouTubeVideoStatuses(
  ids: string[],
): Promise<Map<string, YouTubeVideoStatus>> {
  const key = apiKey();
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const result = new Map<string, YouTubeVideoStatus>();

  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams({
      part: "snippet,status,contentDetails",
      id: batch.join(","),
      key,
    });
    const response = await fetch(`${API_BASE}/videos?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const data = await readJson<YouTubeVideosApiResponse>(response);
    for (const item of videoItems(data, batch)) {
      const mapped = mapVideo(item);
      if (mapped) result.set(mapped.id, mapped);
    }
  }
  return result;
}

/**
 * search.list — 발견 전용. 반환된 ID는 반드시 fetchYouTubeVideoStatuses로
 * 공개·임베드 가능 여부를 다시 확인한 뒤 후보 큐에 넣어야 한다.
 */
export async function searchYouTubeVideoIds(
  query: string,
  maxResults = 10,
): Promise<string[]> {
  const key = apiKey();
  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: String(Math.max(1, Math.min(50, maxResults))),
    regionCode: "KR",
    relevanceLanguage: "ko",
    videoEmbeddable: "true",
    safeSearch: "moderate",
    key,
  });
  const response = await fetch(`${API_BASE}/search?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data = await readJson<YouTubeSearchApiResponse>(response);
  return (data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
}

/** 후보 승격 조건: 공개 + 임베드 허용. */
export function isPublishableCandidate(video: YouTubeVideoStatus): boolean {
  return video.privacyStatus === "public" && video.embeddable === true;
}
