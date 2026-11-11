const EMPTY_INDEX_ID = "00000000-0000-0000-0000-000000000000";

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
