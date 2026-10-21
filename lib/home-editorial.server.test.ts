import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
  filterPublicMemeMedia: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient: mocks.createStaticClient }));
vi.mock("@/lib/sources/public-links.server", () => ({
  filterPublicMemeMedia: mocks.filterPublicMemeMedia,
}));

import { EDITORIAL_HOME_SELECT, getEditorialHomeMemes } from "./home-editorial.server";

function eligibleRow(index: number) {
  return {
    id: `id-${index}`,
    short_id: `short-${index}`,
    slug: `meme-${index}`,
    title: `밈 ${index}`,
    summary: `서로 다른 요약 ${index}`,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "image",
    origin_year: 2026,
    trend_score: 1,
    description: "설명".repeat(130),
    origin: "유래".repeat(35),
    usage_note: "사용할 때에는 상대와 상황을 먼저 살피고 문맥을 함께 읽는 편이 좋습니다.",
    caution: null,
    usage_examples: [],
    origin_kind: "catalog",
    moderation_status: "approved",
    published_at: "2026-10-01T00:00:00.000Z",
    meme_sources: [{
      source_url: `https://news.example.kr/article/${index}`,
      title: `출처 ${index}`,
      platform: "news",
      creator_name: null,
      captured_at: "2026-10-02T00:00:00.000Z",
    }],
    meme_contents: [{
      id: `content-${index}`,
      meme_id: `id-${index}`,
      url: `https://www.youtube.com/watch?v=video${index}`,
      platform: "youtube",
      content_id: `video${index}`,
      thumbnail_url: `https://images.example.kr/${index}.jpg`,
      is_representative: true,
      availability: "live",
      moderation_status: "approved",
      production_id: null as string | null,
    }],
    meme_tags_map: [{ tag_id: "one" }, { tag_id: "two" }, { tag_id: "three" }],
  };
}

function usePages(pages: Array<Array<Record<string, unknown>>>, errorPage = -1) {
  const calls: Array<[number, number]> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async (from: number, to: number) => {
      calls.push([from, to]);
      const page = Math.floor(from / 200);
      return page === errorPage
        ? { data: null, error: { message: "offline" } }
        : { data: pages[page] ?? [], error: null };
    }),
  };
  const from = vi.fn(() => query);
  mocks.createStaticClient.mockReturnValue({ from });
  return { calls, from, query };
}

beforeEach(() => {
  mocks.createStaticClient.mockReset();
  mocks.filterPublicMemeMedia.mockReset();
  mocks.filterPublicMemeMedia.mockImplementation(async (input) => input);
  vi.restoreAllMocks();
});

describe("getEditorialHomeMemes", () => {
  it("returns only substantial, sourced, safe catalog records with truthful publication dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T00:00:00.000Z"));
    try {
      const rows = [
        { ...eligibleRow(1), description: "얇음" },
        { ...eligibleRow(2), meme_sources: [] },
        { ...eligibleRow(3), title: "" },
        { ...eligibleRow(4), moderation_status: "limited" },
        { ...eligibleRow(5), published_at: null },
        { ...eligibleRow(6), published_at: "2026-10-13T00:00:00.000Z" },
        { ...eligibleRow(7), origin_kind: "house_original" },
        { ...eligibleRow(8), safety_level: "red" },
        { ...eligibleRow(10), title: "같음", summary: " 같음 " },
        { ...eligibleRow(11), meme_sources: [{ ...eligibleRow(11).meme_sources[0], title: "" }] },
        {
          ...eligibleRow(9),
          meme_contents: [
            { ...eligibleRow(9).meme_contents[0], availability: "dead" },
            { ...eligibleRow(9).meme_contents[0], thumbnail_url: "javascript:alert(1)" },
          ],
        },
      ];
      const { from, query } = usePages([rows]);

      const result = await getEditorialHomeMemes(6);

      expect(result.status).toBe("ready");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toBe("id-9");
      expect(result.items[0]?.meme_contents).toEqual([]);
      expect(mocks.createStaticClient).toHaveBeenCalledWith({ cachePublicCatalog: true });
      expect(from).toHaveBeenCalledWith("memes");
      expect(query.select).toHaveBeenCalledWith(EDITORIAL_HOME_SELECT);
      expect(query.eq).toHaveBeenCalledWith("moderation_status", "approved");
      expect(query.eq).toHaveBeenCalledWith("origin_kind", "catalog");
      expect(query.in).toHaveBeenCalledWith("safety_level", ["green", "yellow"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pages by 200, stops after six eligible rows, and never exposes write methods", async () => {
    const first = Array.from({ length: 200 }, (_, index) => ({
      ...eligibleRow(index),
      description: "얇음",
    }));
    const second = Array.from({ length: 10 }, (_, index) => eligibleRow(200 + index));
    const { calls, query } = usePages([first, second]);

    const result = await getEditorialHomeMemes(99);

    expect(result).toMatchObject({ status: "ready" });
    expect(result.items).toHaveLength(6);
    expect(calls).toEqual([[0, 199], [200, 399]]);
    expect(query.order).toHaveBeenCalledWith("published_at", {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.order).toHaveBeenCalledWith("id", { ascending: true });
    expect(query).not.toHaveProperty("insert");
    expect(query).not.toHaveProperty("update");
    expect(query).not.toHaveProperty("upsert");
    expect(query).not.toHaveProperty("rpc");
  });

  it("can reach a sixth eligible recommendation after the first 1,000 ranked rows", async () => {
    const rows = Array.from({ length: 1_600 }, (_, index) => ({
      ...eligibleRow(index),
      description: "얇음",
    }));
    const eligibleRanks = [0, 1, 2, 513, 520, 1_560];
    for (const rank of eligibleRanks) rows[rank] = eligibleRow(rank);
    const pages = Array.from({ length: 8 }, (_, page) =>
      rows.slice(page * 200, (page + 1) * 200),
    );
    const { calls } = usePages(pages);

    const result = await getEditorialHomeMemes(6);

    expect(result.status).toBe("ready");
    expect(result.items.map((item) => item.id)).toEqual(
      eligibleRanks.map((rank) => `id-${rank}`),
    );
    expect(calls).toHaveLength(8);
    expect(calls.at(-1)).toEqual([1_400, 1_599]);
  });

  it("reads at most ten pages and distinguishes an empty result from query unavailability", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const thinPage = Array.from({ length: 200 }, (_, index) => ({
      ...eligibleRow(index),
      description: "얇음",
    }));
    const bounded = usePages(Array.from({ length: 11 }, () => thinPage));
    await expect(getEditorialHomeMemes()).resolves.toEqual({ status: "ready", items: [] });
    expect(bounded.calls).toHaveLength(10);
    expect(bounded.calls.at(-1)).toEqual([1_800, 1_999]);

    usePages([[
      eligibleRow(1),
      ...Array.from({ length: 199 }, (_, index) => ({
        ...eligibleRow(index + 10),
        description: "얇음",
      })),
    ]], 1);
    await expect(getEditorialHomeMemes(2)).resolves.toEqual({ status: "unavailable", items: [] });

    mocks.createStaticClient.mockReturnValue({
      from: () => {
        throw new Error("offline");
      },
    });
    await expect(getEditorialHomeMemes()).resolves.toEqual({ status: "unavailable", items: [] });
    expect(errorLog).toHaveBeenCalledWith(
      "[home-editorial] recommendation query unavailable",
      { failure: "query_error", page: 1 },
    );
    expect(errorLog).toHaveBeenCalledWith(
      "[home-editorial] recommendation query unavailable",
      { failure: "exception" },
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("offline");
  });

  it.each(["private", "unlisted", "removed"])(
    "does not let a %s source and media qualify a boundary-thin home card",
    async () => {
      const row = eligibleRow(70);
      row.description = "d".repeat(150);
      row.origin = "o".repeat(30);
      row.usage_note = "";
      row.caution = null;
      row.usage_examples = [];
      row.meme_tags_map = [];
      row.meme_sources.push({
        ...row.meme_sources[0],
        source_url: "https://news.example.kr/second",
        title: "두 번째 출처",
      });
      usePages([[row]]);
      mocks.filterPublicMemeMedia.mockResolvedValue({ sources: [], contents: [] });

      await expect(getEditorialHomeMemes()).resolves.toEqual({
        status: "ready",
        items: [],
      });
      expect(mocks.filterPublicMemeMedia).toHaveBeenCalledOnce();
    },
  );

  it("does not count produced-only media as original home evidence", async () => {
    const row = eligibleRow(71);
    row.description = "d".repeat(150);
    row.origin = "o".repeat(30);
    row.usage_note = "";
    row.caution = null;
    row.usage_examples = [];
    row.meme_tags_map = [];
    row.meme_sources.push({
      ...row.meme_sources[0],
      source_url: "https://news.example.kr/second-produced",
      title: "두 번째 출처",
    });
    row.meme_contents[0]!.production_id = "production-1";
    usePages([[row]]);

    await expect(getEditorialHomeMemes()).resolves.toEqual({
      status: "ready",
      items: [],
    });
  });

  it.each(["hidden", "ledger-error"])(
    "keeps strong prose but removes a %s thumbnail from the home card",
    async () => {
      const row = eligibleRow(72);
      usePages([[row]]);
      mocks.filterPublicMemeMedia.mockResolvedValue({
        sources: row.meme_sources,
        contents: [],
      });

      const result = await getEditorialHomeMemes(1);

      expect(result.status).toBe("ready");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.meme_contents).toEqual([]);
    },
  );

  it("selects complete source and content DTOs for public projection", async () => {
    const { query } = usePages([[]]);

    await getEditorialHomeMemes();

    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("meme_sources(*)"));
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("meme_contents(*)"));
  });
});
