import type { SafetyLevel } from "@/lib/labels";

export const SAVED_LIBRARY_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 80;

export type SavedLibraryFilters = {
  query: string;
  safety: SafetyLevel | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * `.or()` receives raw PostgREST grammar, so only retain human-searchable
 * Unicode letters/numbers plus whitespace, `_`, and `-` before interpolating
 * it into the title/summary filter.
 */
export function normalizeSavedLibraryQuery(
  value: string | string[] | undefined,
): string {
  return (firstString(value) ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

export function parseSavedLibraryPage(
  value: string | string[] | undefined,
): number {
  const raw = firstString(value);
  if (!raw || !/^\d+$/.test(raw)) return 1;

  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function parseSavedLibraryFilters(
  searchParams: SearchParams,
): SavedLibraryFilters {
  const safety = firstString(searchParams.saved_safety);
  return {
    query: normalizeSavedLibraryQuery(searchParams.saved_q),
    safety:
      safety === "green" ||
      safety === "yellow" ||
      safety === "gray" ||
      safety === "red"
        ? safety
        : null,
    page: parseSavedLibraryPage(searchParams.saved_page),
  };
}

/** Filter parameters do not unlock an entitlement for a free account. */
export function applySavedLibraryEntitlement(
  filters: SavedLibraryFilters,
  isPremium: boolean,
): SavedLibraryFilters {
  return isPremium ? filters : { ...filters, query: "", safety: null };
}

/** A sanitized PostgREST predicate limited to the embedded public meme row. */
export function savedLibraryTitleFilter(query: string): string | null {
  const term = normalizeSavedLibraryQuery(query);
  return term ? `title.ilike.*${term}*,summary.ilike.*${term}*` : null;
}

/** Keep filters and the saved-library anchor stable across pagination/reset links. */
export function savedLibraryHref(
  filters: Pick<SavedLibraryFilters, "query" | "safety">,
  page = 1,
): string {
  const search = new URLSearchParams();
  const query = normalizeSavedLibraryQuery(filters.query);
  if (query) search.set("saved_q", query);
  if (filters.safety) search.set("saved_safety", filters.safety);
  if (page > 1) search.set("saved_page", String(page));

  const serialized = search.toString();
  return `/my${serialized ? `?${serialized}` : ""}#saved`;
}
