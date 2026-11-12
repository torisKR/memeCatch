import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: { message: string } | null };

const { createStaticClient, responses } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  responses: [] as QueryResult[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

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
    responses.push(
      { data: null, error: { message: "statement timeout" } },
      { data: [meme("published", 0)], error: null },
    );
    const result = await loadKoreanRankings();
    expect(result.kind).toBe("published");
    if (result.kind !== "published") return;
    expect(result.memes[0]?.title).toBe("밈 published");
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
