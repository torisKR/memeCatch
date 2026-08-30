import { describe, expect, it } from "vitest";
import {
  isUnsourcedQualityRow,
  parseAdminMemeFocus,
  rankUnsourcedQualityQueue,
} from "./admin-quality-queue";

describe("admin quality queue", () => {
  it("accepts only the unsourced focus token", () => {
    expect(parseAdminMemeFocus("unsourced")).toBe("unsourced");
    expect(parseAdminMemeFocus("thin")).toBeNull();
    expect(parseAdminMemeFocus(undefined)).toBeNull();
  });

  it("treats blank source URLs as unsourced", () => {
    expect(isUnsourcedQualityRow({ meme_sources: [] })).toBe(true);
    expect(isUnsourcedQualityRow({ meme_sources: [{ source_url: "  " }] })).toBe(true);
    expect(
      isUnsourcedQualityRow({ meme_sources: [{ source_url: "https://example.com/a" }] }),
    ).toBe(false);
  });

  it("ranks unsourced rows by trend score then id and respects the limit", () => {
    const ranked = rankUnsourcedQualityQueue(
      [
        { id: "b", trend_score: 4, meme_sources: [] },
        { id: "a", trend_score: 9, meme_sources: [{ source_url: "https://example.com" }] },
        { id: "c", trend_score: 8, meme_sources: [] },
        { id: "d", trend_score: 8, meme_sources: [] },
      ],
      2,
    );

    expect(ranked.map((row) => row.id)).toEqual(["c", "d"]);
  });
});
