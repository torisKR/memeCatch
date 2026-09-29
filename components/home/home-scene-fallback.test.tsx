// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeSceneFallback } from "@/components/home/home-scene-fallback";

describe("HomeSceneFallback", () => {
  afterEach(cleanup);

  it("renders the studio emblem, staggered editorial cards, and four signal tokens", () => {
    const { container } = render(<HomeSceneFallback selectedSignal="yellow" />);
    const artwork = container.querySelector("svg");

    expect(artwork?.querySelector('[data-studio-emblem="speech-loop"]')).not.toBeNull();
    expect(artwork?.querySelectorAll("[data-editorial-card]")).toHaveLength(2);
    expect(artwork?.querySelectorAll("[data-signal-token]")).toHaveLength(4);
    expect(artwork?.querySelector('[data-signal-level="yellow"]')?.getAttribute("data-selected")).toBe("true");
    expect(artwork?.querySelector("[data-mascot-part]")).toBeNull();
    expect(artwork?.querySelector("[data-scene-plinth]")).toBeNull();
  });

  it("keeps signal positions consistent when switching from the 3D scene", () => {
    const { container } = render(<HomeSceneFallback />);
    const positions = Object.fromEntries(["green", "yellow", "gray", "red"].map((level) => {
      const transform = container.querySelector(`[data-signal-level="${level}"]`)?.getAttribute("transform") ?? "";
      const coordinates = transform.match(/translate\((\d+) (\d+)\)/);
      expect(coordinates).not.toBeNull();
      return [level, [Number(coordinates![1]), Number(coordinates![2])]];
    }));
    // Same spatial mapping as the WebGL tokens: red/green above gray/yellow.
    expect(positions.red[0]).toBeLessThan(positions.green[0]);
    expect(positions.gray[0]).toBeLessThan(positions.yellow[0]);
    expect(positions.red[1]).toBeLessThan(positions.gray[1]);
    expect(positions.green[1]).toBeLessThan(positions.yellow[1]);
  });

  it("uses independent metallic and enamel paint definitions for every instance", () => {
    const first = render(<HomeSceneFallback />);
    const second = render(<HomeSceneFallback />);
    const firstSvg = first.container.querySelector("svg");
    const secondSvg = second.container.querySelector("svg");

    expect(firstSvg?.querySelector('[data-paint="orange-enamel"]')).not.toBeNull();
    expect(firstSvg?.querySelector('[data-paint="chrome"]')).not.toBeNull();
    expect(firstSvg?.querySelector('[data-paint="ivory"]')).not.toBeNull();
    expect(firstSvg?.querySelectorAll("filter").length).toBeGreaterThanOrEqual(2);

    const firstIds = new Set([...firstSvg!.querySelectorAll("[id]")].map((node) => node.id));
    const secondIds = new Set([...secondSvg!.querySelectorAll("[id]")].map((node) => node.id));
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
  });
});
