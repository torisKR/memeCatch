import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));

import {
  buildPlusOutcomeHistory,
  isPlusOutcomeArtifactKind,
  isPlusOutcomeChannel,
  isPlusOutcomeLocale,
  parsePlusOutcomeHistoryRows,
  parsePlusOutcomeRatingRows,
  parsePlusOutcomeSummary,
} from "@/lib/plus-outcome-ledger";
import {
  loadPlusOutcomeHistory,
  loadPlusOutcomeReplayItem,
  loadPlusOutcomeFollowUps,
  loadPlusOutcomeRatings,
  loadPlusOutcomeSummary,
  plusOutcomeHistoryDateWindow,
  type PlusOutcomeLedgerSupabase,
} from "@/lib/plus-outcome-ledger.server";

const supabase = { rpc, from } as unknown as PlusOutcomeLedgerSupabase;

const readySummary = {
  status: "ready",
  from_date: "2026-08-03",
  to_date: "2026-08-09",
  timezone: "Asia/Seoul",
  total_receipts: 2,
  total_completions: 3,
  pending_receipt_count: 1,
  awaiting_performance_count: 1,
  by_channel: [
    { key: "instagram", count: 1 },
    { key: "threads", count: 1 },
  ],
  by_locale: [{ key: "ko", count: 2 }],
  by_artifact_kind: [{ key: "creator_pack", count: 2 }],
};

const currentEnglishTranslation = {
  meme_id: "meme-1",
  locale: "en",
  status: "reviewed",
  localized_slug: "global-use-en",
  title: "Global use",
  summary: "A global summary",
  description: "A global description",
  origin: "A global origin",
  usage_note: "Use this when the moment needs a quick shared reaction.",
  caution: "Keep the context clear and avoid using it for sensitive news.",
  aliases: [],
  usage_examples: [],
  source_updated_at: "2026-08-09T00:00:00.000Z",
  provider: "openai",
  model: "gpt-5.6-sol",
  prompt_version: 1,
  translated_at: "2026-08-09T01:00:00.000Z",
  reviewed_at: "2026-08-09T02:00:00.000Z",
  reviewed_by: "reviewer-1",
  created_at: "2026-08-09T01:00:00.000Z",
  updated_at: "2026-08-09T02:00:00.000Z",
};

const historyMeme = {
  id: "meme-1",
  short_id: "meme-1",
  slug: "global-use",
  title: "한국어 원문",
  summary: "한국어 요약",
  description: "가".repeat(160),
  origin: "나".repeat(30),
  usage_note: "다".repeat(40),
  caution: "라".repeat(40),
  aliases: [],
  usage_examples: [
    { situation: "친구 대화", text: "마" },
    { situation: "댓글", text: "바" },
  ],
  updated_at: "2026-08-09T00:00:00.000Z",
  moderation_status: "approved",
  safety_level: "green",
  lifecycle_status: "active",
  meme_contents: [{ availability: "available", moderation_status: "approved" }],
  meme_sources: [{ source_url: "https://example.com/one" }, { source_url: "https://example.com/two" }],
  meme_tags_map: [
    { tag_id: "tag-1", tags: { name: "one" } },
    { tag_id: "tag-2", tags: { name: "two" } },
    { tag_id: "tag-3", tags: { name: "three" } },
  ],
  meme_translations: [currentEnglishTranslation],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Plus outcome ledger domain", () => {
  it("recognizes only contract locale, channel, and artifact literals", () => {
    expect(isPlusOutcomeLocale("zh-tw")).toBe(true);
    expect(isPlusOutcomeLocale("fr")).toBe(false);
    expect(isPlusOutcomeChannel("threads")).toBe(true);
    expect(isPlusOutcomeChannel("facebook")).toBe(false);
    expect(isPlusOutcomeArtifactKind("creator_pack")).toBe(true);
    expect(isPlusOutcomeArtifactKind("video")).toBe(false);
  });

  it("requires a valid channel when parsing rating rows", () => {
    expect(
      parsePlusOutcomeRatingRows([
        {
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          channel: "threads",
          performance_rating: "hit",
        },
        {
          meme_id: "meme-2",
          completion_date: "2026-08-09",
          performance_rating: "hit",
        },
      ]),
    ).toEqual([
      { memeId: "meme-1", completionDate: "2026-08-09", channel: "threads", rating: "hit" },
    ]);
  });

  it("parses only internal history links and keeps a deterministic bounded history", () => {
    const rows = parsePlusOutcomeHistoryRows([
      {
        id: "receipt-2",
        meme_id: "meme-2",
        completion_date: "2026-08-09",
        title_snapshot: "Second use",
        channel: "instagram",
        locale: "en",
        artifact_kind: "caption",
        performance_note: "12 saves",
        performance_rating: "hit",
        href: "/en/memes/meme-2-second",
        link_status: "localized",
        private_note: "should never be returned",
        result_url: "https://private.example/post",
      },
      {
        id: "receipt-1",
        meme_id: "meme-1",
        completion_date: "2026-08-10",
        title_snapshot: "Newest use",
        channel: "threads",
        locale: "ko",
        artifact_kind: "creator_pack",
        performance_note: null,
        performance_rating: null,
        href: "/memes/meme-1-newest",
        link_status: "korean-fallback",
      },
      {
        id: "receipt-external",
        meme_id: "meme-3",
        completion_date: "2026-08-11",
        title_snapshot: "External link",
        channel: "x",
        locale: "ko",
        artifact_kind: "link",
        performance_note: null,
        performance_rating: null,
        href: "https://example.com/not-internal",
        link_status: "localized",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      receiptId: "receipt-2",
      href: "/en/memes/meme-2-second",
      linkStatus: "localized",
    });
    expect(rows[0]).not.toHaveProperty("privateNote");
    expect(rows[0]).toHaveProperty("resultUrl", "https://private.example/post");
    expect(buildPlusOutcomeHistory(rows, 1)).toMatchObject({
      status: "ready",
      pendingCount: 1,
      items: [{ title: "Newest use", href: "/memes/meme-1-newest", linkStatus: "korean-fallback" }],
    });
  });

  it("calculates a 30-day KST history window inclusively", () => {
    expect(plusOutcomeHistoryDateWindow(new Date("2026-08-08T16:00:00.000Z"))).toEqual({
      from: "2026-07-11",
      to: "2026-08-09",
    });
  });

  it("keeps replay metadata only for hit rows with a public matching-locale link", () => {
    const rows = parsePlusOutcomeHistoryRows([
      {
        id: "receipt-unavailable-hit",
        meme_id: "meme-1",
        completion_date: "2026-08-09",
        title_snapshot: "Unavailable hit",
        channel: "threads",
        locale: "en",
        artifact_kind: "caption",
        performance_note: null,
        performance_rating: "hit",
        href: null,
        link_status: "unavailable",
        replay_short_id: "meme-1",
      },
      {
        id: "receipt-fallback-hit",
        meme_id: "meme-1",
        completion_date: "2026-08-08",
        title_snapshot: "Fallback hit",
        channel: "threads",
        locale: "en",
        artifact_kind: "caption",
        performance_note: null,
        performance_rating: "hit",
        href: "/memes/meme-1-source",
        link_status: "korean-fallback",
        replay_short_id: "meme-1",
      },
      {
        id: "receipt-neutral",
        meme_id: "meme-1",
        completion_date: "2026-08-07",
        title_snapshot: "Neutral result",
        channel: "threads",
        locale: "en",
        artifact_kind: "caption",
        performance_note: null,
        performance_rating: "neutral",
        href: "/en/memes/meme-1-source-en",
        link_status: "localized",
        replay_short_id: "meme-1",
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => !Object.hasOwn(row, "replayShortId"))).toBe(true);
  });

  it("safely parses a consistent seven-day summary", () => {
    expect(parsePlusOutcomeSummary(readySummary)).toEqual({
      status: "ready",
      fromDate: "2026-08-03",
      toDate: "2026-08-09",
      timezone: "Asia/Seoul",
      totalReceipts: 2,
      totalCompletions: 3,
      pendingReceiptCount: 1,
      awaitingPerformanceCount: 1,
      byChannel: readySummary.by_channel,
      byLocale: readySummary.by_locale,
      byArtifactKind: readySummary.by_artifact_kind,
    });

    expect(
      parsePlusOutcomeSummary({
        ...readySummary,
        status: "empty",
        total_receipts: 0,
        total_completions: 0,
        pending_receipt_count: 0,
        awaiting_performance_count: 0,
        by_channel: [],
        by_locale: [],
        by_artifact_kind: [],
      }),
    ).toMatchObject({ status: "empty", totalReceipts: 0 });
  });

  it("rejects malformed windows, unknown keys, and inconsistent totals", () => {
    expect(parsePlusOutcomeSummary({ ...readySummary, to_date: "2026-08-10" })).toBeNull();
    expect(
      parsePlusOutcomeSummary({
        ...readySummary,
        by_channel: [{ key: "facebook", count: 2 }],
      }),
    ).toBeNull();
    expect(parsePlusOutcomeSummary({ ...readySummary, pending_receipt_count: 0 })).toBeNull();
  });
});

describe("Plus outcome ledger server loader", () => {
  it("returns locked without touching history for non-Plus users", async () => {
    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: false,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "locked", items: [], pendingCount: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("loads a bounded owner-scoped history with current localized detail links", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-1",
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          title_snapshot: "Global use",
          channel: "threads",
          locale: "en",
          artifact_kind: "creator_pack",
          performance_note: "Good replies",
          performance_rating: "hit",
          memes: historyMeme,
          private_note: "private",
          result_url: "https://private.example/post",
        },
        {
          id: "receipt-invalid-result",
          meme_id: "meme-1",
          completion_date: "2026-08-08",
          title_snapshot: "Unsafe result",
          channel: "threads",
          locale: "en",
          artifact_kind: "creator_pack",
          performance_note: null,
          performance_rating: null,
          memes: historyMeme,
          result_url: "javascript:alert(1)",
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({
      status: "ready",
      pendingCount: 0,
      items: [
        {
          receiptId: "receipt-1",
          completionDate: "2026-08-09",
          title: "Global use",
          channel: "threads",
          locale: "en",
          artifactKind: "creator_pack",
          hasPerformanceNote: true,
          performanceRating: "hit",
          resultUrl: "https://private.example/post",
          replayShortId: "meme-1",
          href: "/en/memes/meme-1-global-use-en",
          linkStatus: "localized",
        },
      ],
    });
    expect(from).toHaveBeenCalledWith("plus_meme_use_receipts");
    expect(query.select.mock.calls[0][0]).toContain("meme_translations(");
    expect(query.select.mock.calls[0][0]).toContain("meme_contents(availability, moderation_status)");
    expect(query.select.mock.calls[0][0]).toContain("result_url");
    expect(query.select.mock.calls[0][0]).not.toContain("private_note");
    expect(query.limit).toHaveBeenCalledWith(50);
    expect(query.order).toHaveBeenNthCalledWith(1, "completion_date", { ascending: false });
    expect(query.order).toHaveBeenNthCalledWith(2, "id", { ascending: true });
  });

  it("falls back to Korean or marks a row unavailable when localized replay is not indexable", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-stale",
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          title_snapshot: "Stale use",
          channel: "threads",
          locale: "en",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: {
            ...historyMeme,
            meme_translations: [
              { ...currentEnglishTranslation, source_updated_at: "2026-08-01T00:00:00.000Z" },
            ],
          },
        },
        {
          id: "receipt-missing",
          meme_id: "meme-1",
          completion_date: "2026-08-08",
          title_snapshot: "Missing translation",
          channel: "instagram",
          locale: "zh",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: { ...historyMeme, meme_translations: [] },
        },
        {
          id: "receipt-unavailable",
          meme_id: "meme-1",
          completion_date: "2026-08-07",
          title_snapshot: "Unavailable translation data",
          channel: "x",
          locale: "ja",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: { ...historyMeme, meme_translations: null },
        },
        {
          id: "receipt-rejected",
          meme_id: "meme-1",
          completion_date: "2026-08-06",
          title_snapshot: "Rejected source",
          channel: "blog",
          locale: "en",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: { ...historyMeme, moderation_status: "rejected" },
        },
        {
          id: "receipt-unreviewed",
          meme_id: "meme-1",
          completion_date: "2026-08-05",
          title_snapshot: "Missing review audit",
          channel: "community",
          locale: "en",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: {
            ...historyMeme,
            meme_translations: [
              { ...currentEnglishTranslation, reviewed_at: null, reviewed_by: null },
            ],
          },
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      items: [
        {
          href: "/memes/meme-1-global-use",
          linkStatus: "korean-fallback",
        },
        {
          href: "/memes/meme-1-global-use",
          linkStatus: "korean-fallback",
        },
        {
          href: null,
          linkStatus: "unavailable",
        },
        {
          href: null,
          linkStatus: "unavailable",
        },
        {
          href: "/memes/meme-1-global-use",
          linkStatus: "korean-fallback",
        },
      ],
    });
  });

  it("returns only a current, safe hit as a replay action and preserves the prior channel", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-hit",
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          title_snapshot: "Global use",
          channel: "threads",
          locale: "en",
          artifact_kind: "creator_pack",
          performance_note: "Good replies",
          performance_rating: "hit",
          memes: historyMeme,
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeReplayItem({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
        shortId: "meme-1",
        locale: "en",
      }),
    ).resolves.toMatchObject({
      kind: "outcome_replay",
      memeId: "meme-1",
      shortId: "meme-1",
      locale: "en",
      preferredOutcomeChannel: "threads",
      href: "/en/memes/meme-1-global-use-en",
      creatorPackFacts: { safetyLevel: "green", lifecycleStatus: "active" },
    });

    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-stale-hit",
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          title_snapshot: "Stale global use",
          channel: "threads",
          locale: "en",
          artifact_kind: "creator_pack",
          performance_note: "Good replies",
          performance_rating: "hit",
          memes: {
            ...historyMeme,
            meme_translations: [
              { ...currentEnglishTranslation, source_updated_at: "2026-08-01T00:00:00.000Z" },
            ],
          },
        },
      ],
      error: null,
    });

    await expect(
      loadPlusOutcomeReplayItem({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
        shortId: "meme-1",
        locale: "en",
      }),
    ).resolves.toBeNull();
  });

  it("keeps a receipt row when its public meme relation is unavailable", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-no-public-meme",
          meme_id: "meme-hidden",
          completion_date: "2026-08-09",
          title_snapshot: "Hidden source",
          channel: "threads",
          locale: "en",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: null,
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      items: [{ title: "Hidden source", href: null, linkStatus: "unavailable" }],
    });
    expect(query.select.mock.calls[0][0]).not.toContain("!inner");
  });

  it("fails closed when a history row is malformed or missing its meme relation", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({
      data: [
        {
          id: "receipt-bad",
          meme_id: "meme-bad",
          completion_date: "2026-08-09",
          title_snapshot: "Bad row",
          channel: "not-a-channel",
          locale: "en",
          artifact_kind: "caption",
          performance_note: null,
          performance_rating: null,
          memes: null,
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "unavailable", items: [], pendingCount: 0 });
  });

  it("returns unavailable when history query fails", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      overrideTypes: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order", "limit"] as const) {
      query[method].mockReturnValue(query);
    }
    query.overrideTypes.mockResolvedValue({ data: null, error: { message: "history_failed" } });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeHistory({
        supabase,
        isPremium: true,
        fromDate: "2026-07-11",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "unavailable", items: [], pendingCount: 0 });
  });

  it("uses the legacy follow-up projection only for a missing performance rating column", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order"] as const) {
      query[method].mockReturnValue(query);
    }
    query.limit
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: "column plus_meme_use_receipts.performance_rating does not exist",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "receipt-legacy",
            meme_id: "meme-legacy",
            completion_date: "2026-08-09",
            title_snapshot: "Legacy receipt",
            channel: "threads",
            locale: "en",
            artifact_kind: "caption",
            performance_note: null,
          },
        ],
        error: null,
      });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeFollowUps({
        supabase,
        isPremium: true,
        fromDate: "2026-08-03",
        toDate: "2026-08-09",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      items: [{ receiptId: "receipt-legacy", performanceRating: null }],
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("does not use the legacy follow-up projection for unrelated undefined columns", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "order"] as const) {
      query[method].mockReturnValue(query);
    }
    query.limit.mockResolvedValue({
      data: null,
      error: { code: "42703", message: "column unrelated_column does not exist" },
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeFollowUps({
        supabase,
        isPremium: true,
        fromDate: "2026-08-03",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "unavailable", items: [], pendingCount: 0 });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("returns locked without touching ratings for non-Plus users", async () => {
    await expect(
      loadPlusOutcomeRatings({
        supabase,
        isPremium: false,
        fromDate: "2026-07-13",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "locked", rows: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns unavailable when the owner-scoped ratings query fails", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      not: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "not", "order"] as const) {
      query[method].mockReturnValue(query);
    }
    query.limit.mockResolvedValue({ data: null, error: { message: "ratings_failed" } });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeRatings({
        supabase,
        isPremium: true,
        fromDate: "2026-07-13",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({ status: "unavailable", rows: [] });
  });

  it("returns locked without touching the database for non-Plus users", async () => {
    await expect(loadPlusOutcomeSummary({ supabase, isPremium: false })).resolves.toMatchObject({
      status: "locked",
      totalReceipts: 0,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns unavailable for RPC failures or malformed data", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "rpc_failed" } });
    await expect(loadPlusOutcomeSummary({ supabase, isPremium: true })).resolves.toMatchObject({
      status: "unavailable",
    });

    rpc.mockResolvedValueOnce({ data: { status: "ready" }, error: null });
    await expect(loadPlusOutcomeSummary({ supabase, isPremium: true })).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("returns ready or empty for valid owner-scoped RPC data", async () => {
    rpc.mockResolvedValueOnce({ data: readySummary, error: null });
    await expect(loadPlusOutcomeSummary({ supabase, isPremium: true })).resolves.toMatchObject({
      status: "ready",
      totalReceipts: 2,
      pendingReceiptCount: 1,
    });
    expect(rpc).toHaveBeenCalledWith("get_plus_meme_use_outcome_summary");

    rpc.mockResolvedValueOnce({
      data: {
        ...readySummary,
        status: "empty",
        total_receipts: 0,
        total_completions: 0,
        pending_receipt_count: 0,
        awaiting_performance_count: 0,
        by_channel: [],
        by_locale: [],
        by_artifact_kind: [],
      },
      error: null,
    });
    await expect(loadPlusOutcomeSummary({ supabase, isPremium: true })).resolves.toMatchObject({
      status: "empty",
    });
  });

  it("loads channel alongside each Plus rating and keeps the query owner-scoped", async () => {
    const query = {
      select: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      not: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    for (const method of ["select", "gte", "lte", "not", "order"] as const) {
      query[method].mockReturnValue(query);
    }
    query.limit.mockResolvedValue({
      data: [
        {
          meme_id: "meme-1",
          completion_date: "2026-08-09",
          channel: "threads",
          performance_rating: "hit",
        },
      ],
      error: null,
    });
    from.mockReturnValue(query);

    await expect(
      loadPlusOutcomeRatings({
        supabase,
        isPremium: true,
        fromDate: "2026-07-13",
        toDate: "2026-08-09",
      }),
    ).resolves.toEqual({
      status: "ready",
      rows: [{ memeId: "meme-1", completionDate: "2026-08-09", channel: "threads", rating: "hit" }],
    });
    expect(from).toHaveBeenCalledWith("plus_meme_use_receipts");
    expect(query.select).toHaveBeenCalledWith(
      "meme_id, completion_date, channel, performance_rating",
    );
  });
});
