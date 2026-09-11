// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatchMascot } from "@/components/catch-mascot";

describe("CatchMascot", () => {
  it("renders the brand-derived decorative scene with the requested state", () => {
    const { container } = render(<CatchMascot size="lg" state="discovering" />);
    const mascot = container.firstElementChild;

    expect(mascot?.getAttribute("aria-hidden")).toBe("true");
    expect(mascot?.getAttribute("data-catch-size")).toBe("lg");
    expect(mascot?.getAttribute("data-catch-state")).toBe("discovering");
    expect(mascot?.className).toContain("catch-mascot-lg");
    expect(mascot?.className).toContain("catch-mascot-discovering");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("circle.catch-mascot-dot")).not.toBeNull();
    expect(container.querySelector(".catch-mascot-scan")).not.toBeNull();
  });

  it.each([
    ["idle", ".catch-mascot-dot-core"],
    ["discovering", ".catch-mascot-scan"],
    ["help", ".catch-mascot-context"],
  ] as const)("renders the %s scene cue for product context", (state, cue) => {
    const { container } = render(<CatchMascot state={state} />);

    expect(container.querySelector(`[data-catch-state="${state}"]`)).not.toBeNull();
    expect(container.querySelector(cue)).not.toBeNull();
  });

  it("does not add an accessible control for decorative artwork", () => {
    render(<CatchMascot />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps SVG paint and filter IDs unique across instances", () => {
    const { container } = render(
      <>
        <CatchMascot />
        <CatchMascot />
      </>,
    );
    const ids = [...container.querySelectorAll("svg [id]")].map((element) => element.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(container.querySelectorAll('g[filter^="url(#catch-shadow-"]').length).toBe(2);
  });
});
