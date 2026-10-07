import { describe, expect, it } from "vitest";
import { createScratchCoverage, memeCardReturnHref, readRevealedMemeCard, scratchPoint, SCRATCH_REVEAL_RATIO } from "./meme-collectible-ui";
import type { MemeCollectibleCard } from "./meme-collectible";

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
describe("revealed card response boundary", () => {
  const card: MemeCollectibleCard = { id: "mc-0001", cardNo: 1, edition: 1, artSeed: 42, memeId: "meme-a", title: "PPAP", slug: "ppap", href: "/memes/abcdef-ppap", summary: "노래", category: "song", originYear: 2016, thumbnailUrl: null, artMotif: "pen-pineapple", artSymbols: ["pen", "apple", "pineapple"], artComposition: "exchange" };
  it("accepts the matching eligible shape and rejects a different card or unsafe links", () => {
    expect(readRevealedMemeCard({ card }, card.id)).toEqual(card);
    for (const href of ["javascript:alert(1)", "//evil.test", "https://evil.test", "/memes/abc?redirect=evil", "/memes/../admin", "/memes/%2e%2e", "/memes/a\\b", "/memes/a\nb"]) expect(readRevealedMemeCard({ card: { ...card, href } }, card.id)).toBeNull();
    expect(readRevealedMemeCard({ card }, "mc-0002")).toBeNull();
  });
  it("accepts actual encoded meme slugs with parentheses and apostrophes", () => {
    for (const href of ["/memes/3qc4nr6p-PPAP-(%ED%8E%9C-%ED%8C%8C%EC%9D%B8%EC%95%A0%ED%94%8C-%EC%95%A0%ED%94%8C-%ED%8E%9C)", "/memes/abcd-it's-fine"]) expect(readRevealedMemeCard({ card: { ...card, href } }, card.id)?.href).toBe(href);
  });
  it("rejects malformed art, numbering and empty data before rendering", () => {
    for (const malformed of [null, {}, { card: null }, { card: { ...card, cardNo: 2 } }, { card: { ...card, artMotif: "bogus" } }, { card: { ...card, artSymbols: [] } }, { card: { ...card, title: "" } }]) expect(readRevealedMemeCard(malformed, card.id)).toBeNull();
  });
});
