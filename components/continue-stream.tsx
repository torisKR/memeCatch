import { createStaticClient } from "@/lib/supabase/server";
import type { MemeListItem } from "@/lib/queries";
import { memePathFrom, type MemeCategory } from "@/lib/labels";
import { RelatedMemeLinks } from "@/components/related-meme-links";

const SELECT = "id, short_id, slug, title, summary, category, trend_score";

/** The article ends with four to six related links, not an open-ended card grid. */
const RELATED_LINKS = 6;

function toLink(meme: MemeListItem) {
  return {
    href: memePathFrom(meme.short_id, meme.slug),
    title: meme.title,
    summary: meme.summary,
  };
}

/**
 * 상세 하단 관련 밈. 같은 태그·카테고리에서 최대 6개만 고르고,
 * 4개 미만이면 제목까지 숨긴다.
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
  const head = related.filter((meme) => indexableIds.has(meme.id)).slice(0, RELATED_LINKS);
  const need = Math.max(0, RELATED_LINKS - head.length);
  let stream: MemeListItem[] = [];

  if (need > 0) {
    const ids = [...indexableIds].filter(
      (id) => id !== currentId && !head.some((meme) => meme.id === id),
    );
    if (ids.length > 0) {
      try {
        const supabase = createStaticClient();
        const { data } = await supabase
          .from("memes")
          .select(SELECT)
          .in("id", ids)
          .in("moderation_status", ["approved", "limited"])
          .order("trend_score", { ascending: false })
          .order("id", { ascending: false });
        const rows = (data ?? []) as MemeListItem[];
        const sameCategory = rows.filter((meme) => meme.category === category);
        const other = rows.filter((meme) => meme.category !== category);
        stream = [...sameCategory, ...other].slice(0, need);
      } catch {
        stream = [];
      }
    }
  }

  return <RelatedMemeLinks items={[...head, ...stream].slice(0, RELATED_LINKS).map(toLink)} />;
}
