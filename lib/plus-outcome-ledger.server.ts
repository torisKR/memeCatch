import "server-only";

import { isLocale, type Locale } from "@/lib/i18n";
import { isIndexableMeme } from "@/lib/content-depth";
import { localizedMemePath } from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";
import {
  isIndexableLocalizedMeme,
  overlayMemeTranslation,
  type MemeTranslationRow,
} from "@/lib/meme-translations";
import { plusNextMoveDateWindow } from "@/lib/plus-next-move";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import { createClient } from "@/lib/supabase/server";
import { parseUsageExamples } from "@/lib/usage-examples";
import {
  buildPlusOutcomeHistory,
  buildPlusOutcomeFollowUps,
  createPlusOutcomeHistoryFallback,
  createPlusOutcomeFollowUpFallback,
  createPlusOutcomeFallback,
  isPlusOutcomeLocale,
  isPlusOutcomeChannel,
  isPlusOutcomeResultUrlSafe,
  parsePlusOutcomeHistoryRows,
  parsePlusOutcomeFollowUpRows,
  parsePlusOutcomeRatingRows,
  parsePlusOutcomeSummary,
  PLUS_OUTCOME_HISTORY_LIMIT,
  PLUS_OUTCOME_HISTORY_WINDOW_DAYS,
  type PlusOutcomeHistory,
  type PlusOutcomeHistoryLinkStatus,
  type PlusOutcomeFollowUps,
  type PlusOutcomeRatingRow,
  type PlusOutcomeSummary,
} from "@/lib/plus-outcome-ledger";

export type PlusOutcomeLedgerSupabase = Awaited<ReturnType<typeof createClient>>;

type PlusOutcomeHistoryReceiptRow = {
  id: string;
  meme_id: string;
  completion_date: string;
  title_snapshot: string;
  channel: string;
  locale: string;
  artifact_kind: string;
  mode: string;
  performance_note: string | null;
  performance_rating: string | null;
  result_url?: string | null;
  memes: PlusOutcomeHistoryMemeRow | null;
};

type PlusOutcomeHistoryMemeRow = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  aliases: string[];
  usage_examples: unknown;
  updated_at: string;
  moderation_status: string;
  safety_level: string;
  lifecycle_status: string;
  meme_contents: { availability?: string | null; moderation_status?: string | null }[];
  meme_sources: { source_url?: string | null }[];
  meme_tags_map: { tag_id?: string | null; tags?: { name: string } | null }[];
  meme_translations: MemeTranslationRow[] | null;
};

const PLUS_OUTCOME_HISTORY_SELECT =
  "id, meme_id, completion_date, title_snapshot, channel, locale, artifact_kind, mode, performance_note, performance_rating, result_url, memes(id, short_id, slug, title, summary, description, origin, usage_note, caution, aliases, updated_at, moderation_status, safety_level, lifecycle_status, usage_examples, meme_contents(availability, moderation_status), meme_sources(source_url), meme_tags_map(tag_id, tags(name)), meme_translations(meme_id,locale,status,localized_slug,title,summary,description,origin,usage_note,caution,aliases,usage_examples,source_updated_at,provider,model,prompt_version,translated_at,reviewed_at,reviewed_by,created_at,updated_at))";

type PlusOutcomeHistoryLink = {
  href: string | null;
  linkStatus: PlusOutcomeHistoryLinkStatus;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isHistoryTranslationRow(value: unknown): value is MemeTranslationRow {
  if (!isRecord(value)) return false;
  return (
    typeof value.meme_id === "string" &&
    isLocale(typeof value.locale === "string" ? value.locale : null) &&
    (value.status === "machine" || value.status === "reviewed" || value.status === "stale") &&
    typeof value.localized_slug === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    typeof value.origin === "string" &&
    isNullableString(value.usage_note) &&
    isNullableString(value.caution) &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string") &&
    typeof value.source_updated_at === "string" &&
    typeof value.provider === "string" &&
    typeof value.model === "string" &&
    typeof value.prompt_version === "number" &&
    Number.isInteger(value.prompt_version) &&
    typeof value.translated_at === "string" &&
    isNullableString(value.reviewed_at) &&
    isNullableString(value.reviewed_by) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function isHistoryMemeRow(value: unknown): value is PlusOutcomeHistoryMemeRow {
  if (!isRecord(value)) return false;
  const contentRows = value.meme_contents;
  const sourceRows = value.meme_sources;
  const tagRows = value.meme_tags_map;
  const translationRows = value.meme_translations;
  return (
    typeof value.id === "string" &&
    typeof value.short_id === "string" &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.description === "string" &&
    typeof value.origin === "string" &&
    isNullableString(value.usage_note) &&
    isNullableString(value.caution) &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string") &&
    typeof value.updated_at === "string" &&
    typeof value.moderation_status === "string" &&
    Array.isArray(contentRows) &&
    contentRows.every(
      (content) =>
        isRecord(content) &&
        isNullableString(content.availability) &&
        isNullableString(content.moderation_status),
    ) &&
    Array.isArray(sourceRows) &&
    sourceRows.every((source) => isRecord(source) && isNullableString(source.source_url)) &&
    Array.isArray(tagRows) &&
    tagRows.every(
      (tag) =>
        isRecord(tag) &&
        typeof tag.tag_id === "string" &&
        (tag.tags === null ||
          (isRecord(tag.tags) && typeof tag.tags.name === "string")),
    ) &&
    (translationRows === null ||
      (Array.isArray(translationRows) && translationRows.every(isHistoryTranslationRow)))
  );
}

function isPublicMemeStatus(value: string): boolean {
  return value === "approved" || value === "limited";
}

function hasReviewedAudit(translation: MemeTranslationRow): boolean {
  return (
    translation.status === "reviewed" &&
    typeof translation.reviewed_at === "string" &&
    translation.reviewed_at.trim().length > 0 &&
    typeof translation.reviewed_by === "string" &&
    translation.reviewed_by.trim().length > 0
  );
}

function resolvePlusOutcomeHistoryLink(row: PlusOutcomeHistoryReceiptRow): PlusOutcomeHistoryLink {
  const meme = row.memes;
  if (
    !isHistoryMemeRow(meme) ||
    !isPublicMemeStatus(meme.moderation_status) ||
    !isIndexableMeme(meme)
  ) {
    return { href: null, linkStatus: "unavailable" };
  }

  const koreanHref = memePathFrom(meme.short_id, meme.slug);
  if (row.locale === "ko") {
    return { href: koreanHref, linkStatus: "korean-fallback" };
  }
  if (!isPlusOutcomeLocale(row.locale)) {
    return { href: null, linkStatus: "unavailable" };
  }
  if (!Array.isArray(meme.meme_translations)) {
    return { href: null, linkStatus: "unavailable" };
  }

  const translation = meme.meme_translations.find(
    (candidate) => candidate.locale === row.locale && candidate.status === "reviewed",
  );
  if (!translation) {
    return { href: koreanHref, linkStatus: "korean-fallback" };
  }
  if (!hasReviewedAudit(translation)) {
    return { href: koreanHref, linkStatus: "korean-fallback" };
  }

  const localized = overlayMemeTranslation(meme, translation, row.locale);
  if (!localized || !isIndexableLocalizedMeme(localized)) {
    return { href: koreanHref, linkStatus: "korean-fallback" };
  }
  return {
    href: localizedMemePath(row.locale, localized.short_id, localized.slug),
    linkStatus: "localized",
  };
}

function buildPlusOutcomeReplayActionItem(
  row: PlusOutcomeHistoryReceiptRow,
  locale: Locale,
): PlusGlobalActionInboxItem | null {
  const meme = row.memes;
  if (
    row.locale !== locale ||
    row.performance_rating !== "hit" ||
    !isPlusOutcomeChannel(row.channel) ||
    !isHistoryMemeRow(meme) ||
    !isPublicMemeStatus(meme.moderation_status) ||
    !isIndexableMeme(meme) ||
    (meme.safety_level !== "green" && meme.safety_level !== "yellow") ||
    (meme.lifecycle_status !== "rising" && meme.lifecycle_status !== "active")
  ) {
    return null;
  }

  const link = resolvePlusOutcomeHistoryLink(row);
  if (
    !link.href ||
    (locale !== "ko" && link.linkStatus !== "localized") ||
    (locale === "ko" && link.linkStatus !== "korean-fallback")
  ) {
    return null;
  }

  const content =
    locale === "ko"
      ? meme
      : overlayMemeTranslation(
          meme,
          meme.meme_translations?.find(
            (translation) => translation.locale === locale && translation.status === "reviewed",
          ),
          locale,
        );
  if (!content) return null;

  return {
    id: `outcome-replay:${meme.short_id}`,
    memeId: meme.id,
    shortId: meme.short_id,
    slug: content.slug,
    title: content.title,
    summary: content.summary,
    locale,
    href: link.href,
    shareText: [content.title.trim(), content.summary.trim(), link.href].filter(Boolean).join("\n\n"),
    kind: "outcome_replay",
    changedAt: meme.updated_at,
    trendScore: 0,
    preferredOutcomeChannel: row.channel,
    creatorPackFacts: {
      title: content.title,
      summary: content.summary,
      usageNote: content.usage_note,
      caution: content.caution,
      safetyLevel: meme.safety_level,
      lifecycleStatus: meme.lifecycle_status,
      usageExamples: parseUsageExamples(content.usage_examples),
    },
  };
}

export type PlusOutcomeRatings = {
  status: "locked" | "empty" | "ready" | "unavailable";
  rows: PlusOutcomeRatingRow[];
};

function createPlusOutcomeRatingsFallback(
  status: "locked" | "unavailable",
): PlusOutcomeRatings {
  return { status, rows: [] };
}

export function plusOutcomeHistoryDateWindow(now = new Date()): { from: string; to: string } {
  return plusNextMoveDateWindow(now, PLUS_OUTCOME_HISTORY_WINDOW_DAYS);
}

function isMissingPerformanceRatingColumn(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const text = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return (
    /performance_rating/i.test(text) &&
    (code === "42703" ||
      /(?:column|schema cache).*performance_rating|performance_rating.*(?:column|schema cache)/i.test(text))
  );
}

export async function loadPlusOutcomeSummary({
  supabase,
  isPremium,
}: {
  supabase: PlusOutcomeLedgerSupabase;
  isPremium: boolean;
}): Promise<PlusOutcomeSummary> {
  if (!isPremium) {
    return createPlusOutcomeFallback("locked");
  }

  const { data, error } = await supabase.rpc("get_plus_meme_use_outcome_summary");
  if (error) {
    return createPlusOutcomeFallback("unavailable");
  }

  return parsePlusOutcomeSummary(data) ?? createPlusOutcomeFallback("unavailable");
}

export async function loadPlusOutcomeFollowUps({
  supabase,
  isPremium,
  fromDate,
  toDate,
}: {
  supabase: PlusOutcomeLedgerSupabase;
  isPremium: boolean;
  fromDate: string;
  toDate: string;
}): Promise<PlusOutcomeFollowUps> {
  if (!isPremium) {
    return createPlusOutcomeFollowUpFallback("locked");
  }

  const { data, error } = await supabase
    .from("plus_meme_use_receipts")
    .select(
      "id, meme_id, completion_date, title_snapshot, channel, locale, artifact_kind, mode, performance_note, performance_rating",
    )
    .gte("completion_date", fromDate)
    .lte("completion_date", toDate)
    .order("completion_date", { ascending: false })
    .limit(30);
  if (!error) {
    return buildPlusOutcomeFollowUps(parsePlusOutcomeFollowUpRows(data));
  }
  if (!isMissingPerformanceRatingColumn(error)) {
    return createPlusOutcomeFollowUpFallback("unavailable");
  }

  const legacy = await supabase
    .from("plus_meme_use_receipts")
    .select("id, meme_id, completion_date, title_snapshot, channel, locale, artifact_kind, mode, performance_note")
    .gte("completion_date", fromDate)
    .lte("completion_date", toDate)
    .order("completion_date", { ascending: false })
    .limit(30);
  if (legacy.error) {
    return createPlusOutcomeFollowUpFallback("unavailable");
  }

  return buildPlusOutcomeFollowUps(
    parsePlusOutcomeFollowUpRows(
      (legacy.data ?? []).map((row) => ({ ...row, performance_rating: null })),
    ),
  );
}

export async function loadPlusOutcomeHistory({
  supabase,
  isPremium,
  fromDate,
  toDate,
}: {
  supabase: PlusOutcomeLedgerSupabase;
  isPremium: boolean;
  fromDate: string;
  toDate: string;
}): Promise<PlusOutcomeHistory> {
  if (!isPremium) {
    return createPlusOutcomeHistoryFallback("locked");
  }

  const query = supabase
    .from("plus_meme_use_receipts")
    .select(PLUS_OUTCOME_HISTORY_SELECT)
    .gte("completion_date", fromDate)
    .lte("completion_date", toDate)
    .order("completion_date", { ascending: false })
    .order("id", { ascending: true })
    .limit(PLUS_OUTCOME_HISTORY_LIMIT);
  const { data, error } = await query.overrideTypes<
    PlusOutcomeHistoryReceiptRow[],
    { merge: false }
  >();
  if (error) {
    return createPlusOutcomeHistoryFallback("unavailable");
  }
  if (!Array.isArray(data)) {
    return createPlusOutcomeHistoryFallback("unavailable");
  }
  const safeData = data.filter((row) => isPlusOutcomeResultUrlSafe(row.result_url));
  const rows = safeData.map((row) => {
    const link = resolvePlusOutcomeHistoryLink(row);
    const replayItem = buildPlusOutcomeReplayActionItem(row, row.locale as Locale);
    return {
      ...row,
      href: link.href,
      link_status: link.linkStatus,
      replay_short_id: replayItem?.shortId ?? null,
    };
  });
  const parsed = parsePlusOutcomeHistoryRows(rows);
  return parsed.length === safeData.length
    ? buildPlusOutcomeHistory(parsed)
    : createPlusOutcomeHistoryFallback("unavailable");
}

export async function loadPlusOutcomeReplayItem({
  supabase,
  isPremium,
  fromDate,
  toDate,
  shortId,
  locale,
}: {
  supabase: PlusOutcomeLedgerSupabase;
  isPremium: boolean;
  fromDate: string;
  toDate: string;
  shortId: string;
  locale: Locale;
}): Promise<PlusGlobalActionInboxItem | null> {
  if (!isPremium || !shortId.trim()) return null;

  const query = supabase
    .from("plus_meme_use_receipts")
    .select(PLUS_OUTCOME_HISTORY_SELECT)
    .gte("completion_date", fromDate)
    .lte("completion_date", toDate)
    .order("completion_date", { ascending: false })
    .order("id", { ascending: true })
    .limit(PLUS_OUTCOME_HISTORY_LIMIT);
  const { data, error } = await query.overrideTypes<
    PlusOutcomeHistoryReceiptRow[],
    { merge: false }
  >();
  if (error || !Array.isArray(data)) return null;

  const row = data.find(
    (candidate) =>
      candidate.memes?.short_id === shortId &&
      candidate.locale === locale &&
      candidate.performance_rating === "hit",
  );
  return row ? buildPlusOutcomeReplayActionItem(row, locale) : null;
}

export async function loadPlusOutcomeRatings({
  supabase,
  isPremium,
  fromDate,
  toDate,
}: {
  supabase: PlusOutcomeLedgerSupabase;
  isPremium: boolean;
  fromDate: string;
  toDate: string;
}): Promise<PlusOutcomeRatings> {
  if (!isPremium) {
    return createPlusOutcomeRatingsFallback("locked");
  }

  const { data, error } = await supabase
    .from("plus_meme_use_receipts")
    .select("meme_id, completion_date, channel, performance_rating")
    .gte("completion_date", fromDate)
    .lte("completion_date", toDate)
    .not("performance_rating", "is", null)
    .order("completion_date", { ascending: false })
    .limit(50);
  if (error) {
    return createPlusOutcomeRatingsFallback("unavailable");
  }

  const rows = parsePlusOutcomeRatingRows(data);
  return { status: rows.length > 0 ? "ready" : "empty", rows };
}
