import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getLocalizedExploreMemes: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("@/lib/localized-explore", () => ({
  getLocalizedExploreMemes: mocks.getLocalizedExploreMemes,
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: mocks.redirect }));
vi.mock("@/components/localized-explore-card", () => ({
  LocalizedExploreCard: ({ meme }: { meme: { id: string } }) => <li>{meme.id}</li>,
}));

import LocalizedExplorePage, { generateMetadata } from "@/app/[locale]/explore/page";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";

const getLocalizedExploreMemes = mocks.getLocalizedExploreMemes;

const locales = ["en", "ja", "zh", "zh-tw"] as const;

describe("localized Explore coverage-empty action", () => {
  beforeEach(() => {
    getLocalizedExploreMemes.mockReset();
    mocks.redirect.mockClear();
  });

  it("links every coverage-empty locale to the Korean original Explore", async () => {
    for (const locale of locales) {
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty", page: 1, hasPrevious: false, hasNext: false });

      const html = renderToStaticMarkup(
        await LocalizedExplorePage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({}),
        }),
      );

      expect(html).toContain('data-localized-explore-original-action="true"');
      expect(html).toContain('href="/explore"');
      expect(html).toContain(LOCALIZED_EXPLORE_COPY[locale].originalExplore);
    }
  });

  it("keeps the original Explore action out of active and unavailable states", async () => {
    for (const status of ["active", "unavailable"] as const) {
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status, page: 1, hasPrevious: false, hasNext: false });

      const html = renderToStaticMarkup(
        await LocalizedExplorePage({
          params: Promise.resolve({ locale: "en" }),
          searchParams: Promise.resolve({}),
        }),
      );

      expect(html).not.toContain("data-localized-explore-original-action");
    }
  });

  it("routes only the supported recent query, including the first array item", async () => {
    const cases: [string | string[], "recent" | undefined][] = [
      ["recent", "recent"],
      [["recent", "trending"], "recent"],
      ["trending", undefined],
      [["trending", "recent"], undefined],
    ];

    for (const [sort, expected] of cases) {
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty", page: 1, hasPrevious: false, hasNext: false });

      await LocalizedExplorePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sort }),
      });

      expect(getLocalizedExploreMemes).toHaveBeenLastCalledWith("en", expected, 1);
    }
  });

  it("keeps recent-query metadata canonical and noindex", async () => {
    getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty", page: 1, hasPrevious: false, hasNext: false });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ sort: "recent" }),
    });

    expect(getLocalizedExploreMemes).toHaveBeenCalledWith("en", "recent", 1);
    expect(metadata.alternates).toEqual({ canonical: "/en/explore" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("self-canonicalizes unfiltered later pages and renders crawlable pagination", async () => {
    getLocalizedExploreMemes.mockResolvedValue({
      items: [{ id: "meme-1" }],
      status: "active",
      page: 2,
      hasPrevious: true,
      hasNext: true,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ page: "2" }),
    });
    expect(metadata.alternates).toEqual({ canonical: "/en/explore?page=2" });
    expect(metadata.robots).toEqual({ index: true, follow: true });

    const html = renderToStaticMarkup(
      await LocalizedExplorePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ page: "2" }),
      }),
    );
    expect(html).toContain('href="/en/explore"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('href="/en/explore?page=3"');
    expect(html).toContain('rel="next"');
  });

  it("clamps an out-of-range localized page during metadata resolution", async () => {
    getLocalizedExploreMemes.mockResolvedValue({
      items: [],
      status: "active",
      page: 2,
      hasPrevious: true,
      hasNext: false,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ page: "999" }),
    });

    expect(metadata.alternates).toEqual({ canonical: "/en/explore?page=2" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
