import { createStaticClient } from "@/lib/supabase/server";
import type { MemeListItem } from "@/lib/queries";
import type { MemeCategory } from "@/lib/labels";
import { ExploreGrid } from "@/components/explore-grid";
import { TrackedBlock } from "@/components/tracked-block";

const SELECT = "*, meme_contents(thumbnail_url, is_representative), meme_market_profiles(market_code, role, review_state)";

/**
 * 첫 화면에 렌더할 카드 수 상한. 상세는 '문서'라서 본문 대비 링크 비율이 중요하다 —
 * 첫 HTML에 수십 개의 관련 링크를 깔면 본문이 링크에 묻혀 얇은 문서로 읽힌다.
 * 나머지는 스크롤 시 클라이언트가 이어붙이므로 탐색 경험은 그대로 유지된다.
 */
const INITIAL_CARDS = 8;

/** 첫 화면에서 관련 밈이 차지할 몫 — 나머지는 같은 카테고리 인기순으로 채운다. */
const RELATED_SLOTS = 6;

/**
 * 이어서 볼 만한 밈 — 상세 페이지 하단 단일 추천 피드 (Wave 1 세션 깊이 엔진).
 * 관련 밈(비슷한 밈)을 앞에 배치하고 같은 카테고리 인기순으로 무한히 이어붙인다.
 * 두 섹션(큐레이션 캐러셀 + 무한 스트림)을 하나의 헤딩·하나의 그리드로 통합 —
 * ExploreGrid의 seenRef가 관련 밈 중복을 걸러낸다. 카드 클릭 → 상세 이동(새 페이지뷰).
 * GA4 next_meme_click.
 *
 * 첫 화면은 INITIAL_CARDS개로 끊고, 실제로 소비한 카테고리 행 수(consumed)를
 * ExploreGrid에 넘겨 다음 페이지가 그 지점에서 이어지게 한다(건너뛰는 밈 없음).
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
  const head = related.slice(0, RELATED_SLOTS);
  const relatedIds = head.map((m) => m.id);
  // 관련 밈이 적으면 카테고리 스트림이 그만큼 더 채운다.
  const need = Math.max(0, INITIAL_CARDS - head.length);

  let stream: MemeListItem[] = [];
  let consumed = 0;
  let exhausted = false;
  try {
    const supabase = createStaticClient();
    // 관련 밈과 겹쳐 걸러질 수 있으니 필요한 수보다 넉넉히 읽고, 실제로 훑은
    // 행 수만 consumed로 센다(그 뒤부터 무한 스크롤이 이어받는다).
    const scanSize = need + RELATED_SLOTS;
    const { data } = await supabase
      .from("memes")
      .select(SELECT)
      .eq("category", category)
      .neq("id", currentId)
      .in("moderation_status", ["approved", "limited"])
      .order("trend_score", { ascending: false })
      .order("id", { ascending: false })
      .range(0, scanSize - 1);
    const rows = (data ?? []) as MemeListItem[];
    exhausted = rows.length < scanSize;

    const seen = new Set<string>([currentId, ...relatedIds]);
    for (const m of rows) {
      consumed++;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      stream.push(m);
      if (stream.length >= need) break;
    }
  } catch {
    // 스트림 조회 실패해도 관련 밈만으로 노출 가능하면 계속 진행한다.
    stream = [];
    consumed = 0;
    exhausted = true;
  }

  // 관련 밈을 앞, 같은 카테고리 인기순을 뒤로 — 큐레이션에서 탐색으로 자연스럽게 흐른다.
  const initial = [...head, ...stream];
  if (initial.length < 6) return null;

  return (
    <section aria-labelledby="continue-stream" className="mt-2">
      <h2 id="continue-stream" className="text-xl font-bold">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="signal-live size-1.5 shrink-0 rounded-full bg-(--signal-cyan)" />
          이어서 볼 만한 밈
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        비슷한 밈부터 — 스크롤을 멈추기 아까운 밈들이 끝없이 이어져요.
      </p>
      <TrackedBlock event="next_meme_click" className="mt-4">
        <ExploreGrid
          initial={initial}
          filters={{ categories: [category], sort: "trending" }}
          excludeIds={[currentId, ...relatedIds]}
          // 첫 화면을 짧게 끊었으므로 소비 지점과 '더 있음'을 명시한다.
          // 기본 추정(첫 묶음이 꽉 찼는가)에 맡기면 무한 스크롤이 멈춘다.
          initialOffset={consumed}
          hasMoreInitial={!exhausted}
        />
      </TrackedBlock>
    </section>
  );
}
