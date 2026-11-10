import { describe, expect, it } from "vitest";
import { toBattleBoard, unavailableBattleBoard, type BattleRow } from "@/lib/community-battle";

const row = (overrides: Partial<BattleRow> = {}): BattleRow => ({
  post_id: "post-1",
  title: "밈 하나",
  like_count: 10,
  comment_count: 2,
  rank: 1,
  total_posts: 150,
  promotion_count: 2,
  is_promotion_candidate: true,
  ...overrides,
});

describe("toBattleBoard", () => {
  it("keeps valid rows in rank order with the board totals", () => {
    const board = toBattleBoard("week", [
      row({ post_id: "post-2", rank: 2, like_count: 7, is_promotion_candidate: true }),
      row(),
      row({ post_id: "post-3", rank: 3, like_count: 5, is_promotion_candidate: false }),
    ]);

    expect(board.status).toBe("ready");
    expect(board.entries.map((entry) => entry.postId)).toEqual(["post-1", "post-2", "post-3"]);
    expect(board.totalPosts).toBe(150);
    expect(board.promotionCount).toBe(2);
    expect(board.entries[2].isPromotionCandidate).toBe(false);
  });

  it("drops malformed rows instead of drawing a wrong ranking", () => {
    const board = toBattleBoard("day", [
      row({ post_id: null }),
      row({ post_id: "blank", title: "   " }),
      row({ post_id: "neg", like_count: -1 }),
      row({ post_id: "zero-rank", rank: 0 }),
      row({ post_id: "ok", rank: 4 }),
    ]);

    expect(board.entries.map((entry) => entry.postId)).toEqual(["ok"]);
  });

  it("only marks a candidate when the database says so", () => {
    const board = toBattleBoard("month", [row({ is_promotion_candidate: "true" })]);
    expect(board.entries[0].isPromotionCandidate).toBe(false);
  });

  it("describes an unavailable board without entries", () => {
    expect(unavailableBattleBoard("day")).toEqual({
      period: "day",
      status: "unavailable",
      entries: [],
      totalPosts: 0,
      promotionCount: 0,
    });
  });
});
