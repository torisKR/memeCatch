const EMPTY_INDEX_ID = "00000000-0000-0000-0000-000000000000";

export type DiscoveryIndexResult =
  | { ok: true; ids: ReadonlySet<string> }
  | { ok: false };

/**
 * Detail routes already have the row needed to apply the public eligibility
 * predicate. A discovery outage must not turn that healthy document into a
 * temporary noindex; a successful discovery read still constrains the row.
 */
export function detailIndexableFromDiscovery(
  discovery: DiscoveryIndexResult,
  id: string,
  rowIndexable: boolean,
): boolean {
  if (!rowIndexable) return false;
  return discovery.ok ? discovery.ids.has(id) : true;
}

/**
 * Keep a PostgREST list on the discovery id set. Undefined leaves the query
 * unchanged. An empty set matches nothing, so a failed or empty gate cannot
 * fall through to the whole catalog.
 */
export function limitQueryToIds<Q>(
  query: Q,
  indexableIds: readonly string[] | undefined,
): Q {
  if (indexableIds === undefined) return query;
  const builder = query as Q & {
    in: (column: string, values: readonly string[]) => Q;
    eq: (column: string, value: string) => Q;
  };
  if (indexableIds.length === 0) return builder.eq("id", EMPTY_INDEX_ID);
  return builder.in("id", indexableIds);
}
