import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CURATED_CORE_SHORT_IDS } from "@/lib/curated-meme-ids";
import { CURATED_CORE_MEMES, findCuratedCoreMeme } from "@/lib/curated-memes";
import { classifyPublicMemeLookup } from "@/lib/public-meme-lookup";

const row = { short_id: "x85wgk74" };

const HOME_CARD_SLUGS = [
  ["jkm2022k", "jung-kkuk-ma"],
  ["oyj2021k", "ohiryeo-joha"],
  ["bjk2021k", "bun-jo-ka"],
  ["gnact78h", "hidink-hungry"],
] as const;

describe("classifyPublicMemeLookup", () => {
  it("keeps a real row ahead of a curated card", () => {
    const curated = findCuratedCoreMeme("jkm2022k");
    expect(classifyPublicMemeLookup({ row, curated, catalogUnavailable: false }).kind).toBe(
      "database",
    );
  });

  it("renders the home guide cards when those short ids are not catalog rows", () => {
    for (const [shortId, slug] of HOME_CARD_SLUGS) {
      const result = classifyPublicMemeLookup({
        row: null,
        curated: findCuratedCoreMeme(shortId),
        catalogUnavailable: true,
      });
      expect(result.kind).toBe("curated");
      if (result.kind !== "curated") continue;
      expect(result.meme.slug).toBe(slug);
    }
  });

  it("does not treat a catalog outage as a missing meme", () => {
    expect(
      classifyPublicMemeLookup({
        row: null,
        curated: null,
        catalogUnavailable: true,
      }).kind,
    ).toBe("unavailable");
  });

  it("still reports a genuine miss when the catalog answers and the key is unknown", () => {
    expect(
      classifyPublicMemeLookup({
        row: null,
        curated: findCuratedCoreMeme("zzzzzzzz"),
        catalogUnavailable: false,
      }).kind,
    ).toBe("missing");
  });

  it("renders meme detail per request without connection()", () => {
    const files = [
      "lib/public-meme-document.ts",
      "components/meme-catalog-unavailable.tsx",
      "app/(default)/memes/[key]/page.tsx",
      "app/[locale]/memes/[key]/page.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/\bconnection\s*\(/);
      expect(source, file).not.toContain("revalidate = 86400");
    }
    for (const file of files.slice(2)) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).toContain('export const dynamic = "force-dynamic"');
    }
  });

  it("gives a curated Korean detail its own X title and the locale image", () => {
    const source = readFileSync(join(process.cwd(), "lib/public-meme-document.ts"), "utf8");
    const card = source.slice(source.indexOf("export function curatedMemeMetadata"));
    expect(card).toContain("twitter:");
    expect(card).toContain("card: \"summary_large_image\"");
    expect(card).toContain("title,");
    expect(card).toContain("alt: meme.title");
    expect(card).toContain("curatedShareVersion(meme)");
    expect(card).not.toContain("ogDefaultImageDescriptor");
  });

  it("keeps the proxy allowlist aligned with the curated cards", () => {
    expect([...CURATED_CORE_MEMES.map((meme) => meme.short_id)].sort()).toEqual(
      [...CURATED_CORE_SHORT_IDS].sort(),
    );
  });
});
