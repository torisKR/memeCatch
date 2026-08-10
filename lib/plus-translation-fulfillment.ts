import {
  isSeoContentLocale,
  type SeoContentLocale,
} from "@/lib/i18n-routing";
import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";
import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  type LifecycleStatus,
  type SafetyLevel,
} from "@/lib/labels";
import { parseUsageExamples, type UsageExample } from "@/lib/usage-examples";

export const PLUS_TRANSLATION_FULFILLMENT_LIMIT = 20;

export type PlusTranslationRequestStatus =
  | "requested"
  | "in_review"
  | "completed"
  | "dismissed";

export type PlusTranslationFulfillmentState =
  | "requested"
  | "in_review"
  | "ready"
  | "stale"
  | "source_incomplete"
  | "dismissed";

export type PlusTranslationFulfillmentStatus =
  | "active"
  | "empty"
  | "unavailable";

export type PlusTranslationFulfillmentMemeRow = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary?: string;
  usage_note?: string | null;
  caution?: string | null;
  safety_level?: string;
  lifecycle_status?: string;
  trend_score?: number | null;
  moderation_status: string;
  updated_at: string;
} & Pick<
  ContentDepthInput,
  | "description"
  | "origin"
  | "usage_examples"
  | "meme_sources"
  | "meme_contents"
  | "meme_tags_map"
>;

export type PlusTranslationFulfillmentRequestRow = {
  id: string;
  meme_id: string;
  locale: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  meme: PlusTranslationFulfillmentMemeRow | null;
};

export type PlusTranslationFulfillmentTranslationRow = {
  meme_id: string;
  locale: string;
  status: string;
  source_updated_at: string;
  localized_slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note?: string | null;
  caution?: string | null;
  usage_examples?: unknown;
  updated_at: string;
};

export type PlusTranslationFulfillmentItem = {
  requestId: string;
  memeId: string;
  shortId: string;
  slug: string;
  title: string;
  summary?: string;
  usageNote?: string | null;
  caution?: string | null;
  safetyLevel?: SafetyLevel;
  lifecycleStatus?: LifecycleStatus;
  trendScore?: number;
  locale: SeoContentLocale;
  requestStatus: PlusTranslationRequestStatus;
  state: PlusTranslationFulfillmentState;
  changedAt: string;
  usageExamples?: UsageExample[];
};

export type PlusTranslationFulfillmentResult = {
  status: PlusTranslationFulfillmentStatus;
  items: PlusTranslationFulfillmentItem[];
};

export type BuildPlusTranslationFulfillmentInput = {
  requests: readonly PlusTranslationFulfillmentRequestRow[] | null;
  translations: readonly PlusTranslationFulfillmentTranslationRow[] | null;
  limit?: number;
};

const REQUEST_STATUSES = new Set<PlusTranslationRequestStatus>([
  "requested",
  "in_review",
  "completed",
  "dismissed",
]);
const PUBLIC_MEME_STATUSES = new Set(["approved", "limited"]);

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function normalizeSafetyLevel(value: string | undefined): SafetyLevel {
  return value && Object.hasOwn(SAFETY_LEVELS, value)
    ? (value as SafetyLevel)
    : "yellow";
}

function normalizeLifecycleStatus(value: string | undefined): LifecycleStatus {
  return value && Object.hasOwn(LIFECYCLE_STATUS, value)
    ? (value as LifecycleStatus)
    : "active";
}

function hasCompleteTranslation(
  translation: PlusTranslationFulfillmentTranslationRow,
): boolean {
  return [
    translation.title,
    translation.summary,
    translation.description,
    translation.origin,
  ].every(hasText);
}

function isRequestStatus(value: string): value is PlusTranslationRequestStatus {
  return REQUEST_STATUSES.has(value as PlusTranslationRequestStatus);
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameInstant(left: string, right: string): boolean {
  const leftTimestamp = timestamp(left);
  const rightTimestamp = timestamp(right);
  return (
    leftTimestamp !== null &&
    rightTimestamp !== null &&
    leftTimestamp === rightTimestamp
  );
}

function fulfillmentLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return PLUS_TRANSLATION_FULFILLMENT_LIMIT;
  }
  return Math.min(
    PLUS_TRANSLATION_FULFILLMENT_LIMIT,
    Math.max(0, Math.trunc(limit)),
  );
}

function changedAtFor(
  request: PlusTranslationFulfillmentRequestRow,
  status: PlusTranslationRequestStatus,
): string {
  if (status === "requested") return request.created_at;
  if (status === "completed") {
    return request.completed_at ?? request.updated_at;
  }
  return request.updated_at;
}

function currentReviewedTranslation(
  request: PlusTranslationFulfillmentRequestRow,
  translations: readonly PlusTranslationFulfillmentTranslationRow[],
): PlusTranslationFulfillmentTranslationRow | null {
  const meme = request.meme;
  if (!meme) return null;

  const matches = translations.filter(
    (translation) =>
      translation.meme_id === request.meme_id &&
      translation.locale === request.locale &&
      translation.status === "reviewed" &&
      sameInstant(translation.source_updated_at, meme.updated_at) &&
      hasText(translation.localized_slug) &&
      hasCompleteTranslation(translation),
  );

  matches.sort(
    (left, right) =>
      (timestamp(right.updated_at) ?? 0) -
        (timestamp(left.updated_at) ?? 0) ||
      (left.localized_slug ?? "").localeCompare(right.localized_slug ?? ""),
  );
  return matches[0] ?? null;
}

function stateFor(
  requestStatus: PlusTranslationRequestStatus,
  translation: PlusTranslationFulfillmentTranslationRow | null,
  meme: PlusTranslationFulfillmentMemeRow,
): PlusTranslationFulfillmentState {
  if (requestStatus === "completed") {
    if (!translation) return "stale";
    return isIndexableMeme(meme) ? "ready" : "source_incomplete";
  }
  return requestStatus;
}

export function buildPlusTranslationFulfillment({
  requests,
  translations,
  limit,
}: BuildPlusTranslationFulfillmentInput): PlusTranslationFulfillmentResult {
  if (requests === null || translations === null) {
    return { status: "unavailable", items: [] };
  }

  const items = requests.flatMap((request): PlusTranslationFulfillmentItem[] => {
    const meme = request.meme;
    if (
      !meme ||
      !hasText(request.id) ||
      !hasText(request.meme_id) ||
      !hasText(meme.id) ||
      request.meme_id !== meme.id ||
      !hasText(meme.short_id) ||
      !hasText(meme.slug) ||
      !isSeoContentLocale(request.locale) ||
      !isRequestStatus(request.status) ||
      !PUBLIC_MEME_STATUSES.has(meme.moderation_status)
    ) {
      return [];
    }

    const translation = currentReviewedTranslation(request, translations);
    const requestStatus = request.status;
    const usageExamples = parseUsageExamples(translation?.usage_examples);
    return [
      {
        requestId: request.id,
        memeId: request.meme_id,
        shortId: meme.short_id,
        slug:
          translation?.localized_slug.trim() || meme.slug,
        title: translation?.title.trim() || meme.title,
        summary: translation?.summary.trim() || "",
        usageNote: translation?.usage_note ?? null,
        caution: translation?.caution ?? null,
        safetyLevel: normalizeSafetyLevel(meme.safety_level),
        lifecycleStatus: normalizeLifecycleStatus(meme.lifecycle_status),
        trendScore: Number.isFinite(meme.trend_score) ? Number(meme.trend_score) : 0,
        locale: request.locale,
        requestStatus,
        state: stateFor(requestStatus, translation, meme),
        changedAt: changedAtFor(request, requestStatus),
        ...(usageExamples.length > 0 ? { usageExamples } : {}),
      },
    ];
  });

  items.sort(
    (left, right) =>
      (timestamp(right.changedAt) ?? 0) -
        (timestamp(left.changedAt) ?? 0) ||
      left.requestId.localeCompare(right.requestId) ||
      left.locale.localeCompare(right.locale),
  );

  const seen = new Set<string>();
  const visibleItems = items
    .filter((item) => {
      if (seen.has(item.requestId)) return false;
      seen.add(item.requestId);
      return true;
    })
    .slice(0, fulfillmentLimit(limit));

  return {
    status: visibleItems.length > 0 ? "active" : "empty",
    items: visibleItems,
  };
}
