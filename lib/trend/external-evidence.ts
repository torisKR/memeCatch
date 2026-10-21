const TRACKING_PARAMETER_NAMES = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "si",
]);

const SCORE_WEIGHTS = {
  growth: 0.35,
  independentSpread: 0.25,
  relativePerformance: 0.2,
  searchMomentum: 0.1,
  recentUsage: 0.1,
} as const;

export type ExternalTrendComponent = keyof typeof SCORE_WEIGHTS;

export type EvidenceRelationship =
  | "independent"
  | "repost"
  | "crosspost"
  | "citation"
  | "unknown";

export type EvidenceUse = {
  id: string;
  contentKey: string;
  creatorKey: string | null;
  relationship: EvidenceRelationship;
  publishedAt: string | null;
  observedAt: string;
};

export type TrendComponentInput = {
  value: number | null;
  policyAllowed: boolean;
  comparable: boolean;
  missingReason?: string | null;
};

export type ExternalTrendAssessmentInput = {
  contentPublishedAt: string | null;
  firstDiscoveredAt: string;
  assessedAt: string;
  existingMemeId?: string | null;
  operatorReviewed: boolean;
  hasHighCumulativeReach?: boolean;
  uses: readonly EvidenceUse[];
  components: Partial<Record<ExternalTrendComponent, TrendComponentInput>>;
};

export type ExternalTrendState =
  | "observing"
  | "popular_content"
  | "rising"
  | "revival";

export type ExternalTrendAssessment = {
  state: ExternalTrendState;
  score: number | null;
  confidence: number;
  publicEligible: boolean;
  independentUseCount: number;
  componentCoverage: number;
  componentValues: Record<ExternalTrendComponent, number | null>;
  missingReasons: Partial<Record<ExternalTrendComponent, string>>;
  reasons: string[];
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals = 3): number {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeYouTubeUrl(url: URL): URL {
  const host = url.hostname.replace(/^www\./u, "").toLowerCase();
  if (host === "youtu.be") {
    const videoId = url.pathname.split("/").filter(Boolean)[0];
    if (videoId) return new URL(`https://www.youtube.com/watch?v=${videoId}`);
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" && parts[1]) {
      return new URL(`https://www.youtube.com/watch?v=${parts[1]}`);
    }
    const videoId = url.searchParams.get("v");
    if (videoId) return new URL(`https://www.youtube.com/watch?v=${videoId}`);
  }
  return url;
}

/**
 * 외부 게시물의 동일성 판정용 URL이다. 추적 파라미터와 프래그먼트를 제거하지만,
 * 원자료 링크 자체를 다운로드하거나 우회하지 않는다.
 */
export function canonicalizeEvidenceUrl(value: string): string | null {
  try {
    let url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url = normalizeYouTubeUrl(url);
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    for (const name of [...url.searchParams.keys()]) {
      if (
        TRACKING_PARAMETER_NAMES.has(name.toLowerCase()) ||
        name.toLowerCase().startsWith("utm_")
      ) {
        url.searchParams.delete(name);
      }
    }

    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/u, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return null;
  }
}

export function buildEvidenceContentKey(input: {
  platform: string;
  platformContentId?: string | null;
  url?: string | null;
}): string | null {
  const platform = input.platform.trim().toLowerCase();
  const contentId = input.platformContentId?.trim();
  if (platform && contentId) return `${platform}:${contentId}`;
  const canonicalUrl = input.url ? canonicalizeEvidenceUrl(input.url) : null;
  return canonicalUrl ? `url:${canonicalUrl}` : null;
}

export function getIndependentEvidenceUses(
  uses: readonly EvidenceUse[],
): EvidenceUse[] {
  const seenContent = new Set<string>();
  const seenCreators = new Set<string>();
  const result: EvidenceUse[] = [];

  for (const use of [...uses].sort((a, b) =>
    (parseTimestamp(b.publishedAt) ?? -Infinity) - (parseTimestamp(a.publishedAt) ?? -Infinity),
  )) {
    if (use.relationship !== "independent" || !use.creatorKey) continue;
    if (seenContent.has(use.contentKey) || seenCreators.has(use.creatorKey)) continue;
    seenContent.add(use.contentKey);
    seenCreators.add(use.creatorKey);
    result.push(use);
  }

  return result;
}

export function assessExternalTrend(
  input: ExternalTrendAssessmentInput,
): ExternalTrendAssessment {
  const assessedAt = parseTimestamp(input.assessedAt);
  const firstDiscoveredAt = parseTimestamp(input.firstDiscoveredAt);
  if (assessedAt === null || firstDiscoveredAt === null) {
    throw new RangeError("assessedAt and firstDiscoveredAt must be valid timestamps");
  }

  const independentUses = getIndependentEvidenceUses(input.uses.filter((use) => {
    const published = parseTimestamp(use.publishedAt);
    return published !== null && published <= assessedAt;
  }));
  const recentIndependentUses = independentUses.filter((use) =>
    assessedAt - parseTimestamp(use.publishedAt)! <= 14 * 24 * 60 * 60 * 1000,
  );
  const componentValues = {} as Record<ExternalTrendComponent, number | null>;
  const missingReasons: Partial<Record<ExternalTrendComponent, string>> = {};
  let availableComponentCount = 0;
  let scoreTotal = 0;
  let comparableComponentCount = 0;

  for (const [name, weight] of Object.entries(SCORE_WEIGHTS) as Array<
    [ExternalTrendComponent, number]
  >) {
    const component = input.components[name];
    if (!component?.policyAllowed) {
      componentValues[name] = null;
      missingReasons[name] = component ? "policy_not_approved" : "not_collected";
      continue;
    }
    if (component.value === null || !Number.isFinite(component.value)) {
      componentValues[name] = null;
      missingReasons[name] = component.missingReason || "missing";
      continue;
    }
    if (!component.comparable) {
      componentValues[name] = null;
      missingReasons[name] = component.missingReason || "not_comparable";
      continue;
    }

    const normalizedValue = clamp(component.value);
    componentValues[name] = normalizedValue;
    availableComponentCount += 1;
    if (component.comparable) comparableComponentCount += 1;
    scoreTotal += normalizedValue * weight;
  }

  const growth = input.components.growth;
  const hasComparableGrowth = Boolean(
    growth?.policyAllowed &&
      growth.comparable &&
      growth.value !== null &&
      Number.isFinite(growth.value) &&
      growth.value > 0,
  );
  const componentCoverage = availableComponentCount / Object.keys(SCORE_WEIGHTS).length;
  const minimumSignalsMet =
    recentIndependentUses.length >= 3 && hasComparableGrowth && availableComponentCount >= 3;
  const score = minimumSignalsMet ? round(scoreTotal * 100, 1) : null;

  const latestIndependentUseAt = independentUses.reduce<number | null>((latest, use) => {
    const timestamp = parseTimestamp(use.publishedAt);
    if (timestamp === null) return latest;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);
  const recentIndependentUse =
    latestIndependentUseAt !== null &&
    assessedAt >= latestIndependentUseAt &&
    assessedAt - latestIndependentUseAt <= 14 * 24 * 60 * 60 * 1000;
  const originalPublishedAt = parseTimestamp(input.contentPublishedAt);
  const oldOriginal =
    originalPublishedAt !== null &&
    assessedAt - originalPublishedAt > 60 * 24 * 60 * 60 * 1000;

  let state: ExternalTrendState = "observing";
  if (
    minimumSignalsMet &&
    oldOriginal &&
    recentIndependentUse &&
    input.existingMemeId
  ) {
    state = "revival";
  } else if (minimumSignalsMet && !oldOriginal && recentIndependentUse) {
    state = "rising";
  } else if (input.hasHighCumulativeReach) {
    state = "popular_content";
  }

  const evidenceCoverage = clamp(componentCoverage);
  const sampleCoverage = clamp(independentUses.length / 5);
  const freshness = recentIndependentUse ? 1 : 0;
  const measurementCoverage = availableComponentCount
    ? comparableComponentCount / availableComponentCount
    : 0;
  const confidence = round(
    evidenceCoverage * 0.35 +
      sampleCoverage * 0.3 +
      freshness * 0.2 +
      measurementCoverage * 0.15,
  );
  const publicEligible =
    input.operatorReviewed && (state === "rising" || state === "revival");

  const reasons: string[] = [];
  if (independentUses.length < 3) reasons.push("independent_uses_below_minimum");
  if (!hasComparableGrowth) reasons.push("comparable_growth_missing");
  if (availableComponentCount < 3) reasons.push("measured_components_below_minimum");
  if (!input.operatorReviewed) reasons.push("operator_review_required");
  if (oldOriginal && state !== "revival") reasons.push("old_content_not_new_trend");

  return {
    state,
    score,
    confidence,
    publicEligible,
    independentUseCount: independentUses.length,
    componentCoverage: round(componentCoverage),
    componentValues,
    missingReasons,
    reasons,
  };
}
