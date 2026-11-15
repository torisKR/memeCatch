import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlusActionQueue } from "@/components/premium/plus-action-queue";

const items = [
  {
    id: "ready",
    shortId: "ready",
    slug: "ready-meme",
    title: "Ready meme",
    summary: "A current green signal.",
    safetyLevel: "green" as const,
    lifecycleStatus: "rising" as const,
    trendScore: 90,
    savedAt: "2026-08-08T00:00:00.000Z",
    collection: null,
  },
  {
    id: "context",
    shortId: "context",
    slug: "context-meme",
    title: "Context meme",
    summary: "A current yellow signal.",
    safetyLevel: "yellow" as const,
    lifecycleStatus: "active" as const,
    trendScore: 70,
    savedAt: "2026-08-07T00:00:00.000Z",
    collection: null,
  },
];

describe("PlusActionQueue", () => {
  it("links saved actions to the localized detail Use Kit", () => {
    const html = renderToStaticMarkup(
      <PlusActionQueue items={items} savedCount={4} locale="en" />,
    );

    expect(html).toContain("Your next best meme actions");
    expect(html).toContain("Ready meme");
    expect(html).toContain("Open Use Kit");
    expect(html).toContain('href="/en/memes/ready-ready-meme#');
    expect(html).toContain("Check context");
  });

  it("keeps the empty queue actionable in a supported locale", () => {
    const html = renderToStaticMarkup(
      <PlusActionQueue items={[]} savedCount={0} locale="ja" />,
    );

    expect(html).toContain("まずミームを保存しましょう");
    expect(html).toContain('href="/explore"');
    expect(html).toContain('data-plus-action-queue="empty"');
  });
});
