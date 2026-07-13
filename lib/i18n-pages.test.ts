import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

const REQUIRED_PRODUCT_SHOP_FIELDS = [
  "shopTitle",
  "shopIntro",
  "liveAdTitle",
  "liveAdDescription",
  "editorPickTitle",
  "editorPickDescription",
  "liveBadge",
  "editorBadge",
  "carouselLabel",
  "previousProduct",
  "nextProduct",
  "pauseCarousel",
  "playCarousel",
] as const;

type ProductShopCopy = {
  [Field in (typeof REQUIRED_PRODUCT_SHOP_FIELDS)[number]]: string;
};

function expectCompleteProductShopCopy(copy: ProductShopCopy) {
  for (const field of REQUIRED_PRODUCT_SHOP_FIELDS) {
    expect(copy[field].trim(), field).not.toBe("");
  }
}

describe("product shop copy", () => {
  it("rejects copy with a blank required field", () => {
    expect(() =>
      expectCompleteProductShopCopy({
        ...PAGE_COPY.en,
        shopIntro: "",
      }),
    ).toThrow();
  });

  it.each(SUPPORTED_LOCALES)("has complete carousel copy for %s", (locale) => {
    const copy = PAGE_COPY[locale];

    expectCompleteProductShopCopy(copy);

    const sourceName = "Source 名称 — 100% (원문)";
    for (const label of [
      copy.viewProductLabel(sourceName),
      copy.checkProductLabel(sourceName),
    ]) {
      expect(label.trim()).not.toBe("");
      expect(label).toContain(sourceName);
    }
  });

  it("uses natural English copy for the editor picks description", () => {
    expect(PAGE_COPY.en.editorPickDescription).toBe(
      "Products selected by MemeCatch editors for a meme-filled lifestyle.",
    );
  });
});
