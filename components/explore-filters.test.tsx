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
});
