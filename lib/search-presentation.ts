type SearchPresentationItem = {
  id: string;
  short_id: string;
};

/** List-display identity only. Do not use this map for routing or canonical URLs. */
const CURATED_CATALOG_EQUIVALENTS: Readonly<Record<string, string>> = {
  oyj2021k: "6hgbgvxs",
};
const CATALOG_EQUIVALENT_SHORT_IDS = new Set(
  Object.values(CURATED_CATALOG_EQUIVALENTS),
);

function isCuratedItem(item: SearchPresentationItem): boolean {
  return item.id.startsWith("curated-");
}

export function searchPresentationKey(item: SearchPresentationItem): string {
  const catalogShortId =
    CURATED_CATALOG_EQUIVALENTS[item.short_id]
    ?? (CATALOG_EQUIVALENT_SHORT_IDS.has(item.short_id)
      ? item.short_id
      : null);

  return catalogShortId ? `catalog:${catalogShortId}` : `short:${item.short_id}`;
}

export function mergeSearchPresentationItems<
  const TGroups extends readonly (readonly SearchPresentationItem[])[],
>(...groups: TGroups): Array<TGroups[number][number]> {
  type Item = TGroups[number][number];
  const items = groups.flat() as Item[];
  const winners = new Map<string, Item>();

  for (const item of items) {
    const key = searchPresentationKey(item);
    const current = winners.get(key);
    if (!current || (isCuratedItem(current) && !isCuratedItem(item))) {
      winners.set(key, item);
    }
  }

  const emitted = new Set<string>();
  return items.filter((item) => {
    const key = searchPresentationKey(item);
    if (emitted.has(key) || winners.get(key) !== item) return false;
    emitted.add(key);
    return true;
  });
}
