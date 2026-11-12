import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { KoreanRankings, PublicRankingMeme } from "@/lib/korean-rankings";

const { loadKoreanRankings } = vi.hoisted(() => ({
  loadKoreanRankings: vi.fn(async (): Promise<KoreanRankings> => ({ kind: "unavailable" })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/korean-rankings.server", () => ({ loadKoreanRankings }));

import RankingsPage, { generateMetadata } from "@/app/rankings/page";

function meme(id: string): PublicRankingMeme {
  return {
    id,
    short_id: id,
    slug: "slug",
    title: `공개 밈 ${id}`,
    summary: "요약",
    safety_level: "green",
    lifecycle_status: "active",
    trend_score: 4,
    published_at: "2026-11-01T00:00:00.000Z",
  };
}

describe("Korean rankings page", () => {
  it("renders a live list without the old error copy", async () => {
    loadKoreanRankings.mockResolvedValueOnce({
      kind: "live",
      fallback: null,
      today: [meme("live")],
      weekly: [],
      weeklyLocked: true,
      comeback: [],
      lastRollupDate: null,
      topWeeklyViews: 0,
    });
    const html = renderToStaticMarkup(await RankingsPage());
    expect(html).toContain("밈캐치 내 급상승");
    expect(html).toContain("공개 밈 live");
    expect(html).not.toContain("랭킹을 불러오지 못했어요");
  });

  it("falls back to the published weekly list", async () => {
    loadKoreanRankings.mockResolvedValueOnce({
      kind: "published",
      memes: [meme("week")],
    });
    const html = renderToStaticMarkup(await RankingsPage());
    expect(html).toContain("이번 주 많이 본 밈");
    expect(html).toContain("공개 밈 week");
    expect(html).not.toContain("랭킹을 불러오지 못했어요");
    expect(html).not.toContain("다시 불러오기");
  });

  it("does not render a 200 error page when nothing can be listed", async () => {
    loadKoreanRankings.mockResolvedValueOnce({ kind: "unavailable" });
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: true });
    loadKoreanRankings.mockResolvedValueOnce({ kind: "outage" });
    await expect(RankingsPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("no longer reads the session inside the rankings loader", () => {
    const source = readFileSync(join(process.cwd(), "app/rankings/page.tsx"), "utf8");
    expect(source).not.toContain("getPremiumEntitlement");
    expect(source).not.toContain("랭킹을 불러오지 못했어요");
    expect(source).toContain('dynamic = "force-dynamic"');
  });
});
