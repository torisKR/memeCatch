import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getWeeklyDigest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/weekly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/weekly")>();
  return { ...actual, getWeeklyDigest };
});
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: { title: string } }) => <span>{meme.title}</span>,
}));
vi.mock("@/components/adsense-script", () => ({ AdsenseScript: () => null }));

import WeeklyPage from "@/app/(default)/weekly/page";

const range = {
  startISO: "2026-11-09T15:00:00.000Z",
  endISO: "2026-11-16T14:59:59.999Z",
  year: 2026,
  month: 11,
  weekOfMonth: 3,
  isOngoing: true,
};

function memes(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    short_id: `${prefix}${index + 1}`,
    slug: `${prefix}-${index + 1}`,
    title: `${prefix} ${index + 1}`,
    summary: "충분한 설명",
  }));
}

beforeEach(() => {
  getWeeklyDigest.mockReset();
});

describe("weekly structured data", () => {
  it("omits ItemList data when both card rails are hidden", async () => {
    getWeeklyDigest.mockResolvedValue({
      range,
      trending: memes(2, "급상승"),
      fresh: memes(1, "신규"),
      categoryBreakdown: [],
    });

    const html = renderToStaticMarkup(await WeeklyPage());

    expect(html).not.toContain('type="application/ld+json"');
    expect(html).not.toContain('id="weekly-trending"');
    expect(html).not.toContain('id="weekly-fresh"');
  });

  it("describes the same visible rail that the page renders", async () => {
    getWeeklyDigest.mockResolvedValue({
      range,
      trending: memes(2, "숨은 급상승"),
      fresh: memes(3, "보이는 신규"),
      categoryBreakdown: [],
    });

    const html = renderToStaticMarkup(await WeeklyPage());

    expect(html).toContain('type="application/ld+json"');
    expect(html).not.toContain('id="weekly-trending"');
    expect(html).toContain('id="weekly-fresh"');
    expect(html).toContain("보이는 신규 1");
    expect(html).not.toContain("숨은 급상승 1");
  });
});
