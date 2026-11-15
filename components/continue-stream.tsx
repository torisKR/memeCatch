import { cacheCatalogRead } from "@/lib/catalog-read-cache";
import { createStaticClient } from "@/lib/supabase/server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { LIST_SELECT, MemeCatalogUnavailableError, type MemeListItem } from "@/lib/queries";
import type { MemeCategory } from "@/lib/labels";
import { RelatedMemes } from "@/components/related-memes";

const loadCategoryStream = cacheCatalogRead(
  async (
    category: MemeCategory,
    currentId: string,
    indexableIds: string[],
    scanSize: number,
  ): Promise<MemeListItem[]> => {
    const { data, error } = await createStaticClient()
      .from("memes")
      .select(LIST_SELECT)
      .in("id", indexableIds)
      .eq("category", category)
      .neq("id", currentId)
      .in("moderation_status", ["approved", "limited"])
      .order("trend_score", { ascending: false })
      .order("id", { ascending: false })
      .range(0, scanSize - 1);
    if (error) throw new MemeCatalogUnavailableError();
    return (data ?? []) as MemeListItem[];
  },
  ["public-meme-category-stream"],
  { revalidate: 86_400, tags: [PUBLIC_CATALOG_CACHE_TAG] },
);

/** 상세의 관련 밈은 최대 6장. 관련 결과가 적으면 같은 카테고리로 채운다. */
const RELATED_LIMIT = 6;

/**
 * 상세 하단의 관련 밈. 비슷한 밈을 앞에 두고, 같은 카테고리로 6장까지 채운다.
 * 한 장도 없으면 섹션 자체를 그리지 않는다.
 */
export async function ContinueStream({
  currentId,
  category,
  related,
  indexableIds,
}: {
  currentId: string;
  category: MemeCategory;
  related: MemeListItem[];
  indexableIds: ReadonlySet<string>;
}) {
  const head = related.filter((meme) => indexableIds.has(meme.id)).slice(0, RELATED_LIMIT);
  const relatedIds = head.map((m) => m.id);
  const need = Math.max(0, RELATED_LIMIT - head.length);

  let stream: MemeListItem[] = [];
  const fallbackIds = [...indexableIds].filter(
    (id) => id !== currentId && !relatedIds.includes(id),
  );
  if (need > 0 && fallbackIds.length > 0) {
    try {
      const scanSize = need + RELATED_LIMIT;
      const rows = await loadCategoryStream(category, currentId, fallbackIds, scanSize);
      const seen = new Set<string>([currentId, ...relatedIds]);
      for (const meme of rows) {
        if (seen.has(meme.id)) continue;
        seen.add(meme.id);
        stream.push(meme);
        if (stream.length >= need) break;
      }
    } catch {
      stream = [];
    }
  }

  const initial = [...head, ...stream].slice(0, RELATED_LIMIT);
  if (initial.length === 0) return null;

  return (
    <RelatedMemes
      locale="ko"
      memes={initial.map((meme) => ({ meme }))}
    />
  );
}
