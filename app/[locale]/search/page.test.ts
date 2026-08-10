import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { generateMetadata } from "@/app/[locale]/search/page";
import { GLOBAL_SEARCH_COPY } from "@/lib/i18n-global-search";
import { shouldOfferLocalizedSearchRecovery } from "@/lib/localized-search-recovery";

describe("localized search metadata", () => {
  it("keeps the English search surface localized and non-indexable", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe(GLOBAL_SEARCH_COPY.en.title);
    expect(metadata.description).toBe(GLOBAL_SEARCH_COPY.en.description);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({
      canonical: "/en/search",
    });
  });

  it("does not make a UI-only locale route indexable", async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({ locale: "th" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toEqual({ robots: { index: false, follow: false } });
  });
});

describe("localized search recovery", () => {
  it("offers Korean original Explore only for a reviewed-coverage gap", () => {
    expect(
      shouldOfferLocalizedSearchRecovery({
        query: "밈",
        resultCount: 2,
        localizedResultCount: 0,
        localizedStatus: "coverage-empty",
      }),
    ).toBe(true);
  });

  it.each([
    { query: "밈", resultCount: 2, localizedResultCount: 1, localizedStatus: "active" as const },
    { query: "밈", resultCount: 2, localizedResultCount: 0, localizedStatus: "unavailable" as const },
    { query: "밈", resultCount: 0, localizedResultCount: 0, localizedStatus: "coverage-empty" as const },
    { query: "", resultCount: 2, localizedResultCount: 0, localizedStatus: "coverage-empty" as const },
  ])("does not offer recovery for %#", (input) => {
    expect(shouldOfferLocalizedSearchRecovery(input)).toBe(false);
  });
});
