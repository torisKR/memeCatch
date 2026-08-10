import { describe, expect, it } from "vitest";
import {
  computeTranslationCoverage,
  TRANSLATION_COVERAGE_LOCALES,
  type PublicMemeRevision,
  type TranslationCoverageRow,
} from "@/lib/translation-coverage";

const publicMemes: PublicMemeRevision[] = [
  { id: "meme-c", updated_at: "2026-08-09T03:00:00.000Z" },
  { id: "meme-a", updated_at: "2026-08-09T01:00:00.000Z" },
  { id: "meme-d", updated_at: "2026-08-09T04:00:00.000Z" },
  { id: "meme-b", updated_at: "2026-08-09T02:00:00.000Z" },
];

function translation(
  memeId: string,
  locale: string,
  status: TranslationCoverageRow["status"],
  sourceUpdatedAt: string,
): TranslationCoverageRow {
  return {
    meme_id: memeId,
    locale,
    status,
    source_updated_at: sourceUpdatedAt,
  };
}

describe("computeTranslationCoverage", () => {
  it("builds mutually exclusive public-locale buckets and completion percentages", () => {
    const rows: TranslationCoverageRow[] = [
      translation("meme-a", "en", "reviewed", "2026-08-09T01:00:00.000Z"),
      translation("meme-b", "en", "machine", "2026-08-09T02:00:00.000Z"),
      translation("meme-c", "en", "reviewed", "2026-08-08T03:00:00.000Z"),
      translation("meme-d", "en", "stale", "2026-08-09T04:00:00.000Z"),
      translation("meme-a", "ja", "reviewed", "2026-08-09T10:00:00+09:00"),
      translation("private-meme", "ja", "reviewed", "2026-08-09T00:00:00.000Z"),
      translation("meme-a", "ko", "reviewed", "2026-08-09T01:00:00.000Z"),
    ];

    const coverage = computeTranslationCoverage(publicMemes, rows);

    expect(coverage.map(({ locale }) => locale)).toEqual(TRANSLATION_COVERAGE_LOCALES);
    expect(coverage[0]).toEqual({
      locale: "en",
      total: 4,
      reviewedCurrent: ["meme-a"],
      machineCurrent: ["meme-b"],
      stale: ["meme-c", "meme-d"],
      missing: [],
      completionPercentage: 25,
    });
    expect(coverage[1]).toEqual({
      locale: "ja",
      total: 4,
      reviewedCurrent: ["meme-a"],
      machineCurrent: [],
      stale: [],
      missing: ["meme-b", "meme-c", "meme-d"],
      completionPercentage: 25,
    });
    expect(coverage[2].missing).toEqual(["meme-a", "meme-b", "meme-c", "meme-d"]);
    expect(coverage[3].missing).toEqual(["meme-a", "meme-b", "meme-c", "meme-d"]);
  });

  it("is deterministic for duplicate and reordered inputs", () => {
    const rows: TranslationCoverageRow[] = [
      translation("meme-a", "en", "machine", "2026-08-09T01:00:00.000Z"),
      translation("meme-a", "en", "reviewed", "2026-08-09T01:00:00.000Z"),
      translation("meme-b", "en", "reviewed", "not-a-timestamp"),
    ];

    const forward = computeTranslationCoverage(publicMemes, rows);
    const reversed = computeTranslationCoverage([...publicMemes].reverse(), [...rows].reverse());

    expect(reversed).toEqual(forward);
    expect(forward[0].reviewedCurrent).toEqual(["meme-a"]);
    expect(forward[0].stale).toEqual(["meme-b"]);
  });

  it("returns zero percent when there are no public memes", () => {
    const coverage = computeTranslationCoverage([], []);

    expect(coverage).toHaveLength(TRANSLATION_COVERAGE_LOCALES.length);
    expect(coverage.every(({ total, completionPercentage }) => total === 0 && completionPercentage === 0)).toBe(true);
  });
});
