import { describe, expect, it } from "vitest";
import { indexableSlangTerms, type SlangDepthRow } from "@/lib/slang-terms";

function slangRow(title: string, description: string, passing = false): SlangDepthRow {
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
    origin: passing ? "유".repeat(90) : "유래",
    usage_note: passing ? "씀".repeat(50) : null,
    caution: null,
    usage_examples: passing
      ? [
          { situation: "상황".repeat(20), text: "예문".repeat(20) },
          { situation: "다른".repeat(20), text: "대사".repeat(20) },
        ]
      : null,
    meme_sources: passing
      ? [{ source_url: "https://example.com/a" }, { source_url: "https://example.com/b" }]
      : [{ source_url: "https://example.com/source" }],
    meme_tags_map: [],
    meme_contents: [],
  };
}

describe("indexable slang rows", () => {
  it("drops detail pages that search engines will not index", () => {
    const rows = indexableSlangTerms(
      [slangRow("얇은말", "짧다"), slangRow("깊은말", "뜻".repeat(180), true)],
      60,
    );
    expect(rows.map((row) => row.title)).toEqual(["깊은말"]);
  });
});
