import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/llms-full.txt/route.ts"),
  "utf8",
);

describe("llms-full category grouping", () => {
  it("keeps the tag-backed AI collection out of legacy format grouping", () => {
    expect(source).toContain(
      "displayCategory.key === AI_MEME_DISPLAY_CATEGORY",
    );
  });
});
