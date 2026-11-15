import { describe, expect, it } from "vitest";
import { buildPlusCollectionBrief, type PlusCollectionBriefItem } from "@/lib/plus-collection-brief";

const item: PlusCollectionBriefItem = {
  title: "Signal [meme]",
  summary: "A compact explanation of the moment.",
  origin: "A broadcast clip",
  usageNote: "Use it with close friends.",
  caution: "Do not target a real person.",
  safetyLevel: "yellow",
  lifecycleStatus: "rising",
  privateNote: "Use this in the launch post\nwith the product link.",
  detailUrl: "https://catchmeme.com/memes/abc-signal",
  isLocalized: true,
};

describe("buildPlusCollectionBrief", () => {
  it("builds a private, localized, use-ready Markdown brief", () => {
    const markdown = buildPlusCollectionBrief({
      collection: "Launch ideas",
      locale: "en",
      items: [item],
      generatedAt: "2026-08-09T12:00:00.000Z",
    });

    expect(markdown).toContain("# Launch ideas");
    expect(markdown).toContain("Private export containing your saved memes");
    expect(markdown).toContain("Current reviewed translation");
    expect(markdown).toContain("Ready-to-use kit");
    expect(markdown).toContain("Do not target a real person.");
    expect(markdown).toContain("> Use this in the launch post");
    expect(markdown).toContain("Signal \\[meme\\]");
  });

  it("labels a missing translation as a Korean fallback and caps output at 100 items", () => {
    const many = Array.from({ length: 101 }, (_, index) => ({
      ...item,
      title: `Meme ${index}`,
      isLocalized: false,
    }));
    const markdown = buildPlusCollectionBrief({
      collection: "Archive",
      locale: "ja",
      items: many,
      truncated: true,
    });

    expect(markdown).toContain("韓国語原文 fallback");
    expect(markdown).toContain("最新100件のみ収録");
    expect(markdown).toContain("## 100. Meme 99");
    expect(markdown).not.toContain("## 101. Meme 100");
  });
});
