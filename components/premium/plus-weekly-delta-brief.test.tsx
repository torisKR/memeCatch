import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlusWeeklyDeltaBrief } from "@/components/premium/plus-weekly-delta-brief";
import type { PlusWeeklyDeltaBrief as Brief } from "@/lib/plus-weekly-brief";

const brief: Brief = {
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

  it("explains when history exists but the trend did not rise", () => {
    const html = renderToStaticMarkup(
      <PlusWeeklyDeltaBrief brief={{ ...brief, items: [], emptyReason: "no_change" }} locale="en" />,
    );

    expect(html).toContain("There are dated trend points, but no candidate has risen");
    expect(html).not.toContain("No candidate has at least two dated trend points yet.");
  });
});
