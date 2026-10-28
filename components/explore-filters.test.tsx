// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExploreFilters } from "@/components/explore-filters";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  query: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

afterEach(() => {
  cleanup();
  navigation.push.mockReset();
  navigation.query = "";
});

describe("ExploreFilters", () => {
  it("distinguishes internal rankings from external trends and does not repeat empty counts", () => {
    render(<ExploreFilters platformCounts={{ youtube: 0, youtube_shorts: 0, tiktok: 0, instagram: 0 }} />);
    expect(screen.getByRole("option", { name: "밈캐치 내 급상승" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "최근 등록" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "YouTube" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /· 0/ })).toBeNull();
  });
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
});
