import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";
import { COLLECTIONS } from "@/lib/collections";


/** 1시간마다 재생성 — 새로 승인된 밈 반영 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient();

  // 홈 lastmod — 빌드 시각(new Date) 대신 실제 콘텐츠 변경 시점(최신 밈 공개일)
  let homeLastMod = new Date();
  try {
    const { data: latest } = await supabase
      .from("memes")
      .select("published_at")
      .eq("moderation_status", "approved")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .single();
    if (latest?.published_at) homeLastMod = new Date(latest.published_at);
  } catch {
    /* 실패 시 현재 시각 유지 */
  }

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: homeLastMod,
      changeFrequency: "hourly",
      priority: 1,
    },
    // 테마별 모음 허브
    ...COLLECTIONS.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: homeLastMod,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // 주요 정적 페이지 — 탐색·커뮤니티·정책
    ...(["/explore", "/timeline", "/weekly", "/rankings", "/community", "/news", "/products", "/about", "/privacy", "/terms"] as const).map(
      (path) => ({
        url: `${SITE_URL}${path}`,
        lastModified: homeLastMod,
        changeFrequency: "daily" as const,
        priority: 0.6,
      })
    ),
  ];

  // 승인 밈 전체 (페이지 단위로 순회 — 사이트맵 상한 5만 URL)
  const PAGE = 1000;
  for (let from = 0; from < 49000; from += PAGE) {
    const { data, error } = await supabase
      .from("memes")
      .select("short_id, slug, updated_at")
      .eq("moderation_status", "approved")
      .order("published_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error || !data || data.length === 0) break;

    for (const meme of data) {
      entries.push({
        url: `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`,
        lastModified: new Date(meme.updated_at),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    if (data.length < PAGE) break;
  }

  return entries;
}
