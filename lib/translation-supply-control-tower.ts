import {
  SEO_CONTENT_LOCALES,
  type SeoContentLocale,
} from "@/lib/i18n-routing";

export type TranslationSupplyCoverageInput = {
  locale: SeoContentLocale;
  totalPublic: number;
  reviewedCurrent: number;
  reviewNeeded: number;
  stale: number;
  missing: number;
  completionPercentage: number;
};

export type TranslationSupplyPriorityInput = {
  memeId: string;
  locale: SeoContentLocale;
  requestCount: number;
  latestRequestedAt: string;
  status: "requested" | "in_review";
  memeTitle: string;
  memeShortId: string;
  memeSlug: string;
  translationStatus: string | null;
  translationUpdatedAt: string | null;
  sourceUpdatedAt: string | null;
  routeUnlockCandidate: boolean;
};

export type TranslationSupplyNextAction =
  | "plus_missing"
  | "plus_review"
  | "review"
  | "stale"
  | "missing"
  | "ready";

export type TranslationSupplyTowerRow = TranslationSupplyCoverageInput & {
  requestCount: number;
  missingRequestCount: number;
  reviewRequestCount: number;
  nextAction: TranslationSupplyNextAction;
  nextActionCount: number;
  priorityRows: TranslationSupplyPriorityInput[];
};

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortTranslationSupplyPriorityRows<
  T extends TranslationSupplyPriorityInput,
>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    if (left.routeUnlockCandidate !== right.routeUnlockCandidate) {
      return left.routeUnlockCandidate ? -1 : 1;
    }

    const leftMissing = left.translationStatus === null;
    const rightMissing = right.translationStatus === null;
    if (leftMissing !== rightMissing) return leftMissing ? -1 : 1;

    if (right.requestCount !== left.requestCount) {
      return right.requestCount - left.requestCount;
    }

    const latestRequestedAtDifference =
      timestampValue(right.latestRequestedAt) - timestampValue(left.latestRequestedAt);
    if (latestRequestedAtDifference !== 0) return latestRequestedAtDifference;

    const memeIdDifference = left.memeId.localeCompare(right.memeId);
    if (memeIdDifference !== 0) return memeIdDifference;
    return left.locale.localeCompare(right.locale);
  });
}

function nextActionFor(
  coverage: TranslationSupplyCoverageInput,
  missingRequestCount: number,
  reviewRequestCount: number,
): { nextAction: TranslationSupplyNextAction; nextActionCount: number } {
  if (missingRequestCount > 0) {
    return { nextAction: "plus_missing", nextActionCount: missingRequestCount };
  }
  if (reviewRequestCount > 0) {
    return { nextAction: "plus_review", nextActionCount: reviewRequestCount };
  }
  if (coverage.reviewNeeded > 0) {
    return { nextAction: "review", nextActionCount: coverage.reviewNeeded };
  }
  if (coverage.stale > 0) {
    return { nextAction: "stale", nextActionCount: coverage.stale };
  }
  if (coverage.missing > 0) {
    return { nextAction: "missing", nextActionCount: coverage.missing };
  }
  return { nextAction: "ready", nextActionCount: 0 };
}

export function buildTranslationSupplyTower(
  coverageRows: readonly TranslationSupplyCoverageInput[],
  priorityRows: readonly TranslationSupplyPriorityInput[],
): TranslationSupplyTowerRow[] {
  const prioritiesByLocale = new Map<SeoContentLocale, TranslationSupplyPriorityInput[]>();
  for (const row of priorityRows) {
    const rows = prioritiesByLocale.get(row.locale) ?? [];
    rows.push(row);
    prioritiesByLocale.set(row.locale, rows);
  }

  const coverageByLocale = new Map(coverageRows.map((row) => [row.locale, row]));
  return SEO_CONTENT_LOCALES.flatMap((locale) => {
    const coverage = coverageByLocale.get(locale);
    if (!coverage) return [];

    const localePriorityRows = sortTranslationSupplyPriorityRows(
      prioritiesByLocale.get(locale) ?? [],
    );
    const missingRequestCount = localePriorityRows
      .filter((row) => row.translationStatus === null)
      .reduce((total, row) => total + row.requestCount, 0);
    const reviewRequestCount = localePriorityRows
      .filter((row) => row.translationStatus !== null)
      .reduce((total, row) => total + row.requestCount, 0);
    const requestCount = missingRequestCount + reviewRequestCount;
    const { nextAction, nextActionCount } = nextActionFor(
      coverage,
      missingRequestCount,
      reviewRequestCount,
    );

    return [
      {
        ...coverage,
        requestCount,
        missingRequestCount,
        reviewRequestCount,
        nextAction,
        nextActionCount,
        priorityRows: localePriorityRows,
      },
    ];
  });
}
