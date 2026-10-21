// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemeDetailNavigation } from "@/components/meme-detail-navigation";

afterEach(cleanup);

describe("MemeDetailNavigation", () => {
  it("renders the supplied section targets as an ordered list of native hash links", () => {
    render(
      <MemeDetailNavigation
        label="이 밈 빠르게 보기"
        items={[
          { id: "meaning", label: "뜻" },
          { id: "origin", label: "유래와 확산" },
          { id: "usage", label: "사용 예" },
        ]}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "이 밈 빠르게 보기" });
    const list = within(navigation).getByRole("list");
    const links = within(list).getAllByRole("link");

    expect(list.tagName).toBe("OL");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#meaning",
      "#origin",
      "#usage",
    ]);
    expect(links.map((link) => link.textContent)).toEqual(["뜻", "유래와 확산", "사용 예"]);
    expect(links.every((link) => link.className.includes("min-h-11"))).toBe(true);
    expect(links.every((link) => link.className.includes("focus-visible:outline"))).toBe(true);
  });

  it("renders nothing when the route has no actual section targets", () => {
    const { container } = render(
      <MemeDetailNavigation label="이 밈 빠르게 보기" items={[]} />,
    );

    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders supplied labels as text instead of executable markup", () => {
    const unsafeLookingLabel = '<img src="x" onerror="alert(1)">';
    render(
      <MemeDetailNavigation
        label="상세 목차"
        items={[{ id: "evidence", label: unsafeLookingLabel }]}
      />,
    );

    expect(screen.getByRole("link", { name: unsafeLookingLabel }).getAttribute("href")).toBe(
      "#evidence",
    );
    expect(document.querySelector("img")).toBeNull();
  });
});
