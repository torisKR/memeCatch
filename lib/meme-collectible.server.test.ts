import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const mocks = vi.hoisted(() => ({ createStaticClient: vi.fn(), createPublicClient: vi.fn(), motif: vi.fn(), caption: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: mocks.createStaticClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createPublicClient }));
vi.mock("@/lib/meme-collectible-catalog", () => ({ getMemeCardArtDirection: mocks.motif, getMemeCardEditorialCaption: mocks.caption }));

import {
  claimMemeCollectibleCard, getMemeCardAuthenticatedUser, getMemeCardCatalogPage,
  getMemeCardCollectionPage, getMemeCollectibleCard, getOwnedMemeCardIds,
} from "./meme-collectible.server";

type Result = { data?: unknown; error?: unknown; count?: number | null; status?: number };
type Recorded = { table: string; calls: { method: string; args: unknown[] }[] };
function clientFixture(results: Result[]) {
  const records: Recorded[] = [];
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "owner-a", is_anonymous: false } }, error: null });
  const client = {
    auth: { getUser },
    from: vi.fn((table: string) => {
      const record: Recorded = { table, calls: [] };
      records.push(record);
      const result = results.shift();
      if (!result) throw new Error(`Unexpected query: ${table}`);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "not", "in", "ilike", "order", "range", "limit", "upsert", "maybeSingle"]) {
        builder[method] = (...args: unknown[]) => { record.calls.push({ method, args }); return builder; };
      }
      builder.then = (resolve: (result: Result) => unknown) => Promise.resolve({ error: null, ...result }).then(resolve);
      return builder;
    }),
  };
  return { client: client as unknown as SupabaseClient<Database>, records, getUser };
}

const card = {
  id: "mc-0001", card_no: 1, meme_id: "meme-a", edition: 1, art_seed: 42, active: true,
  memes: {
    id: "meme-a", short_id: "abc123", title: "PPAP", slug: "ppap", summary: "A pen and pineapple song",
    category: "song", origin_year: 2016, moderation_status: "approved", safety_level: "green", published_at: "2026-01-01T00:00:00Z",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.motif.mockReturnValue({ motif: "pen-pineapple", symbols: ["pen", "pineapple"], composition: "exchange" });
  mocks.caption.mockReturnValue("Editorially reviewed card caption");
});

describe("collectible card repository", () => {
  it("reads 24 current eligible public cards with canonical links, explicit filters, and a finite cache", async () => {
    const fixture = clientFixture([{ data: [card], count: 1000 }]);
    mocks.createPublicClient.mockReturnValue(fixture.client);
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: [{ id: card.id, meme_id: card.meme_id, memes: { id: card.meme_id } }], count: 1000 }]).client);
    const page = await getMemeCardCatalogPage({ page: 2 });
    expect(page).toMatchObject({ total: 1000, pageSize: 24, hasMore: true, page: 2 });
    expect(page.cards[0]).toMatchObject({ id: "mc-0001", artMotif: "pen-pineapple", thumbnailUrl: null, href: "/memes/abc123-ppap", summary: "Editorially reviewed card caption" });
    expect(JSON.stringify(page)).not.toContain(card.memes.summary);
    expect(fixture.records[0].calls.find((call) => call.method === "select")?.args[0]).not.toContain("summary");
    expect(fixture.records[0].calls).toEqual(expect.arrayContaining([
      { method: "eq", args: ["active", true] }, { method: "eq", args: ["memes.moderation_status", "approved"] },
      { method: "eq", args: ["memes.safety_level", "green"] }, { method: "not", args: ["memes.published_at", "is", null] },
      { method: "range", args: [24, 47] },
    ]));
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    const config = mocks.createPublicClient.mock.calls[0][2];
    await config.global.fetch("https://database.example/rest/v1/meme_collectible_cards", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cache: "force-cache", next: { revalidate: 60, tags: ["meme-collectible-catalog", "public-meme-catalog"] } }));
    vi.unstubAllGlobals();
  });

  it("never exposes primed cached content after a live withdrawal and reconciles the current availability count", async () => {
    mocks.createPublicClient.mockReturnValue(clientFixture([{ data: [card], count: 1 }]).client);
    const fresh = clientFixture([{ data: [], count: 0 }]);
    mocks.createStaticClient.mockReturnValue(fresh.client);
    const page = await getMemeCardCatalogPage({ page: 1 });
    expect(page).toEqual({ cards: [], total: 0, page: 1, pageSize: 24, hasMore: false });
    expect(JSON.stringify(page)).not.toContain(card.memes.title);
    expect(fresh.records[0].calls).toContainEqual({ method: "select", args: ["id,meme_id,memes!inner(id)", { count: "exact" }] });
    expect(fresh.records[0].calls).toContainEqual({ method: "eq", args: ["memes.safety_level", "green"] });
  });

  it("fills shifted live page IDs after withdrawal instead of showing stale cards or stale pagination", async () => {
    const next = { ...card, id: "mc-0002", card_no: 2, meme_id: "meme-b", memes: { ...card.memes, id: "meme-b", title: "Current replacement" } };
    mocks.createPublicClient.mockReturnValue(clientFixture([{ data: [card], count: 25 }]).client);
    const fresh = clientFixture([
      { data: [{ id: next.id, meme_id: next.meme_id, memes: { id: next.meme_id } }], count: 24 },
      { data: [next] },
    ]);
    mocks.createStaticClient.mockReturnValue(fresh.client);
    const page = await getMemeCardCatalogPage({ page: 1 });
    expect(page.total).toBe(24);
    expect(page.hasMore).toBe(false);
    expect(page.cards.map((entry) => entry.id)).toEqual(["mc-0002"]);
    expect(fresh.records[1].calls).toContainEqual({ method: "in", args: ["id", ["mc-0002"]] });
  });

  it("does not fall back to cached publication status when the fresh eligibility query fails", async () => {
    mocks.createPublicClient.mockReturnValue(clientFixture([{ data: [card], count: 1 }]).client);
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: null, error: { message: "eligibility unavailable" } }]).client);
    await expect(getMemeCardCatalogPage({ page: 1 })).rejects.toMatchObject({ status: 503, code: "cards_unavailable" });
  });

  it("does not create cache entries for arbitrary search strings and escapes SQL pattern wildcards", async () => {
    const fixture = clientFixture([{ data: [], count: 0 }]);
    mocks.createStaticClient.mockReturnValue(fixture.client);
    await getMemeCardCatalogPage({ page: 1, query: "100%_", category: "song" });
    expect(mocks.createPublicClient).not.toHaveBeenCalled();
    expect(fixture.records[0].calls).toContainEqual({ method: "ilike", args: ["memes.title", "%100\\%\\_%"] });
  });

  it("treats failed queries and missing counts as failures, never an empty collection", async () => {
    const fixture = clientFixture([{ data: null, error: { message: "secret database failure" } }, { data: [], count: null }]);
    mocks.createPublicClient.mockReturnValue(fixture.client);
    await expect(getMemeCardCatalogPage({ page: 1 })).rejects.toMatchObject({ status: 503, code: "cards_unavailable" });
    await expect(getMemeCardCatalogPage({ page: 1 })).rejects.toMatchObject({ status: 503 });
  });

  it.each([
    { ...card, active: false },
    { ...card, memes: { ...card.memes, published_at: null } },
    { ...card, memes: { ...card.memes, moderation_status: "pending" } },
    { ...card, memes: { ...card.memes, safety_level: "red" } },
  ])("fails closed if a malformed database result contains ineligible content", async (row) => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: row }]).client);
    await expect(getMemeCollectibleCard("mc-0001")).rejects.toMatchObject({ status: 503 });
  });

  it("bounds collection hydration to this owner's visible page and retains private hidden-card placeholders", async () => {
    const owner = clientFixture([{ data: [{ card_id: "mc-0001", created_at: "first" }, { card_id: "mc-0002", created_at: "second" }], count: 49 }]);
    const publicCards = clientFixture([{ data: [card] }]);
    mocks.createStaticClient.mockReturnValue(publicCards.client);
    const page = await getMemeCardCollectionPage(owner.client, "owner-a", { page: 2 });
    expect(owner.records[0].calls).toContainEqual({ method: "eq", args: ["user_id", "owner-a"] });
    expect(owner.records[0].calls).toContainEqual({ method: "range", args: [24, 47] });
    expect(publicCards.records[0].calls).toContainEqual({ method: "in", args: ["id", ["mc-0001", "mc-0002"]] });
    expect(publicCards.records[0].calls).toContainEqual({ method: "limit", args: [24] });
    expect(page.cards[1]).toEqual({ id: "mc-0002", available: false, claimedAt: "second" });
    expect(page.total).toBe(49);
  });

  it("reports hydration failures separately from a genuinely unavailable owned card", async () => {
    const owner = clientFixture([{ data: [{ card_id: "mc-0001", created_at: "first" }], count: 1 }]);
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: null, error: { message: "outage" } }]).client);
    await expect(getMemeCardCollectionPage(owner.client, "owner-a", { page: 1 })).rejects.toMatchObject({ status: 503 });
  });

  it("rejects hidden cards before writing and does not trust operator-visible drafts", async () => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: null }]).client);
    const owner = clientFixture([]);
    await expect(claimMemeCollectibleCard(owner.client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 404 });
    expect(owner.client.from).not.toHaveBeenCalled();
  });

  it("makes repeated claims idempotent and returns the persisted original claim time", async () => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: card }, { data: card }]).client);
    const owner = clientFixture([
      {}, { data: { card_id: "mc-0001", created_at: "original-time" } },
      {}, { data: { card_id: "mc-0001", created_at: "original-time" } },
    ]);
    const first = await claimMemeCollectibleCard(owner.client, "owner-a", "mc-0001");
    const second = await claimMemeCollectibleCard(owner.client, "owner-a", "mc-0001");
    expect(first).toEqual(second);
    expect(first).toEqual({ cardId: "mc-0001", owned: true, claimedAt: "original-time" });
    expect(owner.records[0].calls).toContainEqual({ method: "upsert", args: [{ user_id: "owner-a", card_id: "mc-0001" }, { onConflict: "user_id,card_id", ignoreDuplicates: true }] });
  });

  it.each(["42501", "23503"])("handles eligibility or catalog deletion races without claiming success: %s", async (code) => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: card }]).client);
    const owner = clientFixture([{ error: { code, message: "private raw error" } }]);
    await expect(claimMemeCollectibleCard(owner.client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 409, code: "card_unavailable" });
  });

  it("never claims success after a write or readback database failure", async () => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: card }, { data: card }]).client);
    await expect(claimMemeCollectibleCard(clientFixture([{ error: { code: "XX000" } }]).client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 503 });
    await expect(claimMemeCollectibleCard(clientFixture([{}, { data: null }]).client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 503 });
  });

  it.each(["PGRST301", "PGRST303"])("preserves login recovery when JWT expires after getUser: %s", async (code) => {
    mocks.createStaticClient.mockReturnValue(clientFixture([{ data: card }, { data: card }]).client);
    await expect(claimMemeCollectibleCard(clientFixture([{ error: { code }, status: 401 }]).client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 401, code: "signed_out" });
    await expect(claimMemeCollectibleCard(clientFixture([{}, { data: null, error: { code }, status: 401 }]).client, "owner-a", "mc-0001")).rejects.toMatchObject({ status: 401, code: "signed_out" });
    await expect(getMemeCardCollectionPage(clientFixture([{ data: null, error: { code }, status: 401 }]).client, "owner-a", { page: 1 })).rejects.toMatchObject({ status: 401, code: "signed_out" });
    await expect(getOwnedMemeCardIds(clientFixture([{ data: null, error: { code }, status: 401 }]).client, "owner-a", ["mc-0001"])).rejects.toMatchObject({ status: 401, code: "signed_out" });
  });

  it("never uses a supplied user id or anonymous session as authentication", async () => {
    const owner = clientFixture([]);
    owner.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(getMemeCardAuthenticatedUser(owner.client)).rejects.toMatchObject({ status: 401 });
    owner.getUser.mockResolvedValueOnce({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    await expect(getMemeCardAuthenticatedUser(owner.client)).rejects.toMatchObject({ status: 401 });
    owner.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status: 503, message: "outage" } });
    await expect(getMemeCardAuthenticatedUser(owner.client)).rejects.toMatchObject({ status: 503 });
    expect(owner.getUser).toHaveBeenCalledTimes(3);
  });

  it("bounds ownership badge queries and filters them to the verified owner", async () => {
    const owner = clientFixture([{ data: [{ card_id: "mc-0001" }] }]);
    expect(await getOwnedMemeCardIds(owner.client, "owner-a", ["mc-0001"])).toEqual(["mc-0001"]);
    expect(owner.records[0].calls).toContainEqual({ method: "eq", args: ["user_id", "owner-a"] });
    await expect(getOwnedMemeCardIds(owner.client, "owner-b", Array(25).fill("mc-0001"))).rejects.toMatchObject({ status: 400 });
    await expect(getMemeCardCatalogPage({ page: 43 })).rejects.toMatchObject({ status: 400 });
  });
});
