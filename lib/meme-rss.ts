import { createStaticClient } from "@/lib/db/server";
import { SITE_URL } from "@/lib/site";
import { memePathFrom, CATEGORIES, type MemeCategory } from "@/lib/labels";
import {
  loadApprovedIndexableMemes,
  publicationExportUnavailableResponse,
} from "@/lib/publication-export";
import type { ContentDepthInput } from "@/lib/content-depth";
import { evidenceTimestamp } from "@/lib/source-links";
import {
  MEME_FEEDS,
  MEME_FEED_ITEM_LIMIT,
  type MemeFeedKind,
} from "@/lib/meme-rss-feeds";

/**
 * Columns the indexability gate needs plus the feed fields. Keep this in step
 * with the sitemap's DEPTH_SELECT: a dropped signal silently scores a meme
 * lower and removes it from the feed.
 */
export const MEME_FEED_SELECT =
  "id, short_id, slug, title, summary, category, origin_year, published_at, updated_at," +
  " description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status)," +
  " meme_tags_map(tag_id)";

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

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** A real, past timestamp from the row, or null. Never falls back to now. */
function validDate(value: string | null | undefined): Date | null {
  const timestamp = evidenceTimestamp(value);
  return timestamp ? new Date(timestamp) : null;
}

function renderItem(meme: FeedRow, kind: MemeFeedKind): string {
  const url = `${SITE_URL}${memePathFrom(meme.short_id, meme.slug)}`;
  const categoryLabel =
    CATEGORIES[meme.category as MemeCategory]?.user ?? meme.category;
  // The new feed dates an item by publication; the updated feed by its last
  // body edit (updated_at moves only on body edits).
  const itemDate = validDate(kind === "new" ? meme.published_at : meme.updated_at);
  const pubDate = itemDate
    ? `\n      <pubDate>${itemDate.toUTCString()}</pubDate>`
    : "";
  // A rewrite is a new event for feed readers, so the updated feed keys the
  // guid on the revision as well as the meme.
  const guid = kind === "updated" && itemDate
    ? `memecatch-${meme.short_id}-${itemDate.getTime()}`
    : `memecatch-${meme.short_id}`;
  return `    <item>
      <title>${escapeXml(meme.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <description>${escapeXml(meme.summary)}</description>
      <category>${escapeXml(categoryLabel)}</category>${pubDate}
    </item>`;
}

export function renderMemeRss(memes: readonly FeedRow[], kind: MemeFeedKind): string {
  const feed = MEME_FEEDS[kind];
  const items = memes.map((meme) => renderItem(meme, kind)).join("\n");

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

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <atom:link href="${escapeXml(`${SITE_URL}${feed.path}`)}" rel="self" type="application/rss+xml"/>
    <description>${escapeXml(feed.description)}</description>
    <language>ko</language>${lastBuildDateLine}
${items}
  </channel>
</rss>`;
}

/**
 * Serve one meme feed. Only approved memes that pass `isIndexableMeme` (the
 * same gate as the sitemap and detail robots) are listed, so a noindex thin
 * document never reaches a crawler through the feed.
 */
export async function memeFeedResponse(kind: MemeFeedKind): Promise<Response> {
  let memes: FeedRow[];
  try {
    const result = await loadApprovedIndexableMemes<FeedRow>(createStaticClient(), {
      select: MEME_FEED_SELECT,
      primaryOrder: kind === "new" ? "published_at" : "updated_at",
      limit: MEME_FEED_ITEM_LIMIT,
      countAll: false,
    });
    memes = result.rows;
  } catch (error) {
    console.error(`[${MEME_FEEDS[kind].path}] publication export failed`, error);
    return publicationExportUnavailableResponse();
  }

  return new Response(renderMemeRss(memes, kind), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
