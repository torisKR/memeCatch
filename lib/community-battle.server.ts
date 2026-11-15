import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
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

async function loadBoard(period: BattlePeriod): Promise<BattleBoard> {
  try {
    const supabase = createStaticClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as BattleRpc;
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

/** 오늘·이번 주·이번 달 순위를 한 번에 읽는다. 한 기간이 실패해도 나머지는 보여 준다. */
export async function getCommunityMemeBattle(): Promise<BattleBoard[]> {
  return Promise.all(BATTLE_PERIODS.map((period) => loadBoard(period)));
}
