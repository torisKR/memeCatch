import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";
import { createStaticClient } from "@/lib/db/server";
import { loadDiscoveryIndex } from "@/lib/index-gate.server";
import {
  isDirectoryMeme,
  sortDirectory,
  type MemeDirectoryCandidate,
  type MemeDirectoryItem,
} from "@/lib/meme-directory";

const SELECT =
  "id, short_id, slug, title, summary, category, origin_year, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id)";

const PAGE = 1_000;

type DirectoryRow = MemeDirectoryCandidate & {
  title: string | null;
  summary: string | null;
  category: string;
  origin_year: number | null;
};

const loadCachedDirectory = unstable_cache(
  async (): Promise<MemeDirectoryItem[]> => {
    const discovery = await loadDiscoveryIndex();
    // Thrown, not cached: an outage must not publish an empty or unfiltered list.
    if (!discovery.ok) throw new Error("discovery index unavailable");
    const ids = discovery.ids;
    const db = createStaticClient();
    const items: MemeDirectoryItem[] = [];
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data, error } = await db
        .from("memes")
        .select(SELECT)
        .in("moderation_status", ["approved", "limited"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error("meme directory read failed");
      const rows = (data ?? []) as unknown as DirectoryRow[];
      for (const row of rows) {
        // Same predicate as the sitemap, with no extra filter, so the sitemap's
        // page count and this list never disagree.
        if (!isDirectoryMeme(row, ids)) continue;
        items.push({
          id: row.id,
          short_id: row.short_id,
          slug: row.slug,
          title: row.title?.trim() || row.slug,
          summary: row.summary?.trim() ?? "",
          category: row.category,
          origin_year: row.origin_year,
        });
      }
      if (rows.length < PAGE) break;
    }
    return sortDirectory(items);
  },
  ["public-meme-directory-v1"],
  { revalidate: 60 * 60, tags: [PUBLIC_CATALOG_CACHE_TAG, "public-meme-directory"] },
);

export type MemeDirectoryResult = { ok: true; items: MemeDirectoryItem[] } | { ok: false };

/** A failed read is not an empty directory: callers show an outage, not page 1 of 0. */
export const loadMemeDirectory = cache(async function loadMemeDirectory(): Promise<MemeDirectoryResult> {
  try {
    return { ok: true, items: await loadCachedDirectory() };
  } catch {
    return { ok: false };
  }
});
