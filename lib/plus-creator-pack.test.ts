import { describe, expect, it } from "vitest";
import {
  buildPlusCreatorPack,
  creatorPackFormatForChannel,
  PLUS_CREATOR_PACK_LIMIT,
} from "@/lib/plus-creator-pack";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";

function action(index: number, kind: PlusGlobalActionInboxItem["kind"] = "new_reviewed") {
  const locale = index % 2 === 0 ? "en" : "ja";
  return {
    id: `${kind}:${index}`,
    memeId: `meme-${index}`,
    shortId: `short${index}`,
    slug: `meme-${index}`,
    title: `Meme ${index}`,
    summary: `Reviewed summary ${index}`,
    locale,
    href: `/${locale}/memes/short${index}-meme-${index}`,
    shareText: `Meme ${index}\n\nReviewed summary ${index}`,
    kind,
    changedAt: "2026-08-09T00:00:00.000Z",
    trendScore: 100 - index,
    creatorPackFacts: {
      title: `Meme ${index}`,
      summary: `Reviewed summary ${index}`,
      usageNote: "Use it with the right audience.",
      caution: "Avoid targeting a real person.",
      safetyLevel: "green" as const,
      lifecycleStatus: "rising" as const,
    },
  } satisfies PlusGlobalActionInboxItem;
}

describe("buildPlusCreatorPack", () => {
  it.each([
    ["instagram", "story"],
    ["tiktok", "story"],
    ["youtube", "story"],
    ["threads", "card"],
    ["x", "card"],
    ["community", "card"],
    ["messaging", "card"],
    ["blog", "card"],
    ["other", "card"],
  ] as const)("maps %s to the existing %s export format", (channel, format) => {
    expect(creatorPackFormatForChannel(channel)).toBe(format);
  });

  it("keeps inbox order, caps at five, and creates localized card paths", () => {
    const pack = buildPlusCreatorPack({
      items: [
        action(0, "translation_ready"),
        action(1, "saved_signal"),
        action(2, "new_reviewed"),
        action(3, "new_reviewed"),
        action(4, "new_reviewed"),
        action(5, "new_reviewed"),
      ],
    });

    expect(PLUS_CREATOR_PACK_LIMIT).toBe(5);
    expect(pack.status).toBe("ready");
    expect(pack.items).toHaveLength(5);
    expect(pack.items.map((item) => item.actionId)).toEqual([
      "translation_ready:0",
      "saved_signal:1",
      "new_reviewed:2",
      "new_reviewed:3",
      "new_reviewed:4",
    ]);
    expect(pack.items[0]).toMatchObject({
      locale: "en",
      exportPath: "/memes/short0/export?locale=en",
      filename: "memecatch-short0-creator.png",
    });
    expect(pack.items[1]?.exportPath).toBe("/memes/short1/export?locale=ja");
    expect(pack.shareText).toContain("Safety: Generally usable");
  });

  it("does not create a card for incomplete or private-shaped action data", () => {
    const incomplete = { ...action(0), creatorPackFacts: undefined };
    const pack = buildPlusCreatorPack({ items: [incomplete] });

    expect(pack).toEqual({
      status: "empty",
      items: [],
      shareText: "",
      skippedCount: 1,
    });
  });

  it("uses only the reviewed creator facts and excludes unrelated fields", () => {
    const item = {
      ...action(0),
      privateNote: "never share this",
      aiSuggestion: "never share this",
    };
    const pack = buildPlusCreatorPack({ items: [item] });

    expect(pack.shareText).not.toContain("never share this");
    expect(pack.items[0]?.detailPath).toBe("/en/memes/short0-meme-0");
  });

  it("puts the selected reviewed usage example into the one-cut share text", () => {
    const base = action(0);
    const item: PlusGlobalActionInboxItem = {
      ...base,
      creatorPackFacts: {
        ...base.creatorPackFacts!,
        usageExamples: [
          { situation: "First situation", text: "First reviewed line." },
          { situation: "Second situation", text: "Second reviewed line." },
        ],
      },
    };

    const pack = buildPlusCreatorPack({
      items: [item],
      usageExampleIndexes: { [item.memeId]: 1 },
    });

    expect(pack.status).toBe("ready");
    expect(pack.shareText).toContain("Use it like this · Second situation");
    expect(pack.shareText).toContain("Second reviewed line.");
    expect(pack.shareText).not.toContain("First reviewed line.");
  });

  it("keeps each item's selected reviewed example isolated in a multi-item pack", () => {
    const first = action(0);
    const second = action(1);
    const pack = buildPlusCreatorPack({
      items: [
        {
          ...first,
          creatorPackFacts: {
            ...first.creatorPackFacts!,
            usageExamples: [
              { situation: "First default", text: "First default line." },
              { situation: "First selected", text: "First selected line." },
            ],
          },
        },
        {
          ...second,
          creatorPackFacts: {
            ...second.creatorPackFacts!,
            usageExamples: [
              { situation: "Second default", text: "Second default line." },
              { situation: "Second selected", text: "Second selected line." },
            ],
          },
        },
      ],
      usageExampleIndexes: {
        [first.memeId]: 1,
        [second.memeId]: 0,
      },
    });

    expect(pack.items[0]?.shareText).toContain("First selected line.");
    expect(pack.items[0]?.shareText).not.toContain("First default line.");
    expect(pack.items[1]?.shareText).toContain("Second default line.");
    expect(pack.items[1]?.shareText).not.toContain("Second selected line.");
    expect(pack.shareText).toContain("First selected line.");
    expect(pack.shareText).toContain("Second default line.");
  });

  it("passes the selected channel into each reviewed creator draft", () => {
    const shortSocial = buildPlusCreatorPack({ items: [action(0)], channel: "threads" });
    const longForm = buildPlusCreatorPack({ items: [action(0)], channel: "blog" });
    const shortSocialText = shortSocial.items[0]?.shareText ?? "";
    const longFormText = longForm.items[0]?.shareText ?? "";

    expect(shortSocialText).not.toBe(longFormText);
    expect(shortSocialText.indexOf("/en/memes/short0-meme-0")).toBeLessThan(
      shortSocialText.indexOf("Safety: Generally usable"),
    );
    expect(longFormText.indexOf("Safety: Generally usable")).toBeLessThan(
      longFormText.indexOf("/en/memes/short0-meme-0"),
    );
  });

  it("uses the current reviewed detail path exactly once for every channel", () => {
    const item = {
      ...action(0),
      href: "/en/memes/current-reviewed-route",
    };
    const channels = [
      "instagram",
      "tiktok",
      "youtube",
      "threads",
      "x",
      "community",
      "messaging",
      "blog",
      "other",
    ] as const;

    for (const channel of channels) {
      const pack = buildPlusCreatorPack({ items: [item], channel });
      const shareText = pack.items[0]?.shareText ?? "";

      expect(shareText.match(/\/en\/memes\/current-reviewed-route/g)).toHaveLength(1);
      expect(shareText).not.toContain("/en/memes/short0-meme-0");
    }
  });
});
