import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

const REQUIRED_NEWS_FIELDS = [
  "newsTitle",
  "newsDescription",
  "newsEyebrow",
  "newsIntro",
  "ageNav",
  "briefing",
  "efficient",
  "exploreAll",
  "known",
  "voteInfo",
  "noVotes",
  "money",
  "safety",
  "culture",
  "verified",
  "source",
] as const;

describe("news page copy", () => {
  it.each(SUPPORTED_LOCALES)("has complete meme news copy for %s", (locale) => {
    const copy = PAGE_COPY[locale];
    for (const field of REQUIRED_NEWS_FIELDS) {
      expect(copy[field].trim(), field).not.toBe("");
    }
    expect(copy.votes(3)).toMatch(/3/);
    expect(JSON.stringify(copy)).not.toMatch(/adpick|애드픽|쇼핑메이트/i);
  });
});
