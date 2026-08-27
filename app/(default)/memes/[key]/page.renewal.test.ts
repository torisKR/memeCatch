import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("meme detail renewal", () => {
  it("keeps the existing auth invite once, after meaning and origin", () => {
    const about = source.indexOf('aria-labelledby="meme-about"');
    const authInvite = source.indexOf("<AuthInvite />");
    const usageExamples = source.indexOf("<UsageExamples");

    expect(about).toBeGreaterThan(-1);
    expect(authInvite).toBeGreaterThan(about);
    expect(authInvite).toBeLessThan(usageExamples);
    expect(source.match(/<AuthInvite \/>/g)).toHaveLength(1);
  });
});
