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
    expect(screen.queryByText("이 조건의 밈이 아직 없어요")).toBeNull();
    expect(screen.queryByText("필터를 풀어 보거나, 알고 있는 밈을 제보해 주세요.")).toBeNull();
  });

  it("renders an empty state with a submit path when there are no results", () => {
    render(
      <ExploreGrid
        initial={[]}
        filters={{ categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getByText("이 조건의 밈이 아직 없어요")).toBeTruthy();
    expect(screen.getByRole("link", { name: "밈 제보하기" }).getAttribute("href")).toBe(
      "/submit",
    );
  });

  it("names a zero-result search query in the empty state", () => {
    render(
      <ExploreGrid
        initial={[]}
        filters={{ q: "없는밈", categories: [], sort: "trending" }}
      />,
    );

    expect(screen.getByText(/검색 결과가 없어요/)).toBeTruthy();
    expect(screen.getByText("없는밈")).toBeTruthy();
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
