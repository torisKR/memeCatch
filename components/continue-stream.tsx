import { createStaticClient } from "@/lib/supabase/server";
import type { MemeListItem } from "@/lib/queries";
import type { MemeCategory } from "@/lib/labels";
import { ExploreGrid } from "@/components/explore-grid";
import { TrackedBlock } from "@/components/tracked-block";

const SELECT = "*, meme_contents(thumbnail_url, is_representative)";

/**
 * 이어서 볼 만한 밈 — 상세 페이지 하단 단일 추천 피드 (Wave 1 세션 깊이 엔진).
 * 관련 밈(비슷한 밈)을 앞에 배치하고 같은 카테고리 인기순으로 무한히 이어붙인다.
 * 두 섹션(큐레이션 캐러셀 + 무한 스트림)을 하나의 헤딩·하나의 그리드로 통합 —
 * 페이지 오프셋은 카테고리 쿼리 기준(0..23 → 24..)이라 프리펜드해도 연속성이 유지되고,
 * ExploreGrid의 seenRef가 관련 밈 중복을 걸러낸다. 카드 클릭 → 상세 이동(새 페이지뷰).
 * GA4 next_meme_click.
 */
export async function ContinueStream({
  currentId,
  category,
  related,
}: {
  currentId: string;
  category: MemeCategory;
  related: MemeListItem[];
}) {
  const relatedIds = related.map((m) => m.id);
  let stream: MemeListItem[] = [];
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
    const seen = new Set<string>([currentId, ...relatedIds]);
    stream = ((data ?? []) as MemeListItem[]).filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  } catch {
    // 스트림 조회 실패해도 관련 밈만으로 노출 가능하면 계속 진행한다.
    stream = [];
  }

  // 관련 밈을 앞, 같은 카테고리 인기순을 뒤로 — 큐레이션에서 탐색으로 자연스럽게 흐른다.
  const initial = [...related, ...stream];
  if (initial.length < 6) return null;

  return (
    <section aria-labelledby="continue-stream" className="mt-2">
      <h2 id="continue-stream" className="text-xl font-bold">
        이어서 볼 만한 밈
      </h2>
      <p className="mt-1 text-sm text-muted">
        비슷한 밈부터 — 스크롤을 멈추기 아까운 밈들이 끝없이 이어져요.
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
