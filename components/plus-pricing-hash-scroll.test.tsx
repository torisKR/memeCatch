// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PlusPricingHashScroll } from "@/components/plus-pricing-hash-scroll";

function slot(className: string, name: string) {
  const element = document.createElement("div");
  element.className = className;
  element.dataset.plusPricingSlot = name;
  const scrolled: string[] = [];
  element.scrollIntoView = () => {
    scrolled.push(name);
  };
  document.body.append(element);
  return { element, scrolled };
}

describe("PlusPricingHashScroll", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/");
  });

  it("scrolls the phone card when the recovery hash targets the hidden desktop heading", () => {
    window.history.replaceState({}, "", "/memes/example#plus-pricing-title");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const desktop = slot("hidden lg:block", "rail");
    const mobile = slot("lg:hidden", "after-sources");

    render(<PlusPricingHashScroll />);

    expect(mobile.scrolled).toEqual(["after-sources"]);
    expect(desktop.scrolled).toEqual([]);
  });

  it("scrolls the desktop rail at 1280", () => {
    window.history.replaceState({}, "", "/memes/example#plus-pricing-title");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    const desktop = slot("hidden lg:block", "rail");
    const mobile = slot("lg:hidden", "after-sources");

    render(<PlusPricingHashScroll />);

    expect(desktop.scrolled).toEqual(["rail"]);
    expect(mobile.scrolled).toEqual([]);
  });

  it("does not scroll when the hash is absent", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const mobile = slot("lg:hidden", "after-sources");

    render(<PlusPricingHashScroll />);

    expect(mobile.scrolled).toEqual([]);
  });
});
