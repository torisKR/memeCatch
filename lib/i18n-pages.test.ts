import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

describe("product shop copy", () => {
  it.each(SUPPORTED_LOCALES)("has complete carousel copy for %s", (locale) => {
    const copy = PAGE_COPY[locale];

    for (const value of [
      copy.shopTitle,
      copy.liveAdTitle,
      copy.editorPickTitle,
      copy.carouselLabel,
      copy.previousProduct,
      copy.nextProduct,
      copy.pauseCarousel,
      copy.playCarousel,
    ]) {
      expect(value.trim()).not.toBe("");
    }

    expect(copy.viewProductLabel("Source name")).toContain("Source name");
  });
});
