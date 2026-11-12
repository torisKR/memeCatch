import { createStaticClient } from "@/lib/supabase/server";
import type { MemeListItem } from "@/lib/queries";
import type { MemeCategory } from "@/lib/labels";
import { RelatedMemes } from "@/components/related-memes";
import { indexableScanLimit, omitThinMemes } from "@/lib/thin-meme";

const SELECT = "*, meme_contents(thumbnail_url, is_representative, availability, moderation_status), meme_sources(source_url, hidden_from_public), meme_tags_map(tag_id), meme_market_profiles(market_code, role, review_state)";

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
}: {
  currentId: string;
  category: MemeCategory;
  related: MemeListItem[];
}) {
  const head = omitThinMemes(related).slice(0, RELATED_LIMIT);
  const relatedIds = head.map((m) => m.id);
  const need = Math.max(0, RELATED_LIMIT - head.length);

  let stream: MemeListItem[] = [];
  if (need > 0) {
    try {
      const supabase = createStaticClient();
      const scanSize = indexableScanLimit(RELATED_LIMIT);
      const { data } = await supabase
        .from("memes")
        .select(SELECT)
        .eq("category", category)
        .neq("id", currentId)
        .in("moderation_status", ["approved", "limited"])
        .order("trend_score", { ascending: false })
        .order("id", { ascending: false })
        .range(0, scanSize - 1);
      const rows = omitThinMemes((data ?? []) as unknown as MemeListItem[]);
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
