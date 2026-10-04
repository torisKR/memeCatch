import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ keyword: vi.fn(), embed: vi.fn(), enabled: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries", () => ({ searchMemes: mocks.keyword }));
vi.mock("@/lib/meme-vector-lookup.server", () => ({ embedMemeQuery: mocks.embed, semanticSearchEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: () => ({ rpc: mocks.rpc }) }));
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
    expect(mocks.rpc).not.toHaveBeenCalled();
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
  it("preserves SQL rank, strips extra fields, and uses one database request", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("intent"), { ...row("name"), private_note: "never return", embedding: [1] }], error: null });
    expect(await searchMemeReferences("  친구 취향 따라하기  ", 2)).toEqual({ mode: "hybrid", items: [row("intent"), row("name")] });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("search_meme_references", {
      p_query: "친구 취향 따라하기", p_embedding: [1, ...Array(383).fill(0)], p_limit: 2,
    });
    expect(mocks.keyword).not.toHaveBeenCalled();
  });
  it("returns keyword results if SQL throws without exposing diagnostics", async () => {
    mocks.rpc.mockRejectedValue(new Error("private diagnostic"));
    expect(await searchMemeReferences("일상")).toEqual({ mode: "keyword", reason: "rpc_unavailable", items: [row("keyword")] });
  });
});
