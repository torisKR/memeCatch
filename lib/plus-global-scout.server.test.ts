import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { loadPlusGlobalScout, plusGlobalScoutDateKey } from "@/lib/plus-global-scout.server";

const SOURCE_UPDATED_AT = "2026-08-09T00:00:00.000Z";

function query(result: { data: unknown; error: { message: string } | null }) {
  const builder = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    overrideTypes: vi.fn(),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.overrideTypes.mockReturnValue(builder);
  return builder;
}

function source() {
  return {
    id: "meme-1",
    short_id: "abc123",
    slug: "source-meme",
    title: "한국어 밈",
    summary: "한국어 요약",
    description: "한국어 설명 ".repeat(40),
    origin: "한국어 유래 ".repeat(12),
    usage_note: "사용법 ".repeat(5),
    caution: "주의 ".repeat(5),
    usage_examples: [
      { situation: "친구와", text: "예문 하나" },
      { situation: "대화방", text: "예문 둘" },
    ],
    meme_sources: [
      { source_url: "https://example.com/source-1" },
      { source_url: "https://example.com/source-2" },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "one" }, { tag_id: "two" }, { tag_id: "three" }],
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "rising",
    moderation_status: "approved",
    trend_score: 88,
    updated_at: SOURCE_UPDATED_AT,
  };
}

function translation() {
  return {
    meme_id: "meme-1",
    locale: "en",
    localized_slug: "global-meme",
    title: "Global meme",
    summary: "Global summary",
    description: "Global description",
    origin: "Global origin",
    usage_note: "Use it lightly",
    caution: "Check the context",
    status: "reviewed",
    source_updated_at: SOURCE_UPDATED_AT,
    updated_at: SOURCE_UPDATED_AT,
  };
}

type FakeClient = { from: ReturnType<typeof vi.fn> };

function client(from: ReturnType<typeof query>[]): FakeClient {
  return {
    from: vi.fn((table: string) => {
      const next = from.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
  };
}

describe("loadPlusGlobalScout", () => {
  it("does not query or expose the deck for free users", async () => {
    const supabase = client([]);

    await expect(
      loadPlusGlobalScout({
        supabase: supabase as never,
        isPremium: false,
        locale: "en",
        interests: [],
      }),
    ).resolves.toMatchObject({ status: "empty", items: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("queries only public safe active sources and exact reviewed locale rows", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: [translation()], error: null });
    const supabase = client([sources, translations]);

    await expect(
      loadPlusGlobalScout({
        supabase: supabase as never,
        isPremium: true,
        locale: "en",
        interests: ["phrase"],
        now: new Date("2026-08-09T15:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "active",
      dateKey: "2026-08-10",
      items: [
        expect.objectContaining({
          id: "meme-1",
          locale: "en",
          title: "Global meme",
          sourceUpdatedAt: SOURCE_UPDATED_AT,
        }),
      ],
    });
    expect(sources.in).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(sources.in).toHaveBeenCalledWith("safety_level", ["green", "yellow"]);
    expect(sources.in).toHaveBeenCalledWith("lifecycle_status", ["rising", "active"]);
    expect(sources.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(sources.in).toHaveBeenCalledWith("category", ["phrase"]);
    expect(translations.eq).toHaveBeenCalledWith("locale", "en");
    expect(translations.eq).toHaveBeenCalledWith("status", "reviewed");
  });

  it("uses the Korean source without a translation query and returns empty on source failure", async () => {
    const sources = query({ data: [source()], error: null });
    const supabase = client([sources]);

    await expect(
      loadPlusGlobalScout({
        supabase: supabase as never,
        isPremium: true,
        locale: "ko",
        interests: [],
      }),
    ).resolves.toMatchObject({
      status: "active",
      items: [expect.objectContaining({ locale: "ko", title: "한국어 밈" })],
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);

    const failed = query({ data: null, error: { message: "read failed" } });
    await expect(
      loadPlusGlobalScout({
        supabase: client([failed]) as never,
        isPremium: true,
        locale: "ja",
        interests: [],
      }),
    ).resolves.toMatchObject({ status: "unavailable", items: [] });
  });

  it("separates translation read failures from an empty reviewed deck", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: null, error: { message: "translation read failed" } });

    await expect(
      loadPlusGlobalScout({
        supabase: client([sources, translations]) as never,
        isPremium: true,
        locale: "en",
        interests: [],
      }),
    ).resolves.toMatchObject({ status: "unavailable", items: [] });
  });

  it("uses an exact-current English deck when a supported locale has no reviewed coverage", async () => {
    const sources = query({ data: [source()], error: null });
    const japaneseTranslations = query({ data: [], error: null });
    const englishTranslations = query({ data: [translation()], error: null });

    await expect(
      loadPlusGlobalScout({
        supabase: client([sources, japaneseTranslations, englishTranslations]) as never,
        isPremium: true,
        locale: "ja",
        interests: [],
        now: new Date("2026-08-09T15:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      status: "active",
      items: [
        expect.objectContaining({
          id: "meme-1",
          locale: "en",
          title: "Global meme",
        }),
      ],
    });
    expect(japaneseTranslations.eq).toHaveBeenCalledWith("locale", "ja");
    expect(englishTranslations.eq).toHaveBeenCalledWith("locale", "en");
  });

  it("does not query English when the requested locale already has an eligible card", async () => {
    const sources = query({ data: [source()], error: null });
    const japaneseTranslations = query({
      data: [{ ...translation(), locale: "ja", localized_slug: "japanese-meme" }],
      error: null,
    });
    const supabase = client([sources, japaneseTranslations]);

    await expect(
      loadPlusGlobalScout({
        supabase: supabase as never,
        isPremium: true,
        locale: "ja",
        interests: [],
      }),
    ).resolves.toMatchObject({
      status: "active",
      items: [expect.objectContaining({ locale: "ja", slug: "japanese-meme" })],
    });
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("keeps an English fallback read failure unavailable instead of empty", async () => {
    const sources = query({ data: [source()], error: null });
    const japaneseTranslations = query({ data: [], error: null });
    const englishTranslations = query({ data: null, error: { message: "fallback read failed" } });

    await expect(
      loadPlusGlobalScout({
        supabase: client([sources, japaneseTranslations, englishTranslations]) as never,
        isPremium: true,
        locale: "ja",
        interests: [],
      }),
    ).resolves.toMatchObject({ status: "unavailable", items: [] });
  });

  it("uses the KST date at the exact UTC boundary", () => {
    expect(plusGlobalScoutDateKey(new Date("2026-08-09T14:59:59.999Z"))).toBe("2026-08-09");
    expect(plusGlobalScoutDateKey(new Date("2026-08-09T15:00:00.000Z"))).toBe("2026-08-10");
  });
});
