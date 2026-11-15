import { describe, expect, it } from "vitest";

import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
import {
  collectIndexableWindow,
  hasPublicListing,
  isThinMeme,
  koreanDetailRobots,
  omitThinMemes,
  takeIndexableMemes,
} from "@/lib/thin-meme";

const chars = (n: number) => "밈".repeat(n);

/** Existing-main eligible document whose unique body is still below 400 chars. */
function existingIndexable(): ContentDepthInput {
  return {
    description: chars(339),
    origin: chars(60),
    meme_sources: [{ source_url: "https://example.com/source" }],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function lowScore(): ContentDepthInput {
  return {
    description: chars(500),
    origin: null,
    meme_sources: [],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function shortProse(): ContentDepthInput {
  return {
    description: null,
    origin: null,
    usage_examples: [{ situation: "상황", text: "예문" }],
    meme_sources: [
      { source_url: "https://example.com/one" },
      { source_url: "https://example.com/two" },
    ],
    meme_contents: [{ availability: "online", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "1" }, { tag_id: "2" }, { tag_id: "3" }],
  };
}

describe("shared Korean public eligibility", () => {
  it("matches the existing main index gate without a separate 400-character cutoff", () => {
    const visible = existingIndexable();

    expect(isIndexableMeme(visible)).toBe(true);
    expect(isThinMeme(visible)).toBe(false);
    expect(koreanDetailRobots(visible)).toBeUndefined();
  });

  it.each([
    ["content score", lowScore()],
    ["unique prose", shortProse()],
    ["missing record", null],
  ])("keeps a record failing %s out of listings and index robots", (_reason, meme) => {
    expect(isIndexableMeme(meme)).toBe(false);
    expect(isThinMeme(meme)).toBe(true);
    expect(koreanDetailRobots(meme)).toEqual({ index: false, follow: true });
  });

  it("filters by existing index eligibility and keeps the three-card rail minimum", () => {
    const visible = existingIndexable();
    const rows = [lowScore(), visible, shortProse(), { ...visible }];

    expect(omitThinMemes(rows)).toEqual([rows[1], rows[3]]);
    expect(takeIndexableMemes(rows, 1)).toEqual([rows[1]]);
    expect(hasPublicListing(omitThinMemes(rows).length)).toBe(false);
    expect(hasPublicListing(3)).toBe(true);
    expect(hasPublicListing(2)).toBe(false);
  });

  it("scans past ineligible rows without skipping a later eligible row", async () => {
    const visible = existingIndexable();
    const rows = [lowScore(), shortProse(), visible, { ...visible }, { ...visible }];
    const page = await collectIndexableWindow(
      async (from, to) => rows.slice(from, to + 1),
      0,
      2,
      { pageSize: 2 },
    );

    expect(page.items).toEqual([rows[2], rows[3]]);
    expect(page.scanned).toBe(4);
    expect(page.hasMore).toBe(true);
  });
});
