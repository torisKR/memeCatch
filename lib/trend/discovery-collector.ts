const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const GENERIC_DISCOVERY_TERMS = new Set([
  "challenge",
  "fyp",
  "meme",
  "memes",
  "reels",
  "shorts",
  "viral",
  "드립",
  "릴스",
  "밈",
  "반전",
  "쇼츠",
  "웃긴영상",
  "유행어",
  "챌린지",
  "패러디",
]);

export type DiscoveryLane = "new_discovery" | "candidate_tracking";

export type YouTubeDiscoverySeed = {
  id: string;
  query: string;
  channelId?: string;
  publishedAfter?: string;
};

export type YouTubeSourcePolicy = {
  key: string;
  enabled: boolean;
  derivedAnalysisAllowed?: boolean;
  collectableFields: readonly string[];
  approvalBasis: string;
  verifiedAt: string;
  retentionDays: number;
};

export type YouTubeDiscoveryLanePlan = {
  callBudget: number;
  seeds: readonly YouTubeDiscoverySeed[];
};

export type ReserveYouTubeCall = (request: {
  lane: DiscoveryLane;
  method: "search.list" | "videos.list";
  seedId: string;
  page: number;
  callCount: 1;
}) => boolean | Promise<boolean>;

export type MissingMetricReason =
  | "not_returned_by_provider"
  | "video_unavailable_or_private"
  | "videos_list_failed"
  | "budget_exhausted";

export type RawYouTubeMetric = {
  value: string | null;
  missingReason: MissingMetricReason | null;
};

export type YouTubeDiscoveryRecord = {
  provider: "youtube";
  sourcePolicyKey: string;
  sourcePolicyVerifiedAt: string;
  lane: DiscoveryLane;
  seedId: string;
  querySeed: string;
  platformContentId: string;
  canonicalUrl: string;
  creatorKey: string | null;
  title: string | null;
  description: string | null;
  channelId: string | null;
  sourcePublishedAt: string | null;
  firstDiscoveredAt: string;
  measuredAt: string;
  metadataExpiresAt: string;
  durationSeconds: number | null;
  privacyStatus: "public" | "private" | "unlisted" | null;
  embeddable: boolean | null;
  verificationStatus:
    | "verified"
    | "video_unavailable_or_private"
    | "videos_list_failed"
    | "videos_list_not_run";
  rawMetrics: {
    viewCount: RawYouTubeMetric;
    likeCount: RawYouTubeMetric;
    commentCount: RawYouTubeMetric;
  };
  rightsMode: "api_metadata";
};

export type ObservedCandidateTerm = {
  normalizedPhrase: string;
  displayName: string;
  source: "hashtag" | "quoted_phrase";
  platformContentIds: string[];
};

export type YouTubeDiscoveryFailure = {
  lane: DiscoveryLane;
  seedId: string;
  method: "search.list" | "videos.list";
  page: number;
  reason: "http_error" | "network_error" | "timeout" | "invalid_response";
  httpStatus: number | null;
};

export type YouTubeDiscoveryResult = {
  status: "completed" | "partial" | "disabled";
  disabledReason: "missing_api_key" | "source_policy_disabled" | null;
  records: YouTubeDiscoveryRecord[];
  candidateTerms: ObservedCandidateTerm[];
  failures: YouTubeDiscoveryFailure[];
  callsUsed: Record<DiscoveryLane, number>;
  budgetExhausted: Record<DiscoveryLane, boolean>;
};

type FetchLike = typeof fetch;

export type CollectYouTubeDiscoveryInput = {
  apiKey?: string | null;
  sourcePolicy: YouTubeSourcePolicy;
  lanes: Record<DiscoveryLane, YouTubeDiscoveryLanePlan>;
  reserveCall: ReserveYouTubeCall;
  fetch?: FetchLike;
  now?: () => Date;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxPagesPerSeed?: number;
  maxResultsPerPage?: number;
  maxTitleChars?: number;
  maxDescriptionChars?: number;
  knownPhrases?: readonly string[];
  minimumCandidateOccurrences?: number;
};

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    publishedAt?: string;
  };
};

type SearchResponse = {
  nextPageToken?: string;
  items?: SearchItem[];
};

type VideoItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    publishedAt?: string;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  status?: {
    privacyStatus?: "public" | "private" | "unlisted";
    embeddable?: boolean;
  };
};

type VideosResponse = { items?: VideoItem[] };

type SearchHit = {
  videoId: string;
  lane: DiscoveryLane;
  seed: YouTubeDiscoverySeed;
  discoveredAt: string;
  searchSnippet: SearchItem["snippet"];
};

type RequestFailure = Error & {
  failureReason?: YouTubeDiscoveryFailure["reason"];
  httpStatus?: number;
};

type CollectableField =
  | "title"
  | "description"
  | "channel_id"
  | "published_at"
  | "duration"
  | "statistics.view_count"
  | "statistics.like_count"
  | "statistics.comment_count"
  | "status.privacy_status"
  | "status.embeddable";

function clampInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value!)));
}

function truncate(value: string | undefined, limit: number): string | null {
  if (value === undefined || value.length === 0) return null;
  return value.slice(0, limit);
}

function normalizePhrase(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko")
    .replace(/^#+/u, "")
    .replace(/[^\p{L}\p{N}_\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function parseDurationSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/u);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function metric(value: string | undefined, missingReason: MissingMetricReason): RawYouTubeMetric {
  return value !== undefined && /^\d+$/u.test(value)
    ? { value, missingReason: null }
    : { value: null, missingReason };
}

function failureMetric(reason: MissingMetricReason): RawYouTubeMetric {
  return { value: null, missingReason: reason };
}

function createFailure(error: unknown): RequestFailure {
  if (error instanceof Error) return error as RequestFailure;
  return new Error("unknown YouTube request failure") as RequestFailure;
}

function responseItems<T>(value: unknown): T[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value as T[];
  const error = new Error("invalid YouTube API response") as RequestFailure;
  error.failureReason = "invalid_response";
  throw error;
}

function requestSignal(input: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return input ? AbortSignal.any([input, timeout]) : timeout;
}

async function requestJson<T>(
  request: FetchLike,
  url: URL,
  inputSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  try {
    const response = await request(url, {
      cache: "no-store",
      signal: requestSignal(inputSignal, timeoutMs),
    });
    if (!response.ok) {
      const error = new Error(`YouTube API HTTP ${response.status}`) as RequestFailure;
      error.failureReason = "http_error";
      error.httpStatus = response.status;
      throw error;
    }
    try {
      return await response.json() as T;
    } catch {
      const error = new Error("invalid YouTube API response") as RequestFailure;
      error.failureReason = "invalid_response";
      throw error;
    }
  } catch (caught) {
    const error = createFailure(caught);
    if (!error.failureReason) {
      error.failureReason = error.name === "AbortError" || error.name === "TimeoutError"
        ? "timeout"
        : "network_error";
    }
    throw error;
  }
}

function failureFrom(error: unknown, input: Omit<YouTubeDiscoveryFailure, "reason" | "httpStatus">): YouTubeDiscoveryFailure {
  const typed = createFailure(error);
  return {
    ...input,
    reason: typed.failureReason ?? "network_error",
    httpStatus: typed.httpStatus ?? null,
  };
}

function fieldAllowed(policy: YouTubeSourcePolicy, field: CollectableField): boolean {
  return policy.collectableFields.includes(field);
}

function makeSearchUrl(input: {
  key: string;
  seed: YouTubeDiscoverySeed;
  pageToken?: string;
  maxResults: number;
}): URL {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("q", input.seed.query.trim());
  url.searchParams.set("maxResults", String(input.maxResults));
  url.searchParams.set("regionCode", "KR");
  url.searchParams.set("relevanceLanguage", "ko");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("key", input.key);
  if (input.seed.channelId?.trim()) url.searchParams.set("channelId", input.seed.channelId.trim());
  if (input.seed.publishedAfter?.trim()) url.searchParams.set("publishedAfter", input.seed.publishedAfter.trim());
  if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
  return url;
}

function makeVideosUrl(key: string, videoIds: readonly string[], policy: YouTubeSourcePolicy): URL {
  const parts = ["snippet", "contentDetails", "status"];
  if (["statistics.view_count", "statistics.like_count", "statistics.comment_count"]
    .some((field) => fieldAllowed(policy, field as CollectableField))) {
    parts.push("statistics");
  }
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("part", parts.join(","));
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", key);
  return url;
}

function fallbackRecord(
  hit: SearchHit,
  measuredAt: string,
  status: "video_unavailable_or_private" | "videos_list_failed" | "videos_list_not_run",
  policy: YouTubeSourcePolicy,
  titleLimit: number,
  descriptionLimit: number,
): YouTubeDiscoveryRecord {
  const missingReason = status === "videos_list_not_run" ? "budget_exhausted" : status;
  const metadataExpiresAt = retentionExpiry(measuredAt, policy.retentionDays);
  return {
    provider: "youtube",
    sourcePolicyKey: policy.key,
    sourcePolicyVerifiedAt: policy.verifiedAt,
    lane: hit.lane,
    seedId: hit.seed.id,
    querySeed: hit.seed.query,
    platformContentId: hit.videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${hit.videoId}`,
    creatorKey: fieldAllowed(policy, "channel_id") && hit.searchSnippet?.channelId
      ? `youtube:${hit.searchSnippet.channelId}`
      : null,
    title: fieldAllowed(policy, "title") ? truncate(hit.searchSnippet?.title, titleLimit) : null,
    description: fieldAllowed(policy, "description")
      ? truncate(hit.searchSnippet?.description, descriptionLimit)
      : null,
    channelId: fieldAllowed(policy, "channel_id") ? hit.searchSnippet?.channelId ?? null : null,
    sourcePublishedAt: fieldAllowed(policy, "published_at")
      ? hit.searchSnippet?.publishedAt ?? null
      : null,
    firstDiscoveredAt: hit.discoveredAt,
    measuredAt,
    metadataExpiresAt,
    durationSeconds: null,
    privacyStatus: null,
    embeddable: null,
    verificationStatus: status,
    rawMetrics: {
      viewCount: failureMetric(missingReason),
      likeCount: failureMetric(missingReason),
      commentCount: failureMetric(missingReason),
    },
    rightsMode: "api_metadata",
  };
}

function verifiedRecord(
  hit: SearchHit,
  item: VideoItem,
  measuredAt: string,
  policy: YouTubeSourcePolicy,
  titleLimit: number,
  descriptionLimit: number,
): YouTubeDiscoveryRecord {
  const snippet = item.snippet ?? hit.searchSnippet;
  const statisticsAllowed = {
    viewCount: fieldAllowed(policy, "statistics.view_count"),
    likeCount: fieldAllowed(policy, "statistics.like_count"),
    commentCount: fieldAllowed(policy, "statistics.comment_count"),
  };
  return {
    provider: "youtube",
    sourcePolicyKey: policy.key,
    sourcePolicyVerifiedAt: policy.verifiedAt,
    lane: hit.lane,
    seedId: hit.seed.id,
    querySeed: hit.seed.query,
    platformContentId: hit.videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${hit.videoId}`,
    creatorKey: fieldAllowed(policy, "channel_id") && snippet?.channelId
      ? `youtube:${snippet.channelId}`
      : null,
    title: fieldAllowed(policy, "title") ? truncate(snippet?.title, titleLimit) : null,
    description: fieldAllowed(policy, "description") ? truncate(snippet?.description, descriptionLimit) : null,
    channelId: fieldAllowed(policy, "channel_id") ? snippet?.channelId ?? null : null,
    sourcePublishedAt: fieldAllowed(policy, "published_at") ? snippet?.publishedAt ?? null : null,
    firstDiscoveredAt: hit.discoveredAt,
    measuredAt,
    metadataExpiresAt: retentionExpiry(measuredAt, policy.retentionDays),
    durationSeconds: fieldAllowed(policy, "duration")
      ? parseDurationSeconds(item.contentDetails?.duration)
      : null,
    privacyStatus: fieldAllowed(policy, "status.privacy_status")
      ? item.status?.privacyStatus ?? null
      : null,
    embeddable: fieldAllowed(policy, "status.embeddable")
      ? item.status?.embeddable ?? null
      : null,
    verificationStatus: "verified",
    rawMetrics: {
      viewCount: statisticsAllowed.viewCount
        ? metric(item.statistics?.viewCount, "not_returned_by_provider")
        : failureMetric("not_returned_by_provider"),
      likeCount: statisticsAllowed.likeCount
        ? metric(item.statistics?.likeCount, "not_returned_by_provider")
        : failureMetric("not_returned_by_provider"),
      commentCount: statisticsAllowed.commentCount
        ? metric(item.statistics?.commentCount, "not_returned_by_provider")
        : failureMetric("not_returned_by_provider"),
    },
    rightsMode: "api_metadata",
  };
}

function retentionExpiry(measuredAt: string, configuredDays: number): string {
  const retentionDays = Number.isFinite(configuredDays)
    ? Math.min(30, Math.max(1, Math.floor(configuredDays)))
    : 30;
  return new Date(Date.parse(measuredAt) + retentionDays * 86_400_000).toISOString();
}

function extractTerms(
  records: readonly YouTubeDiscoveryRecord[],
  knownPhrases: readonly string[],
  minimumOccurrences: number,
): ObservedCandidateTerm[] {
  const known = new Set(knownPhrases.map(normalizePhrase).filter(Boolean));
  const grouped = new Map<string, { displayName: string; source: ObservedCandidateTerm["source"]; ids: Set<string> }>();
  const hashtagPattern = /(^|\s)#([\p{L}\p{N}_]{2,40})/gu;
  const quotePatterns = [/[“"]([^”"]{2,40})[”"]/gu, /[‘']([^’']{2,40})[’']/gu];

  for (const record of records) {
    const text = [record.title, record.description].filter(Boolean).join(" ");
    const queryTerms = new Set([
      normalizePhrase(record.querySeed),
      ...record.querySeed.split(/\s+/u).map(normalizePhrase),
    ].filter(Boolean));
    const observed: Array<{ displayName: string; source: ObservedCandidateTerm["source"] }> = [];
    for (const match of text.matchAll(hashtagPattern)) {
      observed.push({ displayName: match[2], source: "hashtag" });
    }
    for (const pattern of quotePatterns) {
      for (const match of text.matchAll(pattern)) {
        observed.push({ displayName: match[1].trim(), source: "quoted_phrase" });
      }
    }
    for (const term of observed) {
      const normalizedPhrase = normalizePhrase(term.displayName);
      if (
        !normalizedPhrase ||
        known.has(normalizedPhrase) ||
        GENERIC_DISCOVERY_TERMS.has(normalizedPhrase) ||
        queryTerms.has(normalizedPhrase)
      ) continue;
      const key = `${term.source}:${normalizedPhrase}`;
      const current = grouped.get(key) ?? {
        displayName: term.displayName,
        source: term.source,
        ids: new Set<string>(),
      };
      current.ids.add(record.platformContentId);
      grouped.set(key, current);
    }
  }

  return [...grouped.entries()]
    .flatMap(([key, value]) => value.ids.size >= minimumOccurrences ? [{
      normalizedPhrase: key.slice(key.indexOf(":") + 1),
      displayName: value.displayName,
      source: value.source,
      platformContentIds: [...value.ids].sort(),
    }] : [])
    .sort((left, right) =>
      right.platformContentIds.length - left.platformContentIds.length ||
      left.normalizedPhrase.localeCompare(right.normalizedPhrase, "ko"),
    );
}

export async function collectYouTubeDiscovery(
  input: CollectYouTubeDiscoveryInput,
): Promise<YouTubeDiscoveryResult> {
  const callsUsed: Record<DiscoveryLane, number> = { new_discovery: 0, candidate_tracking: 0 };
  const budgetExhausted: Record<DiscoveryLane, boolean> = { new_discovery: false, candidate_tracking: false };
  const disabled = (reason: YouTubeDiscoveryResult["disabledReason"]): YouTubeDiscoveryResult => ({
    status: "disabled",
    disabledReason: reason,
    records: [],
    candidateTerms: [],
    failures: [],
    callsUsed,
    budgetExhausted,
  });
  const key = input.apiKey?.trim();
  if (!key) return disabled("missing_api_key");
  if (!input.sourcePolicy.enabled) return disabled("source_policy_disabled");

  const request = input.fetch ?? fetch;
  const now = input.now ?? (() => new Date());
  const derivedAnalysisAllowed = input.sourcePolicy.derivedAnalysisAllowed === true;
  const timeoutMs = clampInteger(input.timeoutMs, 10_000, 500, 30_000);
  const configuredMaxPages = clampInteger(input.maxPagesPerSeed, 2, 1, 5);
  const configuredMaxResults = clampInteger(input.maxResultsPerPage, 25, 1, 50);
  const maxPagesPerSeed = derivedAnalysisAllowed ? configuredMaxPages : 1;
  const maxResultsPerPage = derivedAnalysisAllowed
    ? configuredMaxResults
    : Math.min(25, configuredMaxResults);
  const titleLimit = clampInteger(input.maxTitleChars, 300, 40, 500);
  const descriptionLimit = clampInteger(input.maxDescriptionChars, 2_000, 100, 5_000);
  const minimumCandidateOccurrences = clampInteger(input.minimumCandidateOccurrences, 2, 2, 20);
  const failures: YouTubeDiscoveryFailure[] = [];
  const records: YouTubeDiscoveryRecord[] = [];

  const reserve = async (
    lane: DiscoveryLane,
    method: "search.list" | "videos.list",
    seedId: string,
    page: number,
  ): Promise<boolean> => {
    const configuredBudget = input.lanes[lane].callBudget;
    const budget = Number.isFinite(configuredBudget)
      ? Math.max(0, Math.floor(configuredBudget))
      : 0;
    if (callsUsed[lane] >= budget) {
      budgetExhausted[lane] = true;
      return false;
    }
    const accepted = await input.reserveCall({ lane, method, seedId, page, callCount: 1 });
    if (!accepted) {
      budgetExhausted[lane] = true;
      return false;
    }
    callsUsed[lane] += 1;
    return true;
  };

  for (const lane of ["new_discovery", "candidate_tracking"] as const) {
    for (const seed of input.lanes[lane].seeds) {
      if (!seed.id.trim() || (!seed.query.trim() && !seed.channelId?.trim())) continue;
      let pageToken: string | undefined;
      for (let page = 1; page <= maxPagesPerSeed; page += 1) {
        if (!await reserve(lane, "search.list", seed.id, page)) break;
        let search: SearchResponse;
        const discoveredAt = now().toISOString();
        try {
          search = await requestJson<SearchResponse>(
            request,
            makeSearchUrl({ key, seed, pageToken, maxResults: maxResultsPerPage }),
            input.signal,
            timeoutMs,
          );
        } catch (error) {
          failures.push(failureFrom(error, { lane, seedId: seed.id, method: "search.list", page }));
          break;
        }
        let searchItems: SearchItem[];
        try {
          searchItems = responseItems<SearchItem>(search.items);
        } catch (error) {
          failures.push(failureFrom(error, { lane, seedId: seed.id, method: "search.list", page }));
          break;
        }
        const hits = [...new Map(searchItems.flatMap((item) => {
          const videoId = item.id?.videoId?.trim();
          return videoId ? [[videoId, {
            videoId,
            lane,
            seed,
            discoveredAt,
            searchSnippet: item.snippet,
          } satisfies SearchHit] as const] : [];
        })).values()];

        for (let offset = 0; offset < hits.length; offset += 50) {
          const batch = hits.slice(offset, offset + 50);
          if (!await reserve(lane, "videos.list", seed.id, page)) {
            const measuredAt = now().toISOString();
            records.push(...batch.map((hit) => fallbackRecord(
              hit, measuredAt, "videos_list_not_run", input.sourcePolicy, titleLimit, descriptionLimit,
            )));
            continue;
          }
          try {
            const videos = await requestJson<VideosResponse>(
              request,
              makeVideosUrl(key, batch.map((hit) => hit.videoId), input.sourcePolicy),
              input.signal,
              timeoutMs,
            );
            const measuredAt = now().toISOString();
            const byId = new Map(responseItems<VideoItem>(videos.items).flatMap((item) =>
              item.id ? [[item.id, item] as const] : [],
            ));
            records.push(...batch.map((hit) => {
              const item = byId.get(hit.videoId);
              return item
                ? verifiedRecord(hit, item, measuredAt, input.sourcePolicy, titleLimit, descriptionLimit)
                : fallbackRecord(
                  hit,
                  measuredAt,
                  "video_unavailable_or_private",
                  input.sourcePolicy,
                  titleLimit,
                  descriptionLimit,
                );
            }));
          } catch (error) {
            failures.push(failureFrom(error, { lane, seedId: seed.id, method: "videos.list", page }));
            const measuredAt = now().toISOString();
            records.push(...batch.map((hit) => fallbackRecord(
              hit, measuredAt, "videos_list_failed", input.sourcePolicy, titleLimit, descriptionLimit,
            )));
          }
        }
        pageToken = search.nextPageToken;
        if (!pageToken) break;
      }
    }
  }

  const uniqueRecords = [...new Map(records.map((record) => [
    `${record.lane}:${record.seedId}:${record.platformContentId}`,
    record,
  ])).values()];
  const partial = failures.length > 0 || budgetExhausted.new_discovery || budgetExhausted.candidate_tracking;
  return {
    status: partial ? "partial" : "completed",
    disabledReason: null,
    records: uniqueRecords,
    candidateTerms: derivedAnalysisAllowed
      ? extractTerms(uniqueRecords, input.knownPhrases ?? [], minimumCandidateOccurrences)
      : [],
    failures,
    callsUsed,
    budgetExhausted,
  };
}

