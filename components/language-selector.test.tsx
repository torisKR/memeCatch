import { describe, expect, it } from "vitest";
import { localeDestination } from "@/components/language-selector";

describe("localeDestination", () => {
  it.each([
    ["/memes/abc-original-slug", "en", "/en"],
    ["/en/memes/abc-translated-slug", "ja", "/ja"],
    ["/ja/memes/abc-translated-slug", "zh-tw", "/zh-tw"],
  ] as const)(
    "sends a global switch from %s to the guaranteed %s home",
    (pathname, locale, destination) => {
      expect(localeDestination(pathname, locale)).toBe(destination);
    },
  );

  it("preserves the source detail when returning to Korean", () => {
    expect(localeDestination("/en/memes/abc-translated-slug", "ko")).toBe(
      "/memes/abc-translated-slug",
    );
  });

  it("keeps a visitor on the localized Plus conversion route", () => {
    expect(localeDestination("/pricing", "en")).toBe("/en/pricing");
    expect(localeDestination("/en/pricing", "ja")).toBe("/ja/pricing");
    expect(localeDestination("/ja/pricing", "ko")).toBe("/pricing");
  });

  it("preserves a search query when switching localized search routes", () => {
    expect(localeDestination("/en/search?q=%EC%9B%90%EC%98%81", "ja")).toBe(
      "/ja/search?q=%EC%9B%90%EC%98%81",
    );
    expect(localeDestination("/search?q=%EC%9B%90%EC%98%81", "en")).toBe(
      "/en/search?q=%EC%9B%90%EC%98%81",
    );
  });

  it.each([
    ["/", "en", "/en"],
    ["/ja", "zh", "/zh"],
    ["/zh-tw", "ko", "/"],
  ] as const)(
    "maps home %s to the %s home",
    (pathname, locale, destination) => {
      expect(localeDestination(pathname, locale)).toBe(destination);
    },
  );

  it("keeps non-localized routes when switching to Korean", () => {
    expect(localeDestination("/explore", "ko")).toBe("/explore");
  });

  it("keeps UI-only locales on an unprefixed route", () => {
    expect(localeDestination("/products", "th")).toBeNull();
  });

  it("removes an SEO prefix only when a UI-only locale requires it", () => {
    expect(localeDestination("/en/memes/abc-translated-slug", "vi")).toBe(
      "/memes/abc-translated-slug",
    );
  });
});
