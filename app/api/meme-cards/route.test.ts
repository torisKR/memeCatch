import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ claim: vi.fn(), catalog: vi.fn(), collection: vi.fn(), owned: vi.fn(), user: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/meme-collectible.server", () => ({
  claimMemeCollectibleCard: mocks.claim, getMemeCardCatalogPage: mocks.catalog,
  getMemeCardCollectionPage: mocks.collection, getOwnedMemeCardIds: mocks.owned,
  getMemeCardAuthenticatedUser: mocks.user,
  MemeCardServiceError: class extends Error {
    constructor(public status: number, public code: string) { super(code); }
  },
}));

import { MemeCardServiceError } from "@/lib/meme-collectible.server";
import { GET } from "./route";
import { GET as collectionGET } from "./collection/route";
import { POST } from "./claim/route";

function claimRequest(body: unknown, origin = "https://catchmeme.com") {
  return new Request("https://catchmeme.com/api/meme-cards/claim", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ marker: "cookie-client" });
  mocks.user.mockResolvedValue({ id: "verified-owner" });
  mocks.claim.mockResolvedValue({ cardId: "mc-0001", owned: true, claimedAt: "persisted-time" });
  mocks.collection.mockResolvedValue({ cards: [], total: 0, page: 1, pageSize: 24, hasMore: false });
  mocks.owned.mockResolvedValue(["mc-0001"]);
  mocks.catalog.mockResolvedValue({ cards: [], total: 0, page: 1, pageSize: 24, hasMore: false });
});

describe("meme card APIs", () => {
  it("blocks cross-origin claims before authenticating or writing", async () => {
    expect((await POST(claimRequest({ cardId: "mc-0001" }, "https://attacker.example"))).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each([
    { cardId: "mc-0000" }, { cardId: "mc-1001" }, { cardId: "mc-1" }, { cardId: "mc-0001", userId: "other-user" },
    { cardId: "mc-0001", revealed: true }, { cardId: "mc-0001", createdAt: "spoofed" }, null, [],
  ])("rejects invalid card identity, IDOR fields, and client scratch assertions", async (body) => {
    expect((await POST(claimRequest(body))).status).toBe(400);
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("bounds actual streamed body bytes even without a content-length header", async () => {
    expect((await POST(claimRequest({ cardId: "mc-0001", padding: "a".repeat(1200) }))).status).toBe(413);
    expect(mocks.user).not.toHaveBeenCalled();
  });

  it("requires verified authentication and returns a private, idempotent persisted ownership result", async () => {
    mocks.user.mockRejectedValueOnce(new MemeCardServiceError(401, "signed_out"));
    expect((await POST(claimRequest({ cardId: "mc-0001" }))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
    const response = await POST(claimRequest({ cardId: "mc-0001" }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.claim).toHaveBeenCalledWith({ marker: "cookie-client" }, "verified-owner", "mc-0001");
    expect(await response.json()).toEqual({ cardId: "mc-0001", owned: true, claimedAt: "persisted-time" });
  });

  it.each([404, 409, 503])("preserves safe claim failure status without leaking database details: %s", async (status) => {
    mocks.claim.mockRejectedValueOnce(new MemeCardServiceError(status, "card_unavailable"));
    expect((await POST(claimRequest({ cardId: "mc-0001" }))).status).toBe(status);
  });

  it("sanitizes unexpected failures and never returns owned success", async () => {
    mocks.claim.mockRejectedValueOnce(new Error("secret connection string"));
    const response = await POST(claimRequest({ cardId: "mc-0001" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cards_unavailable" });
  });

  it("does not silently return an empty collection on a database outage", async () => {
    mocks.collection.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await collectionGET(new Request("https://catchmeme.com/api/meme-cards/collection?page=1"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("scopes private ownership badges to the verified user and <=24 card IDs", async () => {
    const response = await collectionGET(new Request("https://catchmeme.com/api/meme-cards/collection?cardIds=mc-0001,mc-0002"));
    expect(mocks.owned).toHaveBeenCalledWith({ marker: "cookie-client" }, "verified-owner", ["mc-0001", "mc-0002"]);
    expect(await response.json()).toEqual({ ownedCardIds: ["mc-0001"] });
    expect((await collectionGET(new Request("https://catchmeme.com/api/meme-cards/collection?userId=someone"))).status).toBe(400);
  });

  it.each(["page=43", "page=-1", "page=01", "page=1&page=2", "category=unknown", `query=${"a".repeat(81)}`, "userId=other"])("rejects unbounded or ambiguous public parameters: %s", async (params) => {
    expect((await GET(new Request(`https://catchmeme.com/api/meme-cards?${params}`))).status).toBe(400);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });

  it("forwards bounded catalog and owner collection filters to server queries", async () => {
    await GET(new Request("https://catchmeme.com/api/meme-cards?page=2&query=PPAP&category=song"));
    expect(mocks.catalog).toHaveBeenCalledWith({ page: 2, query: "PPAP", category: "song" });
    await collectionGET(new Request("https://catchmeme.com/api/meme-cards/collection?page=2&query=PPAP&category=song"));
    expect(mocks.collection).toHaveBeenCalledWith({ marker: "cookie-client" }, "verified-owner", { page: 2, query: "PPAP", category: "song" });
  });
});
