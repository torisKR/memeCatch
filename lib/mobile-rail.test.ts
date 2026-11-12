import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  H_RAIL_CLASS,
  bodyHorizontalOverflow,
  railAtEnd,
  railCapturesVerticalScroll,
  railScrollEnd,
} from "@/lib/mobile-rail";

function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("mobile horizontal rail", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const root = readFileSync("app/_root/root-document.tsx", "utf8");
  const rail = block(css, ".h-rail {");

  it("lets a vertical swipe leave the rail and scroll the window", () => {
    expect(rail).toContain("overflow-y: clip");
    expect(rail).toContain("touch-action: pan-x pan-y");
    expect(railCapturesVerticalScroll("clip")).toBe(false);
    expect(railCapturesVerticalScroll("auto")).toBe(true);
    expect(root).not.toContain("max-md:overflow-y-auto");
    expect(root).not.toContain("max-md:overflow-hidden");
    expect(root).not.toContain("max-md:h-dvh");
    expect(root).toContain("<ScrollChrome />");
  });

  it("can swipe to the last item", () => {
    expect(rail).toContain("overflow-x: auto");
    expect(railScrollEnd(980, 390)).toBe(590);
    expect(railAtEnd(980, 390, 590)).toBe(true);
    expect(railAtEnd(980, 390, 200)).toBe(false);
  });

  it("keeps body horizontal overflow at 0 on a 390px phone", () => {
    expect(css).toContain("overflow-x: clip");
    expect(rail).toContain("max-width: 100%");
    expect(rail).toContain("min-width: 0");
    expect(bodyHorizontalOverflow(390, 390)).toBe(0);
    expect(root).toContain("min-w-0");
    expect(readFileSync("components/home/home-immersive-story.tsx", "utf8")).toContain("H_RAIL_CLASS");
    expect(readFileSync("components/home/home-safety-showcase.tsx", "utf8")).toContain("H_RAIL_CLASS");
    expect(readFileSync("components/h-scroll.tsx", "utf8")).toContain("H_RAIL_CLASS");
    expect(H_RAIL_CLASS).toBe("h-rail");
    expect(readFileSync("app/(default)/explore/page.tsx", "utf8")).toContain("ExploreGrid");
    expect(readFileSync("app/(default)/memes/[key]/page.tsx", "utf8")).toContain("data-plus-pricing-slot");
  });

  it("drops sticky header offsets while phone chrome is hidden", () => {
    const hidden = block(css, 'html[data-chrome="hidden"] {');
    expect(hidden).toContain("--site-header-offset: 0px");
    expect(readFileSync("components/home/home-chapter-nav.module.css", "utf8")).toContain(
      "top: var(--site-header-offset, 6.75rem)",
    );
    const story = readFileSync("components/home/home-immersive-story.module.css", "utf8");
    expect(story).toContain("top: var(--site-header-offset, var(--story-header))");
    expect(story).toContain("--story-header: 6.75rem");
    expect(story).not.toContain("--story-header: var(--site-header-offset");
    expect(story).toContain("calc(100svh - var(--story-header)");
  });

  it("still clears the launcher under page-bottom grids", () => {
    expect(readFileSync("components/explore-grid.tsx", "utf8")).toContain("MOBILE_CARD_CLEARANCE");
    expect(readFileSync("components/related-memes.tsx", "utf8")).not.toContain("MOBILE_CARD_CLEARANCE");
    expect(root).toContain("max-md:pb-[calc(4.5rem+4rem+1rem)]");
  });
});
