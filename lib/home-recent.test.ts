import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createStaticClient: vi.fn() }));
vi.mock("@/lib/db/server", () => mocks);
import { getRecentlyPublishedMemes } from "./queries";
import { indexableScanLimit } from "./thin-meme";

const ready = {
  id: "recent-revival",
  description: "밈".repeat(340),
  origin: "유".repeat(60),
  meme_sources: [{ source_url: "https://example.com/source" }],
};

describe("home recent publication feed", () => {
  beforeEach(() => vi.clearAllMocks());
  it("sorts by actual publication date without letting historical origin or trend score override recency", async () => {
    const thin = { id: "thin-row", description: "밈".repeat(10) };
    const query = { select: vi.fn(), in: vi.fn(), not: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const key of ["select", "in", "not", "order"] as const) query[key].mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [thin, ready], error: null });
    mocks.createStaticClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    expect(await getRecentlyPublishedMemes(6)).toEqual([ready]);
    expect(query.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(query.not).toHaveBeenCalledWith("published_at", "is", null);
    expect(query.order.mock.calls).toEqual([
      ["published_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(indexableScanLimit(6));
  });
  it("returns an honest empty feed on a connection failure", async () => {
    mocks.createStaticClient.mockImplementation(() => { throw new Error("offline"); });
    expect(await getRecentlyPublishedMemes()).toEqual([]);
  });
  it("queries the discovery ids directly instead of scanning unrelated publication pages", async () => {
    const query = { select: vi.fn(), in: vi.fn(), not: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const key of ["select", "in", "not", "order"] as const) query[key].mockReturnValue(query);
    const eligible = { ...ready, id: "eligible" };
    query.limit.mockResolvedValue({ data: [eligible], error: null });
    mocks.createStaticClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    expect(await getRecentlyPublishedMemes(8, new Set(["eligible"]))).toEqual([eligible]);
    expect(query.in).toHaveBeenNthCalledWith(1, "id", ["eligible"]);
    expect(query.in).toHaveBeenNthCalledWith(2, "moderation_status", ["approved", "limited"]);
    expect(query.limit).toHaveBeenCalledWith(indexableScanLimit(8));
  });
});
