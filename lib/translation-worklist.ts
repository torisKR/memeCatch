import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";

export type TranslationWorklistSource = ContentDepthInput & {
  memeId: string;
  shortId: string;
  title: string;
  updatedAt: string;
};

export type TranslationWorklistRow = TranslationWorklistSource & {
  routeUnlockCandidate: boolean;
};

export type TranslationWorklistSortRow = {
  memeId: string;
  updatedAt: string;
  routeUnlockCandidate: boolean;
};

export function classifyTranslationWorklistSource(
  source: TranslationWorklistSource,
): TranslationWorklistRow {
  return {
    ...source,
    routeUnlockCandidate: isIndexableMeme(source),
  };
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortTranslationWorklistRows<T extends TranslationWorklistSortRow>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((left, right) => {
    if (left.routeUnlockCandidate !== right.routeUnlockCandidate) {
      return left.routeUnlockCandidate ? -1 : 1;
    }

    const updatedAtDifference = timestampValue(right.updatedAt) - timestampValue(left.updatedAt);
    if (updatedAtDifference !== 0) return updatedAtDifference;
    return left.memeId.localeCompare(right.memeId);
  });
}

export function prioritizeTranslationWorklistRows<T extends TranslationWorklistSortRow>(
  rows: readonly T[],
  priorityMemeIds: ReadonlySet<string>,
): T[] {
  const sortedRows = sortTranslationWorklistRows(rows);
  if (priorityMemeIds.size === 0) return sortedRows;

  return [
    ...sortedRows.filter((row) => priorityMemeIds.has(row.memeId)),
    ...sortedRows.filter((row) => !priorityMemeIds.has(row.memeId)),
  ];
}

export function missingTranslationPriorityMemeIds(
  rows: readonly {
    memeId: string;
    locale: string;
    translationStatus: string | null;
  }[],
  locale: string,
): string[] {
  return rows
    .filter((row) => row.locale === locale && row.translationStatus === null)
    .map((row) => row.memeId);
}
