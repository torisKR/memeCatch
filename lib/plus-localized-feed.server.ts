import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";
import type { MemeCategory } from "@/lib/labels";
import {
  buildPlusLocalizedFeed,
  PLUS_LOCALIZED_FEED_LIMIT,
  PLUS_LOCALIZED_FEED_SOURCE_LIMIT,
  resolvePlusContentLocale,
  type PlusLocalizedFeedSource,
  type PlusLocalizedFeedState,
} from "@/lib/plus-localized-feed";
import {
  isIndexableLocalizedMeme,
  overlayMemeTranslation,
  type MemeTranslationRow,
} from "@/lib/meme-translations";

const PUBLIC_STATUSES = ["approved", "limited"] as const;

const FEED_SELECT =
  "id, short_id, slug, title, summary, category, safety_level, lifecycle_status, media_type, origin_year, trend_score, description, origin, usage_note, caution, aliases, usage_examples, updated_at, meme_contents(thumbnail_url, is_representative, availability, moderation_status), meme_sources(source_url), meme_tags_map(tag_id)" as const;

const TRANSLATION_SELECT =
  "meme_id, locale, status, localized_slug, title, summary, description, origin, usage_note, caution, aliases, usage_examples, source_updated_at, provider, model, prompt_version, translated_at, reviewed_at, reviewed_by, created_at, updated_at" as const;

export type PlusLocalizedFeedLoadResult = {
  state: PlusLocalizedFeedState | "locked";
  contentLocale: ReturnType<typeof resolvePlusContentLocale>;
  usedFresh: boolean;
  items: ReturnType<typeof buildPlusLocalizedFeed>["items"];
};

export async function loadPlusLocalizedFeed({
  interests,
  locale,
  isPremium,
}: {
  interests: readonly MemeCategory[];
  locale: Locale;
  isPremium: boolean;
}): Promise<PlusLocalizedFeedLoadResult> {
  const contentLocale = resolvePlusContentLocale(locale);
  if (!isPremium) {
    return { state: "locked", contentLocale, usedFresh: false, items: [] };
  }

  const supabase = createStaticClient();
  const hasInterests = interests.length > 0;
  const interestResult = hasInterests
    ? await readSources(supabase, { categories: interests, fresh: false, contentLocale })
    : { rows: [], failed: false };
  if (interestResult.failed) {
    return unavailable(contentLocale);
  }

  let sources = interestResult.rows;
  let usedFresh = false;
  if (!hasInterests || sources.length === 0) {
    const freshResult = await readSources(supabase, {
      categories: [],
      fresh: true,
      contentLocale,
    });
    if (freshResult.failed) return unavailable(contentLocale);
    sources = freshResult.rows;
    usedFresh = true;
  }

  if (sources.length === 0) {
    return { state: "empty-source", contentLocale, usedFresh, items: [] };
  }

  if (contentLocale === "ko") {
    const projection = buildPlusLocalizedFeed({
      locale: contentLocale,
      sources,
      translations: [],
      limit: PLUS_LOCALIZED_FEED_LIMIT,
    });
    return { ...projection, contentLocale, usedFresh };
  }

  const translationResult = await readTranslations(
    supabase,
    sources.map((source) => source.id),
    contentLocale,
  );
  if (translationResult.failed) return unavailable(contentLocale);

  const eligibleSourceIds = new Set<string>();
  for (const source of sources) {
    const hasEligibleTranslation = translationResult.rows.some((row) => {
      if (row.meme_id !== source.id) return false;
      const localized = overlayMemeTranslation(source, row, contentLocale);
      return isIndexableLocalizedMeme(localized);
    });
    if (hasEligibleTranslation) eligibleSourceIds.add(source.id);
  }

  const projection = buildPlusLocalizedFeed({
    locale: contentLocale,
    sources,
    translations: translationResult.rows,
    eligibleSourceIds,
    limit: PLUS_LOCALIZED_FEED_LIMIT,
  });
  return { ...projection, contentLocale, usedFresh };
}

function unavailable(
  contentLocale: ReturnType<typeof resolvePlusContentLocale>,
): PlusLocalizedFeedLoadResult {
  return { state: "unavailable", contentLocale, usedFresh: false, items: [] };
}

async function readSources(
  supabase: ReturnType<typeof createStaticClient>,
  {
    categories,
    fresh,
    contentLocale,
  }: {
    categories: readonly MemeCategory[];
    fresh: boolean;
    contentLocale: ReturnType<typeof resolvePlusContentLocale>;
  },
): Promise<{ rows: PlusLocalizedFeedSource[]; failed: boolean }> {
  try {
    let query = supabase
      .from("memes")
      .select(FEED_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES]);

    if (categories.length > 0) query = query.in("category", [...categories]);

    const { data, error } = fresh
      ? await query
          .order("published_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(
            contentLocale === "ko"
              ? PLUS_LOCALIZED_FEED_LIMIT
              : PLUS_LOCALIZED_FEED_SOURCE_LIMIT,
          )
          .overrideTypes<PlusLocalizedFeedSource[], { merge: false }>()
      : await query
          .order("trend_score", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(
            contentLocale === "ko"
              ? PLUS_LOCALIZED_FEED_LIMIT
              : PLUS_LOCALIZED_FEED_SOURCE_LIMIT,
          )
          .overrideTypes<PlusLocalizedFeedSource[], { merge: false }>();

    return { rows: data ?? [], failed: Boolean(error) };
  } catch {
    return { rows: [], failed: true };
  }
}

async function readTranslations(
  supabase: ReturnType<typeof createStaticClient>,
  memeIds: readonly string[],
  locale: Exclude<ReturnType<typeof resolvePlusContentLocale>, "ko">,
): Promise<{ rows: MemeTranslationRow[]; failed: boolean }> {
  try {
    const { data, error } = await supabase
      .from("meme_translations")
      .select(TRANSLATION_SELECT)
      .eq("locale", locale)
      .eq("status", "reviewed")
      .in("meme_id", [...memeIds])
      .overrideTypes<MemeTranslationRow[], { merge: false }>();
    return { rows: data ?? [], failed: Boolean(error) };
  } catch {
    return { rows: [], failed: true };
  }
}
