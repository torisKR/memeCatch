import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SavedReuseRadar } from "@/components/premium/saved-reuse-radar";

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
    collection: "work",
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
  {
    id: "archive",
    shortId: "archive",
    slug: "archive-meme",
    title: "Archive meme",
    summary: "An old red signal.",
    safetyLevel: "red" as const,
    lifecycleStatus: "archived" as const,
    trendScore: 20,
    savedAt: "2026-08-06T00:00:00.000Z",
    collection: null,
  },
];

describe("SavedReuseRadar", () => {
  it("makes the saved-library actions explicit in English", () => {
    const html = renderToStaticMarkup(
      <SavedReuseRadar items={items} locale="en" />,
    );

    expect(html).toContain("What can you do with your saved memes now?");
    expect(html).toContain("Ready to use now");
    expect(html).toContain("Check the context first");
    expect(html).toContain("Revisit later");
    expect(html).toContain("Ready meme");
    expect(html).toContain("Context meme");
    expect(html).toContain("Archive meme");
    expect(html).toContain('href="/my#saved"');
  });

  it("has a useful localized empty state instead of a blank Plus panel", () => {
    const html = renderToStaticMarkup(
      <SavedReuseRadar items={[]} locale="ja" />,
    );

    expect(html).toContain("見直す保存ミームはまだありません");
    expect(html).toContain("ミームを探す");
    expect(html).toContain('href="/explore"');
  });
});
