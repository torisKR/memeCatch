import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("detail discovery outage fallback", () => {
  it.each([
    "app/(default)/memes/[key]/page.tsx",
    "app/[locale]/memes/[key]/page.tsx",
  ])("uses loaded row eligibility in %s", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source.match(/detailIndexableFromDiscovery\(/g)).toHaveLength(2);
    expect(source).not.toContain("discovery.ok && discovery.ids.has(meme.id)");
    expect(source).not.toContain("const indexable = indexableIds.has(meme.id)");
  });
});
