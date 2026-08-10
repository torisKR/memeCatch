import { describe, expect, it } from "vitest";
import {
  SAVED_REUSE_RADAR_BUCKET_LIMIT,
  buildSavedReuseRadar,
  type SavedReuseRadarItem,
} from "@/lib/saved-reuse-radar";

function item(
  id: string,
  overrides: Partial<SavedReuseRadarItem> = {},
): SavedReuseRadarItem {
  return {
    id,
    shortId: id,
    slug: id,
    title: id,
    summary: `${id} summary`,
    safetyLevel: "green",
    lifecycleStatus: "rising",
    trendScore: 10,
    savedAt: "2026-08-08T00:00:00.000Z",
    collection: null,
    ...overrides,
  };
}

describe("buildSavedReuseRadar", () => {
  it("keeps ready recommendations strictly green and currently active", () => {
    const radar = buildSavedReuseRadar([
      item("green-rising"),
      item("green-active", { lifecycleStatus: "active" }),
      item("yellow-rising", { safetyLevel: "yellow" }),
      item("green-cooling", { lifecycleStatus: "cooling" }),
      item("red-rising", { safetyLevel: "red" }),
    ]);

    expect(radar.readyNow.map((entry) => entry.id)).toEqual([
      "green-active",
      "green-rising",
    ]);
    expect(radar.checkContext.map((entry) => entry.id)).toEqual([
      "yellow-rising",
    ]);
    expect(radar.archive.map((entry) => entry.id)).toEqual([
      "green-cooling",
      "red-rising",
    ]);
  });

  it("orders a bucket by momentum, then saved recency, and bounds its output", () => {
    const radar = buildSavedReuseRadar([
      item("older", { trendScore: 40, savedAt: "2026-08-01T00:00:00.000Z" }),
      item("newer", { trendScore: 40, savedAt: "2026-08-02T00:00:00.000Z" }),
      item("highest", { trendScore: 99 }),
      item("fourth", { trendScore: 1 }),
    ]);

    expect(radar.readyNow.map((entry) => entry.id)).toEqual([
      "highest",
      "newer",
      "older",
    ]);
    expect(radar.readyNow).toHaveLength(SAVED_REUSE_RADAR_BUCKET_LIMIT);
    expect(radar.total).toBe(4);
  });
});
