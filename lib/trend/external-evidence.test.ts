import { describe, expect, it } from "vitest";
import {
  assessExternalTrend,
  buildEvidenceContentKey,
  canonicalizeEvidenceUrl,
  getIndependentEvidenceUses,
  type EvidenceUse,
  type TrendComponentInput,
} from "./external-evidence";

const NOW = "2026-10-13T00:00:00.000Z";

function measured(value: number): TrendComponentInput {
  return { value, policyAllowed: true, comparable: true };
}

function uses(count: number, publishedAt = "2026-10-12T00:00:00.000Z"): EvidenceUse[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `use-${index}`,
    contentKey: `tiktok:post-${index}`,
    creatorKey: `tiktok:creator-${index}`,
    relationship: "independent",
    publishedAt,
    observedAt: NOW,
  }));
}

const completeComponents = {
  growth: measured(0.8),
  independentSpread: measured(0.7),
  relativePerformance: measured(0.6),
  searchMomentum: measured(0.5),
  recentUsage: measured(0.9),
};

describe("external trend evidence", () => {
  it("does not classify an old high-view post as a new rising meme", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2021-01-01T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-12T00:00:00.000Z",
      assessedAt: NOW,
      operatorReviewed: true,
      hasHighCumulativeReach: true,
      uses: [],
      components: { recentUsage: measured(0.1) },
    });

    expect(result.state).toBe("popular_content");
    expect(result.score).toBeNull();
    expect(result.publicEligible).toBe(false);
  });

  it("keeps a small sample in observing state", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2026-10-10T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-11T00:00:00.000Z",
      assessedAt: NOW,
      operatorReviewed: true,
      uses: uses(2),
      components: completeComponents,
    });

    expect(result.state).toBe("observing");
    expect(result.score).toBeNull();
    expect(result.reasons).toContain("independent_uses_below_minimum");
  });

  it("normalizes tracking URL variants and does not count reposts or crossposts", () => {
    expect(
      canonicalizeEvidenceUrl("https://youtu.be/abc123?si=share&utm_source=x"),
    ).toBe("https://www.youtube.com/watch?v=abc123");
    expect(canonicalizeEvidenceUrl("https://m.youtube.com/shorts/abc123?si=share"))
      .toBe("https://www.youtube.com/watch?v=abc123");
    expect(
      buildEvidenceContentKey({
        platform: "YouTube",
        platformContentId: "abc123",
        url: "https://youtu.be/abc123?si=share",
      }),
    ).toBe("youtube:abc123");

    const independent = getIndependentEvidenceUses([
      ...uses(1),
      { ...uses(1)[0], id: "duplicate-url" },
      {
        id: "repost",
        contentKey: "tiktok:repost",
        creatorKey: "tiktok:creator-2",
        relationship: "repost",
        publishedAt: NOW,
        observedAt: NOW,
      },
      {
        id: "crosspost",
        contentKey: "instagram:crosspost",
        creatorKey: "tiktok:creator-0",
        relationship: "crosspost",
        publishedAt: NOW,
        observedAt: NOW,
      },
    ]);
    expect(independent).toHaveLength(1);
  });

  it("classifies recent independent reuse of an existing old meme as a revival", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2020-01-01T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-09T00:00:00.000Z",
      assessedAt: NOW,
      existingMemeId: "meme-1",
      operatorReviewed: true,
      uses: uses(3),
      components: completeComponents,
    });

    expect(result.state).toBe("revival");
    expect(result.publicEligible).toBe(true);
  });

  it("keeps a missing metric distinct from an observed zero", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2026-10-10T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-11T00:00:00.000Z",
      assessedAt: NOW,
      operatorReviewed: false,
      uses: uses(3),
      components: {
        growth: { value: null, policyAllowed: true, comparable: true, missingReason: "api_failed" },
        recentUsage: measured(0),
      },
    });

    expect(result.componentValues.growth).toBeNull();
    expect(result.missingReasons.growth).toBe("api_failed");
    expect(result.componentValues.recentUsage).toBe(0);
  });

  it("does not score unapproved derived or cross-source components", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2026-10-10T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-11T00:00:00.000Z",
      assessedAt: NOW,
      operatorReviewed: true,
      uses: uses(4),
      components: {
        ...completeComponents,
        growth: { value: 1, policyAllowed: false, comparable: true },
      },
    });

    expect(result.score).toBeNull();
    expect(result.missingReasons.growth).toBe("policy_not_approved");
    expect(result.publicEligible).toBe(false);
  });

  it("does not publish a qualified score before operator review", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2026-10-10T00:00:00.000Z",
      firstDiscoveredAt: "2026-10-11T00:00:00.000Z",
      assessedAt: NOW,
      operatorReviewed: false,
      uses: uses(3),
      components: completeComponents,
    });

    expect(result.state).toBe("rising");
    expect(result.score).not.toBeNull();
    expect(result.publicEligible).toBe(false);
    expect(result.reasons).toContain("operator_review_required");
  });

  it("handles an empty evidence set without fabricating a score", () => {
    const result = assessExternalTrend({
      contentPublishedAt: null,
      firstDiscoveredAt: NOW,
      assessedAt: NOW,
      operatorReviewed: false,
      uses: [],
      components: {},
    });

    expect(result.state).toBe("observing");
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it.each([null, "2026-10-14T00:00:00.000Z"])("does not replace missing or future publication time with discovery time: %s", (publishedAt) => {
    const result = assessExternalTrend({
      contentPublishedAt: publishedAt, firstDiscoveredAt: NOW, assessedAt: NOW,
      operatorReviewed: true, uses: uses(3).map((use) => ({ ...use, publishedAt })),
      components: completeComponents,
    });
    expect(result.state).toBe("observing");
    expect(result.score).toBeNull();
    expect(result.publicEligible).toBe(false);
  });

  it("requires three recent independent creators rather than one recent plus old uses", () => {
    const result = assessExternalTrend({
      contentPublishedAt: "2026-10-10T00:00:00.000Z", firstDiscoveredAt: NOW,
      assessedAt: NOW, operatorReviewed: true,
      uses: [uses(3)[0], ...uses(3, "2020-01-01T00:00:00.000Z").slice(1)],
      components: completeComponents,
    });
    expect(result.state).toBe("observing");
    expect(result.score).toBeNull();
  });

  it("does not count an incomparable metric as available or reweight its score", () => {
    const result = assessExternalTrend({
      contentPublishedAt: NOW, firstDiscoveredAt: NOW, assessedAt: NOW,
      operatorReviewed: true, uses: uses(3),
      components: { ...completeComponents, relativePerformance: { ...measured(1), comparable: false } },
    });
    expect(result.componentValues.relativePerformance).toBeNull();
    expect(result.missingReasons.relativePerformance).toBe("not_comparable");
    expect(result.componentCoverage).toBe(0.8);
    expect(result.score).toBe(59.5);
  });
});
