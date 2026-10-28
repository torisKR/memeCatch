import "server-only";

import { cache } from "react";
import {
  projectPublicLocalizedTranslationRows,
  type LocalizedMemeListItem,
  type MemeTranslationRow,
} from "@/lib/meme-translations";
import type { MemeDetail } from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";
import type { SeoContentLocale } from "@/lib/i18n-routing";
import {
  EXPLORE_PAGE_SIZE,
  clampExplorePage,
  explorePageOffset,
} from "@/lib/explore-pagination";

export type LocalizedExploreStatus = "active" | "coverage-empty" | "unavailable";
export type LocalizedExploreSort = "recent";

export type LocalizedExploreResult = {
  items: LocalizedMemeListItem[];
  status: LocalizedExploreStatus;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type LocalizedExploreTranslationRow = MemeTranslationRow & {
  memes: MemeDetail;
};

const TRANSLATION_COLUMNS =
  "meme_id,locale,status,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by,created_at,updated_at" as const;
const EXPLORE_SELECT =
  `${TRANSLATION_COLUMNS}, memes!inner(*, meme_contents(*), meme_sources(*), meme_tags_map(tag_id, tags(name)), meme_market_profiles(market_code, role, review_state))` as const;
const PUBLIC_CANDIDATE_LIMIT = 1_200;
const CANDIDATE_BATCH_SIZE = 72;

function emptyResult(status: Exclude<LocalizedExploreStatus, "active">): LocalizedExploreResult {
  return { items: [], status, page: 1, hasPrevious: false, hasNext: false };
}

export const getLocalizedExploreMemes = cache(async function getLocalizedExploreMemes(
  locale: SeoContentLocale,
  sort?: LocalizedExploreSort,
  requestedPage = 1,
): Promise<LocalizedExploreResult> {
  try {
    const eligible = new Map<string, LocalizedMemeListItem>();
    const normalizedPage = Math.max(1, requestedPage);
    const needed = normalizedPage * EXPLORE_PAGE_SIZE + 1;
    let from = 0;
    let exhausted = false;

    while (from < PUBLIC_CANDIDATE_LIMIT && eligible.size < needed) {
      const to = Math.min(
        from + CANDIDATE_BATCH_SIZE - 1,
        PUBLIC_CANDIDATE_LIMIT - 1,
      );
      const requestedCount = to - from + 1;
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
        .range(from, to)
        .overrideTypes<LocalizedExploreTranslationRow[], { merge: false }>();

      if (error || !data) return emptyResult("unavailable");

      const publicRows = await projectPublicLocalizedTranslationRows(data, locale);
      for (const localized of publicRows) {
        if (!eligible.has(localized.id)) eligible.set(localized.id, localized);
      }

      from = to + 1;
      if (data.length < requestedCount) {
        exhausted = true;
        break;
      }
    }

    if (eligible.size === 0) return emptyResult("coverage-empty");

    const allEligible = [...eligible.values()];
    const page = exhausted || from >= PUBLIC_CANDIDATE_LIMIT
      ? clampExplorePage(normalizedPage, allEligible.length)
      : normalizedPage;
    const offset = explorePageOffset(page);
    const items = allEligible.slice(offset, offset + EXPLORE_PAGE_SIZE);
    return {
      items,
      status: "active",
      page,
      hasPrevious: page > 1,
      hasNext: allEligible.length > offset + EXPLORE_PAGE_SIZE,
    };
  } catch {
    return emptyResult("unavailable");
  }
});
