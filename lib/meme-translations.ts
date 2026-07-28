import "server-only";

import { cache } from "react";
import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLocale,
  type Locale,
} from "@/lib/i18n";
import type { Database } from "@/lib/database.types";
import {
  getMemeByShortId,
  type MemeDetail,
} from "@/lib/queries";
import { createStaticClient } from "@/lib/supabase/server";

export type TranslationStatus = "machine" | "reviewed" | "stale";

/**
 * Public translation record. Korean remains the canonical source in `memes`;
 * this row is a locale-specific editorial snapshot of that source.
 */
type GeneratedTranslationRow =
  Database["public"]["Tables"]["meme_translations"]["Row"];

export type MemeTranslationRow = Omit<
  GeneratedTranslationRow,
  "locale" | "status"
> & {
  locale: Locale;
  status: TranslationStatus;
};

type OriginalMemeFields = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  aliases: string[];
  usage_examples?: unknown;
};

type LocalizableMeme = ContentDepthInput &
  OriginalMemeFields & {
    id: string;
    short_id: string;
    updated_at: string;
  };

export type TranslationMetadata = {
  locale: Locale;
  status: TranslationStatus;
  localizedSlug: string | null;
  sourceUpdatedAt: string;
  updatedAt: string;
  isCurrent: boolean;
  provider: string;
  model: string;
  promptVersion: number;
  translatedAt: string;
  reviewedAt: string | null;
};

export type LocalizedMeme<T extends LocalizableMeme = LocalizableMeme> = Omit<
  T,
  keyof OriginalMemeFields
> &
  OriginalMemeFields & {
    original: OriginalMemeFields;
    translation: TranslationMetadata;
  };

export type LocalizedMemeDetail = LocalizedMeme<
  MemeDetail
>;

/** Featured rows retain the full detail shape so the same object can safely be
 * used by cards, metadata, sitemap and llms-full without a second fetch. */
export type LocalizedMemeListItem = LocalizedMemeDetail;

const TRANSLATION_COLUMNS =
  "meme_id,locale,status,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by,created_at,updated_at" as const;

const FEATURED_SELECT = `${TRANSLATION_COLUMNS}, memes!inner(*, meme_contents(*), meme_sources(*), meme_tags_map(tag_id, tags(name)))` as const;

type FeaturedTranslationRow = MemeTranslationRow & {
  memes: MemeDetail;
};

type AvailabilityBaseRow = Omit<LocalizableMeme, "short_id">;

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

/** A translation is current only when it was produced from this exact source revision. */
export function isTranslationCurrent(
  sourceUpdatedAt: string,
  baseUpdatedAt: string,
): boolean {
  return sameInstant(sourceUpdatedAt, baseUpdatedAt);
}

/** Required SEO prose must be real text, not merely NOT NULL empty strings. */
export function hasRequiredTranslationFields(
  translation: Pick<
    MemeTranslationRow,
    "title" | "summary" | "description" | "origin"
  >,
): boolean {
  return [
    translation.title,
    translation.summary,
    translation.description,
    translation.origin,
  ].every((value) => value.trim().length > 0);
}

/**
 * Overlay an exact-locale translation while retaining the Korean source for
 * attribution and side-by-side display. There is intentionally no fallback:
 * returning another locale under the requested URL would create misleading
 * language signals and duplicate SEO pages.
 */
export function overlayMemeTranslation<T extends LocalizableMeme>(
  meme: T,
  translation: MemeTranslationRow | null | undefined,
  requestedLocale: Locale,
): LocalizedMeme<T> | null {
  if (
    requestedLocale === DEFAULT_LOCALE ||
    !translation ||
    translation.meme_id !== meme.id ||
    translation.locale !== requestedLocale
  ) {
    return null;
  }

  const original: OriginalMemeFields = {
    slug: meme.slug,
    title: meme.title,
    summary: meme.summary,
    description: meme.description,
    origin: meme.origin,
    usage_note: meme.usage_note,
    caution: meme.caution,
    aliases: [...meme.aliases],
    usage_examples: meme.usage_examples,
  };
  const localizedSlug = translation.localized_slug?.trim() || null;

  return {
    ...meme,
    slug: localizedSlug ?? meme.slug,
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    origin: translation.origin,
    usage_note: translation.usage_note,
    caution: translation.caution,
    aliases: [...translation.aliases],
    usage_examples: translation.usage_examples,
    original,
    translation: {
      locale: translation.locale,
      status: translation.status,
      localizedSlug,
      sourceUpdatedAt: translation.source_updated_at,
      updatedAt: translation.updated_at,
      provider: translation.provider,
      model: translation.model,
      promptVersion: translation.prompt_version,
      translatedAt: translation.translated_at,
      reviewedAt: translation.reviewed_at,
      isCurrent: isTranslationCurrent(
        translation.source_updated_at,
        meme.updated_at,
      ),
    },
  };
}

/**
 * Public localized pages require a human-reviewed snapshot of an already
 * substantial Korean source. Drafts remain available only to the operator
 * workflow and are never returned by the public read path below.
 */
export function isIndexableLocalizedMeme(
  meme: LocalizedMeme<LocalizableMeme> | null | undefined,
): boolean {
  if (!meme) return false;
  const originalDepth: ContentDepthInput = {
    ...meme.original,
    meme_sources: meme.meme_sources,
    meme_contents: meme.meme_contents,
    meme_tags_map: meme.meme_tags_map,
  };
  return (
    meme.translation.status === "reviewed" &&
    meme.translation.isCurrent &&
    hasRequiredTranslationFields(meme) &&
    isIndexableMeme(originalDepth)
  );
}

export const getLocalizedMemeByShortId = cache(async function getLocalizedMemeByShortId(
  shortId: string,
  locale: Locale,
): Promise<LocalizedMemeDetail | null> {
  if (!shortId || locale === DEFAULT_LOCALE) return null;

  const meme = await getMemeByShortId(shortId);
  if (!meme) return null;

  try {
    const { data, error } = await createStaticClient()
      .from("meme_translations")
      .select(TRANSLATION_COLUMNS)
      .eq("meme_id", meme.id)
      .eq("locale", locale)
      .eq("status", "reviewed")
      .maybeSingle()
      .overrideTypes<MemeTranslationRow, { merge: false }>();
    if (error || !data) return null;
    const localized = overlayMemeTranslation(meme, data, locale);
    return isIndexableLocalizedMeme(localized) ? localized : null;
  } catch {
    return null;
  }
});

/**
 * Highest-trending translations eligible for public discovery/GEO surfaces.
 * Fetch extra candidates before applying the current/depth checks so stale rows
 * do not unnecessarily shrink the requested result set.
 */
export async function getLocalizedFeaturedMemes(
  locale: Locale,
  limit = 12,
): Promise<LocalizedMemeListItem[]> {
  if (locale === DEFAULT_LOCALE || limit <= 0) return [];
  const safeLimit = Math.min(Math.floor(limit), 400);
  const candidateLimit = Math.min(Math.max(safeLimit * 3, 36), 1_200);

  try {
    const { data, error } = await createStaticClient()
      .from("meme_translations")
      .select(FEATURED_SELECT)
      .eq("locale", locale)
      .eq("status", "reviewed")
      .in("memes.moderation_status", ["approved", "limited"])
      .order("trend_score", { referencedTable: "memes", ascending: false })
      .limit(candidateLimit)
      .overrideTypes<FeaturedTranslationRow[], { merge: false }>();
    if (error || !data) return [];

    const localized: LocalizedMemeListItem[] = [];
    for (const row of data) {
      const meme = overlayMemeTranslation(row.memes, row, locale);
      if (!meme || !isIndexableLocalizedMeme(meme)) continue;
      localized.push(meme);
      if (localized.length === safeLimit) break;
    }
    return localized;
  } catch {
    return [];
  }
}

/**
 * Hreflang-ready locales only. Existing machine/stale rows are not advertised
 * as alternates because they are intentionally non-indexable.
 */
export const getAvailableTranslationLocales = cache(async function getAvailableTranslationLocales(
  memeId: string,
): Promise<Locale[]> {
  if (!memeId) return [];

  try {
    const supabase = createStaticClient();
    const [{ data: base, error: baseError }, { data: rows, error: rowsError }] =
      await Promise.all([
        supabase
          .from("memes")
          .select(
            "id,slug,title,summary,description,origin,usage_note,caution,aliases,updated_at,usage_examples,meme_sources(source_url),meme_contents(availability,moderation_status),meme_tags_map(tag_id)",
          )
          .eq("id", memeId)
          .in("moderation_status", ["approved", "limited"])
          .maybeSingle()
          .overrideTypes<AvailabilityBaseRow, { merge: false }>(),
        supabase
          .from("meme_translations")
          .select(TRANSLATION_COLUMNS)
          .eq("meme_id", memeId)
          .eq("status", "reviewed")
          .overrideTypes<MemeTranslationRow[], { merge: false }>(),
      ]);
    if (baseError || rowsError || !base || !rows) return [];

    const byLocale = new Set<Locale>();
    for (const row of rows) {
      if (!isLocale(row.locale) || row.locale === DEFAULT_LOCALE) continue;
      const minimalBase: LocalizableMeme = {
        ...base,
        short_id: "",
      };
      const meme = overlayMemeTranslation(minimalBase, row, row.locale);
      if (meme && isIndexableLocalizedMeme(meme)) byLocale.add(row.locale);
    }

    return SUPPORTED_LOCALES.filter((locale) => byLocale.has(locale));
  } catch {
    return [];
  }
});
