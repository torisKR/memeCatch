import { describe, expect, it } from "vitest";
import { CURATED_CORE_MEMES, curatedSearchCards, getGuaranteedHomeEntries } from "@/lib/curated-memes";
import type { HomeEntry } from "@/components/home/home-experience";

describe("curated memes and guaranteed home entries", () => {
  it("contains well-formed core curated memes with required metadata", () => {
    expect(CURATED_CORE_MEMES.length).toBeGreaterThanOrEqual(8);

    for (const meme of CURATED_CORE_MEMES) {
      expect(meme.title).toBeTruthy();
      expect(meme.summary).toBeTruthy();
      expect(meme.origin).toBeTruthy();
      expect(["phrase", "dance", "song", "image", "comment", "challenge"]).toContain(meme.category);
      expect(["green", "yellow", "gray", "red"]).toContain(meme.safety_level);
      expect(meme.origin_year).toBeGreaterThanOrEqual(2000);
      expect(meme.usage_context.friends).toBeTruthy();
      expect(meme.usage_context.work).toBeTruthy();
      expect(meme.usage_examples.length).toBeGreaterThanOrEqual(1);
      expect(meme.trend_now.status_label).toBeTruthy();
    }
  });

  it("finds the jung-kkuk-ma guide for a Hangul query the catalog slug does not use", () => {
    const cards = curatedSearchCards("중꺾마");
    expect(cards.map((card) => card.short_id)).toContain("jkm2022k");
    expect(cards[0]?.meme_contents[0]?.thumbnail_url).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("guarantees non-empty home entries when live DB entries are empty", () => {
    const emptyLiveEntries: readonly HomeEntry[] = [];
    const entries = getGuaranteedHomeEntries("ko", emptyLiveEntries);

    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect(entries[0].title).toBeTruthy();
    expect(entries[0].href).toMatch(/^\/memes\//);
    const english = getGuaranteedHomeEntries("en", emptyLiveEntries);
    expect(english.every((entry) => entry.href.startsWith("/memes/"))).toBe(true);
    expect(english.some((entry) => entry.href.startsWith("/en/"))).toBe(false);
    expect(entries[0].thumbnailUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("preserves live entries and pads with curated ones if live entries are sparse", () => {
    const sparseLiveEntries: readonly HomeEntry[] = [
      {
        id: "live-1",
        href: "/memes/live1-sample",
        title: "실시간 밈 1",
        summary: "실시간 요약",
        categoryLabel: "밈 용어",
        safetyLevel: "green",
      },
    ];

    const entries = getGuaranteedHomeEntries("ko", sparseLiveEntries);
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries[0].id).toBe("live-1");
  });

  it("leaves sufficient live entries untouched", () => {
    const sufficientLiveEntries: readonly HomeEntry[] = Array.from({ length: 6 }, (_, i) => ({
      id: `live-${i}`,
      href: `/memes/live-${i}`,
      title: `실시간 밈 ${i}`,
      summary: `실시간 요약 ${i}`,
      categoryLabel: "밈 용어",
      safetyLevel: "green",
    }));

    const entries = getGuaranteedHomeEntries("ko", sufficientLiveEntries);
    expect(entries.length).toBe(6);
    expect(entries[0].id).toBe("live-0");
    expect(entries[5].id).toBe("live-5");
  });
});
