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
    description: "Independent editorial explanation with context. ".repeat(12),
    origin: "The entry describes a documented original source and clearly separates its origin from later uses.",
    usage_note: "Check the intended audience and the meaning before choosing this expression for a public post.",
    caution: "Editorial usage signals do not grant rights to reuse a third party's photograph, music or video.",
    meme_sources: [{ source_url: "https://www.lge.co.kr/story/newsroom/236165" }],
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
});
