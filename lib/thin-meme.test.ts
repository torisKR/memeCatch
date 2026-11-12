import { describe, expect, it } from "vitest";

import { contentDepth } from "@/lib/content-depth";
import {
  THIN_MEME_MIN_BODY_CHARS,
  collectIndexableWindow,
  hasPublicListing,
  isThinMeme,
  koreanDetailRobots,
  memeBodyChars,
  omitThinMemes,
  showsContentStubBanner,
  takeIndexableMemes,
} from "@/lib/thin-meme";
import type { ContentDepthInput } from "@/lib/content-depth";

const chars = (n: number) => "밈".repeat(n);

/** 399 body chars, score high enough that the stub banner stays off. */
function body399(): ContentDepthInput {
  return {
    description: chars(339),
    origin: chars(60),
    meme_sources: [{ source_url: "https://example.com/source" }],
    meme_contents: [],
    meme_tags_map: [],
  };
}

function body400(): ContentDepthInput {
  return {
    ...body399(),
    description: chars(340),
  };
}

describe("isThinMeme C1 body boundary", () => {
  it("counts explanation, origin, notes, and rendered examples, not the title or summary", () => {
    const meme = {
      title: chars(500),
      summary: chars(500),
      description: chars(100),
      origin: `  ${chars(40)}  `,
      usage_note: chars(10),
      caution: chars(5),
      usage_examples: [
        { situation: "친구", text: chars(20) },
        {
          situation: "대화",
          text: "이 문장은 말풍선과 겹쳐 세지 않는다",
          dialogue: [{ speaker: "나", line: chars(7) }],
        },
      ],
    } as ContentDepthInput & { title: string; summary: string };

    expect(memeBodyChars(meme)).toBe(100 + 40 + 10 + 5 + (2 + 20) + (2 + 7));
    expect(memeBodyChars(meme)).toBeLessThan(THIN_MEME_MIN_BODY_CHARS);
  });

  it("does not count the Wikimedia import sentence as body", () => {
    const boilerplate =
      "2014년 공개 Wikimedia 기록을 바탕으로 정리한 항목입니다.";
    const own = body400();
    const imported = {
      ...own,
      origin: boilerplate,
      description: chars(340),
    };
    expect(memeBodyChars(imported)).toBe(340);
    expect(memeBodyChars({ ...imported, origin: chars(60) })).toBe(400);
  });

  it("treats 399 characters as thin and 400 as indexable when the banner is off", () => {
    const under = body399();
    const exact = body400();

    expect(memeBodyChars(under)).toBe(399);
    expect(memeBodyChars(exact)).toBe(400);
    expect(showsContentStubBanner(under)).toBe(false);
    expect(showsContentStubBanner(exact)).toBe(false);
    expect(contentDepth(under).score).toBeGreaterThanOrEqual(5);
    expect(contentDepth(exact).score).toBeGreaterThanOrEqual(5);
    expect(isThinMeme(under)).toBe(true);
    expect(isThinMeme(exact)).toBe(false);
    expect(koreanDetailRobots(under)).toEqual({ index: false, follow: true });
    expect(koreanDetailRobots(exact)).toBeUndefined();
  });

  it("treats a long page that still shows the stub banner as thin", () => {
    const stub = {
      description: chars(500),
      origin: null,
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [],
      meme_contents: [],
      meme_tags_map: [],
    };
    expect(memeBodyChars(stub)).toBeGreaterThanOrEqual(400);
    expect(showsContentStubBanner(stub)).toBe(true);
    expect(contentDepth(stub).isThin).toBe(true);
    expect(isThinMeme(stub)).toBe(true);
    expect(koreanDetailRobots(stub)).toEqual({ index: false, follow: true });
  });

  it("drops thin rows from listings and hides a rail with fewer than 3 cards", () => {
    const rows = [body399(), body400(), body400(), body399()];
    expect(omitThinMemes(rows)).toHaveLength(2);
    expect(takeIndexableMemes(rows, 1)).toEqual([rows[1]]);
    expect(hasPublicListing(omitThinMemes(rows).length)).toBe(false);
    expect(hasPublicListing(3)).toBe(true);
    expect(hasPublicListing(2)).toBe(false);
  });

  it("scans past thin rows without skipping a later indexable row", async () => {
    const rows = [body399(), body399(), body400(), body400(), body400()];
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
