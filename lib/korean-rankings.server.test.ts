import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { message: string } | null };

const { createStaticClient, responses } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  responses: [] as QueryResult[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createStaticClient }));

import {
  clearKoreanRankingsCache,
  koreanRankingsVisible,
  loadKoreanRankings,
} from "@/lib/korean-rankings.server";

function meme(id: string, trendScore: number) {
  return {
    id,
    short_id: id,
    slug: "slug",
    title: `밈 ${id}`,
    summary: null,
    safety_level: "green",
    lifecycle_status: "active",
    trend_score: trendScore,
    published_at: "2026-11-01T00:00:00.000Z",
    description: "밈".repeat(340),
    origin: "유".repeat(60),
    usage_note: null,
    caution: null,
    usage_examples: [],
    meme_sources: [{ source_url: `https://example.com/${id}` }],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function thinMeme(id: string, trendScore: number) {
  return {
    ...meme(id, trendScore),
    description: "밈".repeat(500),
    origin: null,
    meme_sources: [],
  };
}

function client() {
  return {
    from() {
      const result = responses.shift() ?? { data: [], error: null };
      const api: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit", "not", "lt", "gt"]) {
        api[method] = () => api;
      }
      api.then = (
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected);
      return api;
    },
  };
}

describe("loadKoreanRankings", () => {
  beforeEach(() => {
    responses.length = 0;
    clearKoreanRankingsCache();
    createStaticClient.mockImplementation(client);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("uses published memes when the live query fails", async () => {
    const published = Array.from({ length: 3 }, (_, index) => meme(`published-${index}`, 0));
    responses.push(
      { data: null, error: { message: "statement timeout" } },
      { data: [thinMeme("thin", 0), ...published], error: null },
    );
    const result = await loadKoreanRankings();
    expect(result.kind).toBe("published");
    if (result.kind !== "published") return;
    expect(result.memes.map((item) => item.id)).toEqual(published.map((item) => item.id));
    expect(console.error).toHaveBeenCalled();
  });

  it("returns an outage when the published read fails too", async () => {
    responses.push(
      { data: null, error: { message: "password=secret" } },
      { data: null, error: { message: "connection refused" } },
    );
    await expect(loadKoreanRankings()).resolves.toEqual({ kind: "outage" });
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("password");
    expect(logged).toContain("database unavailable");
  });

  it("returns live today and comeback rows when both reads succeed", async () => {
    const trend = Array.from({ length: 10 }, (_, index) => meme(`trend-${index}`, index + 1));
    const comeback = Array.from({ length: 3 }, (_, index) => meme(`comeback-${index}`, index + 1));
    responses.push(
      { data: [thinMeme("thin-trend", 100), ...trend], error: null },
      { data: [thinMeme("thin-comeback", 100), ...comeback], error: null },
    );

    const result = await loadKoreanRankings();

    expect(result.kind).toBe("live");
    if (result.kind !== "live") return;
    expect(result.today).toHaveLength(10);
    expect(result.today.some((item) => item.id === "thin-trend")).toBe(false);
    expect(result.comeback.map((item) => item.id)).toEqual(comeback.map((item) => item.id));
  });

  it("keeps the live trend list when the comeback query fails", async () => {
    const trend = Array.from({ length: 10 }, (_, index) => meme(`trend-${index}`, index + 1));
    responses.push(
      { data: trend, error: null },
      { data: null, error: { message: "comeback timeout" } },
      { data: [meme("published-should-not-win", 0)], error: null },
    );

    const result = await loadKoreanRankings();

    expect(result.kind).toBe("live");
    if (result.kind !== "live") return;
    expect(result.today.map((item) => item.id)).toEqual(trend.map((item) => item.id).reverse());
    expect(result.comeback).toEqual([]);
    expect(result.today.some((item) => item.id === "published-should-not-win")).toBe(false);
    expect(responses).toHaveLength(1);
  });

  it("hides the page when the catalog read succeeds with no rows", async () => {
    responses.push(
      { data: [], error: null },
      { data: [], error: null },
    );
    await expect(loadKoreanRankings()).resolves.toEqual({ kind: "unavailable" });
    await expect(koreanRankingsVisible()).resolves.toBe(false);
  });

  it("hides rankings when the database client throws", async () => {
    createStaticClient.mockImplementation(() => {
      throw new Error("DATABASE_URL is required");
    });
    await expect(loadKoreanRankings()).resolves.toEqual({ kind: "outage" });
    await expect(koreanRankingsVisible()).resolves.toBe(false);
  });
});
