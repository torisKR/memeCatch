export type CatalogRead = "row" | "empty" | "error";

export type DetailBody = "document" | "missing" | "outage";

export type DetailHttpState = {
  status: 200 | 404;
  body: DetailBody;
  /**
   * The HTTP document is rendered for this request.
   * A success, a miss, and an outage are not stored as one another's response.
   */
  storedSuccess: false;
};

/**
 * Detail-page states for one public short id.
 *
 * - row: 200 document
 * - empty, and a curated card exists for the id: 200 curated document
 * - empty, and no curated card: 404 missing
 * - error, and a curated card exists: 200 curated document (the provider error is not a miss)
 * - error, and no curated card: 200 outage, never 404
 *
 * Today's route is force-dynamic, so none of these HTTP responses is stored.
 * A later catalog data cache may store a row. It must not store an error,
 * and an error must not replace a stored row. An empty read is a miss, not an outage.
 */
export function detailHttpState(read: CatalogRead, curated: boolean): DetailHttpState {
  if (read === "row" || curated) {
    return { status: 200, body: "document", storedSuccess: false };
  }
  if (read === "error") {
    return { status: 200, body: "outage", storedSuccess: false };
  }
  if (read === "empty") {
    return { status: 404, body: "missing", storedSuccess: false };
  }
  const unreachable: never = read;
  return unreachable;
}

/** Only a successful row may enter the catalog data cache. */
export function detailDataCacheStores(read: CatalogRead): boolean {
  return read === "row";
}
