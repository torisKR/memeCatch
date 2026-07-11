import { createStaticClient } from "@/lib/supabase/server";
import type { MemeListItem } from "@/lib/queries";
import type { MemeCategory } from "@/lib/labels";
import { ExploreGrid } from "@/components/explore-grid";
import { TrackedBlock } from "@/components/tracked-block";

const SELECT = "*, meme_contents(thumbnail_url, is_representative)";

/**
 * 이어서 보기 — 상세 페이지 하단 무한 카드 스트림 (Wave 1 세션 깊이 엔진).
 * 같은 카테고리 인기순, 현재 밈·관련 밈과 중복 제외. 첫 페이지는 서버(ISR) 조회,
 * 이후 페이지는 ExploreGrid의 무한 스크롤(클라이언트)이 이어받는다.
 * 카드 클릭 → 상세 이동(새 페이지뷰). GA4 next_meme_click.
 */
export async function ContinueStream({
  currentId,
  category,
  relatedIds,
}: {
  currentId: string;
  category: MemeCategory;
  relatedIds: string[];
}) {
  let initial: MemeListItem[] = [];
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from("memes")
      .select(SELECT)
      .eq("category", category)
      .neq("id", currentId)
      .in("moderation_status", ["approved", "limited"])
      .order("trend_score", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 23);
    initial = ((data ?? []) as MemeListItem[]).filter(
      (m) => !relatedIds.includes(m.id)
    );
  } catch {
    return null;
  }
  if (initial.length < 6) return null;

  return (
    <section aria-labelledby="continue-stream" className="mt-2">
      <h2 id="continue-stream" className="text-xl font-bold">
        이어서 보기
      </h2>
      <p className="mt-1 text-sm text-muted">
        스크롤을 멈추기 아까운 밈들 — 끝없이 이어져요.
      </p>
      <TrackedBlock event="next_meme_click" className="mt-4">
        <ExploreGrid
          initial={initial}
          filters={{ categories: [category], sort: "trending" }}
          excludeIds={[currentId, ...relatedIds]}
        />
      </TrackedBlock>
    </section>
  );
}
