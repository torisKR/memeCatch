import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createStaticClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => mocks);
import { getRecentlyPublishedMemes } from "./queries";

describe("home recent publication feed", () => {
  beforeEach(() => vi.clearAllMocks());
  it("sorts by actual publication date without letting historical origin or trend score override recency", async () => {
    const row = { id: "recent-revival" };
    const query = { select: vi.fn(), in: vi.fn(), not: vi.fn(), order: vi.fn(), limit: vi.fn() };
    for (const key of ["select", "in", "not", "order"] as const) query[key].mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [row], error: null });
    mocks.createStaticClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    expect(await getRecentlyPublishedMemes(6)).toEqual([row]);
    expect(query.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(query.not).toHaveBeenCalledWith("published_at", "is", null);
    expect(query.order.mock.calls).toEqual([
      ["published_at", { ascending: false, nullsFirst: false }],
      ["id", { ascending: true }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(6);
  });
  it("returns an honest empty feed on a connection failure", async () => {
    mocks.createStaticClient.mockImplementation(() => { throw new Error("offline"); });
    expect(await getRecentlyPublishedMemes()).toEqual([]);
  });
});
