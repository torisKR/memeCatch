import type { SearchSuggestion } from "@/components/search-suggest";

export const SEARCH_SUGGESTION_COLUMNS = "id, short_id, slug, title, summary, category";

/** One mounted search input owns this short-lived cache; no persistence or session sharing. */
export function createSearchSuggestionCache() {
  const entries = new Map<string, { items: SearchSuggestion[]; expiresAt: number }>();
  const ttlMs = 30_000;
  const maxEntries = 32;

  return {
    get(query: string): SearchSuggestion[] | undefined {
      const entry = entries.get(query);
      if (!entry) return undefined;
      entries.delete(query);
      if (entry.expiresAt <= Date.now()) return undefined;
      entries.set(query, entry);
      return entry.items;
    },
    set(query: string, items: SearchSuggestion[]) {
      entries.delete(query);
      entries.set(query, { items, expiresAt: Date.now() + ttlMs });
      if (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    },
  };
}
