export const SAVED_CONTEXT_WATCH_ITEM_LIMIT = 6;

export type SavedContextWatchKind =
  | "editorial_update"
  | "safety_update"
  | "translation_reviewed"
  | "translation_stale"
  | "lifecycle_update";

export type SavedContextWatchTranslation = {
  locale: string;
  status: string;
  sourceUpdatedAt: string;
  updatedAt: string;
};

export type SavedContextWatchSource = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  savedAt: string;
  updatedAt: string;
  translation: SavedContextWatchTranslation | null;
};

export type SavedContextWatchItem = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  kind: SavedContextWatchKind;
  locale: string | null;
  changedAt: string;
  readAt: string | null;
};

const WATCH_KINDS = new Set<SavedContextWatchKind>([
  "editorial_update",
  "safety_update",
  "translation_reviewed",
  "translation_stale",
  "lifecycle_update",
]);

function timestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAfter(left: string, right: string): boolean {
  const leftTimestamp = timestamp(left);
  const rightTimestamp = timestamp(right);
  return leftTimestamp !== null && rightTimestamp !== null && leftTimestamp > rightTimestamp;
}

export function isSavedContextWatchKind(value: string): value is SavedContextWatchKind {
  return WATCH_KINDS.has(value as SavedContextWatchKind);
}

export function buildSavedContextWatch(
  sources: readonly SavedContextWatchSource[],
): SavedContextWatchItem[] {
  return sources
    .flatMap<SavedContextWatchItem>((source): SavedContextWatchItem[] => {
      const translation = source.translation;
      if (
        translation?.status === "reviewed" &&
        isAfter(translation.updatedAt, source.savedAt) &&
        !isAfter(source.updatedAt, translation.sourceUpdatedAt)
      ) {
        return [
          {
            id: source.id,
            shortId: source.shortId,
            slug: source.slug,
            title: source.title,
            kind: "translation_reviewed" as const,
            locale: translation.locale,
            changedAt: translation.updatedAt,
            readAt: null,
          },
        ];
      }

      if (
        isAfter(source.updatedAt, source.savedAt) &&
        (translation?.status === "stale" ||
          (translation !== null && isAfter(source.updatedAt, translation.sourceUpdatedAt)))
      ) {
        return [
          {
            id: source.id,
            shortId: source.shortId,
            slug: source.slug,
            title: source.title,
            kind: "translation_stale" as const,
            locale: translation?.locale ?? null,
            changedAt: source.updatedAt,
            readAt: null,
          },
        ];
      }

      if (isAfter(source.updatedAt, source.savedAt)) {
        return [
          {
            id: source.id,
            shortId: source.shortId,
            slug: source.slug,
            title: source.title,
            kind: "editorial_update" as const,
            locale: null,
            changedAt: source.updatedAt,
            readAt: null,
          },
        ];
      }

      return [];
    })
    .sort(
      (left, right) =>
        (timestamp(right.changedAt) ?? 0) - (timestamp(left.changedAt) ?? 0) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, SAVED_CONTEXT_WATCH_ITEM_LIMIT);
}
