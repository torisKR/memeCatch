import "server-only";

import type { MemeCategory } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlusGlobalScoutEvidenceDeck,
  PLUS_GLOBAL_SCOUT_LIMIT,
  type PlusGlobalScoutLocale,
  type PlusGlobalScoutResult,
  type PlusGlobalScoutSourceRow,
  type PlusGlobalScoutTranslationRow,
} from "@/lib/plus-global-scout";
import {
  loadTrustedOneCutMemeIds,
  type PlusTrustedEvidenceSupabase,
} from "@/lib/plus-trusted-evidence-exporter.server";

export const PLUS_GLOBAL_SCOUT_SOURCE_LIMIT = 240;

export type PlusGlobalScoutSupabase = Awaited<ReturnType<typeof createClient>>;

const trustedScoutMemeIds = new WeakMap<PlusGlobalScoutResult, readonly string[]>();

export function trustedPlusGlobalScoutMemeIds(
  result: PlusGlobalScoutResult,
): readonly string[] {
  return trustedScoutMemeIds.get(result) ?? [];
}

function isPlusGlobalScoutLocale(value: string): value is PlusGlobalScoutLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh" || value === "zh-tw";
}

export function plusGlobalScoutDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function loadPlusGlobalScout({
  supabase,
  isPremium,
  locale,
  interests,
  now = new Date(),
}: {
  supabase: PlusGlobalScoutSupabase;
  isPremium: boolean;
  locale: string;
  interests: readonly MemeCategory[];
  now?: Date;
}): Promise<PlusGlobalScoutResult> {
  const dateKey = plusGlobalScoutDateKey(now);
  if (!isPremium || !isPlusGlobalScoutLocale(locale)) {
    return {
      status: "empty",
      dateKey,
      items: [],
    } satisfies PlusGlobalScoutResult;
  }

  let sourceQuery = supabase
    .from("memes")
    .select(
      "id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, category, safety_level, lifecycle_status, moderation_status, trend_score, updated_at, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
    )
    .in("moderation_status", ["approved", "limited"])
    .in("safety_level", ["green", "yellow"])
    .in("lifecycle_status", ["rising", "active"])
    .order("trend_score", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(PLUS_GLOBAL_SCOUT_SOURCE_LIMIT);

  if (interests.length > 0) sourceQuery = sourceQuery.in("category", [...interests]);

  const { data: sources, error: sourceError } = await sourceQuery.overrideTypes<
    PlusGlobalScoutSourceRow[],
    { merge: false }
  >();
  if (sourceError) {
    return { status: "unavailable", dateKey, items: [] } satisfies PlusGlobalScoutResult;
  }
  if (!sources?.length) {
    return { status: "empty", dateKey, items: [] } satisfies PlusGlobalScoutResult;
  }

  const translationResult =
    locale === "ko"
      ? { rows: [], unavailable: false }
      : await loadPlusGlobalScoutTranslations(
          supabase,
          sources.map((source) => source.id),
          locale,
        );
  if (translationResult.unavailable) {
    return { status: "unavailable", dateKey, items: [] } satisfies PlusGlobalScoutResult;
  }

  let evidenceLocale = locale;
  let evidenceTranslations = translationResult.rows;

  if (
    buildPlusGlobalScoutEvidenceDeck({
      locale: evidenceLocale,
      dateKey,
      sources,
      translations: evidenceTranslations,
    }).length === 0 &&
    locale !== "ko" &&
    locale !== "en"
  ) {
    const fallbackTranslationResult = await loadPlusGlobalScoutTranslations(
      supabase,
      sources.map((source) => source.id),
      "en",
    );
    if (fallbackTranslationResult.unavailable) {
      return { status: "unavailable", dateKey, items: [] } satisfies PlusGlobalScoutResult;
    }
    evidenceLocale = "en";
    evidenceTranslations = fallbackTranslationResult.rows;
  }

  const items = await loadTrustedPlusGlobalScoutItems({
    supabase: supabase as unknown as PlusTrustedEvidenceSupabase,
    locale: evidenceLocale,
    dateKey,
    sources,
    translations: evidenceTranslations,
  });
  if (!items) {
    return { status: "unavailable", dateKey, items: [] } satisfies PlusGlobalScoutResult;
  }

  const result = {
    status: items.length > 0 ? "active" : "empty",
    dateKey,
    items,
  } satisfies PlusGlobalScoutResult;
  trustedScoutMemeIds.set(result, items.map((item) => item.id));
  return result;
}

async function loadTrustedPlusGlobalScoutItems({
  supabase,
  locale,
  dateKey,
  sources,
  translations,
}: {
  supabase: PlusTrustedEvidenceSupabase;
  locale: PlusGlobalScoutLocale;
  dateKey: string;
  sources: readonly PlusGlobalScoutSourceRow[];
  translations: readonly PlusGlobalScoutTranslationRow[];
}): Promise<PlusGlobalScoutResult["items"] | null> {
  let remainingSources = [...sources];
  const trustedItems: PlusGlobalScoutResult["items"] = [];

  while (remainingSources.length > 0 && trustedItems.length < PLUS_GLOBAL_SCOUT_LIMIT) {
    const ranked = buildPlusGlobalScoutEvidenceDeck({
      locale,
      dateKey,
      sources: remainingSources,
      translations,
    });
    if (ranked.length === 0) break;

    const rankedIds = new Set(ranked.map((item) => item.id));
    remainingSources = remainingSources.filter((source) => !rankedIds.has(source.id));
    const trustedMemeIds = await loadTrustedOneCutMemeIds(
      supabase,
      ranked.map((item) => item.id),
    );
    if (!trustedMemeIds) return null;
    trustedItems.push(...ranked.filter((item) => trustedMemeIds.has(item.id)));
  }

  return trustedItems.slice(0, PLUS_GLOBAL_SCOUT_LIMIT);
}

async function loadPlusGlobalScoutTranslations(
  supabase: PlusGlobalScoutSupabase,
  memeIds: readonly string[],
  locale: PlusGlobalScoutLocale,
): Promise<{ rows: PlusGlobalScoutTranslationRow[]; unavailable: boolean }> {
  const rows: PlusGlobalScoutTranslationRow[] = [];
  for (let offset = 0; offset < memeIds.length; offset += 100) {
    const { data, error } = await supabase
      .from("meme_translations")
      .select(
        "meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, usage_examples, status, source_updated_at, updated_at",
      )
      .eq("locale", locale)
      .eq("status", "reviewed")
      .in("meme_id", memeIds.slice(offset, offset + 100))
      .overrideTypes<PlusGlobalScoutTranslationRow[], { merge: false }>();
    if (error) return { rows: [], unavailable: true };
    rows.push(...(data ?? []));
  }
  return { rows, unavailable: false };
}
