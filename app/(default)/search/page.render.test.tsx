import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const searchMemes = vi.hoisted(() => vi.fn());
const getTrendingMemes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({ searchMemes, getTrendingMemes }));
vi.mock("@/app/(default)/search/search-input", () => ({
  SearchInput: ({ initialQuery }: { initialQuery: string }) => (
    <form role="search"><input value={initialQuery} readOnly /></form>
  ),
}));
vi.mock("@/components/meme-reference-search", () => ({
  MemeReferenceSearch: ({ query }: { query: string }) => (
    <section data-reference-results>{query}</section>
  ),
}));
vi.mock("@/components/meme-card", () => ({ MemeCard: () => null }));
vi.mock("@/components/search-outcome-tracker", () => ({ SearchOutcomeTracker: () => null }));
vi.mock("@/components/tracked-block", () => ({
  TrackedBlock: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import SearchPage, { metadata } from "@/app/(default)/search/page";

beforeEach(() => {
  searchMemes.mockReset();
  getTrendingMemes.mockReset();
  getTrendingMemes.mockResolvedValue([]);
});

describe("root search no-exact-match state", () => {
  it("keeps a compact lexical notice above the independent situation results", async () => {
    searchMemes.mockResolvedValue([]);

    const html = renderToStaticMarkup(
      await SearchPage({ searchParams: Promise.resolve({ q: "친구 취향을 따라 할 때" }) }),
    );

    expect(html).toContain('data-search-no-exact-match="true"');
    expect(html).toContain("이름·별칭으로 일치하는 밈은 없어요.");
    expect(html).toContain("아래 상황·의미 검색은 별도로 확인해요.");
    expect(html).toContain("검색어는 등록된 공개 밈 자료 안에서만 찾아요.");
    expect(html).not.toContain("AI 서비스");
    expect(html).not.toContain("검색 의도 분류");
    expect(html).toContain('href="/submit?name=%EC%B9%9C%EA%B5%AC%20%EC%B7%A8%ED%96%A5%EC%9D%84%20%EB%94%B0%EB%9D%BC%20%ED%95%A0%20%EB%95%8C"');
    expect(html).not.toContain("이 밈, 저희도 아직 몰라요");
    expect(html).not.toContain("state-empty-search.webp");
    expect(html.indexOf("data-search-no-exact-match")).toBeLessThan(
      html.indexOf("data-reference-results"),
    );
  });

  it("describes both direct and situation search without promising a combined result", () => {
    expect(metadata.description).toContain("이름·초성·별칭");
    expect(metadata.description).toContain("상황");
  });
});
