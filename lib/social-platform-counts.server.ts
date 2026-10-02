import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import { UNAVAILABLE_FILTER } from "@/lib/content-availability";
import {
  countSocialPlatformReferences,
  emptySocialPlatformCounts,
  isSocialPlatform,
  type SocialPlatformCounts,
} from "@/lib/source-platform";

const PAGE_SIZE = 1000;

/**
 * 탐색 필터의 수량은 `meme_contents`의 공개 URL을 기준으로 계산한다.
 * DB가 같은 밈의 같은 플랫폼을 한 번만 세어 네 행만 반환한다.
 * 아직 집계 마이그레이션이 적용되지 않은 환경에서만 기존 페이지 조회로 폴백한다.
 */
export async function getSocialPlatformCounts(): Promise<SocialPlatformCounts> {
  try {
    const supabase = createStaticClient({ cachePublicCounts: true });
    const aggregate = await supabase.rpc("get_social_platform_counts", undefined, { get: true });
    if (!aggregate.error) {
      const counts = emptySocialPlatformCounts();
      for (const row of aggregate.data ?? []) {
        if (isSocialPlatform(row.platform) && Number.isSafeInteger(row.meme_count) && row.meme_count >= 0) {
          counts[row.platform] = row.meme_count;
        }
      }
      return counts;
    }
    if (aggregate.error.code !== "PGRST202" && aggregate.error.code !== "42883") {
      return emptySocialPlatformCounts();
    }
    const rows: Array<{ meme_id: string; platform: string | null; url: string | null }> = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("meme_contents")
        .select("meme_id, platform, url")
        .eq("moderation_status", "approved")
        // 렌더 경로와 같은 제외 목록을 쓴다 — dead와 region_blocked를 함께 뺀다.
        .not("availability", "in", UNAVAILABLE_FILTER)
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data) return emptySocialPlatformCounts();
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }

    return countSocialPlatformReferences(rows);
  } catch {
    return emptySocialPlatformCounts();
  }
}
