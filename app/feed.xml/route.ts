import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom, CATEGORIES, type MemeCategory } from "@/lib/labels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** 1시간마다 재생성 */
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const supabase = createStaticClient();

  const { data: memes } = await supabase
    .from("memes")
    .select("short_id, slug, title, summary, category, published_at, updated_at")
    .eq("moderation_status", "approved")
    .order("published_at", { ascending: false })
    .limit(30);

  const items = (memes ?? [])
    .map((meme) => {
      const url = `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`;
      const categoryLabel =
        CATEGORIES[meme.category as MemeCategory]?.user ?? meme.category;
      const pubDate = new Date(
        meme.published_at ?? meme.updated_at
      ).toUTCString();
      return `    <item>
      <title>${escapeXml(meme.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">memecatch-${escapeXml(meme.short_id)}</guid>
      <description>${escapeXml(meme.summary)}</description>
      <category>${escapeXml(categoryLabel)}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>밈캐치 — 새로 등록된 밈</title>
    <link>${escapeXml(SITE_URL)}</link>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <description>요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 최근 등록된 밈 30개를 전해드려요.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
