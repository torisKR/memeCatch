import { describe, expect, it } from "vitest";
import { indexableSlangTerms, type SlangDepthRow } from "@/lib/slang-terms";

function slangRow(title: string, description: string): SlangDepthRow {
  return {
    id: title,
    short_id: "abcd",
    slug: title,
    title,
    summary: "한 줄",
    safety_level: "green",
    origin_year: 2024,
    trend_score: 1,
    description,
    origin: "유래 ".repeat(40),
    usage_note: null,
    caution: null,
    usage_examples: null,
    meme_sources: [{ source_url: "https://example.com/source" }],
    meme_tags_map: [],
    meme_contents: [],
  };
}

describe("indexable slang rows", () => {
  it("drops detail pages that search engines will not index", () => {
    const rows = indexableSlangTerms(
      [slangRow("얇은말", "짧다"), slangRow("깊은말", "설명 ".repeat(90))],
      60,
    );
    expect(rows.map((row) => row.title)).toEqual(["깊은말"]);
  });
});
