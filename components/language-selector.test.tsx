import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/i18n-client", async () => {
  const { getMessages } = await import("@/lib/i18n");
  return {
    persistLocale: vi.fn(),
    useLocale: () => ({ locale: "ko", messages: getMessages("ko") }),
  };
});

import {
  LanguageSelector,
  localeDestination,
} from "@/components/language-selector";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

function renderedLocaleOptions(pathname: string) {
  navigation.pathname = pathname;
  const html = renderToStaticMarkup(<LanguageSelector />);
  return Array.from(html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g), (match) => match[1]);
}

describe("LanguageSelector", () => {
  beforeEach(() => {
    navigation.pathname = "/";
  });

  it.each(["/", "/index", "/en", "/ja", "/zh", "/zh-tw"])(
    "offers only editorial home locales on %s",
    (pathname) => {
      expect(renderedLocaleOptions(pathname)).toEqual(["ko", "en", "ja", "zh", "zh-tw"]);
    },
  );

  it.each(["/products", "/community", "/en/search"])(
    "keeps every UI locale on non-home route %s",
    (pathname) => {
      expect(renderedLocaleOptions(pathname)).toEqual(SUPPORTED_LOCALES);
    },
  );
});

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

  it("removes an obsolete lang query while preserving other query parameters", () => {
    expect(localeDestination("/?lang=ko", "en")).toBe("/en");
    expect(localeDestination("/?campaign=fall&lang=ko&q=memes", "en")).toBe(
      "/en?campaign=fall&q=memes",
    );
  });

  it("routes in place to remove lang before applying a UI-only locale", () => {
    expect(localeDestination("/products?tab=saved&lang=ko", "th")).toBe(
      "/products?tab=saved",
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

  it("stays on the meme card catalog when the language changes", () => {
    expect(localeDestination("/meme-cards", "en")).toBe("/en/meme-cards");
    expect(localeDestination("/en/meme-cards", "ko")).toBe("/meme-cards");
  });

  it("keeps UI-only locales on an unprefixed route", () => {
    expect(localeDestination("/products", "th")).toBeNull();
  });

  it("removes an SEO prefix only when a UI-only locale requires it", () => {
    expect(localeDestination("/en/memes/abc-translated-slug", "vi")).toBe(
      "/memes/abc-translated-slug",
    );
  });

  it("stays on rankings for every supported locale", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(19);
    for (const locale of SUPPORTED_LOCALES) {
      const expected = locale === "ko" ? "/rankings" : `/${locale}/rankings`;
      expect(localeDestination("/rankings", locale)).toBe(expected);
      expect(localeDestination("/en/rankings", locale)).toBe(expected);
      expect(localeDestination("/zh-tw/rankings", locale)).toBe(expected);
      expect(localeDestination("/ar/rankings", locale)).toBe(expected);
      expect(localeDestination("/th/rankings?from=menu", locale)).toBe(`${expected}?from=menu`);
    }
  });
});
