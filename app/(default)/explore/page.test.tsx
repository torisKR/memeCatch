import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  range: vi.fn(),
  headResult: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/social-platform-counts.server", () => ({
  getSocialPlatformCounts: vi.fn(async () => ({})),
}));
vi.mock("@/components/explore-filters", () => ({ ExploreFilters: () => <div /> }));
vi.mock("@/components/json-ld", () => ({ ExploreCollectionJsonLd: () => null }));
vi.mock("@/components/explore-grid", () => ({
  ExploreGrid: ({ initialOffset, hasMoreInitial }: { initialOffset: number; hasMoreInitial: boolean }) => (
    <div data-testid="grid" data-offset={initialOffset} data-more={String(hasMoreInitial)} />
  ),
}));
vi.mock("@/lib/supabase/server", () => ({
  createStaticClient: () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "in", "eq", "not", "ilike", "gte", "lte", "order"]) {
      chain[method] = vi.fn(() => chain);
    }
    chain.range = mocks.range;
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(mocks.headResult()).then(resolve);
    return { from: vi.fn(() => chain), rpc: vi.fn(() => chain) };
  },
}));

import ExplorePage, { generateMetadata } from "@/app/(default)/explore/page";

describe("default Explore pagination", () => {
  beforeEach(() => {
    mocks.range.mockReset();
    mocks.headResult.mockReset().mockReturnValue({ data: null, count: 0, error: null });
    mocks.redirect.mockClear();
  });

  it("renders an SSR page window with crawlable previous and next links", async () => {
    mocks.range.mockResolvedValue({
      data: Array.from({ length: 25 }, (_, index) => ({ id: `meme-${index}` })),
      count: 80,
      error: null,
    });

    const html = renderToStaticMarkup(
      await ExplorePage({ searchParams: Promise.resolve({ page: "2" }) }),
    );

    expect(mocks.range).toHaveBeenCalledWith(24, 48);
    expect(html).toContain('data-offset="48"');
    expect(html).toContain('data-more="true"');
    expect(html).toContain('href="/explore"');
    expect(html).toContain('rel="prev"');
    expect(html).toContain('href="/explore?page=3"');
    expect(html).toContain('rel="next"');
    expect(html).toContain('href="/timeline"');
    expect(html).toContain('href="/weekly"');
    expect(html).toContain('href="/guides/reading-memes"');
  });

  it("self-canonicalizes unfiltered page two and noindexes filtered URLs", async () => {
    mocks.range.mockResolvedValue({ data: [], count: 80, error: null });
    const pageTwo = await generateMetadata({ searchParams: Promise.resolve({ page: "2" }) });
    expect(pageTwo.alternates).toEqual({ canonical: "/explore?page=2" });
    expect(pageTwo.robots).toEqual({ index: true, follow: true });

    const filtered = await generateMetadata({
      searchParams: Promise.resolve({ page: "2", sort: "recent" }),
    });
    expect(filtered.alternates).toEqual({ canonical: "/explore" });
    expect(filtered.robots).toEqual({ index: false, follow: true });
  });

  it("does not query externally just to build base-page metadata", async () => {
    const pageOne = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(pageOne.alternates).toEqual({ canonical: "/explore" });
    expect(mocks.range).not.toHaveBeenCalled();
  });

  it("keeps search pagination inside the RPC cap", async () => {
    mocks.range.mockResolvedValue({
      data: Array.from({ length: 50 }, (_, index) => ({ id: `search-${index}` })),
      error: null,
    });

    const html = renderToStaticMarkup(
      await ExplorePage({ searchParams: Promise.resolve({ q: "밈", page: "3" }) }),
    );

    expect(mocks.range).toHaveBeenCalledWith(0, 49);
    expect(html).toContain('data-offset="72"');
    expect(html).toContain('data-more="false"');
    expect(html).toContain('href="/explore?q=%EB%B0%88&amp;page=2"');
    expect(html).not.toContain('rel="next"');
  });

  it("redirects an out-of-range page once to the clamped last page", async () => {
    mocks.range.mockResolvedValue({ data: [], count: 80, error: null });

    await expect(
      ExplorePage({ searchParams: Promise.resolve({ page: "99" }) }),
    ).rejects.toThrow("redirect:/explore?page=4");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });

  it("clamps an out-of-range page during metadata resolution", async () => {
    mocks.range.mockResolvedValue({ data: [], count: 80, error: null });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ page: "999" }),
    });

    expect(metadata.alternates).toEqual({ canonical: "/explore?page=4" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("recovers the total after PostgREST rejects an unsatisfiable offset", async () => {
    mocks.range.mockResolvedValue({
      data: null,
      count: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
    });
    mocks.headResult.mockReturnValue({ data: null, count: 80, error: null });

    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ page: "999" }),
    });

    expect(metadata.alternates).toEqual({ canonical: "/explore?page=4" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(mocks.range).toHaveBeenCalledWith(23_952, 23_976);
    expect(mocks.headResult).toHaveBeenCalledTimes(1);
  });
});
