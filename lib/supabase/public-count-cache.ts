export const PUBLIC_COUNT_CACHE_TAG = "public-social-platform-counts";

/** 공개 집계 RPC 한 개만 캐시한다. 세션·행 데이터·다른 RPC는 항상 우회한다. */
export function createPublicCountFetch(supabaseUrl: string, anonKey: string): typeof fetch {
  const endpoint = new URL("/rest/v1/rpc/get_social_platform_counts", supabaseUrl).href;
  return (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const headers = new Headers(init?.headers ?? request?.headers);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const eligible = `${url.origin}${url.pathname}` === endpoint
      && method === "GET"
      && headers.get("apikey") === anonKey
      && headers.get("authorization") === `Bearer ${anonKey}`
      && !headers.has("cookie")
      && !init?.body && !request?.body;
    const options: RequestInit = { ...init, cache: "no-store", next: undefined };
    if (eligible) {
      options.cache = "force-cache";
      options.next = { revalidate: 300, tags: [PUBLIC_COUNT_CACHE_TAG] };
    }
    return fetch(input, options);
  };
}
