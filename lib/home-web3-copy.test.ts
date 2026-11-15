import { describe, expect, it } from "vitest";
import { HOME_LOCALES } from "@/lib/home-copy";
import { HOME_WEB3_COPY } from "@/lib/home-web3-copy";

describe("HOME_WEB3_COPY", () => {
  it("provides complete chapter and hero actions for every home locale", () => {
    expect(Object.keys(HOME_WEB3_COPY)).toEqual([...HOME_LOCALES]);

    for (const locale of HOME_LOCALES) {
      const copy = HOME_WEB3_COPY[locale];

      expect(copy.chapterLabel.trim()).not.toBe("");
      expect(copy.chapters.map((chapter) => chapter.href)).toEqual([
        "#home-top",
        "#home-latest",
        "#home-signals",
        "#home-pathways",
        "#home-editorial",
      ]);
      expect(copy.chapters.every((chapter) => chapter.label.trim().length > 0)).toBe(true);
      expect(copy.hero.exploreAction.trim()).not.toBe("");
      expect(copy.hero.communityAction.trim()).not.toBe("");
      expect(copy.pathways.communityMark.trim()).not.toBe("");
      expect(JSON.stringify(copy)).not.toMatch(/productsMark|판매 주체|Seller relationships/);
    }
  });

  it("does not introduce fake Web3 product claims", () => {
    const visibleCopy = JSON.stringify(HOME_WEB3_COPY).toLowerCase();

    expect(visibleCopy).not.toMatch(/wallet|nft|mint|token|on-chain|onchain/);
  });
});
