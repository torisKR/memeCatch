import { localizedMemePath, type SeoContentLocale } from "@/lib/i18n-routing";
import type { MemeListItem } from "@/lib/queries";

export const LOCALIZED_RELATED_LIMIT = 6;
export const LOCALIZED_RELATED_MINIMUM = 3;

type ReviewedTranslation = {
  short_id: string;
  slug: string;
  title: string;
  summary: string;
};

export type LocalizedRelatedCard = {
  meme: MemeListItem;
  href: string;
};

/**
 * Non-Korean detail pages only show related memes that have a reviewed
 * translation in that locale. Fewer than three translated neighbors is not
 * enough for the section, so the page hides it.
 */
export function selectLocalizedRelatedCards(
  related: readonly MemeListItem[],
  translations: ReadonlyMap<string, ReviewedTranslation>,
  locale: SeoContentLocale,
): LocalizedRelatedCard[] {
  const cards: LocalizedRelatedCard[] = [];
  for (const item of related) {
    const translation = translations.get(item.short_id);
    if (!translation) continue;
    cards.push({
      meme: {
        ...item,
        title: translation.title,
        summary: translation.summary,
        slug: translation.slug,
      },
      href: localizedMemePath(locale, translation.short_id, translation.slug),
    });
    if (cards.length === LOCALIZED_RELATED_LIMIT) break;
  }
  if (cards.length < LOCALIZED_RELATED_MINIMUM) return [];
  return cards;
}
