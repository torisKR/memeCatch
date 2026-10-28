import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ keyword: vi.fn(), embed: vi.fn(), enabled: vi.fn(), rpc: vi.fn(), classify: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/queries", () => ({ searchMemes: mocks.keyword }));
vi.mock("@/lib/meme-vector-lookup.server", () => ({ embedMemeQuery: mocks.embed, semanticSearchEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/meme-intent.server", () => ({ classifyMemeIntent: mocks.classify }));
import { searchMemeReferences } from "./meme-reference-search.server";

const row = (id: string) => ({ id, short_id: id, slug: id, title: id, summary: "요약" });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.keyword.mockResolvedValue([{ ...row("keyword"), private_note: "never return" }]);
  mocks.embed.mockResolvedValue([1, ...Array(383).fill(0)]);
  mocks.classify.mockResolvedValue({ intent: "situation", source: "fallback", reason: "local_only" });
});
describe("public meme reference retrieval", () => {
  it("passes only the bounded query and locale to local classification", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("semantic")], error: null });
    await searchMemeReferences("친구 따라 할 때", 2, { intentRouting: true });
    expect(mocks.classify).toHaveBeenCalledWith({ query: "친구 따라 할 때", locale: undefined }, undefined);
  });
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
  it("keeps exact titles ahead of semantics without running intent classification", async () => {
    mocks.keyword.mockResolvedValue([row("새삥")]);
    const result = await searchMemeReferences("새삥", 4, { intentRouting: true, locale: "ko" });
    expect(result.items).toEqual([row("새삥")]);
    expect(result.decision).toEqual({ intent: "lookup", source: "fallback", reason: "exact_match" });
    expect(mocks.classify).not.toHaveBeenCalled(); expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("keeps the existing SQL exact/alias priority and fused rank instead of adding weak lexical hits", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("semantic"), row("keyword")], error: null });
    const result = await searchMemeReferences("친구 따라 할 때", 2, { intentRouting: true, locale: "ko" });
    expect(result.items.map(i => i.id)).toEqual(["semantic", "keyword"]);
    expect(result.decision).toEqual({ intent: "situation", source: "fallback", reason: "local_only" });
    expect(mocks.classify).toHaveBeenCalledTimes(1);
  });
  it("does not discard semantic candidates when weak lexical matches fill the limit", async () => {
    mocks.keyword.mockResolvedValue([row("weak-one"), row("weak-two")]);
    mocks.rpc.mockResolvedValue({ data: [row("situation-match"), row("weak-one")], error: null });
    expect((await searchMemeReferences("친구 따라 할 때", 2, { intentRouting: true })).items.map(i => i.id)).toEqual(["situation-match", "weak-one"]);
  });
  it("preserves legacy non-Korean retrieval without a Korean decision", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("semantic")], error: null });
    expect(await searchMemeReferences("a friend's taste", 2, { intentRouting: true, locale: "en" })).toEqual({ mode: "hybrid", items: [row("semantic")] });
    expect(mocks.classify).not.toHaveBeenCalled();
  });
  it("does not pretend semantic availability when disabled and still returns a routing hint", async () => {
    mocks.enabled.mockReturnValue(false);
    const result = await searchMemeReferences("새삥 뜻", 4, { intentRouting: true });
    expect(result.mode).toBe("keyword"); expect(result.reason).toBe("disabled");
    expect(result.decision).toEqual({ intent: "situation", source: "fallback", reason: "local_only" });
    expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("never sends suspect intent input to an embedding provider", async () => {
    mocks.classify.mockResolvedValue({ intent: "lookup", source: "fallback", reason: "input_not_sent" });
    const result = await searchMemeReferences("이메일 person@example.com", 4, { intentRouting: true });
    expect(result.mode).toBe("keyword"); expect(mocks.embed).not.toHaveBeenCalled();
  });
  it("cancels before retrieval when caller already disconnected", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(searchMemeReferences("새삥 뜻", 4, { intentRouting: true, signal: controller.signal })).rejects.toThrow();
    expect(mocks.keyword).not.toHaveBeenCalled(); expect(mocks.classify).not.toHaveBeenCalled();
  });
});
