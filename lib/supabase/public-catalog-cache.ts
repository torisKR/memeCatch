export const PUBLIC_CATALOG_CACHE_TAG = "public-meme-catalog";

// Keep these projections aligned with lib/queries.ts. Full detail rows never qualify.
const projections = new Set([
  "id,short_id,slug,title,summary,category,safety_level,lifecycle_status,media_type,origin_year,trend_score,meme_contents(thumbnail_url,is_representative),meme_market_profiles(market_code,role,review_state)",
  "id,short_id,slug,title,summary,safety_level,origin_year,trend_score",
]);
const publicStatuses = "in.(approved,limited)";
const boundedLimit = (value: string | null) => value !== null
  && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100;

/** Only bounded, anonymous public list/search GETs share the server Data Cache. */
export function createPublicCatalogFetch(supabaseUrl: string, anonKey: string): typeof fetch {
  const origin = new URL(supabaseUrl).origin;
  return (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const headers = new Headers(init?.headers ?? request?.headers);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const projection = url.searchParams.get("select")?.replace(/\s/g, "") ?? "";
    const list = url.pathname === "/rest/v1/memes"
      && boundedLimit(url.searchParams.get("limit"));
    const query = url.searchParams.get("p_query")?.trim() ?? "";
    const search = url.pathname === "/rest/v1/rpc/search_memes"
      && query.length >= 2 && query.length <= 80
      && boundedLimit(url.searchParams.get("p_limit"));
    const eligible = url.origin === origin && url.href.length <= 4096
      && method === "GET" && (list || search)
      && projections.has(projection)
      && url.searchParams.getAll("moderation_status").length === 1
      && url.searchParams.get("moderation_status") === publicStatuses
      && headers.get("apikey") === anonKey
      && headers.get("authorization") === `Bearer ${anonKey}`
      && (!headers.has("accept-profile") || headers.get("accept-profile") === "public")
      && !headers.has("cookie") && !headers.has("range")
      && !init?.body && !request?.body;
    return fetch(input, {
      ...init,
      cache: eligible ? "force-cache" : "no-store",
      next: eligible ? { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] } : undefined,
    });
  };
}
