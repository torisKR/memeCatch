import { describe, expect, it } from "vitest";
import type {
  PlusLocalizedFeedSource,
  PlusLocalizedFeedTranslation,
} from "@/lib/plus-localized-feed";
import {
  buildPlusLocalizedFeed,
  localizedFeedHref,
  resolvePlusContentLocale,
  usesEnglishContentFallback,
} from "@/lib/plus-localized-feed";

const SOURCE_UPDATED_AT = "2026-08-09T00:00:00.000Z";

function source(
  number: number,
  overrides: Partial<PlusLocalizedFeedSource> = {},
): PlusLocalizedFeedSource {
  return {
    id: `meme-${number}`,
    short_id: `short-${number}`,
    slug: `source-${number}`,
    title: `한국어 밈 ${number}`,
    summary: `한국어 요약 ${number}`,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "rising",
    media_type: "image",
    origin_year: 2026,
    trend_score: 100 - number,
    description: "충분히 긴 원문 설명입니다.".repeat(20),
    origin: "확인된 유래 설명입니다.".repeat(8),
    usage_note: "친한 사이에서 상황을 살펴 사용하세요.".repeat(2),
    caution: "공식적인 자리에서는 맥락을 확인하세요.".repeat(2),
    aliases: [],
    usage_examples: [
      { situation: "친구와", text: "예문 하나" },
      { situation: "대화방", text: "예문 둘" },
    ],
    updated_at: SOURCE_UPDATED_AT,
    meme_contents: [
      {
        availability: "live",
        moderation_status: "approved",
        thumbnail_url: `https://cdn.example/${number}.jpg`,
        is_representative: true,
      },
    ],
    meme_sources: [{ source_url: `https://example.com/${number}` }],
    meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    meme_market_profiles: [
      { market_code: "US", role: "origin", review_state: "reviewed" },
    ],
    ...overrides,
  };
}

function translation(
  number: number,
  overrides: Partial<PlusLocalizedFeedTranslation> = {},
): PlusLocalizedFeedTranslation {
  return {
    meme_id: `meme-${number}`,
    locale: "en",
    status: "reviewed",
    localized_slug: `localized-${number}`,
    title: `Localized meme ${number}`,
    summary: `Localized summary ${number}`,
    description: `Localized description ${number}`,
    origin: `Localized origin ${number}`,
    source_updated_at: SOURCE_UPDATED_AT,
    ...overrides,
  };
}

describe("Plus localized feed projection", () => {
  it("resolves exact content locales and labels UI-only English fallback", () => {
    expect(resolvePlusContentLocale("ko")).toBe("ko");
    expect(resolvePlusContentLocale("ja")).toBe("ja");
    expect(resolvePlusContentLocale("zh-tw")).toBe("zh-tw");
    expect(resolvePlusContentLocale("fr")).toBe("en");
    expect(usesEnglishContentFallback("fr", "en")).toBe(true);
    expect(usesEnglishContentFallback("en", "en")).toBe(false);
  });

  it("keeps Korean source cards and canonical paths without translation filtering", () => {
    const result = buildPlusLocalizedFeed({
      locale: "ko",
      sources: [source(1)],
      translations: [translation(1, { status: "machine" })],
      eligibleSourceIds: [],
    });

    expect(result).toMatchObject({ state: "active" });
    expect(result.items[0]).toMatchObject({
      href: "/memes/short-1-source-1",
      meme: {
        title: "한국어 밈 1",
        summary: "한국어 요약 1",
        meme_market_profiles: [
          { market_code: "US", role: "origin", review_state: "reviewed" },
        ],
      },
    });
  });

  it("accepts only exact reviewed/current complete translations", () => {
    const sources = [1, 2, 3, 4, 5, 6, 7].map((number) => source(number));
    const translations = [
      translation(1),
      translation(2, { status: "machine" }),
      translation(3, { source_updated_at: "2026-08-08T00:00:00.000Z" }),
      translation(4, { locale: "ja" }),
      translation(5, { localized_slug: " " }),
      translation(6, { description: "" }),
      translation(7),
    ];

    const result = buildPlusLocalizedFeed({
      locale: "en",
      sources,
      translations,
      eligibleSourceIds: new Set(sources.map((item) => item.id)),
    });

    expect(result.state).toBe("active");
    expect(result.items.map((item) => item.meme.id)).toEqual(["meme-1", "meme-7"]);
    expect(result.items[0]).toMatchObject({
      href: "/en/memes/short-1-localized-1",
      meme: { title: "Localized meme 1", summary: "Localized summary 1" },
    });
  });

  it("preserves source order after coverage filtering and caps at six", () => {
    const sources = Array.from({ length: 8 }, (_, index) => source(index + 1));
    const translations = sources.map((item) =>
      translation(Number(item.id.replace("meme-", "")), { locale: "ja" }),
    );
    const result = buildPlusLocalizedFeed({
      locale: "ja",
      sources,
      translations,
      eligibleSourceIds: new Set(sources.map((item) => item.id)),
    });

    expect(result.items).toHaveLength(6);
    expect(result.items.map((item) => item.meme.id)).toEqual([
      "meme-1",
      "meme-2",
      "meme-3",
      "meme-4",
      "meme-5",
      "meme-6",
    ]);
  });

  it("distinguishes empty source from empty reviewed coverage", () => {
    expect(
      buildPlusLocalizedFeed({ locale: "en", sources: [], translations: [] }),
    ).toEqual({ state: "empty-source", items: [] });

    expect(
      buildPlusLocalizedFeed({
        locale: "en",
        sources: [source(1)],
        translations: [],
        eligibleSourceIds: new Set(["meme-1"]),
      }),
    ).toEqual({ state: "empty-coverage", items: [] });
  });

  it("encodes localized slugs in the resolved content route", () => {
    expect(localizedFeedHref("zh-tw", "abc123", "繁體 梗"))
      .toBe("/zh-tw/memes/abc123-%E7%B9%81%E9%AB%94%20%E6%A2%97");
  });
});
