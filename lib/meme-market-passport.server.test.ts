import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createStaticClient = vi.hoisted(() => vi.fn());
const getLocalizedSearchMemesResult = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
vi.mock("@/lib/meme-translations", () => ({ getLocalizedSearchMemesResult }));

import { getMemeMarketPassport } from "@/lib/meme-market-passport.server";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function query(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    overrideTypes: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) => resolve(result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.overrideTypes.mockReturnValue(builder);
  return builder;
}

function installClient(queries: ReturnType<typeof query>[]) {
  const supabase = {
    from: vi.fn((table: string) => {
      const next = queries.shift();
      if (!next) throw new Error(`Unexpected query for ${table}`);
      return next;
    }),
  };
  createStaticClient.mockReturnValue(supabase);
  return supabase;
}

const reviewedProfile = {
  meme_id: "meme-1",
  market_code: "JP",
  language_tag: "ja",
  role: "active",
  local_title: "現地ミーム",
  local_aliases: [],
  usage_note: "友人同士で使います。",
  caution: "場面を確認してください。",
  review_state: "reviewed",
};

const indexableTargetFields = {
  description: "D".repeat(180),
  origin: "O".repeat(40),
  usage_note: "U".repeat(40),
  caution: "C".repeat(40),
  usage_examples: [{ situation: "chat", text: "Use this in a casual chat." }],
  meme_sources: [{ source_url: "https://example.com/source" }],
  meme_contents: [{ availability: "available", moderation_status: "approved" }],
  meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
};

describe("getMemeMarketPassport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLocalizedSearchMemesResult.mockResolvedValue({ items: new Map(), status: "coverage-empty" });
  });

  it("returns reviewed only when the built passport has reviewed data", async () => {
    installClient([
      query({ data: [reviewedProfile], error: null }),
      query({ data: [], error: null }),
    ]);

    await expect(getMemeMarketPassport("meme-1")).resolves.toMatchObject({
      dataStatus: "reviewed",
      hasReviewedData: true,
      profiles: expect.arrayContaining([expect.objectContaining({ marketCode: "JP" })]),
    });
  });

  it("marks fallback-only data as empty", async () => {
    installClient([
      query({ data: [], error: null }),
      query({ data: [], error: null }),
    ]);

    await expect(getMemeMarketPassport("meme-1")).resolves.toMatchObject({
      dataStatus: "empty",
      hasReviewedData: false,
    });
  });

  it("marks a read failure unavailable instead of exposing fallback facts", async () => {
    installClient([
      query({ data: null, error: { message: "permission denied" } }),
      query({ data: [], error: null }),
    ]);

    await expect(getMemeMarketPassport("meme-1")).resolves.toMatchObject({
      dataStatus: "unavailable",
      hasReviewedData: false,
    });
  });

  it("attaches a canonical route to Korean reviewed variants without a translation read", async () => {
    installClient([
      query({ data: [], error: null }),
      query({
        data: [
          { id: "link-1", target_meme_id: "meme-2", relation_kind: "local_variant", review_state: "reviewed" },
          { id: "link-2", target_meme_id: "meme-3", relation_kind: "local_variant", review_state: "reviewed" },
        ],
        error: null,
      }),
      query({
        data: [
          {
            id: "meme-2",
            short_id: "m2",
            slug: "local-variant",
            title: "Local variant",
            ...indexableTargetFields,
          },
          { id: "meme-3", short_id: "m3", slug: "thin-variant", title: "Thin variant" },
        ],
        error: null,
      }),
    ]);

    const passport = await getMemeMarketPassport("meme-1", "ko");
    expect(passport).toMatchObject({
      dataStatus: "reviewed",
      variants: [
        expect.objectContaining({ targetHref: "/memes/m2-local-variant" }),
      ],
    });
    expect(passport.variants).toHaveLength(1);
    expect(getLocalizedSearchMemesResult).not.toHaveBeenCalled();
  });

  it("only links localized variants with an exact reviewed route", async () => {
    installClient([
      query({ data: [], error: null }),
      query({
        data: [
          { id: "link-1", target_meme_id: "meme-2", relation_kind: "local_variant", review_state: "reviewed" },
          { id: "link-2", target_meme_id: "meme-3", relation_kind: "local_variant", review_state: "reviewed" },
        ],
        error: null,
      }),
      query({
        data: [
          {
            id: "meme-2",
            short_id: "m2",
            slug: "canonical-variant",
            title: "Canonical variant",
            ...indexableTargetFields,
          },
          {
            id: "meme-3",
            short_id: "m3",
            slug: "missing-locale",
            title: "Missing locale",
            ...indexableTargetFields,
          },
        ],
        error: null,
      }),
    ]);
    getLocalizedSearchMemesResult.mockResolvedValue({
      status: "active",
      items: new Map([
        ["m2", { short_id: "m2", slug: "localized-variant", title: "Localized variant" }],
      ]),
    });

    await expect(getMemeMarketPassport("meme-1", "ja")).resolves.toMatchObject({
      dataStatus: "reviewed",
      variants: [
        expect.objectContaining({
          targetTitle: "Localized variant",
          targetSlug: "localized-variant",
          targetHref: "/ja/memes/m2-localized-variant",
        }),
      ],
    });
  });

  it("keeps a localized target read failure unavailable", async () => {
    installClient([
      query({ data: [], error: null }),
      query({
        data: [{ id: "link-1", target_meme_id: "meme-2", relation_kind: "local_variant", review_state: "reviewed" }],
        error: null,
      }),
      query({
        data: [
          {
            id: "meme-2",
            short_id: "m2",
            slug: "local-variant",
            title: "Local variant",
            ...indexableTargetFields,
          },
        ],
        error: null,
      }),
    ]);
    getLocalizedSearchMemesResult.mockResolvedValue({ items: new Map(), status: "unavailable" });

    await expect(getMemeMarketPassport("meme-1", "zh")).resolves.toMatchObject({
      dataStatus: "unavailable",
      hasReviewedData: false,
    });
  });
});
