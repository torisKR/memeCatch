// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignalPointer } from "./signal-pointer";

function stubMedia(matches: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches[query] ?? false }));
}

function move(target: Element, clientX: number, clientY: number, pointerType = "mouse") {
  const event = new Event("pointermove", { bubbles: true });
  Object.assign(event, { clientX, clientY, pointerType });
  target.dispatchEvent(event);
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  document.body.innerHTML = '<a data-pointer-light id="card"><span id="inner">밈</span></a><p id="outside">밖</p>';
  const card = document.getElementById("card")!;
  card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SignalPointer", () => {
  it("writes the pointer position and tilt to the card under the mouse", () => {
    stubMedia({ "(hover: hover) and (pointer: fine)": true });
    render(<SignalPointer />);
    const card = document.getElementById("card")!;

    move(document.getElementById("inner")!, 150, 25);

    expect(card.style.getPropertyValue("--px")).toBe("75.0%");
    expect(card.style.getPropertyValue("--py")).toBe("25.0%");
    expect(card.style.getPropertyValue("--tilt-x")).toBe("2.00deg");
    expect(card.style.getPropertyValue("--tilt-y")).toBe("2.00deg");
  });

  it("flattens the card again when the mouse leaves it", () => {
    stubMedia({ "(hover: hover) and (pointer: fine)": true });
    render(<SignalPointer />);
    const card = document.getElementById("card")!;
    move(card, 150, 25);

    move(document.getElementById("outside")!, 500, 500);

    expect(card.style.getPropertyValue("--tilt-x")).toBe("");
    expect(card.style.getPropertyValue("--tilt-y")).toBe("");
  });

  it.each([
    ["touch input", { "(hover: hover) and (pointer: fine)": false }],
    ["reduced motion", { "(hover: hover) and (pointer: fine)": true, "(prefers-reduced-motion: reduce)": true }],
  ])("does nothing for %s", (_label, media) => {
    stubMedia(media);
    render(<SignalPointer />);
    const card = document.getElementById("card")!;

    move(card, 150, 25);

    expect(card.style.getPropertyValue("--px")).toBe("");
  });
});
