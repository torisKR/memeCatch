import { getTrendingMemes, LIST_SELECT, type MemeListItem } from "@/lib/queries";
import { isYouTubeThumbnailUrl, verifiedRetiredCardImage } from "@/lib/retired-card-image";
import { createStaticClient } from "@/lib/supabase/server";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";

const RETIRED_PRODUCT_CARD_COUNT = 4;

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

function representativeThumbnail(meme: MemeListItem): string | null {
  const contents = meme.meme_contents ?? [];
  return (
    contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null
  );
}

function remember(seen: Set<string>, meme: MemeListItem) {
  seen.add(meme.id);
  seen.add(meme.slug);
  seen.add(meme.short_id);
}

function alreadyChosen(seen: Set<string>, meme: MemeListItem): boolean {
  return seen.has(meme.id) || seen.has(meme.slug) || seen.has(meme.short_id);
}

/**
 * Four public cards. Verified same-origin art comes first. The rest are
 * trending memes whose thumbnail is not a YouTube still. Shipped illustrations
 * fill any remaining slots when the catalog is short.
 */
export function chooseRetiredProductCards(
  catalog: readonly MemeListItem[],
  trending: readonly MemeListItem[],
): MemeListItem[] {
  const chosen: MemeListItem[] = [];
  const seen = new Set<string>();
  const push = (meme: MemeListItem) => {
    if (chosen.length >= RETIRED_PRODUCT_CARD_COUNT || alreadyChosen(seen, meme)) return;
    const thumbnail = representativeThumbnail(meme);
    if (thumbnail && isYouTubeThumbnailUrl(thumbnail)) return;
    remember(seen, meme);
    chosen.push(meme);
  };

  for (const meme of catalog) {
    if (verifiedRetiredCardImage(representativeThumbnail(meme))) push(meme);
  }
  for (const meme of trending) push(meme);
  if (chosen.length < RETIRED_PRODUCT_CARD_COUNT) {
    for (const meme of retiredProductFallbackMemes()) push(meme);
  }
  return chosen.slice(0, RETIRED_PRODUCT_CARD_COUNT);
}

/** Verified art first, then non-YouTube trending memes. Always four when possible. */
export async function loadRetiredProductMemes(): Promise<MemeListItem[]> {
  const [catalog, trending] = await Promise.all([
    loadPublicMemes(48),
    getTrendingMemes(24),
  ]);
  return chooseRetiredProductCards(catalog, trending);
}

async function loadPublicMemes(limit: number): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient({ cachePublicCatalog: true });
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLISHED_STATUSES])
      .order("trend_score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}
