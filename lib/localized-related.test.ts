import { describe, expect, it } from "vitest";
import { selectLocalizedRelatedCards } from "@/lib/localized-related";
import type { MemeListItem } from "@/lib/queries";

function meme(shortId: string, title: string): MemeListItem {
  return {
    id: `id-${shortId}`,
    short_id: shortId,
    slug: `ko-${shortId}`,
    title,
    summary: `${title} 요약`,
    category: "phrase",
    safety_level: "yellow",
    lifecycle_status: "active",
    media_type: "image",
    origin_year: 2024,
    trend_score: 1,
  } as MemeListItem;
}

function translation(shortId: string, title: string) {
  return {
    short_id: shortId,
    slug: `en-${shortId}`,
    title,
    summary: `${title} summary`,
  };
}

describe("selectLocalizedRelatedCards", () => {
  const related = ["a", "b", "c", "d", "e", "f", "g"].map((id) => meme(id, `한글 ${id}`));

  it("drops memes with no reviewed translation and links the rest in that locale", () => {
    const translations = new Map([
      ["a", translation("a", "Alpha")],
      ["c", translation("c", "Charlie")],
      ["e", translation("e", "Echo")],
    ]);

    const cards = selectLocalizedRelatedCards(related, translations, "en");

    expect(cards.map((card) => card.meme.title)).toEqual(["Alpha", "Charlie", "Echo"]);
    expect(cards.map((card) => card.meme.slug)).toEqual(["en-a", "en-c", "en-e"]);
    expect(cards.map((card) => card.href)).toEqual([
      "/en/memes/a-en-a",
      "/en/memes/c-en-c",
      "/en/memes/e-en-e",
    ]);
  });

  it("keeps a reviewed card with an empty summary and still counts it toward three", () => {
    const translations = new Map([
      ["a", { ...translation("a", "Alpha"), summary: "" }],
      ["b", translation("b", "Beta")],
      ["c", translation("c", "Charlie")],
    ]);

    const cards = selectLocalizedRelatedCards(related, translations, "en");

    expect(cards).toHaveLength(3);
    expect(cards[0]?.meme.summary).toBe("");
    expect(cards[0]?.meme.title).toBe("Alpha");
  });

  it("hides the section when fewer than three translated memes remain", () => {
    const translations = new Map([
      ["a", translation("a", "Alpha")],
      ["b", translation("b", "Beta")],
    ]);

    expect(selectLocalizedRelatedCards(related, translations, "ja")).toEqual([]);
  });

  it("keeps at most six translated memes", () => {
    const translations = new Map(related.map((item) => [item.short_id, translation(item.short_id, item.short_id)]));

    const cards = selectLocalizedRelatedCards(related, translations, "zh-tw");

    expect(cards).toHaveLength(6);
    expect(cards[0]?.href.startsWith("/zh-tw/memes/")).toBe(true);
  });
});
