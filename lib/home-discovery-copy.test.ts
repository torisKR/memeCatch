import { describe, expect, it } from "vitest";

import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import { SEO_ROUTE_LOCALES } from "@/lib/i18n-routing";

describe("HOME_DISCOVERY_COPY", () => {
  it("provides complete discovery controls and states in every home locale", () => {
    expect(Object.keys(HOME_DISCOVERY_COPY)).toEqual([...SEO_ROUTE_LOCALES]);

    for (const locale of SEO_ROUTE_LOCALES) {
      const copy = HOME_DISCOVERY_COPY[locale];
      const required = [
        copy.eyebrow,
        copy.title,
        copy.description,
        copy.searchLabel,
        copy.searchPlaceholder,
        copy.searchScope,
        copy.categoryLabel,
        copy.allCategories,
        copy.resultsLabel,
        copy.clearFilters,
        copy.noResultsTitle,
        copy.noResultsDescription,
        copy.emptyTitle,
        copy.emptyDescription,
        copy.readEntry,
        copy.originalLabel,
        copy.previewLabel,
        copy.previewEyebrow,
        copy.previewTitle,
        copy.previewDescription,
        copy.previewAction,
        copy.nextPreview,
      ];

      expect(required.every(Boolean)).toBe(true);
      expect(copy.resultStatus(0, 3)).toContain("0");
      expect(copy.resultStatus(2, 3)).toContain("2");
      expect(copy.resultStatus(2, 3)).toContain("3");
    }
  });

  it("keeps each displayed-set search scope explicit instead of claiming archive search", () => {
    const scopeCopy = SEO_ROUTE_LOCALES.map(
      (locale) => HOME_DISCOVERY_COPY[locale].searchScope,
    ).join(" ");

    expect(scopeCopy).not.toMatch(/search(?:es)? (?:the )?(?:entire|whole) archive/iu);
    expect(HOME_DISCOVERY_COPY.en.searchScope).toContain("recent set");
    expect(HOME_DISCOVERY_COPY.ko.searchScope).toContain("편집 추천 항목 안에서만");
  });
});
