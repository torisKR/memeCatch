import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ keyword: vi.fn(), embed: vi.fn(), enabled: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries", () => ({ searchMemes: mocks.keyword }));
vi.mock("@/lib/meme-vector-lookup.server", () => ({ embedMemeQuery: mocks.embed, semanticSearchEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
import { searchMemeReferences } from "./meme-reference-search.server";

const row = (id: string) => ({ id, short_id: id, slug: id, title: id, summary: "요약" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.keyword.mockResolvedValue([{ ...row("keyword"), private_note: "never return" }]);
  mocks.embed.mockResolvedValue([1, ...Array(383).fill(0)]);
});
describe("public meme reference retrieval", () => {
  it("rejects invalid bounds before any database or embedding call", async () => {
    for (const [query, limit] of [["x", 12], ["x".repeat(121), 12], ["일상", 21], ["일상", 1.5]] as const) {
      await expect(searchMemeReferences(query, limit)).rejects.toThrow("invalid_reference_query");
    }
    expect(mocks.keyword).not.toHaveBeenCalled();
    expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("keeps lexical retrieval and a minimal DTO when disabled", async () => {
    mocks.enabled.mockReturnValue(false);
    expect(await searchMemeReferences("  일상  ")).toEqual({ mode: "keyword", reason: "disabled", items: [row("keyword")] });
    expect(mocks.keyword).toHaveBeenCalledWith("일상", 12);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not call vector SQL during an embedding outage", async () => {
    mocks.embed.mockResolvedValue(null);
    expect((await searchMemeReferences("일상")).reason).toBe("model_unavailable");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [{ data: null, error: { message: "private diagnostic" } }, "rpc_unavailable"],
    [{ data: [], error: null }, "index_empty"],
  ])("falls back for unavailable or empty vector indexes", async (reply, reason) => {
    mocks.rpc.mockResolvedValue(reply);
    expect(await searchMemeReferences("일상")).toEqual({ mode: "keyword", reason, items: [row("keyword")] });
  });
  it("rereads public metadata, preserves SQL rank, and fuses both rankings", async () => {
    mocks.keyword.mockResolvedValue([row("both"), row("keyword")]);
    mocks.rpc.mockResolvedValue({ data: [{ meme_id: "semantic" }, { meme_id: "both" }, { meme_id: "hidden" }], error: null });
    const filters = vi.fn().mockReturnThis();
    const chain = { select: vi.fn().mockReturnThis(), in: filters, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [row("both"), row("semantic")], error: null }).then(resolve) };
    mocks.from.mockReturnValue(chain);
    const result = await searchMemeReferences("일상", 3);
    expect(result.mode).toBe("hybrid");
    expect(result.items.map((item) => item.id)).toEqual(["both", "semantic", "keyword"]);
    expect(filters).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(chain.select).toHaveBeenCalledWith("id,short_id,slug,title,summary");
    expect(result.items.some((item) => item.id === "hidden")).toBe(false);
  });
  it("returns keyword results if SQL throws", async () => {
    mocks.rpc.mockRejectedValue(new Error("private diagnostic"));
    expect((await searchMemeReferences("일상")).reason).toBe("rpc_unavailable");
  });
});
