// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreGrid } from "@/components/explore-grid";
import type { MemeListItem } from "@/lib/queries";

vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme }: { meme: MemeListItem }) => (
    <a href={`/memes/${meme.id}`} data-testid="explore-card">
      {meme.title}
    </a>
  ),
}));

const meme = {
  id: "explore-card-1",
  title: "새로 불러온 밈",
} as MemeListItem;

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ExploreGrid", () => {
  it("renders loaded cards without an initial hidden animation state", () => {
    render(
      <ExploreGrid
        initial={[meme]}
        filters={{ categories: [], sort: "trending" }}
      />,
    );

    const item = screen.getByTestId("explore-card").closest("li");
    expect(item).not.toBeNull();
    expect(item?.style.opacity).not.toBe("0");
  });

  it("shows a load failure instead of the empty catalog when the first query fails", () => {
    render(
      <ExploreGrid
        initial={[]}
        catalogUnavailable
        filters={{ categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("밈 목록을 불러오지 못했어요");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(screen.queryByText("조건에 맞는 밈이 아직 없어요")).toBeNull();
  });

  it("shows the filter-reset empty state when a result set has no cards", () => {
    render(
      <ExploreGrid
        initial={[]}
        filters={{ categories: ["phrase"], sort: "trending" }}
      />,
    );

    expect(screen.getByText("조건에 맞는 밈이 아직 없어요")).toBeTruthy();
    const reset = screen.getByRole("button", { name: "필터 초기화" });
    expect(reset.closest("form")?.getAttribute("action")).toBe("/explore");
    expect(reset.closest("form")?.getAttribute("method")).toBe("get");
    expect(screen.getByRole("link", { name: "밈 제보하기" }).getAttribute("href")).toBe(
      "/submit",
    );
  });

  it("keeps one or two explore cards instead of hiding the dictionary grid", () => {
    render(
      <ExploreGrid
        initial={[meme, { ...meme, id: "explore-card-2", title: "두 번째 밈" }]}
        filters={{ categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getAllByTestId("explore-card")).toHaveLength(2);
    expect(screen.queryByText("조건에 맞는 밈이 아직 없어요")).toBeNull();
  });

  it("keeps a zero-result search query on the submit path", () => {
    render(
      <ExploreGrid
        initial={[]}
        filters={{ q: "없는밈", categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getByText("조건에 맞는 밈이 아직 없어요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "밈 제보하기" }).getAttribute("href")).toBe(
      "/submit?name=%EC%97%86%EB%8A%94%EB%B0%88",
    );
  });

  it("encodes a trimmed zero-result query in the submission path", () => {
    render(
      <ExploreGrid
        initial={[]}
        filters={{ q: "  고양이 & 강아지  ", categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getByRole("link", { name: "밈 제보하기" }).getAttribute("href")).toBe(
      "/submit?name=%EA%B3%A0%EC%96%91%EC%9D%B4+%26+%EA%B0%95%EC%95%84%EC%A7%80",
    );
  });
});
