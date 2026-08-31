import {
  isSeoContentLocale,
  localizedMemePath,
} from "@/lib/i18n-routing";
import type { Locale } from "@/lib/i18n";
import { memePathFrom } from "@/lib/labels";
import type { PlusDailySignalCandidate } from "@/lib/plus-daily-signal.server";
import type {
  PlusGlobalScoutItem,
  PlusGlobalScoutResult,
} from "@/lib/plus-global-scout";
import type {
  PlusTranslationFulfillmentItem,
  PlusTranslationFulfillmentResult,
} from "@/lib/plus-translation-fulfillment";
import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";
import type { UsageExample } from "@/lib/usage-examples";

export const PLUS_GLOBAL_ACTION_INBOX_LIMIT = 5;
export const PLUS_GLOBAL_ACTION_EVIDENCE_LIMIT = 20;

export type PlusGlobalActionKind =
  | "outcome_replay"
  | "translation_ready"
  | "saved_signal"
  | "new_reviewed";

export type PlusGlobalActionInboxStatus = "active" | "empty" | "unavailable";

export type PlusGlobalActionInboxItem = {
  id: string;
  memeId: string;
  shortId: string;
  slug?: string;
  title: string;
  summary: string;
  locale: Locale;
  href: string;
  shareText: string;
  kind: PlusGlobalActionKind;
  changedAt: string | null;
  trendScore: number;
  creatorPackFacts?: PlusGlobalActionCreatorPackFacts;
  preferredOutcomeChannel?: import("@/lib/plus-outcome-ledger").PlusOutcomeChannel;
};

export type PlusGlobalActionCreatorPackFacts = {
  title: string;
  summary: string;
  usageNote: string | null;
  caution: string | null;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  usageExamples?: UsageExample[];
};

export type PlusGlobalActionInboxCompletionStatus = "available" | "unavailable";

export type PlusGlobalActionInboxCompletion = {
  status: PlusGlobalActionInboxCompletionStatus;
  completedMemeIds: readonly string[];
  completedTodayCount: number;
  currentStreak: number;
};

export type PlusGlobalActionInboxResult = {
  status: PlusGlobalActionInboxStatus;
  items: PlusGlobalActionInboxItem[];
  unavailableLanes: PlusGlobalActionKind[];
  completion: PlusGlobalActionInboxCompletion;
};

export type PlusGlobalActionInboxInput = {
  locale: Locale;
  fulfillment: PlusTranslationFulfillmentResult;
  signals: readonly PlusDailySignalCandidate[];
  signalStatus: "available" | "unavailable";
  scout: PlusGlobalScoutResult;
  completion?: Partial<PlusGlobalActionInboxCompletion>;
  preferredMemeId?: string;
  replayItem?: PlusGlobalActionInboxItem;
  globalDailyCandidate?: PlusGlobalDailyActionCandidate;
  limit?: number;
};

export type PlusGlobalDailyActionCandidate = {
  memeId: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  locale: Locale;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  updatedAt: string;
};

type RankedAction = {
  item: PlusGlobalActionInboxItem;
  priority: number;
};

const PRIORITY: Record<PlusGlobalActionKind, number> = {
  outcome_replay: -1,
  translation_ready: 0,
  saved_signal: 1,
  new_reviewed: 2,
};

function inboxLimit(limit: number | undefined, maximum: number): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return maximum;
  }
  return Math.min(
    maximum,
    Math.max(0, Math.trunc(limit)),
  );
}

function timestamp(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionHref(locale: Locale, shortId: string, slug: string): string {
  return isSeoContentLocale(locale)
    ? localizedMemePath(locale, shortId, slug)
    : memePathFrom(shortId, slug);
}

function shareText(title: string, summary: string, href: string): string {
  return [title.trim(), summary.trim(), href].filter(Boolean).join("\n\n");
}

function creatorPackFacts({
  title,
  summary,
  usageNote,
  caution,
  safetyLevel,
  lifecycleStatus,
  usageExamples,
}: {
  title: string;
  summary: string;
  usageNote: string | null;
  caution: string | null;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  usageExamples?: UsageExample[];
}): PlusGlobalActionCreatorPackFacts {
  const base = {
    title,
    summary,
    usageNote,
    caution,
    safetyLevel,
    lifecycleStatus,
  } satisfies Omit<PlusGlobalActionCreatorPackFacts, "usageExamples">;
  return usageExamples && usageExamples.length > 0
    ? { ...base, usageExamples }
    : base;
}

function compareActions(left: RankedAction, right: RankedAction): number {
  return (
    left.priority - right.priority ||
    right.item.trendScore - left.item.trendScore ||
    timestamp(right.item.changedAt) - timestamp(left.item.changedAt) ||
    left.item.memeId.localeCompare(right.item.memeId)
  );
}

function addAction(
  actions: Map<string, RankedAction>,
  item: PlusGlobalActionInboxItem,
  priority = PRIORITY[item.kind],
): void {
  const next = { item, priority };
  const existing = actions.get(item.memeId);
  if (!existing || compareActions(next, existing) < 0) {
    actions.set(item.memeId, next);
  }
}

function addGlobalDailyCandidate(
  actions: Map<string, RankedAction>,
  candidate: PlusGlobalDailyActionCandidate | undefined,
): void {
  if (
    !candidate ||
    !candidate.memeId.trim() ||
    !candidate.shortId.trim() ||
    !candidate.slug.trim() ||
    !candidate.title.trim() ||
    !candidate.summary.trim() ||
    !candidate.updatedAt.trim() ||
    (candidate.safetyLevel !== "green" && candidate.safetyLevel !== "yellow") ||
    (candidate.lifecycleStatus !== "rising" && candidate.lifecycleStatus !== "active")
  ) {
    return;
  }

  const href = actionHref(candidate.locale, candidate.shortId, candidate.slug);
  addAction(
    actions,
    {
      id: `global_daily:${candidate.memeId}`,
      memeId: candidate.memeId,
      shortId: candidate.shortId,
      slug: candidate.slug,
      title: candidate.title,
      summary: candidate.summary,
      locale: candidate.locale,
      href,
      shareText: shareText(candidate.title, candidate.summary, href),
      kind: "new_reviewed",
      changedAt: candidate.updatedAt,
      trendScore: 0,
      creatorPackFacts: creatorPackFacts({
        title: candidate.title,
        summary: candidate.summary,
        usageNote: null,
        caution: null,
        safetyLevel: candidate.safetyLevel,
        lifecycleStatus: candidate.lifecycleStatus,
      }),
    },
    PRIORITY.outcome_replay + 0.5,
  );
}

function addReadyTranslations(
  actions: Map<string, RankedAction>,
  fulfillment: PlusTranslationFulfillmentResult,
  locale: Locale,
): void {
  const readyByMeme = new Map<string, PlusTranslationFulfillmentItem>();
  for (const item of fulfillment.items) {
    if (item.state !== "ready") continue;
    const existing = readyByMeme.get(item.memeId);
    if (!existing || compareTranslationItems(item, existing, locale) < 0) {
      readyByMeme.set(item.memeId, item);
    }
  }
  for (const item of readyByMeme.values()) {
    addAction(actions, translationAction(item));
  }
}

function compareTranslationItems(
  left: PlusTranslationFulfillmentItem,
  right: PlusTranslationFulfillmentItem,
  preferredLocale: Locale,
): number {
  return (
    Number(left.locale !== preferredLocale) - Number(right.locale !== preferredLocale) ||
    timestamp(right.changedAt) - timestamp(left.changedAt) ||
    left.requestId.localeCompare(right.requestId) ||
    left.locale.localeCompare(right.locale)
  );
}

function translationAction(
  item: PlusTranslationFulfillmentItem,
): PlusGlobalActionInboxItem {
  return {
    id: `translation:${item.requestId}`,
    memeId: item.memeId,
    shortId: item.shortId,
    title: item.title,
    slug: item.slug,
    summary: item.summary ?? "",
    locale: item.locale,
    href: actionHref(item.locale, item.shortId, item.slug),
    shareText: shareText(item.title, item.summary ?? "", actionHref(item.locale, item.shortId, item.slug)),
    kind: "translation_ready",
    changedAt: item.changedAt,
    trendScore: 0,
    creatorPackFacts:
      item.summary && item.safetyLevel && item.lifecycleStatus
        ? creatorPackFacts({
            title: item.title,
            summary: item.summary,
            usageNote: item.usageNote ?? null,
            caution: item.caution ?? null,
            safetyLevel: item.safetyLevel,
            lifecycleStatus: item.lifecycleStatus,
            usageExamples: item.usageExamples,
          })
        : undefined,
  };
}

function addSignals(
  actions: Map<string, RankedAction>,
  locale: Locale,
  signals: readonly PlusDailySignalCandidate[],
): void {
  for (const signal of signals) {
    if (!signal.shareReady) continue;
    addAction(actions, {
      id: `signal:${signal.id}`,
      memeId: signal.id,
      shortId: signal.shortId,
      slug: signal.slug,
      title: signal.title,
      summary: signal.summary,
      locale,
      href: actionHref(locale, signal.shortId, signal.slug),
      shareText: shareText(
        signal.title,
        signal.summary,
        actionHref(locale, signal.shortId, signal.slug),
      ),
      kind: signal.source === "saved_rising" ? "saved_signal" : "new_reviewed",
      changedAt: null,
      trendScore: signal.trendScore,
      creatorPackFacts: {
        ...creatorPackFacts({
          title: signal.title,
          summary: signal.summary,
          usageNote: signal.usageNote,
          caution: signal.caution,
          safetyLevel: signal.safetyLevel,
          lifecycleStatus: "rising",
          usageExamples: signal.usageExamples,
        }),
      },
    });
  }
}

function addScout(
  actions: Map<string, RankedAction>,
  scout: PlusGlobalScoutResult,
): void {
  for (const item of scout.items) {
    addAction(actions, scoutAction(item));
  }
}

function scoutAction(item: PlusGlobalScoutItem): PlusGlobalActionInboxItem {
  return {
    id: `scout:${item.id}`,
    memeId: item.id,
    shortId: item.shortId,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    locale: item.locale,
    href: actionHref(item.locale, item.shortId, item.slug),
    shareText: shareText(
      item.title,
      item.summary,
      actionHref(item.locale, item.shortId, item.slug),
    ),
    kind: "new_reviewed",
    changedAt: item.sourceUpdatedAt,
    trendScore: item.trendScore,
    creatorPackFacts: creatorPackFacts({
      title: item.title,
      summary: item.summary,
      usageNote: item.usageNote,
      caution: item.caution,
      safetyLevel: item.safetyLevel,
      lifecycleStatus: item.lifecycleStatus,
      usageExamples: item.usageExamples,
    }),
  };
}

function buildPlusGlobalActionInboxWithMaximum({
  locale,
  fulfillment,
  signals,
  signalStatus,
  scout,
  completion,
  preferredMemeId,
  replayItem,
  globalDailyCandidate,
  limit,
}: PlusGlobalActionInboxInput, maximum: number): PlusGlobalActionInboxResult {
  const actions = new Map<string, RankedAction>();
  addReadyTranslations(actions, fulfillment, locale);
  addSignals(actions, locale, signals);
  addScout(actions, scout);
  addGlobalDailyCandidate(actions, globalDailyCandidate);
  if (replayItem) addAction(actions, replayItem);

  const unavailableLanes: PlusGlobalActionKind[] = [];
  if (fulfillment.status === "unavailable") {
    unavailableLanes.push("translation_ready");
  }
  if (signalStatus === "unavailable") unavailableLanes.push("saved_signal");
  if (scout.status === "unavailable") unavailableLanes.push("new_reviewed");

  const completedMemeIds = completion?.completedMemeIds ?? [];
  const completedSet = new Set(completedMemeIds);
  const completedTodayCount = Number.isInteger(completion?.completedTodayCount)
    ? Math.max(0, completion?.completedTodayCount ?? 0)
    : 0;
  const currentStreak = Number.isInteger(completion?.currentStreak)
    ? Math.max(0, completion?.currentStreak ?? 0)
    : 0;
  const completionStatus = completion?.status === "unavailable" ? "unavailable" : "available";

  const preferred = preferredMemeId?.trim() || null;
  const items = [...actions.values()]
    .sort((left, right) => {
      const leftIsPreferred = preferred !== null && left.item.memeId === preferred;
      const rightIsPreferred = preferred !== null && right.item.memeId === preferred;
      return Number(rightIsPreferred) - Number(leftIsPreferred) || compareActions(left, right);
    })
    .filter(
      ({ item }) =>
        !completedSet.has(item.memeId) &&
        !(item.kind === "outcome_replay" && completionStatus === "unavailable"),
    )
    .slice(0, inboxLimit(limit, maximum))
    .map(({ item }) => item);

  return {
    status:
      items.length > 0
        ? "active"
        : unavailableLanes.length > 0
          ? "unavailable"
        : "empty",
    items,
    unavailableLanes,
    completion: {
      status: completionStatus,
      completedMemeIds,
      completedTodayCount,
      currentStreak,
    },
  };
}

export function buildPlusGlobalActionInbox(
  input: PlusGlobalActionInboxInput,
): PlusGlobalActionInboxResult {
  return buildPlusGlobalActionInboxWithMaximum(input, PLUS_GLOBAL_ACTION_INBOX_LIMIT);
}

export function buildPlusGlobalActionEvidenceInbox(
  input: PlusGlobalActionInboxInput,
): PlusGlobalActionInboxResult {
  return buildPlusGlobalActionInboxWithMaximum(input, PLUS_GLOBAL_ACTION_EVIDENCE_LIMIT);
}

export function buildTrustedPlusGlobalActionInbox({
  input,
  trustedMemeIds,
}: {
  input: PlusGlobalActionInboxInput;
  trustedMemeIds: readonly string[] | null;
}): PlusGlobalActionInboxResult {
  if (trustedMemeIds === null) {
    return buildPlusGlobalActionInbox({
      ...input,
      fulfillment: { status: "unavailable", items: [] },
      signals: [],
      signalStatus: "unavailable",
      scout: { status: "unavailable", dateKey: input.scout.dateKey, items: [] },
      preferredMemeId: undefined,
      replayItem: undefined,
      globalDailyCandidate: undefined,
    });
  }

  const trusted = new Set(trustedMemeIds);
  return buildPlusGlobalActionInbox({
    ...input,
    fulfillment: {
      ...input.fulfillment,
      items: input.fulfillment.items.filter((item) => trusted.has(item.memeId)),
    },
    signals: input.signals.filter((item) => trusted.has(item.id)),
    scout: {
      ...input.scout,
      items: input.scout.items.filter((item) => trusted.has(item.id)),
    },
    preferredMemeId:
      input.preferredMemeId && trusted.has(input.preferredMemeId)
        ? input.preferredMemeId
        : undefined,
    replayItem:
      input.replayItem && trusted.has(input.replayItem.memeId)
        ? input.replayItem
        : undefined,
    globalDailyCandidate:
      input.globalDailyCandidate && trusted.has(input.globalDailyCandidate.memeId)
        ? input.globalDailyCandidate
        : undefined,
  });
}
