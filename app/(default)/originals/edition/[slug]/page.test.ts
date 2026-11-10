import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "app/(default)/originals/edition/[slug]/page.tsx"),
  "utf-8",
);
const content = readFileSync(
  join(process.cwd(), "components/originals-editorial/original-edition-content.tsx"),
  "utf-8",
);
const css = readFileSync(
  join(process.cwd(), "components/originals-editorial/original-edition.module.css"),
  "utf-8",
);

describe("original edition labels and title", () => {
  it("names the two save actions by what they include", () => {
    expect(content).toContain('const CARD_BUTTON = "문구 포함 카드 저장"');
    expect(content).toContain('const ARTWORK_LINK = "그림만 저장"');
    expect(content).not.toContain('"밈 카드 저장"');
    expect(content).not.toContain('"그림 저장"');
  });

  it("keeps the Korean tab title on 밈캐치", () => {
    expect(content).toContain("`${edition.title} | 밈캐치`");
    expect(content).not.toContain("MemeCatch");
    expect(page).toContain('siteName: "밈캐치"');
  });

  it("keeps the Korean title from breaking one syllable onto its own line", () => {
    expect(css).toContain("word-break: keep-all");
    expect(css).toContain("text-wrap: balance");
  });
});
