import { describe, expect, it } from "vitest";
import {
  SEO_CONTENT_LOCALES,
  SEO_LOCALE_CONFIG,
  SEO_LOCALE_COPY,
  buildHreflangLanguages,
  buildLocalizedMetadata,
  getHreflang,
  getOpenGraphLocale,
  isSeoContentLocale,
  isLocalizedStaticPath,
  localizedMemePath,
  localizedPath,
  localizedStaticPath,
  parseLocalePath,
  stripLocalePath,
  toSeoBcp47,
} from "@/lib/i18n-routing";

describe("SEO locale routing", () => {
  it("limits indexable translated content to locales with dedicated copy", () => {
    expect(SEO_CONTENT_LOCALES).toEqual(["en", "ja", "zh", "zh-tw"]);
    expect(isSeoContentLocale("en")).toBe(true);
    expect(isSeoContentLocale("ko")).toBe(false);
    expect(isSeoContentLocale("fr")).toBe(false);
  });

  it.each([
    ["/", "ko", "/"],
    ["/about", "ko", "/about"],
    ["/about", "en", "/en/about"],
    ["/en/about", "ja", "/ja/about"],
    ["/zh-tw/search?q=밈#results", "en", "/en/search?q=밈#results"],
    ["/en", "zh", "/zh"],
  ] as const)("localizes %s for %s", (path, locale, expected) => {
    expect(localizedPath(path, locale)).toBe(expected);
  });

  it("parses and strips only supported SEO path prefixes", () => {
    expect(parseLocalePath("/zh-tw/memes/abc?from=home")).toEqual({
      locale: "zh-tw",
      pathname: "/memes/abc?from=home",
      hadLocalePrefix: true,
    });
    expect(parseLocalePath("/fr/memes/abc")).toEqual({
      locale: "ko",
      pathname: "/fr/memes/abc",
      hadLocalePrefix: false,
    });
    expect(stripLocalePath("/ko/about#team")).toBe("/about#team");
  });

  it("builds localized meme paths without changing the Korean canonical shape", () => {
    expect(localizedMemePath("ko", "a1b2c3", "원영적 사고")).toBe(
      "/memes/a1b2c3-%EC%9B%90%EC%98%81%EC%A0%81%20%EC%82%AC%EA%B3%A0",
    );
    expect(localizedMemePath("en", "a1b2c3", "원영적 사고")).toBe(
      "/en/memes/a1b2c3-%EC%9B%90%EC%98%81%EC%A0%81%20%EC%82%AC%EA%B3%A0",
    );
  });

  it("localizes only static routes that actually exist in every SEO locale", () => {
    expect(isLocalizedStaticPath("/en/pricing?source=header")).toBe(true);
    expect(isLocalizedStaticPath("/en/daily")).toBe(true);
    expect(isLocalizedStaticPath("/en/search?q=돌아온")).toBe(true);
    expect(isLocalizedStaticPath("/explore")).toBe(true);
    expect(isLocalizedStaticPath("/meme-cards")).toBe(true);
    expect(localizedStaticPath("/meme-cards", "en")).toBe("/en/meme-cards");
    expect(localizedStaticPath("/pricing", "en")).toBe("/en/pricing");
    expect(localizedStaticPath("/daily", "ja")).toBe("/ja/daily");
    expect(localizedStaticPath("/search", "en")).toBe("/en/search");
    expect(localizedStaticPath("/explore", "zh-tw")).toBe("/zh-tw/explore");
    expect(localizedStaticPath("/en/pricing?source=header", "ja")).toBe(
      "/ja/pricing?source=header",
    );
    expect(localizedStaticPath("/pricing", "th")).toBe("/pricing");
  });
});

describe("SEO locale signals", () => {
  it("maps Chinese variants to distinct language and Open Graph signals", () => {
    expect(getHreflang("zh")).toBe("zh-Hans");
    expect(getHreflang("zh-tw")).toBe("zh-Hant");
    expect(toSeoBcp47("zh-tw")).toBe("zh-TW");
    expect(getOpenGraphLocale("zh")).toBe("zh_CN");
    expect(getOpenGraphLocale("zh-tw")).toBe("zh_TW");
    expect(SEO_LOCALE_CONFIG.ja.documentLanguage).toBe("ja");
    expect(SEO_LOCALE_CONFIG.en.dateLocale).toBe("en-US");
  });

  it("provides complete default SEO copy for every route locale", () => {
    for (const copy of Object.values(SEO_LOCALE_COPY)) {
      expect(copy.siteName).toBeTruthy();
      expect(copy.defaultTitle).toBeTruthy();
      expect(copy.titleTemplate).toContain("%s");
      expect(copy.description).toBeTruthy();
      expect(copy.glossaryName).toBeTruthy();
      expect(Object.values(copy.categories).every(Boolean)).toBe(true);
    }
  });

  it("builds reciprocal hreflang paths only for the locales supplied by the caller", () => {
    expect(buildHreflangLanguages("/memes/a1-name", ["ko", "en"])).toEqual({
      ko: "/memes/a1-name",
      en: "/en/memes/a1-name",
    });
  });

  it("builds localized canonical, hreflang, Open Graph, and Twitter metadata", () => {
    const metadata = buildLocalizedMetadata({
      locale: "en",
      pathname: "/memes/a1-name",
      title: "Korean meme meaning",
      description: "A complete explanation.",
      availableLocales: ["ko", "en", "ja"],
    });

    expect(metadata.alternates).toEqual({
      canonical: "/en/memes/a1-name",
      languages: {
        ko: "/memes/a1-name",
        en: "/en/memes/a1-name",
        ja: "/ja/memes/a1-name",
        // 글로벌 피벗: x-default는 한국어가 아닌 영어 경로를 가리킨다.
        "x-default": "/en/memes/a1-name",
      },
    });
    expect(metadata.openGraph).toMatchObject({
      locale: "en_US",
      alternateLocale: ["ko_KR", "ja_JP"],
      url: "/en/memes/a1-name",
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("resets an inherited title template while preserving the localized child template", () => {
    const metadata = buildLocalizedMetadata({ locale: "en" });

    expect(metadata.title).toEqual({
      absolute: "MemeCatch — Korean Memes Explained",
      template: "%s | MemeCatch",
    });
  });
});
