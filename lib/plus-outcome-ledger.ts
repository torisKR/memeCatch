import { buildPlusOutcomeReplayPath } from "@/lib/plus-outcome-replay-routing";

export const PLUS_OUTCOME_LOCALES = ["ko", "en", "ja", "zh", "zh-tw"] as const;
export const PLUS_OUTCOME_CHANNELS = [
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "x",
  "community",
  "messaging",
  "blog",
  "other",
] as const;
export const PLUS_OUTCOME_ARTIFACT_KINDS = [
  "caption",
  "single_card",
  "creator_pack",
  "link",
  "other",
] as const;
export const PLUS_OUTCOME_RATINGS = ["hit", "neutral", "miss"] as const;
export const PLUS_OUTCOME_MODES = ["bulk", "one_cut"] as const;

export type PlusOutcomeLocale = (typeof PLUS_OUTCOME_LOCALES)[number];
export type PlusOutcomeChannel = (typeof PLUS_OUTCOME_CHANNELS)[number];
export type PlusOutcomeArtifactKind = (typeof PLUS_OUTCOME_ARTIFACT_KINDS)[number];
export type PlusOutcomeRating = (typeof PLUS_OUTCOME_RATINGS)[number];
export type PlusOutcomeMode = (typeof PLUS_OUTCOME_MODES)[number];
export type PlusOutcomeSummaryStatus = "locked" | "empty" | "ready" | "unavailable";

const localeSet = new Set<string>(PLUS_OUTCOME_LOCALES);
const channelSet = new Set<string>(PLUS_OUTCOME_CHANNELS);
const artifactKindSet = new Set<string>(PLUS_OUTCOME_ARTIFACT_KINDS);
const ratingSet = new Set<string>(PLUS_OUTCOME_RATINGS);
const modeSet = new Set<string>(PLUS_OUTCOME_MODES);

export function isPlusOutcomeLocale(value: unknown): value is PlusOutcomeLocale {
  return typeof value === "string" && localeSet.has(value);
}

export function isPlusOutcomeChannel(value: unknown): value is PlusOutcomeChannel {
  return typeof value === "string" && channelSet.has(value);
}

export function isPlusOutcomeArtifactKind(value: unknown): value is PlusOutcomeArtifactKind {
  return typeof value === "string" && artifactKindSet.has(value);
}

export function isPlusOutcomeRating(value: unknown): value is PlusOutcomeRating {
  return typeof value === "string" && ratingSet.has(value);
}

export function isPlusOutcomeMode(value: unknown): value is PlusOutcomeMode {
  return typeof value === "string" && modeSet.has(value);
}

export type PlusOutcomeBreakdown<Key extends string> = {
  key: Key;
  count: number;
};

type PlusOutcomeSummaryMetrics = {
  timezone: "Asia/Seoul";
  totalReceipts: number;
  totalCompletions: number;
  pendingReceiptCount: number;
  awaitingPerformanceCount: number;
  byChannel: PlusOutcomeBreakdown<PlusOutcomeChannel>[];
  byLocale: PlusOutcomeBreakdown<PlusOutcomeLocale>[];
  byArtifactKind: PlusOutcomeBreakdown<PlusOutcomeArtifactKind>[];
};

export type PlusOutcomeAvailableSummary = PlusOutcomeSummaryMetrics & {
  status: "empty" | "ready";
  fromDate: string;
  toDate: string;
};

export type PlusOutcomeUnavailableSummary = PlusOutcomeSummaryMetrics & {
  status: "locked" | "unavailable";
  fromDate: null;
  toDate: null;
};

export type PlusOutcomeSummary = PlusOutcomeAvailableSummary | PlusOutcomeUnavailableSummary;

export type PlusOutcomeFollowUpStatus = "locked" | "empty" | "ready" | "unavailable";

export type PlusOutcomeFollowUpItem = {
  receiptId: string;
  memeId: string;
  completionDate: string;
  title: string;
  channel: PlusOutcomeChannel;
  locale: PlusOutcomeLocale;
  artifactKind: PlusOutcomeArtifactKind;
  mode?: PlusOutcomeMode;
  performanceNote: string | null;
  performanceRating: PlusOutcomeRating | null;
};

export type PlusOutcomeFollowUps = {
  status: PlusOutcomeFollowUpStatus;
  items: PlusOutcomeFollowUpItem[];
  pendingCount: number;
};

export const PLUS_OUTCOME_HISTORY_LIMIT = 50;
export const PLUS_OUTCOME_HISTORY_WINDOW_DAYS = 30;

export type PlusOutcomeHistoryStatus = "locked" | "empty" | "ready" | "unavailable";

export type PlusOutcomeHistoryLinkStatus =
  | "localized"
  | "korean-fallback"
  | "unavailable";

const historyLinkStatusSet = new Set<PlusOutcomeHistoryLinkStatus>([
  "localized",
  "korean-fallback",
  "unavailable",
]);

export function isPlusOutcomeHistoryLinkStatus(
  value: unknown,
): value is PlusOutcomeHistoryLinkStatus {
  return typeof value === "string" && historyLinkStatusSet.has(value as PlusOutcomeHistoryLinkStatus);
}

export type PlusOutcomeHistoryItem = Omit<
  PlusOutcomeFollowUpItem,
  "performanceNote" | "receiptId" | "memeId"
> & {
  receiptId: string;
  hasPerformanceNote: boolean;
  href: string | null;
  linkStatus: PlusOutcomeHistoryLinkStatus;
  resultUrl?: string;
  replayShortId?: string;
};

type PlusOutcomeHistoryLedgerItem = PlusOutcomeHistoryItem &
  Pick<PlusOutcomeFollowUpItem, "receiptId" | "memeId">;

export type PlusOutcomeHistory = {
  status: PlusOutcomeHistoryStatus;
  items: PlusOutcomeHistoryItem[];
  pendingCount: number;
};

export type PlusOutcomeWinningReplay = {
  title: string;
  completionDate: string;
  channel: PlusOutcomeChannel;
  locale: PlusOutcomeLocale;
  artifactKind: PlusOutcomeArtifactKind;
  href: string;
};

export type PlusOutcomeReplayCompletion = {
  status: "available" | "unavailable";
  completedMemeIds: readonly string[];
  completedTodayCount: number;
};

export function buildPlusOutcomeWinningReplay(
  summary: PlusOutcomeSummary,
  history: PlusOutcomeHistory,
  completion: PlusOutcomeReplayCompletion,
): PlusOutcomeWinningReplay | null {
  if (
    summary.status !== "ready" ||
    history.status !== "ready" ||
    completion.status === "unavailable" ||
    completion.completedTodayCount > 0 ||
    completion.completedMemeIds.length > 0
  ) {
    return null;
  }

  const candidate = [...history.items]
    .filter(
      (item) =>
        item.completionDate >= summary.fromDate &&
        item.completionDate <= summary.toDate &&
        item.performanceRating === "hit" &&
        Boolean(item.replayShortId) &&
        (item.linkStatus === "localized" ||
          (item.linkStatus === "korean-fallback" && item.locale === "ko")),
    )
    .sort((left, right) => right.completionDate.localeCompare(left.completionDate))[0];
  if (!candidate?.replayShortId) return null;

  const href = buildPlusOutcomeReplayPath(candidate.replayShortId, candidate.locale);
  if (!href) return null;

  return {
    title: candidate.title,
    completionDate: candidate.completionDate,
    channel: candidate.channel,
    locale: candidate.locale,
    artifactKind: candidate.artifactKind,
    href,
  };
}

export type PlusOutcomeRatingRow = {
  memeId: string;
  completionDate: string;
  channel: PlusOutcomeChannel;
  rating: PlusOutcomeRating;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function parseResultUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? normalized : undefined;
  } catch {
    return undefined;
  }
}

export function isPlusOutcomeResultUrlSafe(value: unknown): boolean {
  return parseResultUrl(value) !== undefined;
}

function parseBreakdown<Key extends string>(
  value: unknown,
  isKey: (candidate: unknown) => candidate is Key,
): PlusOutcomeBreakdown<Key>[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const seen = new Set<Key>();
  const parsed: PlusOutcomeBreakdown<Key>[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isKey(item.key)) {
      return null;
    }
    const count = nonNegativeInteger(item.count);
    if (count === null || count === 0 || seen.has(item.key)) {
      return null;
    }
    seen.add(item.key);
    parsed.push({ key: item.key, count });
  }
  return parsed;
}

function totalBreakdown<Key extends string>(items: PlusOutcomeBreakdown<Key>[]): number {
  return items.reduce((total, item) => total + item.count, 0);
}

export function createPlusOutcomeFallback(
  status: "locked" | "unavailable",
): PlusOutcomeUnavailableSummary {
  return {
    status,
    fromDate: null,
    toDate: null,
    timezone: "Asia/Seoul",
    totalReceipts: 0,
    totalCompletions: 0,
    pendingReceiptCount: 0,
    awaitingPerformanceCount: 0,
    byChannel: [],
    byLocale: [],
    byArtifactKind: [],
  };
}

export function parsePlusOutcomeSummary(value: unknown): PlusOutcomeAvailableSummary | null {
  if (!isRecord(value) || (value.status !== "empty" && value.status !== "ready")) {
    return null;
  }

  const fromDate = parseDate(value.from_date);
  const toDate = parseDate(value.to_date);
  const totalReceipts = nonNegativeInteger(value.total_receipts);
  const totalCompletions = nonNegativeInteger(value.total_completions);
  const pendingReceiptCount = nonNegativeInteger(value.pending_receipt_count);
  const awaitingPerformanceCount = nonNegativeInteger(value.awaiting_performance_count);
  const byChannel = parseBreakdown(value.by_channel, isPlusOutcomeChannel);
  const byLocale = parseBreakdown(value.by_locale, isPlusOutcomeLocale);
  const byArtifactKind = parseBreakdown(value.by_artifact_kind, isPlusOutcomeArtifactKind);

  if (
    !fromDate ||
    !toDate ||
    value.timezone !== "Asia/Seoul" ||
    totalReceipts === null ||
    totalCompletions === null ||
    pendingReceiptCount === null ||
    awaitingPerformanceCount === null ||
    !byChannel ||
    !byLocale ||
    !byArtifactKind
  ) {
    return null;
  }

  const windowDays = (Date.parse(`${toDate}T00:00:00.000Z`) - Date.parse(`${fromDate}T00:00:00.000Z`)) / 86_400_000;
  const expectedStatus = totalReceipts === 0 && totalCompletions === 0 ? "empty" : "ready";
  if (
    windowDays !== 6 ||
    value.status !== expectedStatus ||
    totalReceipts > totalCompletions ||
    pendingReceiptCount !== totalCompletions - totalReceipts ||
    awaitingPerformanceCount > totalReceipts ||
    totalBreakdown(byChannel) !== totalReceipts ||
    totalBreakdown(byLocale) !== totalReceipts ||
    totalBreakdown(byArtifactKind) !== totalReceipts
  ) {
    return null;
  }

  return {
    status: value.status,
    fromDate,
    toDate,
    timezone: "Asia/Seoul",
    totalReceipts,
    totalCompletions,
    pendingReceiptCount,
    awaitingPerformanceCount,
    byChannel,
    byLocale,
    byArtifactKind,
  };
}

export function createPlusOutcomeFollowUpFallback(
  status: "locked" | "unavailable",
): PlusOutcomeFollowUps {
  return { status, items: [], pendingCount: 0 };
}

function parseFollowUpRow(value: unknown): PlusOutcomeFollowUpItem | null {
  if (!isRecord(value)) return null;
  const completionDate = parseDate(value.completion_date);
  const mode = value.mode === undefined ? "bulk" : value.mode;
  if (
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    typeof value.title_snapshot !== "string" ||
    value.title_snapshot.trim() === "" ||
    !completionDate ||
    typeof value.meme_id !== "string" ||
    value.meme_id.trim() === "" ||
    !isPlusOutcomeChannel(value.channel) ||
    !isPlusOutcomeLocale(value.locale) ||
    !isPlusOutcomeArtifactKind(value.artifact_kind) ||
    !isPlusOutcomeMode(mode) ||
    (value.performance_note !== null && typeof value.performance_note !== "string") ||
    (value.performance_rating !== null && !isPlusOutcomeRating(value.performance_rating))
  ) {
    return null;
  }

  return {
    receiptId: value.id,
    memeId: value.meme_id,
    completionDate,
    title: value.title_snapshot,
    channel: value.channel,
    locale: value.locale,
    artifactKind: value.artifact_kind,
    mode,
    performanceNote: value.performance_note,
    performanceRating: value.performance_rating,
  };
}

export function parsePlusOutcomeFollowUpRows(value: unknown): PlusOutcomeFollowUpItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = parseFollowUpRow(row);
    return parsed ? [parsed] : [];
  });
}

export function buildPlusOutcomeFollowUps(
  rows: readonly PlusOutcomeFollowUpItem[],
): PlusOutcomeFollowUps {
  const items = [...rows]
    .sort(
      (left, right) =>
        Number(Boolean(left.performanceNote)) - Number(Boolean(right.performanceNote)) ||
        right.completionDate.localeCompare(left.completionDate) ||
        left.receiptId.localeCompare(right.receiptId),
    )
    .slice(0, 5);

  return {
    status: items.length > 0 ? "ready" : "empty",
    items,
    pendingCount: items.filter((item) => !item.performanceNote).length,
  };
}

export function createPlusOutcomeHistoryFallback(
  status: "locked" | "unavailable",
): PlusOutcomeHistory {
  return { status, items: [], pendingCount: 0 };
}

function parseHistoryRow(value: unknown): PlusOutcomeHistoryLedgerItem | null {
  const parsed = parseFollowUpRow(value);
  if (!parsed || !isRecord(value)) return null;
  if (!isPlusOutcomeHistoryLinkStatus(value.link_status)) return null;
  const resultUrl = parseResultUrl(value.result_url);
  if (resultUrl === undefined) return null;
  const replayShortId =
    typeof value.replay_short_id === "string" && value.replay_short_id.trim() !== ""
      ? value.replay_short_id.trim()
      : undefined;
  const replayEligible =
    parsed.performanceRating === "hit" &&
    (value.link_status === "localized" ||
      (value.link_status === "korean-fallback" && parsed.locale === "ko"));
  const safeReplayShortId = replayEligible ? replayShortId : undefined;
  const href = value.href;
  const base = {
    receiptId: parsed.receiptId,
    memeId: parsed.memeId,
    completionDate: parsed.completionDate,
    title: parsed.title,
    channel: parsed.channel,
    locale: parsed.locale,
    artifactKind: parsed.artifactKind,
    mode: parsed.mode,
    performanceRating: parsed.performanceRating,
    hasPerformanceNote: Boolean(parsed.performanceNote),
    ...(resultUrl ? { resultUrl } : {}),
    ...(safeReplayShortId ? { replayShortId: safeReplayShortId } : {}),
  };
  if (value.link_status === "unavailable") {
    return href === null ? { ...base, href: null, linkStatus: value.link_status } : null;
  }
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) {
    return null;
  }
  return { ...base, href, linkStatus: value.link_status };
}

export function parsePlusOutcomeHistoryRows(value: unknown): PlusOutcomeHistoryLedgerItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = parseHistoryRow(row);
    return parsed ? [parsed] : [];
  });
}

export function buildPlusOutcomeHistory(
  rows: readonly PlusOutcomeHistoryLedgerItem[],
  limit = PLUS_OUTCOME_HISTORY_LIMIT,
): PlusOutcomeHistory {
  const boundedLimit = Math.min(
    PLUS_OUTCOME_HISTORY_LIMIT,
    Math.max(0, Math.trunc(limit)),
  );
  const items = [...rows]
    .sort(
      (left, right) =>
        right.completionDate.localeCompare(left.completionDate) ||
        left.receiptId.localeCompare(right.receiptId),
    )
    .slice(0, boundedLimit)
    .map((row) => ({
      receiptId: row.receiptId,
      completionDate: row.completionDate,
      title: row.title,
      channel: row.channel,
      locale: row.locale,
      artifactKind: row.artifactKind,
      mode: row.mode,
      performanceRating: row.performanceRating,
      hasPerformanceNote: row.hasPerformanceNote,
      href: row.href,
      linkStatus: row.linkStatus,
      ...(row.resultUrl ? { resultUrl: row.resultUrl } : {}),
      ...(row.replayShortId ? { replayShortId: row.replayShortId } : {}),
    }));

  return {
    status: items.length > 0 ? "ready" : "empty",
    items,
    pendingCount: items.filter((item) => !item.hasPerformanceNote).length,
  };
}

function parseRatingRow(value: unknown): PlusOutcomeRatingRow | null {
  if (!isRecord(value)) return null;
  const completionDate = parseDate(value.completion_date);
  if (
    typeof value.meme_id !== "string" ||
    value.meme_id.trim() === "" ||
    !completionDate ||
    !isPlusOutcomeChannel(value.channel) ||
    !isPlusOutcomeRating(value.performance_rating)
  ) {
    return null;
  }

  return {
    memeId: value.meme_id,
    completionDate,
    channel: value.channel,
    rating: value.performance_rating,
  };
}

export function parsePlusOutcomeRatingRows(value: unknown): PlusOutcomeRatingRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = parseRatingRow(row);
    return parsed ? [parsed] : [];
  });
}
