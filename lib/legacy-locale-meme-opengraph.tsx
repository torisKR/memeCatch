import { isSeoContentLocale } from "@/lib/i18n-routing";
import { shortIdFromParam } from "@/lib/labels";
import { cardFromLocalized } from "@/lib/meme-share-content";
import { respondWithShareCard } from "@/lib/meme-share-card";
import { getLocalizedMemeByShortId } from "@/lib/meme-translations";
import { isOgDefaultLocale } from "@/lib/og-default-image";

export const alt = "MemeCatch meme card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Translated cards only. No reviewed translation, or a catalog/render failure,
 * serves `/og/{locale}` instead of a Korean title or an error image.
 */
export async function renderLegacyLocaleMemeOpenGraph({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale, key } = await params;
  const fallback = isOgDefaultLocale(locale) ? locale : "en";
  try {
    if (!isSeoContentLocale(locale)) return respondWithShareCard(fallback, null);
    const meme = await getLocalizedMemeByShortId(shortIdFromParam(key), locale);
    if (!meme) return respondWithShareCard(locale, null);
    return respondWithShareCard(locale, cardFromLocalized(locale, {
      title: meme.title,
      summary: meme.summary,
      origin_year: meme.origin_year,
      category: meme.category,
    }));
  } catch {
    return respondWithShareCard(fallback, null);
  }
}
