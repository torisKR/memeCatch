import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const searchMemes = vi.hoisted(() => vi.fn());
const getTrendingMemes = vi.hoisted(() => vi.fn());
const getLocalizedSearchMemesResult = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({ searchMemes, getTrendingMemes }));
vi.mock("@/lib/meme-translations", () => ({ getLocalizedSearchMemesResult }));
vi.mock("@/app/(default)/search/search-input", () => ({
  SearchInput: ({ initialQuery }: { initialQuery: string }) => (
    <form role="search">
      <input value={initialQuery} readOnly />
    </form>
  ),
}));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme, href }: { meme: { title: string }; href?: string }) => (
    <a href={href}>{meme.title}</a>
  ),
}));
vi.mock("@/components/search-outcome-tracker", () => ({
  SearchOutcomeTracker: () => null,
}));
vi.mock("@/components/tracked-block", () => ({
  TrackedBlock: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LocalizedSearchPage from "@/app/[locale]/search/page";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";

const LOCALES = ["en", "ja", "zh", "zh-tw"] as const;

const sourceMeme = {
  id: "meme-1",
  short_id: "abc12345",
  slug: "한국어-원문",
  title: "한국어 원문 밈",
};

beforeEach(() => {
  searchMemes.mockReset();
  getTrendingMemes.mockReset();
  getLocalizedSearchMemesResult.mockReset();
  getTrendingMemes.mockResolvedValue([]);
});

describe("localized search recovery action", () => {
  it.each([1, 2])("renders %i Korean search result(s) instead of hiding them", async (count) => {
    const results = Array.from({ length: count }, (_, index) => ({
      ...sourceMeme,
      id: `meme-${index + 1}`,
      short_id: `abc1234${index}`,
      title: `한국어 원문 밈 ${index + 1}`,
    }));
    searchMemes.mockResolvedValue(results);
    getLocalizedSearchMemesResult.mockResolvedValue({
      items: new Map(),
      status: "coverage-empty",
    });

    const html = renderToStaticMarkup(
      await LocalizedSearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "meme" }),
      }),
    );

    expect(html).toContain(`aria-label="${GLOBAL_SEARCH_COPY.en.resultSection}"`);
    expect(html).toContain("한국어 원문 밈 1");
  });

  it("offers each locale's Korean original Explore action only for coverage-empty results", async () => {
    for (const locale of LOCALES) {
      searchMemes.mockResolvedValueOnce([sourceMeme]);
      getLocalizedSearchMemesResult.mockResolvedValueOnce({
        items: new Map(),
        status: "coverage-empty",
      });

      const html = renderToStaticMarkup(
        await LocalizedSearchPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ q: "밈" }),
        }),
      );

      expect(html).toContain('data-localized-search-original-action="true"');
      expect(html).toContain('href="/explore"');
      expect(html).toContain(LOCALIZED_EXPLORE_COPY[locale].originalExplore);
      expect(html).not.toContain("data-localized-search-translation-options-action");
      expect(html).not.toContain("#plus-pricing-title");
    }
  });

  it.each(LOCALES)("does not offer recovery for active or unavailable in %s", async (locale) => {
    for (const { status, items } of [
      { status: "active" as const, items: new Map([[sourceMeme.short_id, { title: "Localized meme" }]]) },
      { status: "unavailable" as const, items: new Map() },
    ]) {
      searchMemes.mockResolvedValue([sourceMeme]);
      getLocalizedSearchMemesResult.mockResolvedValue({ items, status });

      const html = renderToStaticMarkup(
        await LocalizedSearchPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ q: "밈" }),
        }),
      );

      expect(html).not.toContain("data-localized-search-original-action");
      expect(html).not.toContain("data-localized-search-translation-options-action");
    }
  });

  it.each(LOCALES)("does not offer recovery when %s Korean search has no result", async (locale) => {
    searchMemes.mockResolvedValue([]);
    getLocalizedSearchMemesResult.mockResolvedValue({
      items: new Map(),
      status: "coverage-empty",
    });

    const html = renderToStaticMarkup(
      await LocalizedSearchPage({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({ q: "없는 밈" }),
      }),
    );

    expect(html).not.toContain("data-localized-search-original-action");
    expect(html).not.toContain("data-localized-search-translation-options-action");
    expect(html).toContain('<form role="search">');
  });
});
