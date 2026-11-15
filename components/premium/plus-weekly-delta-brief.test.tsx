// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ track }));
import { PlusWeeklyDeltaBrief } from "@/components/premium/plus-weekly-delta-brief";
import type { PlusWeeklyDeltaBrief as Brief } from "@/lib/plus-weekly-brief";

const brief: Brief = {
  briefId: "2026-08-01_2026-08-07_meme-key",
  window: { from: "2026-08-01", to: "2026-08-07", timezone: "Asia/Seoul" },
  scannedCount: 12,
  items: [
    {
      memeId: "meme-id",
      shortId: "meme-key",
      slug: "moving-meme",
      title: "Moving meme",
      summary: "A verified summary.",
      source: "saved",
      startTrendScore: 10,
      endTrendScore: 42,
      delta: 32,
      lifecycleStatus: "rising",
    },
  ],
  emptyReason: null,
};

describe("PlusWeeklyDeltaBrief", () => {
  afterEach(() => {
    cleanup();
    track.mockReset();
  });

  it("shows the period change and locale-safe trend link", () => {
    const html = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief brief={brief} locale="en" />,
    );

    expect(html).toContain("What changed this week");
    expect(html).toContain("Moving meme");
    expect(html).toContain("+32");
    expect(html).toContain("Found in saved memes");
    expect(html).toContain('href="/en/memes/meme-key-moving-meme#trend-panel-title"');
  });

  it("uses the resolved English content route for a UI-only locale", () => {
    const html = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief brief={brief} locale="de" contentLocale="en" />,
    );

    expect(html).toContain("Moving meme");
    expect(html).toContain('href="/en/memes/meme-key-moving-meme#trend-panel-title"');
  });

  it("keeps localized coverage and query failure distinct from empty history", () => {
    const coverageHtml = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief
        brief={{ ...brief, items: [], emptyReason: "coverage_empty" }}
        locale="zh-tw"
      />,
    );
    const unavailableHtml = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief
        brief={{ ...brief, items: [], emptyReason: "unavailable" }}
        locale="en"
      />,
    );

    expect(coverageHtml).toContain("目前還沒有可用的人工審核週度候選迷因。");
    expect(unavailableHtml).toContain("The weekly trend data is unavailable right now.");
  });

  it("explains why a brief is empty without filling it with generic memes", () => {
    const empty: Brief = { ...brief, items: [], emptyReason: "insufficient_history" };
    const html = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief brief={empty} locale="ja" />,
    );

    expect(html).toContain("2日以上の推移記録があるミームはまだありません。");
    expect(html).not.toContain("Moving meme");
  });

  it("tracks open and click with a weekly identity and no user data", () => {
    render(<PlusWeeklyDeltaBrief brief={brief} locale="en" />);

    expect(track).toHaveBeenCalledWith("plus_weekly_brief_opened", {
      brief_id: "2026-08-01_2026-08-07_meme-key",
      item_count: 1,
    });

    const link = screen.getByRole("link", { name: /Moving meme/ });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    expect(track).toHaveBeenCalledWith("plus_weekly_brief_clicked", {
      brief_id: "2026-08-01_2026-08-07_meme-key",
      meme_id: "meme-id",
      position: 1,
      source: "saved",
    });
    expect(JSON.stringify(track.mock.calls)).not.toMatch(/email|user_id|saved_at/i);
  });
});
