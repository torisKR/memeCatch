import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const koreanPage = readFileSync("app/(default)/page.tsx", "utf8");
const localizedPage = readFileSync("app/[locale]/page.tsx", "utf8");

describe("home route integration", () => {
  it("uses the same home experience in Korean and localized routes", () => {
    expect(koreanPage).toContain("<HomeExperience");
    expect(localizedPage).toContain("<HomeExperience");
    expect(koreanPage).toContain('locale="ko"');
    expect(localizedPage).toContain("locale={locale}");
  });

  it("uses publication recency for Korean cards and passes real safety levels on both routes", () => {
    expect(koreanPage).toContain("getRecentlyPublishedMemes(6)");
    expect(koreanPage).not.toContain("getLatestMemes");
    expect(koreanPage).toContain("safetyLevel: meme.safety_level");
    expect(localizedPage).toContain("safetyLevel: meme.safety_level");
  });

  it("preserves the Korean ad loader and both JSON-LD surfaces", () => {
    expect(koreanPage).toContain("<AdsenseScript />");
    expect(koreanPage).toContain("<WebSiteJsonLd />");
    expect(koreanPage).toContain("<DefinedTermSetJsonLd />");
    expect(localizedPage).toContain('type="application/ld+json"');
    expect(localizedPage).toContain('"@type": "WebSite"');
    expect(localizedPage).toContain('"@type": "DefinedTermSet"');
  });

  it("preserves canonical and complete home hreflang metadata", () => {
    expect(koreanPage).toContain('canonical: "/"');
    expect(koreanPage).toContain("buildHreflangLanguages");
    expect(koreanPage).toContain('"x-default": localizePath("/", "en")');
    expect(localizedPage).toContain("buildLocalizedMetadata");
    expect(localizedPage).toContain('availableLocales: ["ko", ...SEO_CONTENT_LOCALES]');
  });

  it("does not retain the divergent translation-desk layout or review claims", () => {
    expect(localizedPage).not.toContain("translation-desk");
    expect(localizedPage).not.toMatch(/human[- ]reviewed/i);
    expect(localizedPage).not.toMatch(/人工(审核|審核)/);
    expect(localizedPage).not.toContain("人が確認した");
  });
});
