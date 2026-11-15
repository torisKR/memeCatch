import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const searchMemes = vi.hoisted(() => vi.fn());
const getTrendingMemes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({ searchMemes, getTrendingMemes }));
vi.mock("@/app/(default)/search/search-input", () => ({
  SearchInput: ({ initialQuery }: { initialQuery: string }) => (
    <form role="search">
      <input value={initialQuery} readOnly />
    </form>
  ),
}));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: { title: string } }) => <span>{meme.title}</span>,
}));
vi.mock("@/components/meme-reference-search", () => ({
  MemeReferenceSearch: () => null,
}));
vi.mock("@/components/search-outcome-tracker", () => ({
  SearchOutcomeTracker: () => null,
}));
vi.mock("@/components/tracked-block", () => ({
  TrackedBlock: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import SearchPage from "@/app/(default)/search/page";

const result = {
  id: "meme-1",
  short_id: "abc12345",
  slug: "search-result",
  title: "검색된 밈",
};

beforeEach(() => {
  searchMemes.mockReset();
  getTrendingMemes.mockReset();
  getTrendingMemes.mockResolvedValue([]);
});

describe("Korean search results", () => {
  it.each([1, 2])("renders an exact result set with %i card(s)", async (count) => {
    searchMemes.mockResolvedValue(
      Array.from({ length: count }, (_, index) => ({
        ...result,
        id: `meme-${index + 1}`,
        title: `검색된 밈 ${index + 1}`,
      })),
    );

    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: "검색어" }) }),
    );

    expect(html).toContain('aria-label="검색 결과"');
    expect(html).toContain(`검색 결과 <span class="stat-mono">${count}</span>개예요`);
    expect(html).toContain("검색된 밈 1");
  });
});
