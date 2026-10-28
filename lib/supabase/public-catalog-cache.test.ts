import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LIST_SELECT } from "@/lib/queries";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createPublicCatalogFetch, PUBLIC_CATALOG_CACHE_TAG } from "./public-catalog-cache";

vi.mock("@/lib/supabase/server", () => ({ createStaticClient: vi.fn() }));
const headers = { apikey: "anon-key", authorization: "Bearer anon-key" };
const endpoint = "https://test.supabase.co/rest/v1/memes";
const params = { select: LIST_SELECT.replace(/\s/g, ""), moderation_status: "in.(approved,limited)", limit: "6" };
const url = (changes: Record<string, string> = {}) => `${endpoint}?${new URLSearchParams({ ...params, ...changes })}`;
afterEach(() => vi.unstubAllGlobals());

describe("public catalog Data Cache boundary", () => {
  it("admits the actual Supabase SDK list and GET RPC request formats", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("[]", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const supabase = createSupabaseClient("https://test.supabase.co", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: createPublicCatalogFetch("https://test.supabase.co", "anon-key") },
    });
    expect((await supabase.from("memes").select(LIST_SELECT).in("moderation_status", ["approved", "limited"]).limit(6)).error).toBeNull();
    expect((await supabase.rpc("search_memes", { p_query: "한국 밈", p_limit: 20 }, { get: true }).select(LIST_SELECT).in("moderation_status", ["approved", "limited"])).error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of fetch.mock.calls) {
      expect(options).toMatchObject({ method: "GET", cache: "force-cache", next: { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] } });
    }
  });
  it("caches bounded public list projections with a shared invalidation tag", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await createPublicCatalogFetch("https://test.supabase.co", "anon-key")(url(), { headers });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      cache: "force-cache", next: { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] },
    });
  });

  it("caches a GET search while preserving its query-specific URL", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    const search = url({ p_query: "한국 밈", p_limit: "20" }).replace("/memes?", "/rpc/search_memes?");
    await createPublicCatalogFetch("https://test.supabase.co", "anon-key")(new Request(search, { headers }));
    expect(fetch.mock.calls[0][0].url).toBe(search);
    expect(fetch.mock.calls[0][1].cache).toBe("force-cache");
  });

  it("caches only the bounded public trend projection and its approved meme lookup", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("[]", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const supabase = createSupabaseClient("https://test.supabase.co", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: createPublicCatalogFetch("https://test.supabase.co", "anon-key") },
    });
    const memeId = "11111111-1111-4111-8111-111111111111";
    await supabase
      .from("public_meme_trend_summaries")
      .select("meme_id, external_state, reason, evidence_scope, independent_use_count, external_score, confidence, evidence_links, last_verified_at, stale_after")
      .eq("meme_id", memeId)
      .maybeSingle();
    await supabase
      .from("memes")
      .select("id, short_id, slug, title, summary, moderation_status")
      .in("id", [memeId])
      .eq("moderation_status", "approved");

    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, options] of fetch.mock.calls) {
      expect(options).toMatchObject({
        method: "GET",
        cache: "force-cache",
        next: { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] },
      });
    }
  });

  it("caches the reviewed produced-video public projection used by static meme details", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("[]", { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const supabase = createSupabaseClient("https://test.supabase.co", "anon-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: createPublicCatalogFetch("https://test.supabase.co", "anon-key") },
    });
    await supabase
      .from("public_meme_produced_videos")
      .select("meme_id, production_id, youtube_video_id, content_id, caption, privacy_status, site_linked_at, public_embed_verified, video_name, video_description, video_thumbnail_url, video_upload_date")
      .eq("meme_id", "11111111-1111-4111-8111-111111111111")
      .order("site_linked_at", { ascending: false });

    expect(fetch.mock.calls[0][1]).toMatchObject({
      cache: "force-cache",
      next: { revalidate: 60, tags: [PUBLIC_CATALOG_CACHE_TAG] },
    });
  });

  it.each([
    [url({ select: "*,meme_contents(*)" }), { headers }],
    [url({ moderation_status: "in.(pending,approved)" }), { headers }],
    [url({ moderation_status: "" }), { headers }],
    [url({ limit: "101" }), { headers }],
    [url({ limit: "0" }), { headers }],
    [url({ limit: "" }), { headers }],
    [url(), { headers: { ...headers, authorization: "Bearer user-token" } }],
    [url(), { headers: { ...headers, cookie: "session=private" } }],
    [url(), { headers: { ...headers, "accept-profile": "private" } }],
    [url(), { headers: { ...headers, range: "0-1000" } }],
    [url(), { headers, method: "HEAD" }],
    [url(), { headers, method: "POST", body: "{}" }],
    [url().replace("test.supabase.co", "other.supabase.co"), { headers }],
    [url().replace("/memes?", "/meme_translations?"), { headers }],
    [url(), {}],
    [url() + "&moderation_status=in.(pending)", { headers }],
  ])("bypasses private, unbounded, detail or mutation requests", async (input, init) => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await createPublicCatalogFetch("https://test.supabase.co", "anon-key")(input, init);
    expect(fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
    expect(fetch.mock.calls[0][1].next).toBeUndefined();
  });

  it.each(["a", "x".repeat(81)])("does not admit one-character or oversized search keys", async (query) => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetch);
    await createPublicCatalogFetch("https://test.supabase.co", "anon-key")(
      url({ p_query: query, p_limit: "20" }).replace("/memes?", "/rpc/search_memes?"), { headers },
    );
    expect(fetch.mock.calls[0][1].cache).toBe("no-store");
  });

  it("preserves upstream failures instead of caching an empty fallback", async () => {
    const response = new Response("unavailable", { status: 503 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    expect(await createPublicCatalogFetch("https://test.supabase.co", "anon-key")(url(), { headers })).toBe(response);
  });
});
