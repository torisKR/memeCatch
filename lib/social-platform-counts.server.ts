import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import {
  countSocialPlatformReferences,
  emptySocialPlatformCounts,
  type SocialPlatformCounts,
} from "@/lib/source-platform";

const PAGE_SIZE = 1000;

/**
 * 탐색 필터의 수량은 `meme_contents`의 공개 URL을 기준으로 계산한다.
 * PostgREST 행 상한을 피하기 위해 페이지 단위로 모두 읽고, 같은 밈의 같은
 * 플랫폼은 한 번만 센다.
 */
export async function getSocialPlatformCounts(): Promise<SocialPlatformCounts> {
  try {
    const supabase = createStaticClient();
    const rows: Array<{ meme_id: string; platform: string | null; url: string | null }> = [];

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("meme_contents")
        .select("meme_id, platform, url")
        .eq("moderation_status", "approved")
        .neq("availability", "dead")
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
