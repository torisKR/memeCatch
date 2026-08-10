import {
  isSeoContentLocale,
  localizedMemePath,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";
import type { Locale } from "@/lib/i18n";
import { memePathFrom } from "@/lib/labels";
import type { MemeContentRow, MemeListItem, MemeRow, MemeSourceRow } from "@/lib/queries";

export const PLUS_LOCALIZED_FEED_LIMIT = 6;
export const PLUS_LOCALIZED_FEED_SOURCE_LIMIT = 60;

export type PlusFeedContentLocale = SeoRouteLocale;

export type PlusLocalizedFeedSource = Pick<
  MemeRow,
  | "id"
  | "short_id"
  | "slug"
  | "title"
  | "summary"
  | "category"
  | "safety_level"
  | "lifecycle_status"
  | "media_type"
  | "origin_year"
  | "trend_score"
  | "description"
  | "origin"
  | "usage_note"
  | "caution"
  | "aliases"
  | "usage_examples"
  | "updated_at"
> & {
  meme_contents: Array<
    Pick<
      MemeContentRow,
      "availability" | "moderation_status" | "thumbnail_url" | "is_representative"
    >
  >;
  meme_sources: Array<Pick<MemeSourceRow, "source_url">>;
  meme_tags_map: Array<{ tag_id: string }>;
};

export type PlusLocalizedFeedTranslation = {
  meme_id: string;
  locale: string;
  status: string;
  localized_slug: string | null;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note?: string | null;
  caution?: string | null;
  aliases?: string[];
  usage_examples?: unknown;
  provider?: string;
  model?: string;
  prompt_version?: number;
  translated_at?: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at?: string;
  updated_at?: string;
  source_updated_at: string;
};

export type PlusLocalizedFeedItem = {
  meme: MemeListItem;
  href: string;
};

export type PlusLocalizedFeedState =
  | "active"
  | "empty-source"
  | "empty-coverage"
  | "unavailable";

export type PlusLocalizedFeedProjection = {
  state: Exclude<PlusLocalizedFeedState, "unavailable">;
  items: PlusLocalizedFeedItem[];
};

export function resolvePlusContentLocale(locale: Locale): PlusFeedContentLocale {
  if (locale === "ko" || isSeoContentLocale(locale)) return locale;
  return "en";
}

export function usesEnglishContentFallback(
  uiLocale: Locale,
  contentLocale: PlusFeedContentLocale,
): boolean {
  return uiLocale !== "ko" && uiLocale !== contentLocale;
}

export function localizedFeedHref(
  locale: PlusFeedContentLocale,
  shortId: string,
  slug: string,
): string {
  return locale === "ko"
    ? memePathFrom(shortId, slug)
    : localizedMemePath(locale, shortId, slug);
}

export function buildPlusLocalizedFeed({
  locale,
  sources,
  translations,
  eligibleSourceIds = [],
  limit = PLUS_LOCALIZED_FEED_LIMIT,
}: {
  locale: PlusFeedContentLocale;
  sources: readonly PlusLocalizedFeedSource[];
  translations: readonly PlusLocalizedFeedTranslation[];
  eligibleSourceIds?: ReadonlySet<string> | readonly string[];
  limit?: number;
}): PlusLocalizedFeedProjection {
  const safeLimit = Math.min(
    PLUS_LOCALIZED_FEED_LIMIT,
    Math.max(0, Math.trunc(Number.isFinite(limit) ? limit : PLUS_LOCALIZED_FEED_LIMIT)),
  );
  const uniqueSources = uniqueById(sources);
  if (uniqueSources.length === 0 || safeLimit === 0) {
    return { state: "empty-source", items: [] };
  }

  if (locale === "ko") {
    return {
      state: "active",
      items: uniqueSources.slice(0, safeLimit).map((source) => ({
        meme: toCardMeme(source),
        href: localizedFeedHref(locale, source.short_id, source.slug),
      })),
    };
  }

  const eligibleIds =
    eligibleSourceIds instanceof Set ? eligibleSourceIds : new Set(eligibleSourceIds);
  const items: PlusLocalizedFeedItem[] = [];
  for (const source of uniqueSources) {
    if (!eligibleIds.has(source.id)) continue;
    const translation = translations.find(
      (row) =>
        row.meme_id === source.id &&
        row.locale === locale &&
        row.status === "reviewed" &&
        isCurrent(row.source_updated_at, source.updated_at) &&
        hasRequiredLocalizedFields(row),
    );
    if (!translation || items.length >= safeLimit) continue;

    const localizedSlug = translation.localized_slug?.trim();
    if (!localizedSlug) continue;

    const meme = toCardMeme(source, translation);
    items.push({
      meme,
      href: localizedFeedHref(locale, source.short_id, localizedSlug),
    });
  }

  return {
    state: items.length > 0 ? "active" : "empty-coverage",
    items,
  };
}

function uniqueById(
  sources: readonly PlusLocalizedFeedSource[],
): PlusLocalizedFeedSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}

function toCardMeme(
  source: PlusLocalizedFeedSource,
  translation?: PlusLocalizedFeedTranslation,
): MemeListItem {
  return {
    id: source.id,
    short_id: source.short_id,
    slug: translation?.localized_slug?.trim() || source.slug,
    title: translation?.title ?? source.title,
    summary: translation?.summary ?? source.summary,
    category: source.category,
    safety_level: source.safety_level,
    lifecycle_status: source.lifecycle_status,
    media_type: source.media_type,
    origin_year: source.origin_year,
    trend_score: source.trend_score,
    meme_contents: source.meme_contents.map((content) => ({
      thumbnail_url: content.thumbnail_url,
      is_representative: content.is_representative,
    })),
  };
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRequiredLocalizedFields(
  row: Pick<PlusLocalizedFeedTranslation, "localized_slug" | "title" | "summary" | "description" | "origin">,
): boolean {
  return [row.localized_slug, row.title, row.summary, row.description, row.origin].every(hasText);
}

function isCurrent(sourceUpdatedAt: string, baseUpdatedAt: string): boolean {
  const sourceTime = Date.parse(sourceUpdatedAt);
  const baseTime = Date.parse(baseUpdatedAt);
  return Number.isFinite(sourceTime) && Number.isFinite(baseTime) && sourceTime === baseTime;
}
