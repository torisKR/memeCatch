import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";
import { parseUsageExamples, type UsageExample } from "@/lib/usage-examples";

export const PLUS_GLOBAL_SCOUT_LOCALES = [
  "ko",
  "en",
  "ja",
  "zh",
  "zh-tw",
] as const;

export const PLUS_GLOBAL_SCOUT_LIMIT = 5;
export const PLUS_GLOBAL_SCOUT_EVIDENCE_LIMIT = 20;

export type PlusGlobalScoutStatus = "active" | "empty" | "unavailable";

export type PlusGlobalScoutLocale =
  (typeof PLUS_GLOBAL_SCOUT_LOCALES)[number];

export type PlusGlobalScoutSourceRow = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  moderation_status: string;
  safety_level: SafetyLevel;
  lifecycle_status: LifecycleStatus;
  trend_score: number;
  updated_at: string;
};

export type PlusGlobalScoutTranslationRow = {
  meme_id: string;
  locale: string;
  status: string;
  localized_slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  usage_examples?: unknown;
  source_updated_at: string;
};

export type PlusGlobalScoutItem = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usageNote: string | null;
  caution: string | null;
  locale: PlusGlobalScoutLocale;
  safetyLevel: "green" | "yellow";
  lifecycleStatus: "rising" | "active";
  trendScore: number;
  sourceUpdatedAt: string;
  usageExamples?: UsageExample[];
};

export type PlusGlobalScoutResult = {
  status: PlusGlobalScoutStatus;
  dateKey: string;
  items: PlusGlobalScoutItem[];
};

export type BuildPlusGlobalScoutDeckInput = {
  locale: PlusGlobalScoutLocale;
  dateKey: string;
  sources: readonly PlusGlobalScoutSourceRow[];
  translations: readonly PlusGlobalScoutTranslationRow[];
  limit?: number;
};

type ScoutContent = Pick<
  PlusGlobalScoutItem,
  | "slug"
  | "title"
  | "summary"
  | "description"
  | "origin"
  | "usageNote"
  | "caution"
  | "usageExamples"
>;

const PUBLIC_STATUSES = new Set(["approved", "limited"]);
const SAFE_LEVELS = new Set<SafetyLevel>(["green", "yellow"]);
const CURRENT_LIFECYCLES = new Set<LifecycleStatus>(["rising", "active"]);

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function hasCanonicalContent(content: {
  title: string;
  summary: string;
  description: string;
  origin: string;
}): boolean {
  return [content.title, content.summary, content.description, content.origin].every(hasText);
}

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function dailyRank(dateKey: string, id: string): number {
  const value = `${dateKey}:${id}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function deckLimit(limit: number | undefined, maximum: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return maximum;
  return Math.min(maximum, Math.max(0, Math.trunc(limit)));
}

function isEligibleSource(
  source: PlusGlobalScoutSourceRow,
): source is PlusGlobalScoutSourceRow & {
  safety_level: PlusGlobalScoutItem["safetyLevel"];
  lifecycle_status: PlusGlobalScoutItem["lifecycleStatus"];
} {
  return (
    hasText(source.id) &&
    hasText(source.short_id) &&
    hasText(source.slug) &&
    hasCanonicalContent(source) &&
    isIndexableMeme(source) &&
    PUBLIC_STATUSES.has(source.moderation_status) &&
    SAFE_LEVELS.has(source.safety_level) &&
    CURRENT_LIFECYCLES.has(source.lifecycle_status) &&
    Number.isFinite(source.trend_score)
  );
}

function contentForLocale(
  source: PlusGlobalScoutSourceRow,
  translations: readonly PlusGlobalScoutTranslationRow[],
  locale: PlusGlobalScoutLocale,
): ScoutContent | null {
  if (locale === "ko") {
    const usageExamples = parseUsageExamples(source.usage_examples);
    return {
      slug: source.slug,
      title: source.title,
      summary: source.summary,
      description: source.description,
      origin: source.origin,
      usageNote: source.usage_note,
      caution: source.caution,
      ...(usageExamples.length > 0 ? { usageExamples } : {}),
    };
  }

  const translation = translations.find(
    (row) =>
      row.meme_id === source.id &&
      row.locale === locale &&
      row.status === "reviewed" &&
      sameInstant(row.source_updated_at, source.updated_at) &&
      hasText(row.localized_slug) &&
      hasCanonicalContent(row),
  );

  if (!translation) return null;

  const usageExamples = parseUsageExamples(translation.usage_examples);
  return {
    slug: translation.localized_slug,
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    origin: translation.origin,
    usageNote: translation.usage_note,
    caution: translation.caution,
    ...(usageExamples.length > 0 ? { usageExamples } : {}),
  };
}

function buildPlusGlobalScoutDeckWithMaximum({
  locale,
  dateKey,
  sources,
  translations,
  limit,
}: BuildPlusGlobalScoutDeckInput, maximum: number): PlusGlobalScoutItem[] {
  const items = sources.flatMap((source): PlusGlobalScoutItem[] => {
    if (!isEligibleSource(source)) return [];
    const content = contentForLocale(source, translations, locale);
    if (!content) return [];

    return [{
      id: source.id,
      shortId: source.short_id,
      ...content,
      locale,
      safetyLevel: source.safety_level,
      lifecycleStatus: source.lifecycle_status,
      trendScore: source.trend_score,
      sourceUpdatedAt: source.updated_at,
    }];
  });

  items.sort(
    (left, right) =>
      dailyRank(dateKey, left.id) - dailyRank(dateKey, right.id) ||
      right.trendScore - left.trendScore ||
      left.id.localeCompare(right.id),
  );

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, deckLimit(limit, maximum));
}

export function buildPlusGlobalScoutDeck(
  input: BuildPlusGlobalScoutDeckInput,
): PlusGlobalScoutItem[] {
  return buildPlusGlobalScoutDeckWithMaximum(input, PLUS_GLOBAL_SCOUT_LIMIT);
}

export function buildPlusGlobalScoutEvidenceDeck(
  input: BuildPlusGlobalScoutDeckInput,
): PlusGlobalScoutItem[] {
  return buildPlusGlobalScoutDeckWithMaximum(input, PLUS_GLOBAL_SCOUT_EVIDENCE_LIMIT);
}
