import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("meme detail renewal", () => {
  it("keeps the existing auth invite once, after the source block", () => {
    const about = source.indexOf('aria-labelledby="meme-about"');
    const authInvite = source.indexOf("<AuthInvite />");

    expect(about).toBeGreaterThan(-1);
    expect(authInvite).toBeGreaterThan(about);
    expect(source.match(/<AuthInvite \/>/g)).toHaveLength(1);
  });

  it("uses originSectionHeading for house originals and labels catalog origins 유래", () => {
    expect(source).toContain("originSectionHeading(meme.origin_kind)");
    expect(source).toContain(': "유래"');
    expect(source).not.toMatch(/<h3[^>]*>\s*어디서 시작됐어요\?/);
  });

  it("uses aboutSectionHeading for sr-only about h2 and page metadata, not hardcoded folk 유래", () => {
    expect(source).toContain("{aboutSectionHeading(meme.origin_kind)}");
    expect(source).toContain("memeDetailMetadataDescription(");
    expect(source).not.toMatch(/<h2[^>]*>\s*뜻과 유래/);
    expect(source).not.toContain("뜻과 유래 ·");
  });
});
