import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));

import { loadGlobalDailyChallenge } from "@/lib/global-daily-challenge.server";

type QueryResult = { data: unknown; error: { message: string } | null };

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  builder.select.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

function memes() {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `meme-${index}`,
    short_id: `short-${index}`,
    slug: `global-${index}`,
    title: `Global ${index}`,
    summary: `A sufficiently long summary for global meme number ${index}, with distinct context.`,
    description: "A reviewed explanation with enough detail for the daily challenge. This source-backed context explains the phrase, its audience, and the situations where it appears in current conversation.",
    origin: "The documented source history is current and reviewed, with a dated explanation of how the phrase moved from its original community into wider use.",
    usage_note: "Use it only when the surrounding conversation makes the intended tone clear. Use the phrase after the context has already been established.",
    caution: "Check the relationship and context before using it with someone unfamiliar. Avoid using it as a substitute for a direct explanation.",
    usage_examples: [
      { situation: "A casual group chat", text: "Use the phrase after the context has already been established." },
    ],
    meme_sources: [{ source_url: "https://example.com/global-meme-source" }],
    meme_contents: [{ availability: "available", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    category: "phrase",
    origin_year: 2024,
    safety_level: "green",
    lifecycle_status: "rising",
    moderation_status: "approved",
    updated_at: "2026-08-09T00:00:00.000Z",
  }));
}

function translations() {
  return memes().flatMap((meme) => ["en", "ja", "zh", "zh-tw"].map((locale) => ({
    meme_id: meme.id,
    locale,
    status: "reviewed",
    localized_slug: `${meme.slug}-${locale}`,
    title: `${meme.title} ${locale}`,
    summary: `A sufficiently long ${locale} summary for ${meme.id}, with distinct context.`,
    description: `A reviewed ${locale} explanation with enough detail for the challenge.`,
    origin: `The ${locale} source history is current and reviewed.`,
    source_updated_at: meme.updated_at,
  })));
}

beforeEach(() => {
  vi.clearAllMocks();
  const schedule = {
    challenge_date: "2026-08-09",
    candidate_meme_ids: memes().map((meme) => meme.id),
    completed_at: null,
    completion_locale: null,
    current_streak: 0,
  };
  rpc.mockResolvedValue({ data: [schedule], error: null });
  from.mockImplementation((table: string) => {
    if (table === "memes") return queryBuilder({ data: memes(), error: null });
    return queryBuilder({ data: translations(), error: null });
  });
});

describe("Global Meme Daily server loader", () => {
  it("loads three same-date questions with the requested locale translation", async () => {
    const challenge = await loadGlobalDailyChallenge("ja", new Date("2026-08-09T01:00:00.000Z"));
    expect(challenge.state).toBe("ready");
    expect(challenge.challengeDate).toBe("2026-08-09");
    expect(challenge.questions).toHaveLength(3);
    expect(challenge.candidates).toHaveLength(12);
    expect(challenge.questions[0].meme.slug).toContain("-ja");
    expect(rpc).toHaveBeenCalledWith("get_plus_global_daily_challenge", { p_challenge_date: "2026-08-09" });
  });

  it("does not fall back when one scheduled meme loses a reviewed translation", async () => {
    from.mockImplementation((table: string) => {
      if (table === "memes") return queryBuilder({ data: memes(), error: null });
      return queryBuilder({ data: translations().filter((row) => row.meme_id !== "meme-4"), error: null });
    });
    const challenge = await loadGlobalDailyChallenge("en", new Date("2026-08-09T01:00:00.000Z"));
    expect(challenge.state).toBe("unavailable");
    expect(challenge.questions).toEqual([]);
  });

  it("does not expose a scheduled meme when its source is too thin for a detail route", async () => {
    from.mockImplementation((table: string) => {
      if (table === "memes") {
        return queryBuilder({
          data: memes().map((meme, index) =>
            index === 0
              ? {
                  ...meme,
                  description: "thin",
                  origin: "short",
                  usage_note: null,
                  caution: null,
                  usage_examples: [],
                  meme_sources: [],
                  meme_contents: [],
                  meme_tags_map: [],
                }
              : meme,
          ),
          error: null,
        });
      }
      return queryBuilder({ data: translations(), error: null });
    });

    const challenge = await loadGlobalDailyChallenge("en", new Date("2026-08-09T01:00:00.000Z"));
    expect(challenge.state).toBe("unavailable");
    expect(challenge.questions).toEqual([]);
  });

  it("returns unavailable on schedule or database errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "daily_not_available" } });
    await expect(loadGlobalDailyChallenge("ko", new Date("2026-08-09T01:00:00.000Z"))).resolves.toMatchObject({
      state: "unavailable",
      challengeDate: "2026-08-09",
    });
  });
});
