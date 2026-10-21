import { describe, expect, it } from "vitest";
import {
  buildObservationAssessment,
  prepareLatestIndependentUses,
  type CandidateSignalObservation,
  type ComparableWindowPair,
  type ObservationMetricSnapshot,
  type ObservationSourcePolicy,
} from "./observation-assessment";

const NOW = "2026-10-13T00:00:00.000Z";

const xPolicy: ObservationSourcePolicy = {
  policyKey: "x-approved",
  platform: "x",
  enabled: true,
  derivedAnalysisAllowed: true,
  crossPlatformCombinationAllowed: false,
};

const naverPolicy: ObservationSourcePolicy = {
  policyKey: "naver-approved",
  platform: "naver_datalab",
  enabled: true,
  derivedAnalysisAllowed: true,
  crossPlatformCombinationAllowed: false,
};

const windows: ComparableWindowPair = {
  previous: {
    kind: "hourly_24h",
    windowStart: "2026-10-11T00:00:00.000Z",
    windowEnd: "2026-10-12T00:00:00.000Z",
    status: "completed",
    observationScopeFingerprint: "scope-v1",
    expectedBuckets: 24,
    completedBuckets: 24,
    apiFailureCount: 0,
    delayedBucketCount: 0,
  },
  current: {
    kind: "hourly_24h",
    windowStart: "2026-10-12T00:00:00.000Z",
    windowEnd: NOW,
    status: "completed",
    observationScopeFingerprint: "scope-v1",
    expectedBuckets: 24,
    completedBuckets: 24,
    apiFailureCount: 0,
    delayedBucketCount: 0,
  },
};

function link(
  id: string,
  creatorKey: string | null,
  publishedAt: string | null,
  overrides: Partial<CandidateSignalObservation> = {},
): CandidateSignalObservation {
  return {
    id,
    policyKey: "x-approved",
    platform: "x",
    contentKey: `x:${id}`,
    creatorKey,
    relationship: "independent",
    relationshipReviewed: true,
    countsAsIndependent: true,
    availabilityStatus: "available",
    publishedAt,
    observedAt: "2026-10-13T00:00:00.000Z",
    retentionUntil: "2026-11-13T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    contentPublishedAt: "2026-10-10T00:00:00.000Z",
    firstDiscoveredAt: "2026-10-12T12:00:00.000Z",
    assessedAt: NOW,
    operatorReviewed: false,
    links: [
      link("current-1", "creator-1", "2026-10-12T03:00:00.000Z"),
      link("current-2", "creator-2", "2026-10-12T04:00:00.000Z"),
      link("current-3", "creator-3", "2026-10-12T05:00:00.000Z"),
      link("previous-1", "creator-4", "2026-10-11T03:00:00.000Z"),
    ],
    policies: [xPolicy, naverPolicy],
    windows,
    snapshots: [] as ObservationMetricSnapshot[],
    ...overrides,
  };
}

function snapshot(overrides: Partial<ObservationMetricSnapshot>): ObservationMetricSnapshot {
  return {
    id: "metric",
    signalId: "target",
    policyKey: "x-approved",
    platform: "x",
    metricName: "engagement_count",
    metricClass: "raw",
    value: 20,
    missingReason: null,
    unit: "count",
    period: "current",
    role: "candidate",
    windowStart: windows.current.windowStart,
    windowEnd: windows.current.windowEnd,
    windowStatus: "completed",
    collectorStatus: "completed",
    observationScopeFingerprint: "scope-v1",
    expectedSamples: 1,
    collectedSamples: 1,
    creatorKey: "creator-1",
    contentType: "short_video",
    postAgeBucket: "24h",
    requestGroupFingerprint: null,
    filterFingerprint: null,
    timeUnit: null,
    ...overrides,
  };
}

describe("observation assessment", () => {
  it("keeps the latest reviewed available post per creator and never substitutes observation time", () => {
    const uses = prepareLatestIndependentUses([
      link("old", "same-creator", "2026-08-01T00:00:00.000Z"),
      link("recent", "same-creator", "2026-10-12T20:00:00.000Z"),
      link("no-published-at", "creator-2", null),
      link("future", "creator-future", "2026-10-13T00:00:01.000Z"),
      link("expired", "creator-3", "2026-10-12T10:00:00.000Z", { retentionUntil: NOW }),
      link("private", "creator-4", "2026-10-12T10:00:00.000Z", { availabilityStatus: "private" }),
      link("unreviewed", "creator-5", "2026-10-12T10:00:00.000Z", { relationshipReviewed: false }),
    ], NOW);

    expect(uses.map((use) => use.id)).toEqual(["recent"]);
    expect(uses[0].publishedAt).toBe("2026-10-12T20:00:00.000Z");
  });

  it("computes independent growth from published times without cumulative view metrics", () => {
    const result = buildObservationAssessment(baseInput());

    expect(result.currentIndependentUseCount).toBe(3);
    expect(result.previousIndependentUseCount).toBe(1);
    expect(result.assessmentInput.components.growth).toEqual({
      value: 1,
      comparable: true,
      policyAllowed: true,
    });
    expect(result.assessmentInput).not.toHaveProperty("hasHighCumulativeReach");
    expect(result.assessment.state).toBe("rising");
  });

  it("counts the same creator once in each completed window without counting duplicates or reposts", () => {
    const result = buildObservationAssessment(baseInput({
      links: [
        link("prior-original", "same-creator", "2026-10-11T03:00:00.000Z"),
        link("current-original", "same-creator", "2026-10-12T03:00:00.000Z"),
        link("duplicate-original", "duplicate-creator-1", "2026-10-12T04:00:00.000Z", {
          contentKey: "x:duplicate",
        }),
        link("duplicate-copy", "duplicate-creator-2", "2026-10-12T05:00:00.000Z", {
          contentKey: "x:duplicate",
        }),
        link("current-repost", "repost-creator", "2026-10-12T06:00:00.000Z", {
          relationship: "repost",
          countsAsIndependent: false,
        }),
      ],
    }));

    expect(result.previousIndependentUseCount).toBe(1);
    expect(result.currentIndependentUseCount).toBe(2);
    expect(result.eligibleUseIds).toEqual(expect.arrayContaining(["prior-original", "current-original"]));
    expect(result.eligibleUseIds.filter((id) => id.startsWith("duplicate-"))).toHaveLength(1);
    expect(result.eligibleUseIds).not.toContain("current-repost");
    expect(result.assessmentInput.components.growth?.value).toBe(1);
  });

  it("does not treat unknown or future publication time as trend recency", () => {
    const result = buildObservationAssessment(baseInput({
      links: [
        link("metadata-only", "creator-1", null, { observedAt: "2026-10-12T20:00:00.000Z" }),
        link("future", "creator-2", "2026-10-14T00:00:00.000Z", { observedAt: NOW }),
      ],
    }));

    expect(result.eligibleUseIds).toEqual([]);
    expect(result.currentIndependentUseCount).toBe(0);
    expect(result.previousIndependentUseCount).toBe(0);
    expect(result.assessmentInput.components.recentUsage?.value).toBe(0);
    expect(result.assessment.state).toBe("observing");
  });

  it.each([
    [{ current: { ...windows.current, status: "failed" as const } }, "observation_scope_or_completion_mismatch"],
    [{ current: { ...windows.current, apiFailureCount: 1 } }, "collector_coverage_incomplete"],
    [{ current: { ...windows.current, delayedBucketCount: 1 } }, "collector_coverage_incomplete"],
    [{ current: { ...windows.current, completedBuckets: 23 } }, "collector_coverage_incomplete"],
    [{ current: { ...windows.current, observationScopeFingerprint: "changed" } }, "observation_scope_or_completion_mismatch"],
  ])("excludes growth for incomplete or incomparable collection windows", (partial, reason) => {
    const pair = { previous: windows.previous, current: { ...windows.current, ...partial.current } };
    const result = buildObservationAssessment(baseInput({ windows: pair }));
    expect(result.assessmentInput.components.growth?.value).toBeNull();
    expect(result.currentIndependentUseCount).toBeNull();
    expect(result.rejectionReasons).toContain(reason);
  });

  it("defaults YouTube derived analysis to denied when no enabled policy is supplied", () => {
    const youtubeLinks = [
      link("yt-1", "yt-a", "2026-10-12T03:00:00.000Z", { policyKey: "youtube", platform: "youtube" }),
      link("yt-2", "yt-b", "2026-10-12T04:00:00.000Z", { policyKey: "youtube", platform: "youtube" }),
      link("yt-3", "yt-c", "2026-10-12T05:00:00.000Z", { policyKey: "youtube", platform: "youtube" }),
    ];
    const result = buildObservationAssessment(baseInput({ links: youtubeLinks, policies: [] }));

    expect(result.assessmentInput.components.growth?.policyAllowed).toBe(false);
    expect(result.assessmentInput.components.growth?.value).toBeNull();
    expect(result.rejectionReasons).toContain("source_policy_disabled_or_missing");

    const mismatchedPolicy = buildObservationAssessment(baseInput({
      links: youtubeLinks.map((item) => ({ ...item, policyKey: "x-approved" })),
      policies: [xPolicy],
    }));
    expect(mismatchedPolicy.assessmentInput.components.growth?.policyAllowed).toBe(false);
    expect(mismatchedPolicy.rejectionReasons).toContain("source_policy_platform_mismatch");
  });

  it("requires five same-creator/type/post-age comparison samples for relative performance", () => {
    const candidate = snapshot({ id: "candidate" });
    const fourBaselines = Array.from({ length: 4 }, (_, index) => snapshot({
      id: `baseline-${index}`,
      signalId: `baseline-${index}`,
      role: "baseline",
      value: 10,
    }));
    const belowMinimum = buildObservationAssessment(baseInput({
      snapshots: [candidate, ...fourBaselines],
      relativePerformanceTargetSignalId: "target",
    }));
    expect(belowMinimum.assessmentInput.components.relativePerformance?.value).toBeNull();
    expect(belowMinimum.assessmentInput.components.relativePerformance?.missingReason)
      .toBe("relative_performance_sample_below_five");

    const complete = buildObservationAssessment(baseInput({
      snapshots: [
        candidate,
        ...fourBaselines,
        snapshot({ id: "baseline-5", signalId: "baseline-5", role: "baseline", value: 10 }),
        snapshot({ id: "wrong-creator", signalId: "wrong", role: "baseline", creatorKey: "other", value: 1 }),
      ],
      relativePerformanceTargetSignalId: "target",
    }));
    expect(complete.assessmentInput.components.relativePerformance?.value).toBe(1);
  });

  it("uses Naver ratios only for the same completed request group, filter and time unit", () => {
    const current = snapshot({
      id: "naver-current",
      signalId: "naver-keyword",
      policyKey: "naver-approved",
      platform: "naver_datalab",
      metricName: "relative_search_index",
      value: 60,
      role: "search",
      period: "current",
      requestGroupFingerprint: "group-a",
      filterFingerprint: "filter-a",
      timeUnit: "hour",
    });
    const previous = snapshot({
      ...current,
      id: "naver-previous",
      value: 30,
      period: "previous",
      windowStart: windows.previous.windowStart,
      windowEnd: windows.previous.windowEnd,
    });
    const mismatch = buildObservationAssessment(baseInput({
      snapshots: [{ ...current, requestGroupFingerprint: "group-b" }, previous],
    }));
    expect(mismatch.assessmentInput.components.searchMomentum?.missingReason)
      .toBe("naver_request_fingerprint_mismatch");

    const complete = buildObservationAssessment(baseInput({ snapshots: [current, previous] }));
    expect(complete.assessmentInput.components.searchMomentum?.value).toBe(1);
  });
});
