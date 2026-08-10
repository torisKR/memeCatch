export const TRANSLATION_COVERAGE_LOCALES = [
  "en",
  "ja",
  "zh",
  "zh-tw",
] as const;

export type TranslationCoverageLocale =
  (typeof TRANSLATION_COVERAGE_LOCALES)[number];

export type TranslationCoverageStatus = "machine" | "reviewed" | "stale";

export type PublicMemeRevision = {
  id: string;
  updated_at: string;
};

export type TranslationCoverageRow = {
  meme_id: string;
  locale: string;
  status: TranslationCoverageStatus;
  source_updated_at: string;
};

export type LocaleTranslationCoverage = {
  locale: TranslationCoverageLocale;
  total: number;
  reviewedCurrent: string[];
  machineCurrent: string[];
  stale: string[];
  missing: string[];
  completionPercentage: number;
};

type CoverageBucket = "reviewedCurrent" | "machineCurrent" | "stale";

const COVERAGE_LOCALE_SET = new Set<string>(TRANSLATION_COVERAGE_LOCALES);
const BUCKET_PRIORITY: Record<CoverageBucket, number> = {
  stale: 1,
  machineCurrent: 2,
  reviewedCurrent: 3,
};

function isCoverageLocale(value: string): value is TranslationCoverageLocale {
  return COVERAGE_LOCALE_SET.has(value);
}

function isSameRevision(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime === rightTime
  );
}

function bucketFor(
  row: TranslationCoverageRow,
  memeUpdatedAt: string,
): CoverageBucket {
  if (
    row.status === "stale" ||
    !isSameRevision(row.source_updated_at, memeUpdatedAt)
  ) {
    return "stale";
  }
  return row.status === "reviewed" ? "reviewedCurrent" : "machineCurrent";
}

export function computeTranslationCoverage(
  publicMemes: readonly PublicMemeRevision[],
  translationRows: readonly TranslationCoverageRow[],
): LocaleTranslationCoverage[] {
  const revisionsByMemeId = new Map(
    [...publicMemes]
      .sort((left, right) =>
        left.id === right.id
          ? left.updated_at.localeCompare(right.updated_at)
          : left.id.localeCompare(right.id),
      )
      .map(({ id, updated_at }) => [id, updated_at]),
  );
  const memeIds = [...revisionsByMemeId.keys()].sort();
  const bucketByTranslation = new Map<string, CoverageBucket>();

  for (const row of translationRows) {
    if (!isCoverageLocale(row.locale)) continue;
    const memeUpdatedAt = revisionsByMemeId.get(row.meme_id);
    if (!memeUpdatedAt) continue;

    const key = `${row.locale}\u0000${row.meme_id}`;
    const bucket = bucketFor(row, memeUpdatedAt);
    const existing = bucketByTranslation.get(key);
    if (!existing || BUCKET_PRIORITY[bucket] > BUCKET_PRIORITY[existing]) {
      bucketByTranslation.set(key, bucket);
    }
  }

  return TRANSLATION_COVERAGE_LOCALES.map((locale) => {
    const reviewedCurrent: string[] = [];
    const machineCurrent: string[] = [];
    const stale: string[] = [];
    const missing: string[] = [];

    for (const memeId of memeIds) {
      const bucket = bucketByTranslation.get(`${locale}\u0000${memeId}`);
      switch (bucket) {
        case "reviewedCurrent":
          reviewedCurrent.push(memeId);
          break;
        case "machineCurrent":
          machineCurrent.push(memeId);
          break;
        case "stale":
          stale.push(memeId);
          break;
        default:
          missing.push(memeId);
      }
    }

    return {
      locale,
      total: memeIds.length,
      reviewedCurrent,
      machineCurrent,
      stale,
      missing,
      completionPercentage:
        memeIds.length === 0
          ? 0
          : Math.round((reviewedCurrent.length / memeIds.length) * 100),
    };
  });
}
