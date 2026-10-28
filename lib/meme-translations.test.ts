import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ContentDepthInput } from "@/lib/content-depth";
import type { Locale } from "@/lib/i18n";
import {
  hasRequiredTranslationFields,
  isIndexableLocalizedMeme,
  isTranslationCurrent,
  overlayMemeTranslation,
  getLocalizedFeaturedMemes,
  getLocalizedFeaturedMemesResult,
  getLocalizedSearchMemesResult,
  type MemeTranslationRow,
} from "@/lib/meme-translations";

const createStaticClient = vi.hoisted(() => vi.fn());
const filterPublicMemeMedia = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
vi.mock("@/lib/sources/public-links.server", () => ({ filterPublicMemeMedia }));

const SOURCE_UPDATED_AT = "2026-07-28T04:00:00.000Z";

type TestMeme = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  aliases: string[];
  usage_examples?: unknown;
  meme_market_profiles?: { market_code: string; role: string; review_state: string }[];
  updated_at: string;
};

function baseMeme(overrides: Partial<TestMeme> = {}): TestMeme {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    short_id: "abc12345",
    slug: "원본-밈",
    title: "원본 밈",
    summary: "한국어 한 줄 뜻",
    description: "뜻과 쓰임을 충분히 설명하는 한국어 본문입니다.".repeat(12),
    origin: "확인된 유래와 확산 과정을 설명하는 한국어 문장입니다.".repeat(3),
    usage_note: "친구 사이에서 쓰되 상대와 상황을 먼저 살펴보는 것이 좋아요.".repeat(2),
    caution: "공식적인 자리에서는 오해를 피하기 위해 사용하지 않는 편이 좋아요.".repeat(2),
    aliases: ["원문 별칭"],
    usage_examples: [
      { situation: "친구와", text: "원문 예문 하나" },
      { situation: "대화방", text: "원문 예문 둘" },
    ],
    meme_sources: [
      { source_url: "https://example.com/source-1" },
      { source_url: "https://example.com/source-2" },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "a" }, { tag_id: "b" }, { tag_id: "c" }],
    meme_market_profiles: [
      { market_code: "KR", role: "origin", review_state: "reviewed" },
    ],
    updated_at: SOURCE_UPDATED_AT,
    ...overrides,
  };
}

function translation(
  overrides: Partial<MemeTranslationRow> = {},
): MemeTranslationRow {
  return {
    meme_id: "00000000-0000-4000-8000-000000000001",
    locale: "en",
    status: "reviewed",
    localized_slug: "original-meme",
    title: "Original meme",
    summary: "A concise English explanation of the Korean meme.",
    description: "A complete English explanation of its meaning and use.",
    origin: "A verified English explanation of its origin and spread.",
    usage_note: "Use it with friends who understand the original context.",
    caution: "Avoid using it in formal settings without context.",
    aliases: ["English alias"],
    usage_examples: [
      { situation: "With friends", text: "An English example." },
    ],
    source_updated_at: SOURCE_UPDATED_AT,
    provider: "test-provider",
    model: "test-model",
    prompt_version: 1,
    translated_at: "2026-07-28T04:10:00.000Z",
    reviewed_at: "2026-07-28T04:15:00.000Z",
    reviewed_by: "00000000-0000-4000-8000-000000000003",
    created_at: "2026-07-28T04:10:00.000Z",
    updated_at: "2026-07-28T04:20:00.000Z",
    ...overrides,
  };
}

function featuredRow(overrides: Partial<MemeTranslationRow> = {}) {
  return {
    ...translation(overrides),
    memes: baseMeme(),
  };
}

function mockTranslationQuery(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    overrideTypes: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder.overrideTypes.mockResolvedValue(response);
  createStaticClient.mockReturnValue({
    from: vi.fn().mockReturnValue(builder),
  });
  return builder;
}

function mockPagedTranslationQuery(
  page: (index: number) => { data: unknown; error: unknown },
) {
  let pageIndex = -1;
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    overrideTypes: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockImplementation(() => {
    pageIndex += 1;
    return builder;
  });
  builder.overrideTypes.mockImplementation(async () => page(pageIndex));
  createStaticClient.mockReturnValue({
    from: vi.fn().mockReturnValue(builder),
  });
  return builder;
}

beforeEach(() => {
  createStaticClient.mockReset();
  filterPublicMemeMedia.mockReset();
  filterPublicMemeMedia.mockImplementation(async (input) => input);
});

describe("overlayMemeTranslation", () => {
  it("overlays localized prose and preserves the complete Korean original", () => {
    const base = baseMeme();
    const localized = overlayMemeTranslation(base, translation(), "en");

    expect(localized).toMatchObject({
      slug: "original-meme",
      title: "Original meme",
      summary: "A concise English explanation of the Korean meme.",
      aliases: ["English alias"],
      original: {
        slug: "원본-밈",
        title: "원본 밈",
        summary: "한국어 한 줄 뜻",
        aliases: ["원문 별칭"],
      },
      translation: {
        locale: "en",
        status: "reviewed",
        localizedSlug: "original-meme",
        isCurrent: true,
      },
    });
    expect(localized?.original.usage_examples).toBe(base.usage_examples);
    expect(localized?.usage_examples).toEqual([
      { situation: "With friends", text: "An English example." },
    ]);
  });

  it.each<[Locale, Locale]>([
    ["ja", "en"],
    ["zh", "en"],
    ["ko", "en"],
  ])(
    "returns null instead of falling back when %s is requested but only %s exists",
    (requestedLocale) => {
      expect(
        overlayMemeTranslation(baseMeme(), translation(), requestedLocale),
      ).toBeNull();
    },
  );

  it("returns null when a translation belongs to another meme", () => {
    expect(
      overlayMemeTranslation(
        baseMeme(),
        translation({ meme_id: "00000000-0000-4000-8000-000000000099" }),
        "en",
      ),
    ).toBeNull();
  });
});

describe("translation freshness and SEO eligibility", () => {
  it("compares source revisions as instants rather than raw timestamp strings", () => {
    expect(
      isTranslationCurrent(
        "2026-07-28T13:00:00+09:00",
        "2026-07-28T04:00:00.000Z",
      ),
    ).toBe(true);
    expect(isTranslationCurrent("not-a-date", SOURCE_UPDATED_AT)).toBe(false);
  });

  it("marks a source-updated translation as stale even if its status was not changed", () => {
    const localized = overlayMemeTranslation(
      baseMeme({ updated_at: "2026-07-28T05:00:00.000Z" }),
      translation(),
      "en",
    );

    expect(localized?.translation.isCurrent).toBe(false);
    expect(isIndexableLocalizedMeme(localized)).toBe(false);
  });

  it.each<MemeTranslationRow["status"]>(["machine", "stale"])(
    "keeps %s translations displayable but non-indexable",
    (status) => {
      const localized = overlayMemeTranslation(
        baseMeme(),
        translation({ status }),
        "en",
      );

      expect(localized?.title).toBe("Original meme");
      expect(isIndexableLocalizedMeme(localized)).toBe(false);
    },
  );

  it("indexes only a reviewed, current, complete translation of a substantial base", () => {
    const localized = overlayMemeTranslation(baseMeme(), translation(), "en");
    expect(isIndexableLocalizedMeme(localized)).toBe(true);
  });

  it("rejects reviewed translations with blank required fields", () => {
    const incomplete = translation({ description: "   " });
    expect(hasRequiredTranslationFields(incomplete)).toBe(false);
    expect(
      isIndexableLocalizedMeme(
        overlayMemeTranslation(baseMeme(), incomplete, "en"),
      ),
    ).toBe(false);
  });

  it("rejects a complete translation when the Korean source is too thin", () => {
    const localized = overlayMemeTranslation(
      baseMeme({
        description: "짧은 설명",
        origin: "",
        usage_note: null,
        caution: null,
        usage_examples: null,
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
      }),
      translation(),
      "en",
    );
    expect(isIndexableLocalizedMeme(localized)).toBe(false);
  });
});

describe("localized search lookup status", () => {
  it("classifies an eligible reviewed row as active", async () => {
    mockTranslationQuery({ data: [featuredRow()], error: null });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result.status).toBe("active");
    expect(result.items.get("abc12345")?.title).toBe("Original meme");
  });

  it.each([
    { label: "ineligible row", data: [featuredRow({ status: "machine" })] },
    { label: "empty rows", data: [] },
  ])("classifies $label as coverage-empty", async ({ data }) => {
    mockTranslationQuery({ data, error: null });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result).toEqual({ items: new Map(), status: "coverage-empty" });
  });

  it("classifies a query error as unavailable", async () => {
    mockTranslationQuery({ data: null, error: new Error("lookup failed") });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result).toEqual({ items: new Map(), status: "unavailable" });
  });

  it("classifies a thrown client error as unavailable", async () => {
    createStaticClient.mockImplementation(() => {
      throw new Error("client unavailable");
    });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result).toEqual({ items: new Map(), status: "unavailable" });
  });

  it.each(["private", "unlisted", "removed", "ledger-failed"])(
    "removes a search row whose indexability depends on %s media",
    async () => {
    const hidden = featuredRow();
    hidden.memes = baseMeme({
      description: "d".repeat(150),
      origin: "o".repeat(30),
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [
        { source_url: "https://www.youtube.com/watch?v=source00001" },
        { source_url: "https://www.youtube.com/watch?v=source00002" },
      ],
      meme_contents: [{
        url: "https://www.youtube.com/watch?v=content0001",
        platform: "youtube",
        content_id: "content0001",
        availability: "live",
        moderation_status: "approved",
      }],
      meme_tags_map: [],
    } as never);
    mockTranslationQuery({ data: [hidden], error: null });
    filterPublicMemeMedia.mockResolvedValue({
      sources: hidden.memes.meme_sources,
      contents: [],
    });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result).toEqual({ items: new Map(), status: "coverage-empty" });
    },
  );

  it("removes produced media before deciding search eligibility", async () => {
    const produced = featuredRow();
    produced.memes = baseMeme({
      description: "d".repeat(150),
      origin: "o".repeat(30),
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [
        { source_url: "https://example.com/source-a" },
        { source_url: "https://example.com/source-b" },
      ],
      meme_contents: [{
        availability: "live",
        moderation_status: "approved",
        production_id: "production-1",
      }],
      meme_tags_map: [],
    } as never);
    mockTranslationQuery({ data: [produced], error: null });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result).toEqual({ items: new Map(), status: "coverage-empty" });
  });

  it("returns only projected public media in localized search card fields", async () => {
    const strong = featuredRow();
    mockTranslationQuery({ data: [strong], error: null });
    filterPublicMemeMedia.mockResolvedValue({ sources: [], contents: [] });

    const result = await getLocalizedSearchMemesResult(["abc12345"], "en");

    expect(result.status).toBe("active");
    expect(result.items.get("abc12345")?.meme_sources).toEqual([]);
    expect(result.items.get("abc12345")?.meme_contents).toEqual([]);
  });
});

describe("localized featured Korean origin", () => {
  it("keeps KR-origin translations and skips unknown or non-Korean origin", async () => {
    const korean = featuredRow();
    const american = {
      ...translation({
        meme_id: "00000000-0000-4000-8000-000000000002",
        localized_slug: "gyat-meme",
        title: "Gyat meme",
      }),
      memes: baseMeme({
        id: "00000000-0000-4000-8000-000000000002",
        short_id: "gyat0001",
        slug: "gyat",
        title: "Gyat",
        meme_market_profiles: [
          { market_code: "US", role: "origin", review_state: "reviewed" },
        ],
      }),
    };
    const unknown = {
      ...translation({
        meme_id: "00000000-0000-4000-8000-000000000003",
        localized_slug: "unknown-meme",
        title: "Unknown origin meme",
      }),
      memes: baseMeme({
        id: "00000000-0000-4000-8000-000000000003",
        short_id: "unkn0001",
        slug: "unknown",
        title: "Unknown",
        meme_market_profiles: [],
      }),
    };
    mockTranslationQuery({ data: [american, unknown, korean], error: null });

    const featured = await getLocalizedFeaturedMemes("en", 12);

    expect(featured).toHaveLength(1);
    expect(featured[0]?.short_id).toBe("abc12345");
    expect(featured[0]?.title).toBe("Original meme");
  });

  it("does not publish a translation whose Korean source only passes via hidden media", async () => {
    const hiddenMedia = featuredRow();
    hiddenMedia.memes = baseMeme({
      description: "d".repeat(150),
      origin: "o".repeat(30),
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [
        { source_url: "https://www.youtube.com/watch?v=source00001" },
        { source_url: "https://www.youtube.com/watch?v=source00002" },
      ],
      meme_contents: [
        {
          url: "https://www.youtube.com/watch?v=content0001",
          platform: "youtube",
          content_id: "content0001",
          availability: "live",
          moderation_status: "approved",
        },
      ],
      meme_tags_map: [],
    } as never);
    mockTranslationQuery({ data: [hiddenMedia], error: null });
    filterPublicMemeMedia.mockResolvedValue({
      sources: hiddenMedia.memes.meme_sources,
      contents: [],
    });

    const result = await getLocalizedFeaturedMemesResult("en", 12);

    expect(result).toEqual({ items: [], status: "coverage-empty" });
    expect(filterPublicMemeMedia).toHaveBeenCalledOnce();
  });

  it("reports a featured query failure instead of disguising it as empty coverage", async () => {
    mockTranslationQuery({ data: null, error: new Error("query failed") });

    await expect(getLocalizedFeaturedMemesResult("en", 12)).resolves.toEqual({
      items: [],
      status: "unavailable",
    });
  });

  it("defaults reader surfaces to approved plus limited and lets AI feeds request approved only", async () => {
    const query = mockTranslationQuery({ data: [], error: null });

    await getLocalizedFeaturedMemesResult("en", 12);
    expect(query.in).toHaveBeenCalledWith("memes.moderation_status", ["approved", "limited"]);

    query.in.mockClear();
    await getLocalizedFeaturedMemesResult("en", 12, "approved-only");
    expect(query.in).toHaveBeenCalledWith("memes.moderation_status", ["approved"]);
  });

  it("continues past a full ineligible page and finds a later reviewed item", async () => {
    const ineligiblePage = Array.from({ length: 200 }, () =>
      featuredRow({ status: "machine" }));
    const eligible = featuredRow();
    const query = mockPagedTranslationQuery((index) => index === 0
      ? { data: ineligiblePage, error: null }
      : { data: [eligible], error: null });

    const result = await getLocalizedFeaturedMemesResult("en", 1);

    expect(result.status).toBe("active");
    expect(result.items[0]?.short_id).toBe("abc12345");
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 199);
    expect(query.range).toHaveBeenNthCalledWith(2, 200, 399);
    expect(query.order).toHaveBeenCalledWith("meme_id", { ascending: false });
  });

  it("returns unavailable when a later candidate page fails", async () => {
    const ineligiblePage = Array.from({ length: 200 }, () =>
      featuredRow({ status: "machine" }));
    mockPagedTranslationQuery((index) => index === 0
      ? { data: ineligiblePage, error: null }
      : { data: null, error: new Error("later page failed") });

    await expect(getLocalizedFeaturedMemesResult("en", 1)).resolves.toEqual({
      items: [],
      status: "unavailable",
    });
  });

  it("returns unavailable when the bounded scan is exhausted without corpus exhaustion", async () => {
    const fullPage = Array.from({ length: 200 }, () =>
      featuredRow({ status: "machine" }));
    const query = mockPagedTranslationQuery(() => ({ data: fullPage, error: null }));

    await expect(getLocalizedFeaturedMemesResult("en", 1)).resolves.toEqual({
      items: [],
      status: "unavailable",
    });
    expect(query.range).toHaveBeenCalledTimes(250);
    expect(query.range).toHaveBeenLastCalledWith(49_800, 49_999);
  });
});
