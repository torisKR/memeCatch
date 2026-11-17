import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";

export type LocalizedDocumentTranslation = {
  status: string;
  sourceUpdatedAt: Date | string;
  title: string;
  summary: string;
  description: string;
  origin: string;
};

type LocalizedDocumentEligibilityInput = {
  baseUpdatedAt: Date | string;
  original: ContentDepthInput;
  translation: LocalizedDocumentTranslation | null | undefined;
};

/** Compare database timestamps at the millisecond precision used by JavaScript. */
export function isSameStoredRevision(
  left: Date | string,
  right: Date | string,
): boolean {
  const leftMs = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightMs = right instanceof Date ? right.getTime() : new Date(right).getTime();
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

export function hasRequiredLocalizedDocumentFields(
  translation: Pick<LocalizedDocumentTranslation, "title" | "summary" | "description" | "origin">,
): boolean {
  return [
    translation.title,
    translation.summary,
    translation.description,
    translation.origin,
  ].every((value) => value.trim().length > 0);
}

/**
 * One eligibility contract for public localized detail routes. Proxy uses it
 * before streaming; the page data layer uses it before returning a document.
 */
export function isIndexableLocalizedDocument({
  baseUpdatedAt,
  original,
  translation,
}: LocalizedDocumentEligibilityInput): boolean {
  return Boolean(
    translation &&
    translation.status === "reviewed" &&
    isSameStoredRevision(translation.sourceUpdatedAt, baseUpdatedAt) &&
    hasRequiredLocalizedDocumentFields(translation) &&
    isIndexableMeme(original),
  );
}
