import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicCountFetch, PUBLIC_COUNT_CACHE_TAG } from "./public-count-cache";

const endpoint = "https://test.supabase.co/rest/v1/rpc/get_social_platform_counts";
const headers = { apikey: "anon-key", authorization: "Bearer anon-key" };
afterEach(() => vi.unstubAllGlobals());

describe("public count fetch cache boundary", () => {
  it("opts only anonymous GET aggregate responses into the Next Data Cache", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await createPublicCountFetch("https://test.supabase.co", "anon-key")(endpoint, { headers });
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      cache: "force-cache", next: { revalidate: 300, tags: [PUBLIC_COUNT_CACHE_TAG] },
    }));
  });

  it.each([
    [endpoint, { headers: { ...headers, authorization: "Bearer user-token" } }],
    [endpoint, { headers: { ...headers, cookie: "session=private" } }],
    [endpoint, { headers, method: "POST", body: "{}" }],
    [endpoint.replace("get_social_platform_counts", "is_operator"), { headers }],
    [endpoint.replace("test.supabase.co", "other.supabase.co"), { headers }],
    ["https://test.supabase.co/rest/v1/memes", { headers }],
    [endpoint, {}],
  ])("never caches authenticated, cookie, mutation or other data requests", async (url, init) => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await createPublicCountFetch("https://test.supabase.co", "anon-key")(url, init);
    expect(fetch).toHaveBeenCalledWith(url, expect.objectContaining({ cache: "no-store" }));
    expect(fetch.mock.calls[0][1].next).toBeUndefined();
  });

  it("recognizes Request input headers and preserves provider errors for the caller", async () => {
    const response = new Response("unavailable", { status: 503 });
    const fetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetch);
    const request = new Request(endpoint, { headers });
    expect(await createPublicCountFetch("https://test.supabase.co", "anon-key")(request)).toBe(response);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: "force-cache" });
    // Next's fetch stores only HTTP 200; this layer does not cache fallback values.
  });
});
