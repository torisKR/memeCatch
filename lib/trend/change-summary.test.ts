import { describe, expect, it } from "vitest";
import { buildTrendChangeSummaries } from "./change-summary";

describe("buildTrendChangeSummaries", () => {
  it("describes observed 30 and 90 day movement without causal inference", () => {
    const points = [
      { date: "2026-05-21", trend_score: 50, views: 1, reactions: 1, saves: 0 },
      { date: "2026-07-20", trend_score: 30, views: 2, reactions: 2, saves: 1 },
      { date: "2026-08-18", trend_score: 60, views: 3, reactions: 4, saves: 2 },
    ];

    expect(buildTrendChangeSummaries(points)).toEqual([
      expect.objectContaining({ days: 30, direction: "up", confidence: "low", sampleCount: 2, coveragePercent: 7, lastObservedAt: "2026-08-18", startScore: 30, endScore: 60, views: 5, reactions: 6, saves: 3 }),
      expect.objectContaining({ days: 90, direction: "up", confidence: "low", sampleCount: 3, coveragePercent: 3, lastObservedAt: "2026-08-18", startScore: 50, endScore: 60, views: 6, reactions: 7, saves: 3 }),
    ]);
  });

  it("marks a window insufficient instead of manufacturing a reason", () => {
    expect(buildTrendChangeSummaries([
      { date: "2026-08-18", trend_score: 60, views: 3, reactions: 4, saves: 2 },
    ]).map((summary) => [summary.direction, summary.confidence])).toEqual([
      ["insufficient", "insufficient"],
      ["insufficient", "insufficient"],
    ]);
  });

  it("reports absent windows as insufficient with no fabricated update time", () => {
    expect(buildTrendChangeSummaries([])).toEqual([
      expect.objectContaining({ days: 30, direction: "insufficient", confidence: "insufficient", sampleCount: 0, coveragePercent: 0, lastObservedAt: null }),
      expect.objectContaining({ days: 90, direction: "insufficient", confidence: "insufficient", sampleCount: 0, coveragePercent: 0, lastObservedAt: null }),
    ]);
  });
});
