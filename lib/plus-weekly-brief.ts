import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";
import { isIndexableMeme } from "@/lib/content-depth";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { PlusLocalizedFeedSource } from "@/lib/plus-localized-feed";

export const PLUS_WEEKLY_BRIEF_ITEM_LIMIT = 5;

type CurrentLifecycle = Extract<LifecycleStatus, "rising" | "active">;

export type PlusWeeklyBriefCandidate = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  source: "saved" | "interest";
};

export type PlusWeeklyBriefSource = PlusLocalizedFeedSource & {
  moderation_status: string;
  source: "saved" | "interest";
};

export type PlusWeeklyBriefTranslation = {
  meme_id: string;
  locale: string;
  status: string;
  localized_slug: string | null;
  title: string;
  summary: string;
  description: string;
  origin: string;
  source_updated_at: string;
};

export type PlusWeeklyBriefCandidateProjection = {
  state: "active" | "empty-source" | "empty-coverage";
  candidates: PlusWeeklyBriefCandidate[];
};

export type PlusWeeklyBriefCoverageState =
  | "active"
  | "empty-source"
  | "empty-coverage"
  | "unavailable";

export function resolvePlusWeeklyBriefCoverageState({
  locale,
  sourceError,
  localizedSourceError = false,
  translationError = false,
  projectionState = "active",
}: {
  locale: SeoRouteLocale;
  sourceError: boolean;
  localizedSourceError?: boolean;
  translationError?: boolean;
  projectionState?: PlusWeeklyBriefCandidateProjection["state"];
}): PlusWeeklyBriefCoverageState {
  if (sourceError || localizedSourceError || translationError) return "unavailable";
  return locale === "ko" ? "active" : projectionState;
}

export function buildPlusWeeklyBriefCandidates({
  locale,
  sources,
  translations,
}: {
  locale: SeoRouteLocale;
  sources: readonly PlusWeeklyBriefSource[];
  translations: readonly PlusWeeklyBriefTranslation[];
}): PlusWeeklyBriefCandidateProjection {
  if (sources.length === 0) {
    return { state: "empty-source", candidates: [] };
  }

  if (locale === "ko") {
    return {
      state: "active",
      candidates: sources.map((source) => toCandidate(source)),
    };
  }

  const candidates = sources.flatMap((source) => {
    if (
      source.moderation_status !== "approved" &&
      source.moderation_status !== "limited"
    ) {
      return [];
    }
    if (!isIndexableMeme(source)) return [];

    const translation = translations.find(
      (row) =>
        row.meme_id === source.id &&
        row.locale === locale &&
        row.status === "reviewed" &&
        isCurrent(row.source_updated_at, source.updated_at) &&
        hasRequiredTranslationFields(row),
    );
    const localizedSlug = translation?.localized_slug?.trim();
    if (!translation || !localizedSlug) return [];

    return [
      toCandidate(source, {
        slug: localizedSlug,
        title: translation.title,
        summary: translation.summary,
      }),
    ];
  });

  return {
    state: candidates.length > 0 ? "active" : "empty-coverage",
    candidates,
  };
}

function toCandidate(
  source: PlusWeeklyBriefSource,
  localized?: Pick<PlusWeeklyBriefCandidate, "slug" | "title" | "summary">,
): PlusWeeklyBriefCandidate {
  return {
    id: source.id,
    shortId: source.short_id,
    slug: localized?.slug ?? source.slug,
    title: localized?.title ?? source.title,
    summary: localized?.summary ?? source.summary,
    safetyLevel: source.safety_level as SafetyLevel,
    lifecycleStatus: source.lifecycle_status as LifecycleStatus,
    source: source.source,
  };
}

function hasRequiredTranslationFields(
  translation: Pick<
    PlusWeeklyBriefTranslation,
    "localized_slug" | "title" | "summary" | "description" | "origin"
  >,
): boolean {
  return [
    translation.localized_slug,
    translation.title,
    translation.summary,
    translation.description,
    translation.origin,
  ].every((value) => typeof value === "string" && value.trim().length > 0);
}

function isCurrent(sourceUpdatedAt: string, sourceUpdatedAtOnMeme: string): boolean {
  const translatedAt = Date.parse(sourceUpdatedAt);
  const currentAt = Date.parse(sourceUpdatedAtOnMeme);
  return Number.isFinite(translatedAt) && Number.isFinite(currentAt) && translatedAt === currentAt;
}

export type PlusWeeklyBriefMetric = {
  meme_id: string;
  date: string;
  trend_score: number;
};

export type PlusWeeklyBriefItem = {
  memeId: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  source: "saved" | "interest";
  startTrendScore: number;
  endTrendScore: number;
  delta: number;
  lifecycleStatus: CurrentLifecycle;
};

export type PlusWeeklyDeltaBrief = {
  briefId: string;
  window: { from: string; to: string; timezone: "Asia/Seoul" };
  scannedCount: number;
  items: PlusWeeklyBriefItem[];
  emptyReason:
    | "no_candidates"
    | "coverage_empty"
    | "insufficient_history"
    | "no_change"
    | "unavailable"
    | null;
};

export type PlusWeeklyDeltaBriefInput = {
  candidates: readonly PlusWeeklyBriefCandidate[];
  metrics: readonly PlusWeeklyBriefMetric[];
  excludedIds?: ReadonlySet<string>;
  from: string;
  to: string;
};

function isEligibleCandidate(
  candidate: PlusWeeklyBriefCandidate,
  excludedIds: ReadonlySet<string>,
): candidate is PlusWeeklyBriefCandidate & { lifecycleStatus: CurrentLifecycle } {
  return (
    candidate.safetyLevel === "green" &&
    (candidate.lifecycleStatus === "rising" || candidate.lifecycleStatus === "active") &&
    !excludedIds.has(candidate.id)
  );
}

export function buildPlusWeeklyDeltaBrief({
  candidates,
  metrics,
  excludedIds = new Set(),
  from,
  to,
}: PlusWeeklyDeltaBriefInput): PlusWeeklyDeltaBrief {
  const eligible = candidates.filter((candidate) =>
    isEligibleCandidate(candidate, excludedIds),
  );
  const metricsByMeme = new Map<string, PlusWeeklyBriefMetric[]>();

  for (const metric of metrics) {
    const current = metricsByMeme.get(metric.meme_id) ?? [];
    current.push(metric);
    metricsByMeme.set(metric.meme_id, current);
  }

  let historyCandidateCount = 0;
  const items = eligible
    .flatMap((candidate) => {
      const series = [...(metricsByMeme.get(candidate.id) ?? [])].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      if (series.length < 2) return [];
      historyCandidateCount += 1;
      const first = series[0].trend_score;
      const last = series[series.length - 1].trend_score;
      const delta = last - first;
      return [
        {
          memeId: candidate.id,
          shortId: candidate.shortId,
          slug: candidate.slug,
          title: candidate.title,
          summary: candidate.summary,
          source: candidate.source,
          startTrendScore: first,
          endTrendScore: last,
          delta,
          lifecycleStatus: candidate.lifecycleStatus,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.delta - left.delta ||
        right.endTrendScore - left.endTrendScore ||
        left.memeId.localeCompare(right.memeId),
    )
    .slice(0, PLUS_WEEKLY_BRIEF_ITEM_LIMIT);

  return {
    briefId: [from, to, ...items.map((item) => item.shortId)].join("_"),
    window: { from, to, timezone: "Asia/Seoul" },
    scannedCount: eligible.length,
    items,
    emptyReason:
      eligible.length === 0
        ? "no_candidates"
        : items.length === 0 && historyCandidateCount === 0
          ? "insufficient_history"
          : null,
  };
}

export function kstDateWindow(now = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const to = `${values.year}-${values.month}-${values.day}`;
  const fromDate = new Date(`${to}T00:00:00+09:00`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const fromParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fromDate);
  const fromValues = Object.fromEntries(
    fromParts.map(({ type, value }) => [type, value]),
  );
  return {
    from: `${fromValues.year}-${fromValues.month}-${fromValues.day}`,
    to,
  };
}
