import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadPlusTranslationFulfillment } from "@/lib/plus-translation-fulfillment.server";

const SOURCE_UPDATED_AT = "2026-08-09T00:00:00.000Z";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    overrideTypes: vi.fn(),
    then: (resolve: (value: QueryResult) => void) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.overrideTypes.mockReturnValue(builder);
  return builder;
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    meme_id: "meme-1",
    locale: "en",
    status: "requested",
    created_at: "2026-08-08T00:00:00.000Z",
    updated_at: "2026-08-09T01:00:00.000Z",
    completed_at: null,
    meme: {
      id: "meme-1",
      short_id: "abc123",
      slug: "source-meme",
      title: "Source meme",
      description:
        "A detailed definition explains the recognizable expression, its social signal, and the situations in which people use it in everyday conversation. ".repeat(2),
      origin: "The format became popular through online communities and was adapted across contexts over time.",
      usage_note: "Use this meme when a team needs a clear, quick reaction to a shared situation.",
      caution: "Check the audience and context before using this format publicly.",
      usage_examples: [
        { situation: "A team needs a quick reaction", text: "Use the card to make the shared mood explicit." },
      ],
      meme_sources: [{ source_url: "https://example.com/meme-1" }],
      meme_contents: [{ availability: "available", moderation_status: "approved" }],
      meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
      updated_at: SOURCE_UPDATED_AT,
      moderation_status: "approved",
    },
    ...overrides,
  };
}

function translation() {
  return {
    meme_id: "meme-1",
    locale: "en",
    status: "reviewed",
    source_updated_at: SOURCE_UPDATED_AT,
    updated_at: "2026-08-09T02:00:00.000Z",
    localized_slug: "localized-meme",
    title: "Localized meme",
    summary: "Localized summary",
    description: "Localized description",
    origin: "Localized origin",
  };
}

type FakeClient = { from: ReturnType<typeof vi.fn> };

function client(queries: ReturnType<typeof query>[]): FakeClient {
  return {
    from: vi.fn((table: string) => {
      const next = queries.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
  };
}

describe("loadPlusTranslationFulfillment", () => {
  it("returns locked without touching Supabase for free or blank-owner paths", async () => {
    const supabase = client([]);

    await expect(
      loadPlusTranslationFulfillment({
        supabase: supabase as never,
        isPremium: false,
        userId: "owner-1",
      }),
    ).resolves.toEqual({ status: "locked", items: [] });
    await expect(
      loadPlusTranslationFulfillment({
        supabase: supabase as never,
        isPremium: true,
        userId: "   ",
      }),
    ).resolves.toEqual({ status: "locked", items: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("applies owner scope, public join, deterministic ordering, and the max limit", async () => {
    const requests = query({
      data: [
        request({
          status: "completed",
          completed_at: "2026-08-09T02:00:00.000Z",
        }),
      ],
      error: null,
    });
    const translations = query({ data: [translation()], error: null });
    const supabase = client([requests, translations]);

    await expect(
      loadPlusTranslationFulfillment({
        supabase: supabase as never,
        isPremium: true,
        userId: " owner-1 ",
        limit: 99,
      }),
    ).resolves.toMatchObject({
      status: "active",
      items: [expect.objectContaining({ requestId: "request-1", state: "ready" })],
    });

    expect(supabase.from).toHaveBeenNthCalledWith(1, "plus_translation_requests");
    expect(requests.select).toHaveBeenCalledWith(
      expect.stringContaining(
        "meme:memes!inner(id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, safety_level, lifecycle_status, trend_score, moderation_status, updated_at, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id))",
      ),
    );
    expect(requests.eq).toHaveBeenCalledWith("user_id", "owner-1");
    expect(requests.in).toHaveBeenCalledWith("memes.moderation_status", [
      "approved",
      "limited",
    ]);
    expect(requests.order).toHaveBeenNthCalledWith(1, "updated_at", { ascending: false });
    expect(requests.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
    expect(requests.limit).toHaveBeenCalledWith(20);
    expect(translations.eq).toHaveBeenCalledWith("locale", "en");
    expect(translations.in).toHaveBeenCalledWith("meme_id", ["meme-1"]);
  });

  it("returns unavailable instead of empty when the translation query fails", async () => {
    const requests = query({ data: [request()], error: null });
    const translations = query({
      data: null,
      error: { message: "translation read failed" },
    });

    await expect(
      loadPlusTranslationFulfillment({
        supabase: client([requests, translations]) as never,
        isPremium: true,
        userId: "owner-1",
      }),
    ).resolves.toEqual({ status: "unavailable", items: [] });
  });

  it("returns unavailable instead of empty when the owner request query fails", async () => {
    const requests = query({
      data: null,
      error: { message: "request read failed" },
    });

    await expect(
      loadPlusTranslationFulfillment({
        supabase: client([requests]) as never,
        isPremium: true,
        userId: "owner-1",
      }),
    ).resolves.toEqual({ status: "unavailable", items: [] });
  });

  it("returns empty only when no eligible owner request exists", async () => {
    const requests = query({ data: [request({ locale: "ko" })], error: null });
    const supabase = client([requests]);

    await expect(
      loadPlusTranslationFulfillment({
        supabase: supabase as never,
        isPremium: true,
        userId: "owner-1",
      }),
    ).resolves.toEqual({ status: "empty", items: [] });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});
