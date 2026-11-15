import { describe, expect, it } from "vitest";
import {
  koreanRankingsRenderList,
  resolveKoreanRankings,
  type PublicRankingMeme,
} from "@/lib/korean-rankings";

function meme(id: string): PublicRankingMeme {
  return {
    id,
    short_id: id,
    slug: "slug",
    title: `밈 ${id}`,
    summary: null,
    safety_level: "green",
    lifecycle_status: "active",
    trend_score: 3,
    published_at: "2026-01-01T00:00:00.000Z",
  };
}

const liveRows = {
  fallback: null,
  today: [meme("today")],
  comeback: [],
};

describe("resolveKoreanRankings", () => {
  it("keeps a live ranking list", () => {
    const result = resolveKoreanRankings({
      liveError: false,
      live: liveRows,
      published: null,
    });
    expect(result.kind).toBe("live");
    if (result.kind !== "live") return;
    expect(result.today[0]?.title).toBe("밈 today");
    expect(result.weeklyLocked).toBe(true);
  });

  it("falls back to published memes when the live read fails", () => {
    const result = resolveKoreanRankings({
      liveError: true,
      live: null,
      published: [meme("published")],
    });
    expect(result).toEqual({ kind: "published", memes: [meme("published")] });
  });

  it("is unavailable only when a successful read has no rows", () => {
    expect(
      resolveKoreanRankings({
        liveError: false,
        live: { fallback: [], today: [], comeback: [] },
        published: [],
      }).kind,
    ).toBe("unavailable");
  });

  it("reports an outage when neither read can run", () => {
    const result = resolveKoreanRankings({
      liveError: true,
      live: null,
      published: null,
    });
    expect(result.kind).toBe("outage");
    expect(koreanRankingsRenderList(result)).toBe(false);
  });
});
