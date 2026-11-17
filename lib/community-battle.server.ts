import "server-only";

import { createStaticClient } from "@/lib/db/server";
import { communityBattleThumbnail } from "@/lib/community-battle-preview";
import {
  BATTLE_LIST_LIMIT,
  BATTLE_PERIODS,
  toBattleBoard,
  unavailableBattleBoard,
  type BattleBoard,
  type BattlePeriod,
  type BattleRow,
} from "@/lib/community-battle";

// community_meme_battle은 database.types.ts에 아직 없어 로컬 타입으로 호출한다.
type BattleRpc = (
  fn: "community_meme_battle",
  args: { p_period: BattlePeriod; p_limit: number },
) => PromiseLike<{ data: BattleRow[] | null; error: { message: string } | null }>;

type StaticClient = ReturnType<typeof createStaticClient>;

async function loadBoard(db: StaticClient, period: BattlePeriod): Promise<BattleBoard> {
  try {
    const rpc = db.rpc.bind(db) as unknown as BattleRpc;
    const { data, error } = await rpc("community_meme_battle", {
      p_period: period,
      p_limit: BATTLE_LIST_LIMIT,
    });
    if (error || !data) {
      // 오류 원문에는 URL이나 키가 섞일 수 있어 단계와 기간만 남긴다.
      console.error("[community-battle] board unavailable", { period });
      return unavailableBattleBoard(period);
    }
    return toBattleBoard(period, data);
  } catch {
    console.error("[community-battle] board unavailable", { period });
    return unavailableBattleBoard(period);
  }
}

type PreviewPostRow = { id: string; body: string };

/** 세 기간의 중복 ID를 합쳐 visible 본문만 한 번 읽고, 실패하면 순위만 그대로 둔다. */
async function addBattlePreviews(
  db: StaticClient,
  boards: readonly BattleBoard[],
): Promise<BattleBoard[]> {
  const postIds = Array.from(new Set(
    boards.flatMap((board) => board.entries.map((entry) => entry.postId)),
  ));
  if (postIds.length === 0) return [...boards];

  try {
    const { data, error } = await db
      .from("community_posts")
      .select("id,body")
      .eq("status", "visible")
      .in("id", postIds);
    if (error || !data) {
      console.error("[community-battle] previews unavailable");
      return [...boards];
    }

    const previews = new Map(
      (data as PreviewPostRow[]).map((post) => [
        post.id,
        communityBattleThumbnail(post.body),
      ]),
    );
    return boards.map((board) => ({
      ...board,
      entries: board.entries.map((entry) => ({
        ...entry,
        thumbnailUrl: previews.get(entry.postId) ?? null,
      })),
    }));
  } catch {
    console.error("[community-battle] previews unavailable");
    return [...boards];
  }
}

/** 오늘·이번 주·이번 달 순위를 한 번에 읽는다. 한 기간이 실패해도 나머지는 보여 준다. */
export async function getCommunityMemeBattle(): Promise<BattleBoard[]> {
  let db: StaticClient;
  try {
    db = createStaticClient();
  } catch {
    return BATTLE_PERIODS.map(unavailableBattleBoard);
  }
  const boards = await Promise.all(BATTLE_PERIODS.map((period) => loadBoard(db, period)));
  return addBattlePreviews(db, boards);
}
