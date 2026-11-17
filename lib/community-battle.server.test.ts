import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleRow } from "@/lib/community-battle";

const { createStaticClient } = vi.hoisted(() => ({ createStaticClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createStaticClient }));

import { getCommunityMemeBattle } from "@/lib/community-battle.server";

const battleRow = (postId: string, rank: number): BattleRow => ({
  post_id: postId,
  title: `밈 ${rank}`,
  like_count: 20 - rank,
  comment_count: rank,
  rank,
  total_posts: 12,
  promotion_count: 1,
  is_promotion_candidate: rank === 1,
});

function previewQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  createStaticClient.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("getCommunityMemeBattle", () => {
  it("asks for the DB maximum and carries all 12 entries through in rank order", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => battleRow(`post-${index + 1}`, index + 1));
    const rpc = vi.fn().mockImplementation((_name, { p_period }) =>
      Promise.resolve({ data: p_period === "day" ? [...rows].reverse() : rows, error: null }),
    );
    const query = previewQuery({
      data: rows.map((item) => ({
        id: item.post_id,
        body: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
      })),
      error: null,
    });
    const from = vi.fn(() => query);
    createStaticClient.mockReturnValue({ rpc, from });

    const boards = await getCommunityMemeBattle();

    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls.map((call) => call[1])).toEqual([
      { p_period: "day", p_limit: 50 },
      { p_period: "week", p_limit: 50 },
      { p_period: "month", p_limit: 50 },
    ]);
    expect(boards[0].entries).toHaveLength(12);
    expect(boards[0].entries.map((entry) => entry.rank)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(boards[0].entries[0].thumbnailUrl).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("batch-fetches the union of visible post bodies in one query", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [battleRow("shared", 1), battleRow("day", 2)], error: null })
      .mockResolvedValueOnce({ data: [battleRow("shared", 1), battleRow("week", 2)], error: null })
      .mockResolvedValueOnce({ data: [battleRow("month", 1)], error: null });
    const query = previewQuery({
      data: [
        { id: "shared", body: "![사진](/api/media/meme-uploads/u/shared.png)" },
        { id: "day", body: "본문만" },
      ],
      error: null,
    });
    const from = vi.fn(() => query);
    createStaticClient.mockReturnValue({ rpc, from });

    const boards = await getCommunityMemeBattle();

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("community_posts");
    expect(query.select).toHaveBeenCalledWith("id,body");
    expect(query.eq).toHaveBeenCalledWith("status", "visible");
    expect(query.in).toHaveBeenCalledTimes(1);
    expect(new Set(query.in.mock.calls[0][1])).toEqual(new Set(["shared", "day", "week", "month"]));
    expect(boards[0].entries[0].thumbnailUrl).toBe(
      "/api/media/meme-uploads/u/shared.png",
    );
    expect(boards[1].entries[0].thumbnailUrl).toBe(
      "/api/media/meme-uploads/u/shared.png",
    );
    expect(boards[0].entries[1].thumbnailUrl).toBeNull();
    expect(boards[1].entries).toHaveLength(2);
    expect(boards[1].entries[1].thumbnailUrl).toBeNull();
  });

  it("keeps ranking boards visible when previews are missing or the batch query fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [battleRow("post-1", 1)], error: null });
    const query = previewQuery({ data: null, error: { message: "preview unavailable" } });
    createStaticClient.mockReturnValue({ rpc, from: vi.fn(() => query) });

    const boards = await getCommunityMemeBattle();

    expect(boards.every((board) => board.status === "ready")).toBe(true);
    expect(boards.every((board) => board.entries.length === 1)).toBe(true);
    expect(boards.every((board) => board.entries[0].thumbnailUrl === null)).toBe(true);
  });
});
