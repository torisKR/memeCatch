import { describe, expect, it } from "vitest";
import { relatedMemePoolFilter } from "@/lib/related-meme-pool";

describe("relatedMemePoolFilter", () => {
  it("combines the category pool and the nearby years into one filter", () => {
    expect(relatedMemePoolFilter("phrase", 2021)).toBe(
      "category.eq.phrase,and(origin_year.gte.2019,origin_year.lte.2023)",
    );
  });

  it("uses only the category when the meme has no year", () => {
    expect(relatedMemePoolFilter("dance", null)).toBe("category.eq.dance");
  });
});
