// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExploreFilters } from "@/components/explore-filters";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  query: "",
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => "/explore",
  useSearchParams: () => navigation.params,
}));

afterEach(() => {
  cleanup();
  navigation.push.mockReset();
  navigation.query = "";
  navigation.params = new URLSearchParams();
});

describe("ExploreFilters", () => {
  it("uses disclosure and pressed-button semantics instead of orphaned tabs", async () => {
    const user = userEvent.setup();
    render(
      <ExploreFilters
        platformCounts={{ youtube: 12, youtube_shorts: 8, tiktok: 4, instagram: 2 }}
      />,
    );

    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();

    const disclosure = screen.getByRole("button", { name: "필터" });
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    await user.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");

    const category = screen.getByRole("button", { name: "밈 용어(유행어)" });
    expect(category.getAttribute("aria-pressed")).toBe("false");
    await user.click(category);

    expect(navigation.push).toHaveBeenCalledWith(
      "/explore?category=meme_term",
      { scroll: false },
    );
  });

  it("shows AI memes and keeps the tag-backed category exclusive", async () => {
    navigation.query = "category=meme_term";
    navigation.params = new URLSearchParams(navigation.query);
    const user = userEvent.setup();
    render(
      <ExploreFilters
        platformCounts={{ youtube: 12, youtube_shorts: 8, tiktok: 4, instagram: 2 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "필터 1" }));
    await user.click(screen.getByRole("button", { name: "AI 밈" }));

    expect(navigation.push).toHaveBeenCalledWith("/explore?category=ai-meme", {
      scroll: false,
    });
  });

  it("removes AI memes when selecting a format category", async () => {
    navigation.query = "category=ai-meme";
    navigation.params = new URLSearchParams(navigation.query);
    const user = userEvent.setup();
    render(
      <ExploreFilters
        platformCounts={{ youtube: 12, youtube_shorts: 8, tiktok: 4, instagram: 2 }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "필터 1" }));
    await user.click(screen.getByRole("button", { name: "밈 용어(유행어)" }));

    expect(navigation.push).toHaveBeenCalledWith("/explore?category=meme_term", {
      scroll: false,
    });
  });

  it("submits the typed query when the search button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ExploreFilters
        platformCounts={{ youtube: 12, youtube_shorts: 8, tiktok: 4, instagram: 2 }}
      />,
    );

    await user.type(screen.getByRole("searchbox", { name: "밈 이름이나 뜻으로 검색" }), "중꺾마");
    await user.click(screen.getByRole("button", { name: "검색" }));

    expect(navigation.push).toHaveBeenCalledWith(
      `/explore?q=${encodeURIComponent("중꺾마")}`,
      { scroll: false },
    );
  });
});
