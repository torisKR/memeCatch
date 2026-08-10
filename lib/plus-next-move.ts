import type { Locale } from "@/lib/i18n";
import { isSeoContentLocale, localizedMemePath } from "@/lib/i18n-routing";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import { memePathFrom } from "@/lib/labels";
import type { PlusOutcomeRating, PlusOutcomeRatingRow } from "@/lib/plus-outcome-ledger";
import type { SavedReuseRadarItem } from "@/lib/saved-reuse-radar";

export const PLUS_NEXT_MOVE_RATING_WINDOW_DAYS = 28;
export const PLUS_NEXT_MOVE_RATING_LIMIT = 50;

export type PlusNextMoveRatingStatus = "available" | "unavailable";
export type PlusNextMoveSignal = "hit" | "neutral" | "miss" | "new" | "saved";
export type PlusNextMoveConfidence = "learning" | "ready";

export type PlusNextMoveResult = {
  status: "ready" | "empty" | "unavailable";
  item: PlusGlobalActionInboxItem | null;
  signal: PlusNextMoveSignal;
  confidence: PlusNextMoveConfidence;
  ratedCount: number;
  ratingScore: number;
};

export type PlusNextMoveInput = {
  items: readonly PlusGlobalActionInboxItem[];
  ratings: readonly PlusOutcomeRatingRow[];
  ratingsStatus: PlusNextMoveRatingStatus;
  completedMemeIds?: ReadonlySet<string> | readonly string[];
};

function localDateParts(now: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

function formatKstDate(date: Date): string {
  const parts = localDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function plusNextMoveDateWindow(
  now = new Date(),
  days = PLUS_NEXT_MOVE_RATING_WINDOW_DAYS,
): { from: string; to: string } {
  const to = formatKstDate(now);
  const fromDate = new Date(`${to}T00:00:00+09:00`);
  fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(0, Math.trunc(days) - 1));
  return { from: formatKstDate(fromDate), to };
}

function completedSet(value: PlusNextMoveInput["completedMemeIds"]): ReadonlySet<string> {
  return value instanceof Set ? value : new Set(value ?? []);
}

function ratingDelta(rating: PlusOutcomeRating): number {
  if (rating === "hit") return 1;
  if (rating === "miss") return -1;
  return 0;
}

function nextMoveHref(locale: Locale, shortId: string, slug: string): string {
  const detailHref = isSeoContentLocale(locale)
    ? localizedMemePath(locale, shortId, slug)
    : memePathFrom(shortId, slug);
  return `${detailHref}#meme-use-kit-title`;
}

export function savedReuseToPlusNextMoveItem(
  item: SavedReuseRadarItem,
  locale: Locale,
  content: Pick<SavedReuseRadarItem, "slug" | "title" | "summary"> = item,
): PlusGlobalActionInboxItem {
  const href = nextMoveHref(locale, item.shortId, content.slug);
  return {
    id: `saved-reuse:${item.id}`,
    memeId: item.id,
    shortId: item.shortId,
    slug: content.slug,
    title: content.title,
    summary: content.summary,
    locale,
    href,
    shareText: [content.title.trim(), content.summary.trim(), href].filter(Boolean).join("\n\n"),
    kind: "saved_signal",
    changedAt: null,
    trendScore: item.trendScore,
    creatorPackFacts: {
      title: content.title,
      summary: content.summary,
      usageNote: null,
      caution: null,
      safetyLevel: item.safetyLevel,
      lifecycleStatus: item.lifecycleStatus,
    },
  };
}

export function projectSavedRevisitNextMoveItem(
  item: SavedReuseRadarItem,
  locale: Locale,
  localizedContent: Pick<SavedReuseRadarItem, "slug" | "title" | "summary"> | null = null,
): PlusGlobalActionInboxItem | null {
  if (locale !== "ko" && !localizedContent) return null;
  return savedReuseToPlusNextMoveItem(item, locale, localizedContent ?? item);
}

function candidateSignal(
  ratings: readonly PlusOutcomeRating[],
  score: number,
  item: Pick<PlusGlobalActionInboxItem, "kind">,
): PlusNextMoveSignal {
  if (score > 0) return "hit";
  if (score < 0) return "miss";
  if (item.kind === "saved_signal" && ratings.length === 0) return "saved";
  return ratings.length > 0 ? "neutral" : "new";
}

export function buildPlusNextMove({
  items,
  ratings,
  ratingsStatus,
  completedMemeIds,
}: PlusNextMoveInput): PlusNextMoveResult {
  if (ratingsStatus === "unavailable") {
    return {
      status: "unavailable",
      item: null,
      signal: "new",
      confidence: ratings.length >= 3 ? "ready" : "learning",
      ratedCount: ratings.length,
      ratingScore: 0,
    };
  }

  const completed = completedSet(completedMemeIds);
  const candidates = items.filter((item) => !completed.has(item.memeId));
  if (candidates.length === 0) {
    return {
      status: "empty",
      item: null,
      signal: "new",
      confidence: ratings.length >= 3 ? "ready" : "learning",
      ratedCount: ratings.length,
      ratingScore: 0,
    };
  }

  const ratingsByMeme = new Map<string, PlusOutcomeRating[]>();
  for (const row of ratings) {
    const current = ratingsByMeme.get(row.memeId) ?? [];
    current.push(row.rating);
    ratingsByMeme.set(row.memeId, current);
  }

  const ranked = candidates
    .map((item, index) => {
      const candidateRatings = ratingsByMeme.get(item.memeId) ?? [];
      const score = candidateRatings.reduce((total, rating) => total + ratingDelta(rating), 0);
      return {
        item,
        index,
        score,
        signal: candidateSignal(candidateRatings, score, item),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const selected = ranked[0];

  return {
    status: "ready",
    item: selected.item,
    signal: selected.signal,
    confidence: ratings.length >= 3 ? "ready" : "learning",
    ratedCount: ratings.length,
    ratingScore: selected.score,
  };
}

export type PlusNextMoveCopy = {
  eyebrow: string;
  title: string;
  description: string;
  confidence: {
    learning: (count: number) => string;
    ready: (count: number) => string;
  };
  signal: Record<PlusNextMoveSignal, string>;
  open: string;
  activate: string;
  activated: string;
  empty: { title: string; body: string };
  unavailable: { title: string; body: string };
};

export type PlusNextMoveLocaleCopy = Record<Locale, PlusNextMoveCopy>;
