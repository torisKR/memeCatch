import { describe, expect, it } from "vitest";
import { createScratchCoverage, memeCardReturnHref, scratchPoint, SCRATCH_REVEAL_RATIO } from "./meme-collectible-ui";

describe("scratch area", () => {
  it("maps scaled pointer coordinates and rejects strokes outside the card", () => {
    const rect = { left: 40, top: 20, width: 300, height: 450 };
    expect(scratchPoint(190, 245, rect)).toEqual({ x: 0.5, y: 0.5, radiusX: 0.075, radiusY: 0.05 });
    expect(scratchPoint(39, 50, rect)).toBeNull();
    expect(scratchPoint(100, 50, { ...rect, width: 0 })).toBeNull();
  });
  it("counts erased area once and reveals only after substantial distinct strokes", () => {
    const coverage = createScratchCoverage();
    const point = { x: 0.5, y: 0.5, radiusX: 0.075, radiusY: 0.05 };
    const first = coverage.mark(point);
    for (let i = 0; i < 50; i++) coverage.mark(point);
    expect(coverage.ratio).toBe(first);
    expect(first).toBeLessThan(0.02);
    for (const y of [0.1, 0.2, 0.3, 0.4]) coverage.mark({ ...point, x: 0.05, y }, { ...point, x: 0.95, y });
    expect(coverage.ratio).toBeGreaterThanOrEqual(SCRATCH_REVEAL_RATIO);
  });
  it("scales coverage independently of screen density", () => {
    const a = createScratchCoverage();
    const b = createScratchCoverage();
    const p = scratchPoint(150, 225, { left: 0, top: 0, width: 300, height: 450 })!;
    const q = scratchPoint(600, 900, { left: 0, top: 0, width: 1200, height: 1800 })!;
    expect(a.mark(p)).toEqual(b.mark(q));
  });
});
describe("card login return", () => {
  it("preserves the exact publicly revealed card and filtered page without a claim intent", () => {
    const href = memeCardReturnHref("mc-0042", 3, true, "pen", "slang");
    const params = new URL(href, "https://memecatch.test").searchParams;
    expect(params.get("card")).toBe("mc-0042");
    expect(params.get("revealed")).toBe("1");
    expect(params.get("page")).toBe("3");
    expect(params.has("claim")).toBe(false);
    expect(memeCardReturnHref("https://bad.test", 1)).toBe("/meme-cards");
  });
});
