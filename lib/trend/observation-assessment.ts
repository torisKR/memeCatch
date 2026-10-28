import {
  assessExternalTrend,
  type EvidenceUse,
  type ExternalTrendAssessment,
  type ExternalTrendAssessmentInput,
  type TrendComponentInput,
} from "./external-evidence";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export type ObservationSourcePolicy = {
  policyKey: string;
  platform: string;
  enabled: boolean;
  derivedAnalysisAllowed: boolean;
  crossPlatformCombinationAllowed: boolean;
};

export type CandidateSignalObservation = {
  id: string;
  policyKey: string;
  platform: string;
  contentKey: string;
  creatorKey: string | null;
  relationship: "independent" | "repost" | "crosspost" | "citation" | "unknown";
  relationshipReviewed: boolean;
  countsAsIndependent: boolean;
  availabilityStatus: "available" | "deleted" | "private" | "embed_failed" | "unknown";
  publishedAt: string | null;
  observedAt: string;
  retentionUntil: string;
};

export type CompletedObservationWindow = {
  kind: "hourly_24h" | "daily_7d";
  windowStart: string;
  windowEnd: string;
  status: "completed" | "incomplete" | "failed" | "delayed";
  observationScopeFingerprint: string;
  expectedBuckets: number;
  completedBuckets: number;
  apiFailureCount: number;
  delayedBucketCount: number;
};

export type ComparableWindowPair = {
  current: CompletedObservationWindow;
  previous: CompletedObservationWindow;
};

export type ObservationMetricSnapshot = {
  id: string;
  signalId: string;
  policyKey: string;
  platform: string;
  metricName: string;
  metricClass: "raw" | "derived";
  value: number | null;
  missingReason: string | null;
  unit: string;
  period: "current" | "previous";
  role: "candidate" | "baseline" | "search";
  windowStart: string;
  windowEnd: string;
  windowStatus: "completed" | "incomplete" | "failed" | "delayed";
  collectorStatus: "completed" | "failed" | "delayed";
  observationScopeFingerprint: string;
  expectedSamples: number;
  collectedSamples: number;
  creatorKey: string | null;
  contentType: string | null;
  postAgeBucket: string | null;
  requestGroupFingerprint: string | null;
  filterFingerprint: string | null;
  timeUnit: string | null;
};

export type ObservationAssessmentInput = {
  contentPublishedAt: string | null;
  firstDiscoveredAt: string;
  assessedAt: string;
  existingMemeId?: string | null;
  operatorReviewed: boolean;
  links: readonly CandidateSignalObservation[];
  policies: readonly ObservationSourcePolicy[];
  windows?: ComparableWindowPair | null;
  snapshots: readonly ObservationMetricSnapshot[];
  relativePerformanceTargetSignalId?: string | null;
};

export type ObservationAssessmentResult = {
  assessmentInput: ExternalTrendAssessmentInput;
  assessment: ExternalTrendAssessment;
  eligibleUseIds: string[];
  currentIndependentUseCount: number | null;
  previousIndependentUseCount: number | null;
  rejectionReasons: string[];
};

function parseTime(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function missing(reason: string, policyAllowed = true): TrendComponentInput {
  return { value: null, comparable: false, policyAllowed, missingReason: reason };
}

function measured(value: number): TrendComponentInput {
  return { value: clamp(value), comparable: true, policyAllowed: true };
}

function usableSnapshot(snapshot: ObservationMetricSnapshot): boolean {
  return snapshot.value !== null &&
    Number.isFinite(snapshot.value) &&
    snapshot.missingReason === null &&
    snapshot.windowStatus === "completed" &&
    snapshot.collectorStatus === "completed" &&
    snapshot.expectedSamples > 0 &&
    snapshot.collectedSamples === snapshot.expectedSamples;
}

function policyMap(policies: readonly ObservationSourcePolicy[]): Map<string, ObservationSourcePolicy> {
  return new Map(policies.map((policy) => [policy.policyKey, policy]));
}

function derivedPolicyGate(
  policyKeys: readonly string[],
  policies: Map<string, ObservationSourcePolicy>,
): { allowed: boolean; reason?: string } {
  if (policyKeys.length === 0) return { allowed: false, reason: "source_policy_missing" };
  const resolved = policyKeys.map((key) => policies.get(key));
  if (resolved.some((policy) => !policy?.enabled)) {
    return { allowed: false, reason: "source_policy_disabled_or_missing" };
  }
  if (resolved.some((policy) => !policy?.derivedAnalysisAllowed)) {
    return { allowed: false, reason: "derived_analysis_not_approved" };
  }
  const platforms = new Set(resolved.map((policy) => policy?.platform.toLowerCase()));
  if (
    platforms.size > 1 &&
    resolved.some((policy) => !policy?.crossPlatformCombinationAllowed)
  ) {
    return { allowed: false, reason: "cross_platform_combination_not_approved" };
  }
  return { allowed: true };
}

function policyPlatformIssue(
  policyKey: string,
  platform: string,
  policies: Map<string, ObservationSourcePolicy>,
): "source_policy_disabled_or_missing" | "source_policy_platform_mismatch" | null {
  const policy = policies.get(policyKey);
  if (!policy) return "source_policy_disabled_or_missing";
  return policy.platform.toLowerCase() === platform.toLowerCase()
    ? null
    : "source_policy_platform_mismatch";
}

/**
 * 외부 평가기의 "작성자별 첫 항목" 동작에 기대지 않고, 먼저 최신 게시물을
 * 선택한다. observedAt이나 firstDiscoveredAt은 게시 최신성의 대체값으로 쓰지 않는다.
 */
function eligibleIndependentLinks(
  links: readonly CandidateSignalObservation[],
  assessedAt: string,
): Array<{ link: CandidateSignalObservation; publishedTimestamp: number }> {
  const assessedTimestamp = parseTime(assessedAt);
  if (assessedTimestamp === null) throw new RangeError("assessedAt must be a valid timestamp");

  return links.flatMap((link) => {
    const publishedTimestamp = link.publishedAt ? parseTime(link.publishedAt) : null;
    const retentionTimestamp = parseTime(link.retentionUntil);
    if (
      !link.relationshipReviewed ||
      !link.countsAsIndependent ||
      link.relationship !== "independent" ||
      link.availabilityStatus !== "available" ||
      !link.creatorKey ||
      publishedTimestamp === null ||
      publishedTimestamp > assessedTimestamp ||
      retentionTimestamp === null ||
      retentionTimestamp <= assessedTimestamp
    ) return [];
    return [{ link, publishedTimestamp }];
  }).sort((left, right) =>
    right.publishedTimestamp - left.publishedTimestamp || left.link.id.localeCompare(right.link.id),
  );
}

function deduplicateIndependentLinks(
  eligible: ReadonlyArray<{ link: CandidateSignalObservation; publishedTimestamp: number }>,
): EvidenceUse[] {
  const creators = new Set<string>();
  const contents = new Set<string>();
  const result: EvidenceUse[] = [];
  for (const { link } of eligible) {
    if (creators.has(link.creatorKey!) || contents.has(link.contentKey)) continue;
    creators.add(link.creatorKey!);
    contents.add(link.contentKey);
    result.push({
      id: link.id,
      contentKey: link.contentKey,
      creatorKey: link.creatorKey,
      relationship: "independent",
      publishedAt: link.publishedAt,
      observedAt: link.observedAt,
    });
  }
  return result;
}

export function prepareLatestIndependentUses(
  links: readonly CandidateSignalObservation[],
  assessedAt: string,
): EvidenceUse[] {
  return deduplicateIndependentLinks(eligibleIndependentLinks(links, assessedAt));
}

function prepareIndependentUsesForWindow(
  links: readonly CandidateSignalObservation[],
  assessedAt: string,
  start: number,
  end: number,
): EvidenceUse[] {
  return deduplicateIndependentLinks(
    eligibleIndependentLinks(links, assessedAt).filter(({ publishedTimestamp }) =>
      publishedTimestamp >= start && publishedTimestamp < end,
    ),
  );
}

function validateWindowPair(
  pair: ComparableWindowPair | null | undefined,
  assessedAt: string,
): { valid: true; currentStart: number; currentEnd: number; previousStart: number } |
  { valid: false; reason: string } {
  if (!pair) return { valid: false, reason: "comparison_windows_missing" };
  const assessed = parseTime(assessedAt);
  const currentStart = parseTime(pair.current.windowStart);
  const currentEnd = parseTime(pair.current.windowEnd);
  const previousStart = parseTime(pair.previous.windowStart);
  const previousEnd = parseTime(pair.previous.windowEnd);
  if (
    assessed === null || currentStart === null || currentEnd === null ||
    previousStart === null || previousEnd === null
  ) return { valid: false, reason: "invalid_window_timestamp" };
  if (pair.current.kind !== pair.previous.kind) {
    return { valid: false, reason: "window_kind_mismatch" };
  }
  const requiredDuration = pair.current.kind === "hourly_24h" ? DAY_MS : 7 * DAY_MS;
  if (
    currentEnd - currentStart !== requiredDuration ||
    previousEnd - previousStart !== requiredDuration ||
    previousEnd !== currentStart ||
    currentEnd > assessed
  ) return { valid: false, reason: "windows_not_equal_adjacent_completed_periods" };
  if (
    pair.current.status !== "completed" || pair.previous.status !== "completed" ||
    pair.current.observationScopeFingerprint !== pair.previous.observationScopeFingerprint ||
    !pair.current.observationScopeFingerprint
  ) return { valid: false, reason: "observation_scope_or_completion_mismatch" };
  for (const window of [pair.current, pair.previous]) {
    if (
      window.expectedBuckets <= 0 ||
      window.completedBuckets !== window.expectedBuckets ||
      window.apiFailureCount > 0 ||
      window.delayedBucketCount > 0
    ) return { valid: false, reason: "collector_coverage_incomplete" };
  }
  return { valid: true, currentStart, currentEnd, previousStart };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function relativePerformanceComponent(
  snapshots: readonly ObservationMetricSnapshot[],
  targetSignalId: string | null | undefined,
  policies: Map<string, ObservationSourcePolicy>,
  rejectionReasons: string[],
): TrendComponentInput {
  if (!targetSignalId) return missing("relative_performance_target_missing");
  const candidates = snapshots.filter((snapshot) =>
    snapshot.signalId === targetSignalId && snapshot.role === "candidate" && usableSnapshot(snapshot),
  );
  if (candidates.length !== 1) return missing("relative_performance_candidate_incomplete");
  const candidate = candidates[0];
  const candidatePolicyIssue = policyPlatformIssue(candidate.policyKey, candidate.platform, policies);
  if (candidatePolicyIssue) {
    rejectionReasons.push(candidatePolicyIssue);
    return missing(candidatePolicyIssue, false);
  }
  const gate = derivedPolicyGate([candidate.policyKey], policies);
  if (!gate.allowed) {
    rejectionReasons.push(gate.reason!);
    return missing(gate.reason!, false);
  }
  if (!candidate.creatorKey || !candidate.contentType || !candidate.postAgeBucket) {
    return missing("relative_performance_comparison_keys_missing");
  }
  const baselines = snapshots.filter((snapshot) =>
    snapshot.role === "baseline" &&
    usableSnapshot(snapshot) &&
    snapshot.policyKey === candidate.policyKey &&
    snapshot.metricName === candidate.metricName &&
    snapshot.unit === candidate.unit &&
    snapshot.creatorKey === candidate.creatorKey &&
    snapshot.contentType === candidate.contentType &&
    snapshot.postAgeBucket === candidate.postAgeBucket &&
    snapshot.observationScopeFingerprint === candidate.observationScopeFingerprint,
  );
  if (baselines.length < 5) return missing("relative_performance_sample_below_five");
  const baseline = median(baselines.map((snapshot) => snapshot.value!));
  if (baseline <= 0) return missing("relative_performance_small_denominator");
  return measured((candidate.value! - baseline) / baseline);
}

function sameWindow(snapshot: ObservationMetricSnapshot, window: CompletedObservationWindow): boolean {
  return snapshot.windowStart === window.windowStart &&
    snapshot.windowEnd === window.windowEnd &&
    snapshot.observationScopeFingerprint === window.observationScopeFingerprint;
}

function searchMomentumComponent(
  snapshots: readonly ObservationMetricSnapshot[],
  pair: ComparableWindowPair | null | undefined,
  pairValidation: ReturnType<typeof validateWindowPair>,
  policies: Map<string, ObservationSourcePolicy>,
  rejectionReasons: string[],
): TrendComponentInput {
  if (!pair || !pairValidation.valid) return missing("search_windows_not_comparable");
  const currentRows = snapshots.filter((snapshot) =>
    snapshot.role === "search" && snapshot.period === "current" &&
    snapshot.platform.toLowerCase() === "naver_datalab" &&
    usableSnapshot(snapshot) && sameWindow(snapshot, pair.current),
  );
  const previousRows = snapshots.filter((snapshot) =>
    snapshot.role === "search" && snapshot.period === "previous" &&
    snapshot.platform.toLowerCase() === "naver_datalab" &&
    usableSnapshot(snapshot) && sameWindow(snapshot, pair.previous),
  );
  if (currentRows.length !== 1 || previousRows.length !== 1) {
    return missing("naver_completed_pair_missing");
  }
  const current = currentRows[0];
  const previous = previousRows[0];
  const searchPolicyIssue =
    policyPlatformIssue(current.policyKey, current.platform, policies) ??
    policyPlatformIssue(previous.policyKey, previous.platform, policies);
  if (searchPolicyIssue) {
    rejectionReasons.push(searchPolicyIssue);
    return missing(searchPolicyIssue, false);
  }
  const gate = derivedPolicyGate([current.policyKey, previous.policyKey], policies);
  if (!gate.allowed) {
    rejectionReasons.push(gate.reason!);
    return missing(gate.reason!, false);
  }
  if (
    current.policyKey !== previous.policyKey ||
    current.metricName !== previous.metricName ||
    current.unit !== previous.unit ||
    !current.requestGroupFingerprint ||
    current.requestGroupFingerprint !== previous.requestGroupFingerprint ||
    !current.filterFingerprint ||
    current.filterFingerprint !== previous.filterFingerprint ||
    !current.timeUnit ||
    current.timeUnit !== previous.timeUnit
  ) return missing("naver_request_fingerprint_mismatch");
  if (previous.value! <= 0) return missing("naver_small_denominator");
  return measured((current.value! - previous.value!) / previous.value!);
}

export function buildObservationAssessment(
  input: ObservationAssessmentInput,
): ObservationAssessmentResult {
  const policies = policyMap(input.policies);
  const uses = prepareLatestIndependentUses(input.links, input.assessedAt);
  const rejectionReasons: string[] = [];
  const pairValidation = validateWindowPair(input.windows, input.assessedAt);
  const currentWindowUses = "reason" in pairValidation ? [] : prepareIndependentUsesForWindow(
    input.links,
    input.assessedAt,
    pairValidation.currentStart,
    pairValidation.currentEnd,
  );
  const previousWindowUses = "reason" in pairValidation ? [] : prepareIndependentUsesForWindow(
    input.links,
    input.assessedAt,
    pairValidation.previousStart,
    pairValidation.currentStart,
  );
  const policyUses = "reason" in pairValidation
    ? uses
    : [...currentWindowUses, ...previousWindowUses];
  const policyLinks = policyUses.length > 0
    ? policyUses.flatMap((use) => {
        const link = input.links.find((item) => item.id === use.id);
        return link ? [link] : [];
      })
    : [...input.links];
  const linkPolicyKeys = [...new Set(
    policyLinks.map((link) => link.policyKey),
  )];
  const linkPolicyIssue = policyLinks.reduce<ReturnType<typeof policyPlatformIssue>>((issue, link) => {
    if (issue) return issue;
    return policyPlatformIssue(link.policyKey, link.platform, policies);
  }, null);
  const linkPolicyGate = linkPolicyIssue
    ? { allowed: false, reason: linkPolicyIssue }
    : derivedPolicyGate(linkPolicyKeys, policies);
  const windowMissingReason = "reason" in pairValidation
    ? pairValidation.reason
    : "source_policy_not_approved";

  let currentIndependentUseCount: number | null = null;
  let previousIndependentUseCount: number | null = null;
  let growth = missing(windowMissingReason);
  let independentSpread = missing(windowMissingReason);
  let recentUsage = missing(windowMissingReason);

  if ("reason" in pairValidation) {
    rejectionReasons.push(pairValidation.reason);
  } else if (!linkPolicyGate.allowed) {
    rejectionReasons.push(linkPolicyGate.reason!);
    growth = missing(linkPolicyGate.reason!, false);
    independentSpread = missing(linkPolicyGate.reason!, false);
    recentUsage = missing(linkPolicyGate.reason!, false);
  } else {
    currentIndependentUseCount = currentWindowUses.length;
    previousIndependentUseCount = previousWindowUses.length;
    const denominator = Math.max(previousIndependentUseCount, 1);
    growth = measured((currentIndependentUseCount - previousIndependentUseCount) / denominator);
    independentSpread = measured(currentIndependentUseCount / 5);
    recentUsage = measured(currentIndependentUseCount / 5);
  }

  const components = {
    growth,
    independentSpread,
    relativePerformance: relativePerformanceComponent(
      input.snapshots,
      input.relativePerformanceTargetSignalId,
      policies,
      rejectionReasons,
    ),
    searchMomentum: searchMomentumComponent(
      input.snapshots,
      input.windows,
      pairValidation,
      policies,
      rejectionReasons,
    ),
    recentUsage,
  };

  const assessmentInput: ExternalTrendAssessmentInput = {
    contentPublishedAt: input.contentPublishedAt,
    firstDiscoveredAt: input.firstDiscoveredAt,
    assessedAt: input.assessedAt,
    existingMemeId: input.existingMemeId,
    operatorReviewed: input.operatorReviewed,
    uses,
    components,
  };
  const assessment = assessExternalTrend(assessmentInput);
  const componentRejections = Object.values(components).flatMap((component) =>
    component.value === null && component.missingReason ? [component.missingReason] : [],
  );
  return {
    assessmentInput,
    assessment,
    eligibleUseIds: [...new Set([
      ...uses.map((use) => use.id),
      ...currentWindowUses.map((use) => use.id),
      ...previousWindowUses.map((use) => use.id),
    ])],
    currentIndependentUseCount,
    previousIndependentUseCount,
    rejectionReasons: [...new Set([
      ...rejectionReasons,
      ...componentRejections,
      ...assessment.reasons,
    ])],
  };
}
