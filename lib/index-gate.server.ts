import "server-only";

import { cache } from "react";
import { discoveryIndexIds, type IndexCandidate } from "@/lib/content-depth";
import { createStaticClient } from "@/lib/supabase/server";

const SELECT =
  "id, category, origin_year, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)";

const PAGE = 1_000;

export type DiscoveryIndexResult =
  | { ok: true; ids: ReadonlySet<string> }
  | { ok: false };

/**
 * Public memes that pass the body gate and still have two indexable relatives.
 * One failed read is not an empty catalog: callers must noindex and skip lists
 * instead of publishing the unfiltered corpus.
 */
export const loadDiscoveryIndex = cache(async function loadDiscoveryIndex(): Promise<DiscoveryIndexResult> {
  try {
    const supabase = createStaticClient();
    const candidates: IndexCandidate[] = [];
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data, error } = await supabase
        .from("memes")
        .select(SELECT)
        .in("moderation_status", ["approved", "limited"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return { ok: false };
      const rows = (data ?? []) as unknown as IndexCandidate[];
      candidates.push(...rows);
      if (rows.length < PAGE) break;
    }
    return { ok: true, ids: discoveryIndexIds(candidates) };
  } catch {
    return { ok: false };
  }
});
