// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return { useLocale: () => ({ locale: "ja", messages: getMessages("ja") }) };
});

import {
  MemeTrendPanel,
  trendPanelUpgradeHref,
} from "@/components/premium/meme-trend-panel";

describe("MemeTrendPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders its Plus label in the active locale before loading private metrics", () => {
    const html = renderToStaticMarkup(<MemeTrendPanel memeId="meme-1" />);

    expect(html).toContain("トレンド推移");
    expect(html).toContain("Plus");
    expect(html).not.toContain("트렌드 추이");
  });

  it("returns a signed-out visitor to the same localized Plus page after login", () => {
    expect(trendPanelUpgradeHref("signed_out", "ja")).toBe(
      "/login?next=%2Fja%2Fpricing%3Fsource%3Dtrend_30d",
    );
    expect(trendPanelUpgradeHref("not_premium", "zh-tw")).toBe(
      "/zh-tw/pricing?source=trend_30d",
    );
  });

  it("renders observed basis, sample confidence, coverage, and last update", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      locked: false,
      series: [
        { date: "2026-07-20", trend_score: 20, views: 2, reactions: 1, comments: 0, saves: 1 },
        { date: "2026-08-18", trend_score: 40, views: 5, reactions: 3, comments: 1, saves: 2 },
      ],
      summaries: [{
        days: 30,
        direction: "up",
        confidence: "low",
        sampleCount: 2,
        coveragePercent: 7,
        lastObservedAt: "2026-08-18",
        from: "2026-07-20",
        to: "2026-08-18",
        startScore: 20,
        endScore: 40,
        views: 7,
        reactions: 4,
        saves: 3,
      }],
    }), { headers: { "content-type": "application/json" } })));

    render(<MemeTrendPanel memeId="00000000-0000-4000-8000-000000000001" />);

    await waitFor(() => expect(screen.getByText("観測根拠")).toBeTruthy());
    expect(screen.getByText(/標本信頼度 低/)).toBeTruthy();
    expect(screen.getByText(/標本 2\/30日 · カバー率 7%/)).toBeTruthy();
    expect(screen.getByText(/最終観測日/)).toBeTruthy();
  });
});
