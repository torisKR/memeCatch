// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HomeChapterNav } from "./home-chapter-nav";

const ids = ["home-top", "home-latest", "home-signals", "home-pathways", "home-editorial"];
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("preserves real native anchors and updates exactly one current chapter without scrolling the page", () => {
  const scheduled = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((fn: FrameRequestCallback) => { scheduled.set(++nextId, fn); return nextId; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => scheduled.delete(id)));
  const positions = [0, 600, 1200, 1800, 2400];
  ids.forEach((id, i) => {
    const section = document.createElement("section"); section.id = id;
    section.getBoundingClientRect = () => ({ top: positions[i], height: 500, bottom: positions[i] + 500 } as DOMRect);
    document.body.append(section);
  });
  const flush = () => act(() => { const queue = [...scheduled.values()]; scheduled.clear(); queue.forEach((fn) => fn(16)); });
  const { unmount } = render(<HomeChapterNav locale="en" />);
  flush();
  const nav = screen.getByRole("navigation", { name: "Home sections" });
  expect(within(nav).getAllByRole("link").map(a => a.getAttribute("href"))).toEqual(ids.map(id => `#${id}`));
  expect(within(nav).getByRole("link", { name: "Top" }).getAttribute("aria-current")).toBe("location");
  positions.splice(0, 5, -1300, -700, -100, 500, 1100);
  act(() => { window.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("scroll")); });
  expect(scheduled.size).toBe(1);
  flush();
  expect(within(nav).getByRole("link", { name: "Usage signals" }).getAttribute("aria-current")).toBe("location");
  expect(nav.querySelectorAll('[aria-current="location"]')).toHaveLength(1);
  act(() => window.dispatchEvent(new Event("scroll")));
  unmount();
  expect(scheduled.size).toBe(0);
  window.dispatchEvent(new Event("scroll"));
  expect(scheduled.size).toBe(0);
});
