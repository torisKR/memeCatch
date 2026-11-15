import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  getSemanticRelatedMemeIds: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (read: (...args: unknown[]) => unknown) => read,
}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: mocks.createStaticClient }));
vi.mock("@/lib/meme-vector-lookup.server", () => ({
  getSemanticRelatedMemeIds: mocks.getSemanticRelatedMemeIds,
}));

import type { MemeListItem } from "@/lib/queries";
import { getRelatedMemes } from "@/lib/queries";

function meme(id: string, originYear: number, trendScore: number): MemeListItem {
  return {
    id,
    short_id: id,
    slug: id,
    title: id,
    summary: id,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "text",
    origin_year: originYear,
    trend_score: trendScore,
  };
}

function listQuery(data: MemeListItem[]) {
  const result = { data, error: null };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSemanticRelatedMemeIds.mockResolvedValue([]);
});

describe("getRelatedMemes lexical pool", () => {
  it("reserves a nearby-year query so a lower-trend adjacent meme can receive its bonus", async () => {
    const sameCategory = listQuery([
      meme("old-high-1", 2010, 100),
      meme("old-high-2", 2011, 90),
    ]);
    const nearbyYear = listQuery([meme("near-low", 2021, 1)]);
    const queries = [sameCategory, nearbyYear];
    mocks.createStaticClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("memes");
        const next = queries.shift();
        if (!next) throw new Error("Unexpected memes query");
        return next;
      }),
    });

    const related = await getRelatedMemes(
      { id: "current", category: "phrase", origin_year: 2020 },
      [],
      3,
    );

    expect(sameCategory.eq).toHaveBeenCalledWith("category", "phrase");
    expect(sameCategory.limit).toHaveBeenCalledWith(24);
    expect(nearbyYear.gte).toHaveBeenCalledWith("origin_year", 2018);
    expect(nearbyYear.lte).toHaveBeenCalledWith("origin_year", 2022);
    expect(nearbyYear.limit).toHaveBeenCalledWith(12);
    expect(related.map((item) => item.id)).toEqual([
      "near-low",
      "old-high-1",
      "old-high-2",
    ]);
  });
});
