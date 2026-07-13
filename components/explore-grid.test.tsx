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
});
