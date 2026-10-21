import { describe, expect, it } from "vitest";
import { isLiveAdOrigin, isConfiguredAdsenseClient, isAdsenseContentEligible } from "./adsense-policy";

describe("AdSense deployment boundary", () => {
  it.each(["https://catchmeme.com/", "https://www.catchmeme.com/en"])("allows the verified production origin %s", (url) => {
    expect(isLiveAdOrigin(url)).toBe(true);
  });
  it.each(["http://localhost:3105/", "http://127.0.0.1:3105/", "https://memecatch-preview.vercel.app/", "https://catchmeme.com.evil.test/", "https://user@catchmeme.com/", "http://catchmeme.com/", "https://catchmeme.com:444/", "not a url"])("never loads real ads on unverified origin %s", (url) => {
    expect(isLiveAdOrigin(url)).toBe(false);
  });
  it("requires the verified publisher ID, not merely a plausible ID", () => {
    expect(isConfiguredAdsenseClient("ca-pub-3004906966180197")).toBe(true);
    for (const value of [undefined, "", "ca-pub-0000000000000000", "pub-3004906966180197", "ca-pub-3004906966180197\n"]) {
      expect(isConfiguredAdsenseClient(value)).toBe(false);
    }
  });
});

describe("editorial advertising boundary", () => {
  const substantial = {
    moderation_status: "approved", title: "Documented entry", summary: "An original explanation.",
    published_at: "2020-01-01T00:00:00.000Z",
    description: "Independent editorial explanation with context. ".repeat(12),
    origin: "The entry describes a documented original source and clearly separates its origin from later uses.",
    usage_note: "Check the intended audience and the meaning before choosing this expression for a public post.",
    caution: "Editorial usage signals do not grant rights to reuse a third party's photograph, music or video.",
    meme_sources: [{
      source_url: "https://www.lge.co.kr/story/newsroom/236165",
      title: "LG전자 뉴스룸 밈 소개",
    }],
  };
  it("allows sufficiently explained approved entries with attributable evidence", () => {
    expect(isAdsenseContentEligible(substantial)).toBe(true);
  });
  it("rejects limited, pending, empty, sourceless and placeholder entries", () => {
    expect(isAdsenseContentEligible(null)).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, moderation_status: "limited" })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, moderation_status: "pending" })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, meme_sources: [] })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, summary: substantial.title })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, description: "", origin: "", caution: "", usage_note: "" })).toBe(false);
  });
  it("rejects unpublished, invalid and future-dated entries", () => {
    expect(isAdsenseContentEligible({ ...substantial, published_at: null })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, published_at: undefined })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, published_at: "not-a-date" })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, published_at: "2026-02-31T00:00:00.000Z" })).toBe(false);
    expect(isAdsenseContentEligible({ ...substantial, published_at: "2999-01-01T00:00:00.000Z" })).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "https://localhost/source",
    "https://user:password@example.com/source",
    "https://example.com:444/source",
    "http://127.0.0.1/source",
    "https://source.invalid/item",
  ])("does not treat an unsafe source URL as attributable evidence: %s", (sourceUrl) => {
    expect(isAdsenseContentEligible({
      ...substantial,
      meme_sources: [{ source_url: sourceUrl, title: "Unsafe source" }],
    })).toBe(false);
  });
  it("rejects a public URL without a bibliographic title", () => {
    expect(isAdsenseContentEligible({
      ...substantial,
      meme_sources: [{ source_url: "https://www.lge.co.kr/story/newsroom/236165" }],
    })).toBe(false);
  });
  it("counts a titled public source even when unsafe links are present beside it", () => {
    expect(isAdsenseContentEligible({
      ...substantial,
      meme_sources: [
        { source_url: "javascript:alert(1)", title: "Unsafe source" },
        {
          source_url: "https://www.lge.co.kr/story/newsroom/236165",
          title: "LG전자 뉴스룸 밈 소개",
        },
      ],
    })).toBe(true);
  });
  it("does not let an unsafe second link inflate the editorial depth score", () => {
    expect(isAdsenseContentEligible({
      ...substantial,
      description: "A specific editorial explanation. ".repeat(9),
      origin: "",
      usage_note: "Use only when the audience understands the documented context of the expression.",
      caution: "",
      meme_sources: [
        {
          source_url: "https://www.lge.co.kr/story/newsroom/236165",
          title: "LG전자 뉴스룸 밈 소개",
        },
        { source_url: "javascript:alert(1)", title: "Unsafe source" },
      ],
    })).toBe(false);
  });
});
