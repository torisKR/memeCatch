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
}: {
  currentId: string;
  category: MemeCategory;
  related: MemeListItem[];
}) {
  const head = related.slice(0, RELATED_LINKS);
  const relatedIds = head.map((meme) => meme.id);
  const need = Math.max(0, RELATED_LINKS - head.length);
  let stream: MemeListItem[] = [];

  if (need > 0) {
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
        .limit(need + RELATED_LINKS);
      const seen = new Set<string>([currentId, ...relatedIds]);
      for (const meme of (data ?? []) as MemeListItem[]) {
        if (seen.has(meme.id)) continue;
        seen.add(meme.id);
        stream.push(meme);
        if (stream.length >= need) break;
      }
    } catch {
      stream = [];
    }
  }

  return <RelatedMemeLinks items={[...head, ...stream].slice(0, RELATED_LINKS).map(toLink)} />;
}
