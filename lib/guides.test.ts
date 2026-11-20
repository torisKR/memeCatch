import { describe, expect, it } from "vitest";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";
import { COLLECTIONS } from "@/lib/collections";
import { GUIDES, getGuide, guideBodyLength } from "@/lib/guides";
import { memePathFrom } from "@/lib/labels";

describe("guides content", () => {
  it("has five guides with unique slugs", () => {
    const slugs = GUIDES.map((guide) => guide.slug);
    expect(slugs).toHaveLength(5);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(GUIDES.map((guide) => [guide.slug, guide] as const))(
    "%s has at least 1,500 characters of body text",
    (_slug, guide) => {
      expect(guideBodyLength(guide)).toBeGreaterThanOrEqual(1500);
    },
  );

  it("lists only https sources with a title and publisher", () => {
    for (const source of GUIDES.flatMap((guide) => guide.sources)) {
      expect(new URL(source.url).protocol, source.url).toBe("https:");
      expect(source.title.length).toBeGreaterThan(0);
      expect(source.publisher.length).toBeGreaterThan(0);
    }
  });

  it("cites sources for the guides that make claims about real events, laws or platforms", () => {
    for (const slug of ["korean-meme-eras", "checking-meme-sources", "short-form-challenge-rights"]) {
      expect(getGuide(slug)?.sources.length, slug).toBeGreaterThan(0);
    }
  });

  it("links only to memes, collections and guides that exist", () => {
    const memePaths = new Set(CURATED_CORE_MEMES.map((m) => memePathFrom(m.short_id, m.slug)));
    const collectionPaths = new Set(COLLECTIONS.map((c) => `/collections/${c.slug}`));
    const guidePaths = new Set(GUIDES.map((g) => `/guides/${g.slug}`));
    for (const link of GUIDES.flatMap((g) => g.sections.flatMap((s) => s.links ?? []))) {
      if (link.href.startsWith("/memes/")) expect(memePaths.has(link.href), link.href).toBe(true);
      if (link.href.startsWith("/collections/")) expect(collectionPaths.has(link.href), link.href).toBe(true);
      if (link.href.startsWith("/guides/")) expect(guidePaths.has(link.href), link.href).toBe(true);
    }
  });

  it("returns undefined for an unknown slug", () => {
    expect(getGuide("no-such-guide")).toBeUndefined();
  });
});
