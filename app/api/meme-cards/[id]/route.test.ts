import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ staticClient: vi.fn(), authClient: vi.fn(), cachedClient: vi.fn(), editorial: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: mocks.staticClient, createClient: mocks.authClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.cachedClient }));
vi.mock("@/lib/meme-collectible-catalog", () => ({ getAlignedMemeCardEditorialPresentation: mocks.editorial }));

import { GET } from "./route";

const row = {
  id: "mc-0001", card_no: 1, meme_id: "meme-a", edition: 1, art_seed: 42, active: true,
  memes: {
    id: "meme-a", short_id: "abc123", title: "PPAP", slug: "ppap", summary: "Live PPAP summary", category: "song", origin_year: 2016,
    moderation_status: "approved", safety_level: "green", published_at: "2026-01-01T00:00:00Z",
  },
};

function publicQuery(result: { data: unknown; error?: unknown }) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ error: null, ...result }),
  };
  const client = { from: vi.fn().mockReturnValue(query), auth: { getUser: vi.fn() } };
  mocks.staticClient.mockReturnValue(client);
  return { query, client };
}

function requestCard(id = "mc-0001") {
  return GET(new Request(`https://catchmeme.com/api/meme-cards/${encodeURIComponent(id)}`), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.editorial.mockReturnValue({
    art: { motif: "pen-pineapple", symbols: ["pen", "pineapple"], composition: "exchange" },
    caption: "Reviewed reveal caption",
  });
});

describe("anonymous meme card reveal endpoint", () => {
  it("reveals a current eligible card using a fresh anonymous lookup without authentication", async () => {
    const { client, query } = publicQuery({ data: row });
    const response = await requestCard();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ card: {
      id: "mc-0001", cardNo: 1, edition: 1, artSeed: 42, memeId: "meme-a", title: "PPAP", slug: "ppap",
      href: "/memes/abc123-ppap", summary: "Reviewed reveal caption", category: "song", originYear: 2016,
      thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "pineapple"], artComposition: "exchange",
    } });
    expect(client.from).toHaveBeenCalledWith("meme_collectible_cards");
    expect(query.eq.mock.calls).toEqual([
      ["active", true], ["memes.moderation_status", "approved"], ["memes.safety_level", "green"], ["id", "mc-0001"],
    ]);
    expect(query.not).toHaveBeenCalledWith("memes.published_at", "is", null);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.staticClient).toHaveBeenCalledOnce();
    expect(mocks.authClient).not.toHaveBeenCalled();
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(mocks.cachedClient).not.toHaveBeenCalled();
  });

  it.each(["mc-0000", "mc-1001", "mc-1", "not-a-card", "mc-0001/claim"])("rejects invalid IDs before querying: %s", async (id) => {
    const response = await requestCard(id);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "invalid_input" });
    expect(mocks.staticClient).not.toHaveBeenCalled();
    expect(mocks.authClient).not.toHaveBeenCalled();
  });

  it("returns no card data when the current eligible card is unavailable", async () => {
    publicQuery({ data: null });
    const response = await requestCard();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "card_unavailable" });
    expect(mocks.editorial).not.toHaveBeenCalled();
  });

  it("checks current eligibility again after a previously revealed card is withdrawn", async () => {
    const { query } = publicQuery({ data: row });
    expect((await requestCard()).status).toBe(200);
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const response = await requestCard();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "card_unavailable" });
    expect(mocks.staticClient).toHaveBeenCalledTimes(2);
    expect(query.maybeSingle).toHaveBeenCalledTimes(2);
    expect(mocks.cachedClient).not.toHaveBeenCalled();
  });

  it.each([
    { ...row, active: false },
    { ...row, memes: { ...row.memes, moderation_status: "pending" } },
    { ...row, memes: { ...row.memes, safety_level: "red" } },
    { ...row, memes: { ...row.memes, published_at: null } },
  ])("fails closed without leaking content if a malformed service result contains ineligible data", async (data) => {
    publicQuery({ data });
    const response = await requestCard();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "cards_unavailable" });
  });

  it("bounds database errors without exposing private service details", async () => {
    publicQuery({ data: null, error: { code: "XX000", message: "secret database connection details" } });
    const response = await requestCard();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "cards_unavailable" });
  });

  it("bounds unexpected failures without returning exception messages", async () => {
    mocks.staticClient.mockImplementationOnce(() => { throw new Error("secret service configuration"); });
    const response = await requestCard();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cards_unavailable" });
  });
});
