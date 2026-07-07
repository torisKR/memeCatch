import type { MetadataRoute } from "next";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** 1시간마다 재생성 — 새로 승인된 밈 반영 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createStaticClient();

  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
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
