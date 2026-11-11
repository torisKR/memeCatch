import { createStaticClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";
import { memePathFrom, CATEGORIES, type MemeCategory } from "@/lib/labels";
import {
  loadApprovedIndexableMemes,
  publicationExportUnavailableResponse,
} from "@/lib/publication-export";
import type { ContentDepthInput } from "@/lib/content-depth";
import { evidenceTimestamp } from "@/lib/source-links";


/** Request-time feed. A database-less build must not cache a failed export. */
export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type FeedRow = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string | null;
  updated_at: string;
};

function validDate(value: string | null | undefined): Date | null {
  const timestamp = evidenceTimestamp(value);
  return timestamp ? new Date(timestamp) : null;
}

export async function GET() {
  let memes: FeedRow[];
  try {
    const result = await loadApprovedIndexableMemes<FeedRow>(createStaticClient(), {
      select:
        "id, short_id, slug, title, summary, category, published_at, updated_at," +
        " description, origin, usage_note, caution, usage_examples," +
        " meme_sources(source_url), meme_contents(availability, moderation_status)," +
        " meme_tags_map(tag_id)",
      primaryOrder: "published_at",
      limit: 30,
      countAll: false,
    });
    memes = result.rows;
  } catch (error) {
    console.error("[feed.xml] publication export failed", error);
    return publicationExportUnavailableResponse();
  }

  const items = memes
    .map((meme) => {
      const url = `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`;
      const categoryLabel =
        CATEGORIES[meme.category as MemeCategory]?.user ?? meme.category;
      const publishedAt = validDate(meme.published_at);
      const pubDate = publishedAt
        ? `\n      <pubDate>${publishedAt.toUTCString()}</pubDate>`
        : "";
      return `    <item>
      <title>${escapeXml(meme.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">memecatch-${escapeXml(meme.short_id)}</guid>
      <description>${escapeXml(meme.summary)}</description>
      <category>${escapeXml(categoryLabel)}</category>${pubDate}
    </item>`;
    })
    .join("\n");

  const lastBuildDate = memes
    .map((meme) => validDate(meme.updated_at))
    .filter((date): date is Date => date !== null)
    .reduce<Date | null>(
      (latest, date) => (!latest || date > latest ? date : latest),
      null,
    );
  const lastBuildDateLine = lastBuildDate
    ? `\n    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>밈캐치 — 새로 등록된 밈</title>
    <link>${escapeXml(SITE_URL)}</link>
    <atom:link href="${escapeXml(`${SITE_URL}/feed.xml`)}" rel="self" type="application/rss+xml"/>
    <description>요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 최근 등록된 밈 30개를 전해드려요.</description>
    <language>ko</language>${lastBuildDateLine}
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
