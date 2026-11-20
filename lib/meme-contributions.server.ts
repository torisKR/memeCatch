import "server-only";
import { createStaticClient } from "@/lib/db/server";

export type MemeContributor = {
  nickname: string;
  sourceCount: number;
  exampleCount: number;
};

/**
 * 승인된 보강 제보(출처·예문)의 기여자 — 이름 공개에 동의한 닉네임만.
 * 조회 실패는 상세 페이지를 깨뜨리지 않도록 빈 목록으로 처리한다.
 */
export async function getMemeContributors(memeId: string): Promise<MemeContributor[]> {
  try {
    const db = createStaticClient();
    const { data, error } = await db.rpc("get_meme_contributors", { p_meme_id: memeId });
    if (error || !Array.isArray(data)) return [];
    return data.flatMap((row) =>
      typeof row?.nickname === "string" && row.nickname
        ? [{
            nickname: row.nickname,
            sourceCount: Number(row.source_count) || 0,
            exampleCount: Number(row.example_count) || 0,
          }]
        : [],
    );
  } catch {
    return [];
  }
}
