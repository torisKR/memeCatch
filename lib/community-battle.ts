/**
 * 커뮤니티 밈대결 — 오늘·이번 주·이번 달(KST) 좋아요 순위.
 * 순위와 상위 1% 판정은 DB 함수(community_meme_battle)가 정한다. 여기서는 응답을
 * 검증해 화면용 모양으로 바꾸기만 한다.
 */

export const BATTLE_PERIODS = ["day", "week", "month"] as const;
export type BattlePeriod = (typeof BATTLE_PERIODS)[number];

export const BATTLE_PERIOD_LABELS: Record<BattlePeriod, string> = {
  day: "오늘",
  week: "이번 주",
  month: "이번 달",
};

/** 한 기간에 보여 줄 최대 순위 수. */
export const BATTLE_LIST_LIMIT = 5;

export type BattleEntry = {
  postId: string;
  title: string;
  likeCount: number;
  commentCount: number;
  rank: number;
  isPromotionCandidate: boolean;
};

export type BattleBoard = {
  period: BattlePeriod;
  status: "ready" | "unavailable";
  entries: BattleEntry[];
  totalPosts: number;
  promotionCount: number;
};

export type BattleRow = {
  post_id: unknown;
  title: unknown;
  like_count: unknown;
  comment_count: unknown;
  rank: unknown;
  total_posts: unknown;
  promotion_count: unknown;
  is_promotion_candidate: unknown;
};

function toCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** 형식이 맞지 않는 행은 버린다. 화면에 잘못된 순위를 그리지 않기 위해서다. */
export function toBattleBoard(period: BattlePeriod, rows: readonly BattleRow[]): BattleBoard {
  const entries: BattleEntry[] = [];
  let totalPosts = 0;
  let promotionCount = 0;

  for (const row of rows) {
    const rank = toCount(row.rank);
    const likeCount = toCount(row.like_count);
    const commentCount = toCount(row.comment_count) ?? 0;
    if (
      typeof row.post_id !== "string" ||
      typeof row.title !== "string" ||
      !row.title.trim() ||
      rank === null ||
      rank < 1 ||
      likeCount === null
    ) {
      continue;
    }
    totalPosts = Math.max(totalPosts, toCount(row.total_posts) ?? 0);
    promotionCount = Math.max(promotionCount, toCount(row.promotion_count) ?? 0);
    entries.push({
      postId: row.post_id,
      title: row.title.trim(),
      likeCount,
      commentCount,
      rank,
      isPromotionCandidate: row.is_promotion_candidate === true,
    });
  }

  entries.sort((left, right) => left.rank - right.rank);
  return { period, status: "ready", entries, totalPosts, promotionCount };
}

export function unavailableBattleBoard(period: BattlePeriod): BattleBoard {
  return { period, status: "unavailable", entries: [], totalPosts: 0, promotionCount: 0 };
}
