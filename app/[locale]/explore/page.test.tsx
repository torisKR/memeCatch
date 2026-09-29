import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getLocalizedExploreMemes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/localized-explore", () => ({ getLocalizedExploreMemes }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

import LocalizedExplorePage, { generateMetadata } from "@/app/[locale]/explore/page";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";

const locales = ["en", "ja", "zh", "zh-tw"] as const;

describe("localized Explore coverage-empty action", () => {
  beforeEach(() => {
    getLocalizedExploreMemes.mockReset();
  });

  it("links every coverage-empty locale to the Korean original Explore", async () => {
    for (const locale of locales) {
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty" });

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
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status });

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
      getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty" });

      await LocalizedExplorePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sort }),
      });

      expect(getLocalizedExploreMemes).toHaveBeenLastCalledWith("en", expected);
    }
  });

  it("keeps recent-query metadata canonical and noindex", async () => {
    getLocalizedExploreMemes.mockResolvedValueOnce({ items: [], status: "coverage-empty" });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ sort: "recent" }),
    });

    expect(getLocalizedExploreMemes).toHaveBeenCalledWith("en", "recent");
    expect(metadata.alternates).toEqual({ canonical: "/en/explore" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});
