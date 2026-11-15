import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { discoveryIndexIds, type IndexCandidate } from "@/lib/content-depth";
import type { DiscoveryIndexResult } from "@/lib/index-gate";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { createStaticClient } from "@/lib/supabase/server";

const SELECT =
  "id, category, origin_year, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id)";

const PAGE = 1_000;
const DISCOVERY_REVALIDATE_SECONDS = 60 * 60;

/**
 * Public memes that pass current main's existing isIndexableMeme policy.
 * One failed read is not an empty catalog: callers must noindex and skip lists
 * instead of publishing the unfiltered corpus.
 */
const loadCachedDiscoveryIds = unstable_cache(
  async (): Promise<string[]> => {
    const supabase = createStaticClient();
    const candidates: IndexCandidate[] = [];
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data, error } = await supabase
        .from("memes")
        .select(SELECT)
        .in("moderation_status", ["approved", "limited"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as IndexCandidate[];
      candidates.push(...rows);
      if (rows.length < PAGE) break;
    }
    return [...discoveryIndexIds(candidates)];
  },
  ["public-discovery-index-v1"],
  {
    revalidate: DISCOVERY_REVALIDATE_SECONDS,
    tags: [PUBLIC_CATALOG_CACHE_TAG, "public-discovery-index"],
  },
);

export const loadDiscoveryIndex = cache(async function loadDiscoveryIndex(): Promise<DiscoveryIndexResult> {
  try {
    return { ok: true, ids: new Set(await loadCachedDiscoveryIds()) };
  } catch {
    return { ok: false };
  }
});
