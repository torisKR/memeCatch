import { describe, expect, it } from "vitest";
import {
  buildTranslationSupplyTower,
  sortTranslationSupplyPriorityRows,
  type TranslationSupplyCoverageInput,
  type TranslationSupplyPriorityInput,
} from "@/lib/translation-supply-control-tower";

const COVERAGE: TranslationSupplyCoverageInput[] = [
  {
    locale: "en",
    totalPublic: 10,
    reviewedCurrent: 4,
    reviewNeeded: 2,
    stale: 1,
    missing: 3,
    completionPercentage: 40,
  },
  {
    locale: "ja",
    totalPublic: 10,
    reviewedCurrent: 7,
    reviewNeeded: 3,
    stale: 0,
    missing: 0,
    completionPercentage: 70,
  },
  {
    locale: "zh",
    totalPublic: 10,
    reviewedCurrent: 8,
    reviewNeeded: 0,
    stale: 2,
    missing: 0,
    completionPercentage: 80,
  },
  {
    locale: "zh-tw",
    totalPublic: 10,
    reviewedCurrent: 10,
    reviewNeeded: 0,
    stale: 0,
    missing: 0,
    completionPercentage: 100,
  },
];

function priority(
  overrides: Partial<TranslationSupplyPriorityInput> = {},
): TranslationSupplyPriorityInput {
  return {
    memeId: "meme-1",
    locale: "en",
    requestCount: 3,
    latestRequestedAt: "2026-08-10T01:00:00.000Z",
    status: "requested",
    memeTitle: "원문 제목",
    memeShortId: "MC-0001",
    memeSlug: "source-slug",
    translationStatus: null,
    translationUpdatedAt: null,
    sourceUpdatedAt: null,
    routeUnlockCandidate: false,
    ...overrides,
  };
}

describe("buildTranslationSupplyTower", () => {
  it("prioritizes Plus missing supply and preserves every locale's next action", () => {
    const rows = buildTranslationSupplyTower(COVERAGE, [
      priority({ memeId: "thin-meme", requestCount: 20 }),
      priority({
        memeId: "route-meme",
        requestCount: 2,
        routeUnlockCandidate: true,
      }),
      priority({
        memeId: "ja-existing",
        locale: "ja",
        translationStatus: "machine",
        requestCount: 1,
        status: "in_review",
      }),
    ]);

    expect(rows.map((row) => [row.locale, row.nextAction])).toEqual([
      ["en", "plus_missing"],
      ["ja", "plus_review"],
      ["zh", "stale"],
      ["zh-tw", "ready"],
    ]);
    expect(rows[0].requestCount).toBe(22);
    expect(rows[0].missingRequestCount).toBe(22);
    expect(rows[1].reviewRequestCount).toBe(1);
  });

  it("sorts route-unlock candidates before demand volume with deterministic ties", () => {
    const rows = sortTranslationSupplyPriorityRows([
      priority({ memeId: "z", requestCount: 99, routeUnlockCandidate: false }),
      priority({ memeId: "b", requestCount: 1, routeUnlockCandidate: true }),
      priority({ memeId: "a", requestCount: 1, routeUnlockCandidate: true }),
    ]);

    expect(rows.map((row) => row.memeId)).toEqual(["a", "b", "z"]);
  });
});
