// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CollectionsIndexPage from "./page";
import { COLLECTIONS } from "@/lib/collections";

afterEach(cleanup);

describe("CollectionsIndexPage", () => {
  it("links every curated collection exactly once in the visible index", () => {
    const { container } = render(<CollectionsIndexPage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("흩어진 밈을");
    expect(screen.getByRole("heading", { name: "바로 시작하기" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "시대별로 보기" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "주제별로 보기" })).not.toBeNull();

    const hrefs = [...container.querySelectorAll("a")].map((link) => link.getAttribute("href"));
    for (const collection of COLLECTIONS) {
      expect(hrefs.filter((href) => href === `/collections/${collection.slug}`)).toHaveLength(1);
    }
    expect(container.querySelector('script[type="application/ld+json"]')).not.toBeNull();
  });
});
