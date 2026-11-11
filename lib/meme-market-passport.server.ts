import "server-only";

import { cacheCatalogRead } from "@/lib/catalog-read-cache";
import { isIndexableMeme } from "@/lib/content-depth";
import { memePathFrom } from "@/lib/labels";
import { localizedMemePath, type SeoRouteLocale } from "@/lib/i18n-routing";
import { getLocalizedSearchMemesResult } from "@/lib/meme-translations";
import { MemeCatalogUnavailableError } from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import {
  buildMemeMarketPassport,
  type MarketPassportProfileRow,
  type MarketPassportTargetRow,
  type MarketPassportVariantRow,
  type MemeMarketPassport,
} from "@/lib/meme-market-passport";

async function loadMemeMarketPassport(
  memeId: string,
  locale: SeoRouteLocale,
): Promise<MemeMarketPassport> {
  const fallback = (dataStatus: "empty" | "unavailable") => ({
    ...buildMemeMarketPassport({
      memeId,
      profiles: [],
      variants: [],
      targets: [],
    }),
    dataStatus,
  });

  if (!memeId) return fallback("empty");

  try {
    const supabase = createStaticClient();
    const [profilesResult, variantsResult] = await Promise.all([
      supabase
        .from("meme_market_profiles")
        .select(
          "meme_id, market_code, language_tag, role, local_title, local_aliases, usage_note, caution, review_state",
        )
        .eq("meme_id", memeId)
        .eq("review_state", "reviewed")
        .overrideTypes<MarketPassportProfileRow[], { merge: false }>(),
      supabase
        .from("meme_variant_links")
        .select("id, target_meme_id, relation_kind, review_state")
        .eq("source_meme_id", memeId)
        .eq("review_state", "reviewed")
        .overrideTypes<MarketPassportVariantRow[], { merge: false }>(),
    ]);
    if (profilesResult.error || variantsResult.error) throw new MemeCatalogUnavailableError();

    const variants = variantsResult.data ?? [];
    const targetIds = [...new Set(variants.map((variant) => variant.target_meme_id))];
    const targetsResult = targetIds.length
      ? await supabase
          .from("memes")
          .select(
            "id, short_id, slug, title, description, origin, usage_note, caution, usage_examples, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
          )
          .in("id", targetIds)
          .in("moderation_status", ["approved", "limited"])
          .overrideTypes<MarketPassportTargetRow[], { merge: false }>()
      : { data: [] as MarketPassportTargetRow[], error: null };
    if (targetsResult.error) throw new MemeCatalogUnavailableError();

    const indexableTargets = (targetsResult.data ?? []).filter(isIndexableMeme);
    const routeReadyTargets =
      locale === "ko"
        ? indexableTargets.map((target) => ({
            ...target,
            href: memePathFrom(target.short_id, target.slug),
          }))
        : await buildLocalizedTargetRows(indexableTargets, locale);

    const passport = buildMemeMarketPassport({
      memeId,
      profiles: profilesResult.data ?? [],
      variants,
      targets: routeReadyTargets,
    });
    return {
      ...passport,
      dataStatus: passport.hasReviewedData ? "reviewed" : "empty",
    };
  } catch (error) {
    if (error instanceof MemeCatalogUnavailableError) throw error;
    throw new MemeCatalogUnavailableError();
  }
}

const loadMemeMarketPassportCached = cacheCatalogRead(
  loadMemeMarketPassport,
  ["public-meme-market-passport"],
  { revalidate: 86_400, tags: [PUBLIC_CATALOG_CACHE_TAG] },
);

export async function getMemeMarketPassport(
  memeId: string,
  locale: SeoRouteLocale = "ko",
): Promise<MemeMarketPassport> {
  if (!memeId) {
    return {
      ...buildMemeMarketPassport({ memeId, profiles: [], variants: [], targets: [] }),
      dataStatus: "empty",
    };
  }
  try {
    return await loadMemeMarketPassportCached(memeId, locale);
  } catch {
    return {
      ...buildMemeMarketPassport({ memeId, profiles: [], variants: [], targets: [] }),
      dataStatus: "unavailable",
    };
  }
}

async function buildLocalizedTargetRows(
  targets: readonly MarketPassportTargetRow[],
  locale: Exclude<SeoRouteLocale, "ko">,
): Promise<MarketPassportTargetRow[]> {
  if (targets.length === 0) return [];

  const localizedResult = await getLocalizedSearchMemesResult(
    targets.map((target) => target.short_id),
    locale,
  );
  if (localizedResult.status === "unavailable") {
    throw new Error("localized market passport target read unavailable");
  }

  return targets.flatMap((target) => {
    const localized = localizedResult.items.get(target.short_id);
    if (!localized) return [];
    return [
      {
        ...target,
        slug: localized.slug,
        title: localized.title,
        href: localizedMemePath(locale, localized.short_id, localized.slug),
      },
    ];
  });
}
