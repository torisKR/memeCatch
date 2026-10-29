// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import type { HomeEntry } from "@/components/home/home-experience";
import { HomeMotionHero } from "@/components/home/home-motion-hero";

const entries: HomeEntry[] = [
  {
    id: "lucky",
    href: "/memes/AAA111/lucky",
    title: "럭키비키",
    summary: "안 좋은 일도 결국 잘된 일이라고 웃어넘기는 말",
    categoryLabel: "유행어",
    safetyLevel: "green",
  },
  {
    id: "careful",
    href: "/memes/BBB222/careful",
    title: "맥락 밈",
    summary: "상대에 따라 다르게 들리는 말",
    categoryLabel: "유행어",
    safetyLevel: "yellow",
  },
];

function activeEntry(container: HTMLElement) {
  return container.querySelector("[data-motion-entry]")?.getAttribute("data-motion-entry");
}

afterEach(() => {
  cleanup();
});

describe("HomeMotionHero", () => {
  it("renders nothing without published entries", () => {
    const { container } = render(<HomeMotionHero locale="ko" entries={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the first entry as a real link with its usage signal", () => {
    const { container } = render(<HomeMotionHero locale="ko" entries={entries} />);

    expect(activeEntry(container)).toBe("lucky");
    expect(screen.getByRole("link", { name: /럭키비키/ }).getAttribute("href")).toBe("/memes/AAA111/lucky");
    expect(container.querySelector('[data-motion-signal="green"]')?.textContent).toContain("써도 됨");
  });

  it("advances to the next entry when the progress animation ends and wraps around", () => {
    const { container } = render(<HomeMotionHero locale="ko" entries={entries} />);
    // jsdom has no AnimationEvent, so React registers onAnimationEnd under the webkit-prefixed name.
    const eventName = typeof AnimationEvent === "undefined" ? "webkitAnimationEnd" : "animationend";
    const finish = () => {
      fireEvent(container.querySelector("[data-motion-progress]")!, new Event(eventName, { bubbles: true }));
    };

    act(finish);
    expect(activeEntry(container)).toBe("careful");
    expect(container.querySelector('[data-motion-signal="yellow"]')?.textContent).toContain("맥락 주의");

    act(finish);
    expect(activeEntry(container)).toBe("lucky");
  });

  it("lets the reader pause the scene and jump to a specific entry", () => {
    const { container } = render(<HomeMotionHero locale="ko" entries={entries} />);
    const region = screen.getByRole("region", { name: "밈 3초 해석" });

    fireEvent.click(screen.getByRole("button", { name: "장면 멈추기" }));
    expect(region.getAttribute("data-paused")).toBe("true");
    expect(screen.getByRole("button", { name: "장면 재생하기" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "이 밈 보기: 맥락 밈" }));
    expect(activeEntry(container)).toBe("careful");
    expect(screen.getByRole("button", { name: "이 밈 보기: 맥락 밈" }).getAttribute("aria-pressed")).toBe("true");
  });
});

