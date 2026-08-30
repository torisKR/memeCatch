export const ADMIN_UNSOURCED_FOCUS = "unsourced";
export const ADMIN_UNSOURCED_OVERFETCH = 300;
export const ADMIN_UNSOURCED_LIMIT = 100;

export type AdminMemeQualityFocus = typeof ADMIN_UNSOURCED_FOCUS | null;

export type AdminQualitySource = {
  source_url: string | null;
};

export type AdminQualityQueueRow = {
  id: string;
  trend_score: number;
  meme_sources: AdminQualitySource[] | null;
};

export function parseAdminMemeFocus(value: string | undefined): AdminMemeQualityFocus {
  return value === ADMIN_UNSOURCED_FOCUS ? ADMIN_UNSOURCED_FOCUS : null;
}

export function isUnsourcedQualityRow(row: Pick<AdminQualityQueueRow, "meme_sources">): boolean {
  return !(row.meme_sources ?? []).some((source) => (source.source_url ?? "").trim());
}

export function rankUnsourcedQualityQueue<T extends AdminQualityQueueRow>(
  rows: readonly T[],
  limit = ADMIN_UNSOURCED_LIMIT,
): T[] {
  return rows
    .filter(isUnsourcedQualityRow)
    .sort((a, b) => b.trend_score - a.trend_score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
