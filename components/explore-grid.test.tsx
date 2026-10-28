// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreGrid } from "@/components/explore-grid";
import type { MemeListItem } from "@/lib/queries";

const clientMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: clientMocks.createClient }));

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
  clientMocks.createClient.mockReset();
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

  it("continues from the server-consumed offset without skipping a page", async () => {
    let observerCallback: IntersectionObserverCallback | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    const range = vi.fn(async () => ({ data: [], error: null }));
    const chain: Record<string, unknown> = { range };
    for (const method of ["select", "in", "eq", "not", "ilike", "gte", "lte", "order"]) {
      chain[method] = vi.fn(() => chain);
    }
    clientMocks.createClient.mockReturnValue({ rpc: vi.fn(() => chain) });
    const initial = Array.from({ length: 24 }, (_, index) => ({
      ...meme,
      id: `meme-${index}`,
      title: `밈 ${index}`,
    }));

    render(
      <ExploreGrid
        initial={initial}
        initialOffset={48}
        hasMoreInitial
        filters={{ q: "밈", categories: [], sort: "trending" }}
      />,
    );

    await act(async () => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    await waitFor(() => expect(range).toHaveBeenCalledWith(48, 71));
  });
});
