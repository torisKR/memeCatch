import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingsUnavailable } from "@/components/rankings-unavailable";
import { SUPPORTED_LOCALES, documentLocaleFromPathname, getDocumentDirection, getMessages } from "@/lib/i18n";
import { SEO_CONTENT_LOCALES } from "@/lib/i18n-routing";
import {
  rankingsExploreHref,
  rankingsFallbackCopy,
} from "@/lib/rankings-fallback-copy";
import { RANKINGS_LOCALE_PREFIXES } from "@/lib/rankings-locale-rewrite";

const HANGUL = /[가-힣]/;

describe("rankings fallback copy", () => {
  it("covers every supported locale without Korean leaking into the others", () => {
    expect(new Set(RANKINGS_LOCALE_PREFIXES)).toEqual(
      new Set(SUPPORTED_LOCALES.filter((locale) => locale !== "ko")),
    );

    for (const locale of SUPPORTED_LOCALES) {
      const copy = rankingsFallbackCopy(locale);
      const html = renderToStaticMarkup(<RankingsUnavailable locale={locale} />);
      expect(copy.title).toBe(getMessages(locale).rankings);
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.guidance.replaceAll("'", "&#x27;"));
      expect(html).toContain(copy.explore);
      expect(html).toContain(`href="${rankingsExploreHref(locale)}"`);
      expect(html.match(/<a /g)).toHaveLength(1);
      expect(html).not.toMatch(/error|500/i);
      expect(html).not.toContain("<table");
      expect(html).not.toContain("skeleton");
      if (locale !== "ko") {
        expect(copy.guidance).not.toMatch(HANGUL);
        expect(copy.explore).not.toMatch(HANGUL);
        expect(copy.title).not.toMatch(HANGUL);
        expect(html).not.toMatch(HANGUL);
      }
    }
  });

  it("points every fallback button at an explore route that exists", () => {
    const localizedExplore = new Set<string>(SEO_CONTENT_LOCALES);
    expect(SUPPORTED_LOCALES).toHaveLength(19);
    for (const locale of SUPPORTED_LOCALES) {
      const expected = localizedExplore.has(locale) ? `/${locale}/explore` : "/explore";
      const html = renderToStaticMarkup(<RankingsUnavailable locale={locale} />);
      expect(rankingsExploreHref(locale)).toBe(expected);
      expect(html).toContain(`href="${expected}"`);
      if (!localizedExplore.has(locale)) {
        expect(html).not.toContain(`href="/${locale}/explore"`);
      }
    }
  });

  it("uses Traditional Chinese for zh-tw and Arabic RTL for ar", () => {
    const simplified = rankingsFallbackCopy("zh");
    const traditional = rankingsFallbackCopy("zh-tw");
    expect(traditional.guidance).not.toBe(simplified.guidance);
    expect(traditional.guidance).toContain("暫時無法載入");
    expect(traditional.explore).toContain("詞典");

    const arabic = renderToStaticMarkup(<RankingsUnavailable locale="ar" />);
    expect(arabic).toContain('lang="ar"');
    expect(arabic).toContain('dir="rtl"');
    expect(arabic).toContain("text-right");
    expect(arabic).toContain("justify-start");
    expect(arabic).not.toContain("justify-end");
    expect(arabic).toContain('href="/explore"');
    expect(arabic).not.toContain("/ar/explore");
    expect(getDocumentDirection("ar")).toBe("rtl");
    expect(rankingsExploreHref("ar")).toBe("/explore");
    expect(rankingsExploreHref("en")).toBe("/en/explore");
    expect(rankingsExploreHref("ko")).toBe("/explore");
    expect(documentLocaleFromPathname("/ar/rankings")).toBe("ar");
    expect(documentLocaleFromPathname("/zh-tw/rankings")).toBe("zh-tw");
    expect(documentLocaleFromPathname("/rankings")).toBeNull();
  });
});
