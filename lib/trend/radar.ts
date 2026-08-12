import { createHash } from "node:crypto";

export const RADAR_EXCLUDED_AGGREGATION_PLATFORMS = [
  "youtube",
  "youtube_shorts",
] as const;

export type RadarPlatform =
  | "instagram"
  | "internal"
  | "reddit"
  | "tiktok"
  | "threads"
  | "x"
  | "youtube"
  | "youtube_shorts"
  | (string & {});

export type RadarObservation = {
  platform: RadarPlatform;
  observedAt: string;
  volume: number;
  velocity: number;
  engagement: number;
  sourceReliability: number;
};

export type RawRadarSignal = {
  platform: RadarPlatform;
  platformContentId: string;
  canonicalUrl: string;
  signalKind?: "text_mention" | "instagram_media" | "content_observation";
  querySeed?: string;
  text?: string;
  hashtags?: readonly string[];
  publishedAt?: string | number | Date;
  observedAt: string | number | Date;
  collectedAt?: string | number | Date;
  metrics?: Readonly<Record<string, number>>;
  language?: string;
  languageConfidence?: number;
  koreanRelevance?: number;
  ingestionVersion?: number;
  rightsMode?: "api_metadata" | "official_embed" | "link_only";
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
  rawExpiresAt?: string | number | Date;
};

export type NormalizedRadarSignal = Omit<
  RawRadarSignal,
  "publishedAt" | "observedAt" | "collectedAt" | "rawExpiresAt"
> & {
  normalizedTextHash: string;
  publishedAt?: string;
  observedAt: string;
  collectedAt?: string;
  rawExpiresAt?: string;
};

export type RadarEntity = {
  id: string;
  canonicalName: string;
  aliases: readonly string[];
};

export type RadarMatchMethod =
  | "canonical_exact"
  | "alias_exact"
  | "canonical_hashtag"
  | "alias_hashtag"
  | "canonical_phrase"
  | "alias_phrase";

export type RadarMatch = {
  entityId: string;
  matchMethod: RadarMatchMethod;
  confidence: number;
  matchedValue: string;
};

export type RadarSignalScore = {
  heat: number;
  confidence: number;
  observations: readonly RadarObservation[];
  aggregationObservations: readonly RadarObservation[];
  excludedObservations: readonly RadarObservation[];
  aggregatedPlatforms: readonly string[];
};

export type RadarState =
  | "candidate"
  | "rising"
  | "trending"
  | "cooling"
  | "archive";

export type RadarStateSnapshot = {
  state: RadarState;
  consecutiveHigh: number;
  consecutiveLow: number;
};

export type RadarStateThresholds = {
  risingHeat: number;
  risingConfidence: number;
  trendingHeat: number;
  trendingConfidence: number;
  coolingHeat: number;
  archiveHeat: number;
  promotionObservations: number;
  coolingObservations: number;
  archiveObservations: number;
  revivalObservations: number;
};

export const DEFAULT_RADAR_STATE_THRESHOLDS: RadarStateThresholds = {
  risingHeat: 45,
  risingConfidence: 0.45,
  trendingHeat: 70,
  trendingConfidence: 0.6,
  coolingHeat: 50,
  archiveHeat: 25,
  promotionObservations: 2,
  coolingObservations: 2,
  archiveObservations: 3,
  revivalObservations: 3,
};

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>()]+/giu;
const HASHTAG_PATTERN = /(^|\s)#([\p{L}\p{N}_]+)/gu;
const EXCLUDED_PLATFORMS = new Set<string>(
  RADAR_EXCLUDED_AGGREGATION_PLATFORMS,
);

export function isRadarAggregationPlatform(platform: string): boolean {
  return !EXCLUDED_PLATFORMS.has(platform.toLowerCase());
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeDedupeUrl(value: string): string {
  return collapseWhitespace(value.normalize("NFKC").toLowerCase());
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function normalizeRadarText(value: string): string {
  return collapseWhitespace(
    value.normalize("NFKC").replace(URL_PATTERN, " ").toLowerCase(),
  );
}

export function normalizeRadarHashtag(value: string): string {
  return normalizeRadarText(value.replace(/^#+/u, "")).replace(/\s+/gu, "");
}

export function extractRadarHashtags(value: string): string[] {
  const text = value.normalize("NFKC").replace(URL_PATTERN, " ");
  const seen = new Set<string>();
  const hashtags: string[] = [];

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const hashtag = normalizeRadarHashtag(match[2]);
    if (hashtag && !seen.has(hashtag)) {
      seen.add(hashtag);
      hashtags.push(hashtag);
    }
  }

  return hashtags;
}

export function normalizeRadarTimestamp(
  value: string | number | Date,
): string | null {
  let timestamp: number;

  if (value instanceof Date) {
    timestamp = value.getTime();
  } else if (typeof value === "number") {
    timestamp = value;
  } else {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const hasTime = /T/u.test(trimmed);
    const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/iu.test(trimmed);
    const deterministicValue = hasTime && !hasOffset ? `${trimmed}Z` : trimmed;
    timestamp = Date.parse(deterministicValue);
  }

  if (!Number.isFinite(timestamp)) return null;

  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export type RadarDedupeInput = {
  platform: RadarPlatform;
  externalId?: string | null;
  text?: string | null;
  url?: string | null;
  observedAt?: string | number | Date | null;
};

export function buildRadarDedupeKey(input: RadarDedupeInput): string {
  return JSON.stringify({
    platform: normalizeRadarText(input.platform),
    externalId: normalizeRadarText(input.externalId ?? ""),
    text: normalizeRadarText(input.text ?? ""),
    url: normalizeDedupeUrl(input.url ?? ""),
    observedAt:
      input.observedAt == null ? null : normalizeRadarTimestamp(input.observedAt),
  });
}

export function hashRadarDedupeKey(input: RadarDedupeInput): string {
  return createHash("sha256").update(buildRadarDedupeKey(input)).digest("hex");
}

function normalizeOptionalTimestamp(
  name: string,
  value: string | number | Date | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  const normalized = normalizeRadarTimestamp(value);
  if (!normalized) throw new RangeError(`${name} must be a valid timestamp`);
  return normalized;
}

export function normalizeRadarSignal(
  raw: RawRadarSignal,
): NormalizedRadarSignal {
  const observedAt = normalizeRadarTimestamp(raw.observedAt);
  if (!observedAt) throw new RangeError("observedAt must be a valid timestamp");

  const normalizedText = normalizeRadarText(raw.text ?? "");
  return {
    ...raw,
    hashtags: raw.hashtags?.map(normalizeRadarHashtag).filter(Boolean),
    normalizedTextHash: createHash("sha256")
      .update(normalizedText)
      .digest("hex"),
    publishedAt: normalizeOptionalTimestamp("publishedAt", raw.publishedAt),
    observedAt,
    collectedAt: normalizeOptionalTimestamp("collectedAt", raw.collectedAt),
    rawExpiresAt: normalizeOptionalTimestamp("rawExpiresAt", raw.rawExpiresAt),
  };
}

function normalizeMatchValue(value: string): string {
  return collapseWhitespace(
    normalizeRadarText(value).replace(/[^\p{L}\p{N}_]+/gu, " "),
  );
}

function containsPhrase(text: string, phrase: string): boolean {
  return ` ${text} `.includes(` ${phrase} `);
}

const METHOD_ORDER: Record<RadarMatchMethod, number> = {
  canonical_exact: 0,
  alias_exact: 1,
  canonical_hashtag: 2,
  alias_hashtag: 3,
  canonical_phrase: 4,
  alias_phrase: 5,
};

export function matchRadarEntity(
  text: string,
  entities: readonly RadarEntity[],
): RadarMatch | null {
  const normalizedText = normalizeMatchValue(text);
  const hashtags = new Set(extractRadarHashtags(text));
  const matches: RadarMatch[] = [];

  for (const entity of entities) {
    const terms = [entity.canonicalName, ...entity.aliases];
    for (const [index, rawTerm] of terms.entries()) {
      const term = normalizeMatchValue(rawTerm);
      if (!term) continue;

      const canonical = index === 0;
      const hashtagTerm = normalizeRadarHashtag(rawTerm);
      if (normalizedText === term) {
        matches.push({
          entityId: entity.id,
          matchMethod: canonical ? "canonical_exact" : "alias_exact",
          confidence: canonical ? 0.99 : 0.96,
          matchedValue: rawTerm,
        });
      } else if (hashtags.has(hashtagTerm)) {
        matches.push({
          entityId: entity.id,
          matchMethod: canonical ? "canonical_hashtag" : "alias_hashtag",
          confidence: canonical ? 0.94 : 0.91,
          matchedValue: rawTerm,
        });
      } else if (containsPhrase(normalizedText, term)) {
        matches.push({
          entityId: entity.id,
          matchMethod: canonical ? "canonical_phrase" : "alias_phrase",
          confidence: canonical ? 0.87 : 0.83,
          matchedValue: rawTerm,
        });
      }
    }
  }

  return (
    matches.sort(
      (left, right) =>
        right.confidence - left.confidence ||
        METHOD_ORDER[left.matchMethod] - METHOD_ORDER[right.matchMethod] ||
        left.entityId.localeCompare(right.entityId) ||
        left.matchedValue.localeCompare(right.matchedValue),
    )[0] ?? null
  );
}

export type RadarSignalScoreInput = {
  observations: readonly RadarObservation[];
  referenceAt: string | number | Date;
  freshnessWindowHours?: number;
  confidencePlatformTarget?: number;
};

export function calculateRadarSignal(
  input: RadarSignalScoreInput,
): RadarSignalScore {
  const referenceTimestamp = normalizeRadarTimestamp(input.referenceAt);
  if (!referenceTimestamp) {
    throw new RangeError("referenceAt must be a valid timestamp");
  }

  const referenceMs = Date.parse(referenceTimestamp);
  const freshnessWindowHours = Math.max(1, input.freshnessWindowHours ?? 48);
  const confidencePlatformTarget = Math.max(
    1,
    input.confidencePlatformTarget ?? 3,
  );
  const aggregationObservations = input.observations.filter(
    (observation) => isRadarAggregationPlatform(observation.platform),
  );
  const excludedObservations = input.observations.filter((observation) =>
    !isRadarAggregationPlatform(observation.platform),
  );

  const platformScores = new Map<
    string,
    { weightedHeat: number; weightedReliability: number; weight: number }
  >();

  for (const observation of aggregationObservations) {
    const observedAt = normalizeRadarTimestamp(observation.observedAt);
    const observedMs = observedAt ? Date.parse(observedAt) : Number.NaN;
    const ageHours = Number.isFinite(observedMs)
      ? Math.max(0, referenceMs - observedMs) / 3_600_000
      : freshnessWindowHours;
    const freshness = clamp(1 - ageHours / freshnessWindowHours, 0, 1);
    const observationHeat =
      clamp(observation.velocity, 0, 100) * 0.5 +
      clamp(observation.engagement, 0, 100) * 0.3 +
      clamp(observation.volume, 0, 100) * 0.2;
    const reliability = clamp(observation.sourceReliability, 0, 1);
    const weight = Math.max(0.05, freshness) * Math.max(0.05, reliability);
    const platform = observation.platform.toLowerCase();
    const current = platformScores.get(platform) ?? {
      weightedHeat: 0,
      weightedReliability: 0,
      weight: 0,
    };

    current.weightedHeat += observationHeat * freshness * weight;
    current.weightedReliability += reliability * weight;
    current.weight += weight;
    platformScores.set(platform, current);
  }

  const platformValues = [...platformScores.values()];
  const heat = platformValues.length
    ? platformValues.reduce(
        (sum, platform) => sum + platform.weightedHeat / platform.weight,
        0,
      ) / platformValues.length
    : 0;
  const meanReliability = platformValues.length
    ? platformValues.reduce(
        (sum, platform) => sum + platform.weightedReliability / platform.weight,
        0,
      ) / platformValues.length
    : 0;
  const platformCoverage = clamp(
    platformScores.size / confidencePlatformTarget,
    0,
    1,
  );

  return {
    heat: round(clamp(heat, 0, 100), 2),
    confidence: round(
      clamp(meanReliability * 0.65 + platformCoverage * 0.35, 0, 1),
      4,
    ),
    observations: input.observations,
    aggregationObservations,
    excludedObservations,
    aggregatedPlatforms: [...platformScores.keys()].sort(),
  };
}

export type RadarStateTransitionInput = RadarStateSnapshot & {
  heat: number;
  confidence: number;
  thresholds?: Partial<RadarStateThresholds>;
};

export function recommendRadarState(
  state: RadarState,
  heat: number,
  confidence: number,
  customThresholds: Partial<RadarStateThresholds> = {},
): RadarState {
  const thresholds = { ...DEFAULT_RADAR_STATE_THRESHOLDS, ...customThresholds };
  const rising = heat >= thresholds.risingHeat && confidence >= thresholds.risingConfidence;
  const trending = heat >= thresholds.trendingHeat && confidence >= thresholds.trendingConfidence;

  switch (state) {
    case "candidate":
      return rising ? "rising" : "candidate";
    case "rising":
      if (trending) return "trending";
      return heat < thresholds.archiveHeat ? "candidate" : "rising";
    case "trending":
      return heat < thresholds.coolingHeat ? "cooling" : "trending";
    case "cooling":
      if (trending) return "trending";
      return heat < thresholds.archiveHeat ? "archive" : "cooling";
    case "archive":
      return rising ? "rising" : "archive";
  }
}

function snapshot(
  state: RadarState,
  consecutiveHigh = 0,
  consecutiveLow = 0,
): RadarStateSnapshot {
  return { state, consecutiveHigh, consecutiveLow };
}

export function transitionRadarState(
  input: RadarStateTransitionInput,
): RadarStateSnapshot {
  const thresholds = {
    ...DEFAULT_RADAR_STATE_THRESHOLDS,
    ...input.thresholds,
  };
  const highForRising =
    input.heat >= thresholds.risingHeat &&
    input.confidence >= thresholds.risingConfidence;
  const highForTrending =
    input.heat >= thresholds.trendingHeat &&
    input.confidence >= thresholds.trendingConfidence;

  switch (input.state) {
    case "candidate": {
      const high = highForRising ? input.consecutiveHigh + 1 : 0;
      return high >= thresholds.promotionObservations
        ? snapshot("rising")
        : snapshot("candidate", high, 0);
    }
    case "rising": {
      const high = highForTrending ? input.consecutiveHigh + 1 : 0;
      const low = input.heat < thresholds.archiveHeat ? input.consecutiveLow + 1 : 0;
      if (high >= thresholds.promotionObservations) return snapshot("trending");
      if (low >= thresholds.coolingObservations) return snapshot("candidate");
      return snapshot("rising", high, low);
    }
    case "trending": {
      const low = input.heat < thresholds.coolingHeat ? input.consecutiveLow + 1 : 0;
      return low >= thresholds.coolingObservations
        ? snapshot("cooling")
        : snapshot("trending", 0, low);
    }
    case "cooling": {
      const high = highForTrending ? input.consecutiveHigh + 1 : 0;
      const low = input.heat < thresholds.archiveHeat ? input.consecutiveLow + 1 : 0;
      if (high >= thresholds.promotionObservations) return snapshot("trending");
      if (low >= thresholds.archiveObservations) return snapshot("archive");
      return snapshot("cooling", high, low);
    }
    case "archive": {
      const high = highForRising ? input.consecutiveHigh + 1 : 0;
      return high >= thresholds.revivalObservations
        ? snapshot("candidate")
        : snapshot("archive", high, 0);
    }
  }
}
