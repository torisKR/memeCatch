import { getTrendingMemes, LIST_SELECT, type MemeListItem } from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";

/**
 * Published memes from the priority enrichment set. Used only when the
 * trending catalog is empty. Order is the card order.
 */
export const RETIRED_PRODUCT_FALLBACK_SLUGS = [
  "shrimp-jesus",
  "치맥",
  "꼰대",
  "갑툭튀",
] as const;

const PUBLISHED_STATUSES = ["approved", "limited"] as const;

/** Trending memes, or four curated published memes when trending is empty. */
export async function loadRetiredProductMemes(): Promise<MemeListItem[]> {
  const trending = (await getTrendingMemes(4)).slice(0, 4);
  if (trending.length > 0) return trending;
  return loadPublishedMemesBySlug(RETIRED_PRODUCT_FALLBACK_SLUGS);
}

async function loadPublishedMemesBySlug(
  slugs: readonly string[],
): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient({ cachePublicCatalog: true });
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("slug", [...slugs])
      .in("moderation_status", [...PUBLISHED_STATUSES]);
    if (error || !data) return [];
    const bySlug = new Map(
      (data as MemeListItem[]).map((meme) => [meme.slug, meme]),
    );
    const ordered: MemeListItem[] = [];
    for (const slug of slugs) {
      const meme = bySlug.get(slug);
      if (!meme) continue;
      ordered.push(meme);
    }
    return ordered.slice(0, 4);
  } catch {
    return [];
  }
}
