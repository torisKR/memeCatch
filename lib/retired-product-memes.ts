import { getTrendingMemes, LIST_SELECT, type MemeListItem } from "@/lib/queries";
import { verifiedRetiredCardImage } from "@/lib/retired-card-image";
import { createStaticClient } from "@/lib/supabase/server";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";

/**
 * Published memes whose illustrations are files in `public/`.
 * 꼰대 and 치맥 are not in this set: the first image 404s, and 치맥 is a YouTube still.
 * Order is the card order.
 */
export const RETIRED_PRODUCT_FALLBACK_PICKS = [
  {
    id: "279d001e-3f4a-4801-9816-3fb089c6834b",
    shortId: "xazbup6j",
    slug: "ai-slop",
    title: "AI 슬롭",
    summary: "생성형 AI로 대량 제작된 낮은 품질의 디지털 콘텐츠를 낮춰 부르는 비판적 인터넷 표현.",
    category: "phrase",
    safety: "yellow",
    year: 2024,
    thumbnail: "/ai-memes/ai-slop.jpg",
  },
  {
    id: "d6fdc6c3-0ac6-4508-8b01-f4e048c0aeca",
    shortId: "us5jg4gj",
    slug: "italian-brainrot",
    title: "이탈리안 브레인롯",
    summary: "AI로 만든 동물·사물 혼합 캐릭터와 의사 이탈리아어 내레이션을 결합한 2025년의 초현실주의 인터넷 밈 흐름.",
    category: "image",
    safety: "yellow",
    year: 2025,
    thumbnail: "/ai-memes/italian-brainrot.jpg",
  },
  {
    id: "d2abe3a0-fc36-40e8-8e50-5ab03fb6b280",
    shortId: "py3fd5gq",
    slug: "tralalero-tralala",
    title: "트랄랄레로 트랄랄라",
    summary: "세 개의 다리와 운동화를 가진 AI 상어로 알려진 이탈리안 브레인롯의 대표 캐릭터.",
    category: "image",
    safety: "gray",
    year: 2025,
    thumbnail: "/ai-memes/tralalero-tralala.jpg",
  },
  {
    id: "33a63717-9a70-4601-891a-54337d5740c2",
    shortId: "djjz3enf",
    slug: "ballerina-cappuccina",
    title: "발레리나 카푸치나",
    summary: "카푸치노 잔 머리와 발레리나의 몸을 합친 이탈리안 브레인롯 계열의 AI 캐릭터.",
    category: "image",
    safety: "yellow",
    year: 2025,
    thumbnail: "/ai-memes/ballerina-cappuccina.jpg",
  },
] as const satisfies readonly {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  category: MemeCategory;
  safety: SafetyLevel;
  year: number;
  thumbnail: string;
}[];

export const RETIRED_PRODUCT_FALLBACK_SLUGS = RETIRED_PRODUCT_FALLBACK_PICKS.map(
  (pick) => pick.slug,
);

const PUBLISHED_STATUSES = ["approved", "limited"] as const;

function staticFallbackMeme(
  pick: (typeof RETIRED_PRODUCT_FALLBACK_PICKS)[number],
): MemeListItem {
  return {
    id: pick.id,
    short_id: pick.shortId,
    slug: pick.slug,
    title: pick.title,
    summary: pick.summary,
    category: pick.category,
    safety_level: pick.safety,
    lifecycle_status: "active",
    media_type: "image",
    origin_year: pick.year,
    trend_score: 1,
    meme_contents: [{ thumbnail_url: pick.thumbnail, is_representative: true }],
  } as MemeListItem;
}

/** The four verified illustrations. Used when the catalog cannot supply them. */
export function retiredProductFallbackMemes(): MemeListItem[] {
  return RETIRED_PRODUCT_FALLBACK_PICKS.map(staticFallbackMeme);
}

function withVerifiedThumbnail(meme: MemeListItem): MemeListItem {
  const contents = meme.meme_contents ?? [];
  const current =
    contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null;
  if (verifiedRetiredCardImage(current)) return meme;
  const pick = RETIRED_PRODUCT_FALLBACK_PICKS.find((item) => item.slug === meme.slug);
  if (!pick) return meme;
  return {
    ...meme,
    meme_contents: [{ thumbnail_url: pick.thumbnail, is_representative: true }],
  } as MemeListItem;
}

/** Trending memes, or four verified published memes when trending is empty. */
export async function loadRetiredProductMemes(): Promise<MemeListItem[]> {
  const trending = (await getTrendingMemes(4)).slice(0, 4);
  if (trending.length > 0) return trending;
  try {
    const loaded = await loadPublishedMemesBySlug(RETIRED_PRODUCT_FALLBACK_SLUGS);
    const bySlug = new Map(loaded.map((meme) => [meme.slug, meme]));
    return RETIRED_PRODUCT_FALLBACK_PICKS.map((pick) =>
      withVerifiedThumbnail(bySlug.get(pick.slug) ?? staticFallbackMeme(pick)),
    );
  } catch {
    return retiredProductFallbackMemes();
  }
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
