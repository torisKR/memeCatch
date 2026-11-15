import "server-only";

import { cache } from "react";
import {
  isIndexableLocalizedMeme,
  overlayMemeTranslation,
  type LocalizedMemeListItem,
  type MemeTranslationRow,
} from "@/lib/meme-translations";
import type { MemeDetail } from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";
import type { SeoContentLocale } from "@/lib/i18n-routing";

export type LocalizedExploreStatus = "active" | "coverage-empty" | "unavailable";
export type LocalizedExploreSort = "recent";

export type LocalizedExploreResult = {
  items: LocalizedMemeListItem[];
  status: LocalizedExploreStatus;
};

export type LocalizedExploreTranslationRow = MemeTranslationRow & {
  memes: MemeDetail;
};

const TRANSLATION_COLUMNS =
  "meme_id,locale,status,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by,created_at,updated_at" as const;
const EXPLORE_SELECT =
  `${TRANSLATION_COLUMNS}, memes!inner(*, meme_contents(*), meme_sources(*), meme_tags_map(tag_id, tags(name)), meme_market_profiles(market_code, role, review_state))` as const;
const PUBLIC_CANDIDATE_LIMIT = 1_200;
const PUBLIC_RESULT_LIMIT = 24;

export const getLocalizedExploreMemes = cache(async function getLocalizedExploreMemes(
  locale: SeoContentLocale,
  sort?: LocalizedExploreSort,
): Promise<LocalizedExploreResult> {
  try {
    const candidates = createStaticClient()
      .from("meme_translations")
      .select(EXPLORE_SELECT)
      .eq("locale", locale)
      .eq("status", "reviewed")
      .in("memes.moderation_status", ["approved", "limited"]);
    const ordered = sort === "recent"
      ? candidates.order("updated_at", {
          ascending: false,
          nullsFirst: false,
        })
      : candidates.order("trend_score", {
          referencedTable: "memes",
          ascending: false,
          nullsFirst: false,
        });
    const { data, error } = await ordered
      .order("meme_id", { ascending: false })
      .limit(PUBLIC_CANDIDATE_LIMIT)
      .overrideTypes<LocalizedExploreTranslationRow[], { merge: false }>();

    if (error || !data) return { items: [], status: "unavailable" };

    const eligible = new Map<string, LocalizedMemeListItem>();
    for (const row of data) {
      const localized = overlayMemeTranslation(row.memes, row, locale);
      if (!localized || !isIndexableLocalizedMeme(localized)) continue;
      eligible.set(localized.id, localized);
      if (eligible.size === PUBLIC_RESULT_LIMIT) break;
    }

    const items = [...eligible.values()];
    return {
      items,
      status: items.length > 0 ? "active" : "coverage-empty",
    };
  } catch {
    return { items: [], status: "unavailable" };
  }
});
