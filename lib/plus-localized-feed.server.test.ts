import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createStaticClient = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createStaticClient, createClient }));

import { loadPlusLocalizedFeed } from "@/lib/plus-localized-feed.server";
import type {
  PlusLocalizedFeedSource,
  PlusLocalizedFeedTranslation,
} from "@/lib/plus-localized-feed";

const SOURCE_UPDATED_AT = "2026-08-09T00:00:00.000Z";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    overrideTypes: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.overrideTypes.mockReturnValue(builder);
  return builder;
}

function client(queries: ReturnType<typeof query>[]) {
  return {
    from: vi.fn((table: string) => {
      const next = queries.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
  };
}

function source(number = 1): PlusLocalizedFeedSource {
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
        thumbnail_url: "https://cdn.example/thumb.jpg",
        is_representative: true,
      },
    ],
    meme_sources: [{ source_url: "https://example.com/source" }],
    meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
  };
}

function translation(number = 1): PlusLocalizedFeedTranslation {
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
    aliases: ["localized alias"],
    usage_examples: [{ situation: "friends", text: "Use it with context." }],
    usage_note: "Use it with people who understand the context.",
    caution: "Avoid formal settings.",
    provider: "test-provider",
    model: "test-model",
    prompt_version: 1,
    translated_at: SOURCE_UPDATED_AT,
    reviewed_at: SOURCE_UPDATED_AT,
    reviewed_by: "reviewer-1",
    created_at: SOURCE_UPDATED_AT,
    updated_at: SOURCE_UPDATED_AT,
  };
}

function installClient(queries: ReturnType<typeof query>[]) {
  const supabase = client(queries);
  createStaticClient.mockReturnValue(supabase);
  return supabase;
}

describe("loadPlusLocalizedFeed", () => {
  it("returns locked before creating any Supabase client for free users", async () => {
    createStaticClient.mockReset();
    createClient.mockReset();

    await expect(
      loadPlusLocalizedFeed({ interests: [], locale: "en", isPremium: false }),
    ).resolves.toMatchObject({ state: "locked", items: [] });

    expect(createStaticClient).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses the static anon source boundary and exact reviewed localized detail contract", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: [translation()], error: null });
    const supabase = installClient([sources, translations]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({
      state: "active",
      contentLocale: "en",
      usedFresh: false,
      items: [
        expect.objectContaining({
          href: "/en/memes/short-1-localized-1",
          meme: expect.objectContaining({
            title: "Localized meme 1",
            summary: "Localized summary 1",
          }),
        }),
      ],
    });

    expect(supabase.from).toHaveBeenNthCalledWith(1, "memes");
    expect(sources.select).toHaveBeenCalledWith(
      expect.stringContaining("usage_note, caution, aliases, usage_examples, updated_at"),
    );
    expect(sources.select).toHaveBeenCalledWith(expect.stringContaining("meme_tags_map(tag_id)"));
    expect(sources.limit).toHaveBeenCalledWith(60);
    expect(sources.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(sources.in).toHaveBeenCalledWith("category", ["phrase"]);
    expect(translations.eq).toHaveBeenCalledWith("locale", "en");
    expect(translations.eq).toHaveBeenCalledWith("status", "reviewed");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses fresh content for an intentionally empty-interest selection", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: [translation()], error: null });
    installClient([sources, translations]);

    await expect(
      loadPlusLocalizedFeed({ interests: [], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({ state: "active", usedFresh: true });
    expect(sources.order).toHaveBeenCalledWith("published_at", {
      ascending: false,
      nullsFirst: false,
    });
  });

  it("falls back to fresh only after a successful empty interest query", async () => {
    const interestSources = query({ data: [], error: null });
    const freshSources = query({ data: [source()], error: null });
    const translations = query({ data: [translation()], error: null });
    const supabase = installClient([interestSources, freshSources, translations]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({ state: "active", usedFresh: true });
    expect(supabase.from).toHaveBeenCalledTimes(3);
  });

  it("does not hide an interest read failure behind fresh content", async () => {
    const failedSources = query({ data: null, error: { message: "interest read failed" } });
    const supabase = installClient([failedSources]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({ state: "unavailable", items: [] });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("keeps localized coverage empty instead of selecting a second source pool", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: [], error: null });
    const supabase = installClient([sources, translations]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({ state: "empty-coverage", items: [] });
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("separates translation failure from empty coverage", async () => {
    const sources = query({ data: [source()], error: null });
    const translations = query({ data: null, error: { message: "translation read failed" } });
    installClient([sources, translations]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    ).resolves.toMatchObject({ state: "unavailable", items: [] });
  });

  it("keeps Korean query behavior and never reads translations", async () => {
    const sources = query({ data: [source()], error: null });
    const supabase = installClient([sources]);

    await expect(
      loadPlusLocalizedFeed({ interests: ["phrase"], locale: "ko", isPremium: true }),
    ).resolves.toMatchObject({
      state: "active",
      contentLocale: "ko",
      items: [
        expect.objectContaining({
          meme: expect.objectContaining({ title: "한국어 밈 1" }),
        }),
      ],
    });
    expect(sources.limit).toHaveBeenCalledWith(6);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
