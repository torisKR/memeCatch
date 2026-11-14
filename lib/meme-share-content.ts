import { findCuratedByShareKey, type CuratedMeme } from "@/lib/curated-memes";
import type { SeoContentLocale } from "@/lib/i18n-routing";
import { type MemeCategory } from "@/lib/labels";
import { blankToNull, type MemeShareCardContent, type ShareCardLocale } from "@/lib/meme-share-image";
import { resolveKoreanMemeDocument } from "@/lib/public-meme-document";

function categoryOrNull(value: string | null | undefined): MemeCategory | null {
  switch (value) {
    case "phrase":
    case "dance":
    case "song":
    case "image":
    case "comment":
    case "challenge":
      return value;
    default:
      return null;
  }
}

export function cardFromFields(input: {
  locale: ShareCardLocale;
  title: string;
  summary: string | null | undefined;
  year: number | null | undefined;
  category: string | null | undefined;
}): MemeShareCardContent | null {
  const title = blankToNull(input.title);
  if (!title) return null;
  const year = typeof input.year === "number" && Number.isFinite(input.year) ? input.year : null;
  return {
    locale: input.locale,
    title,
    summary: blankToNull(input.summary),
    year,
    category: categoryOrNull(input.category),
  };
}

export function cardFromCurated(meme: CuratedMeme): MemeShareCardContent | null {
  return cardFromFields({
    locale: "ko",
    title: meme.title,
    summary: meme.summary,
    year: meme.origin_year,
    category: meme.category,
  });
}

/**
 * Locale cards use that locale's summary only. An empty summary stays empty
 * even when the Korean source has one.
 */
export function cardFromLocalized(
  locale: SeoContentLocale,
  meme: {
    title: string;
    summary: string | null | undefined;
    origin_year: number | null | undefined;
    category: string | null | undefined;
  },
): MemeShareCardContent | null {
  return cardFromFields({
    locale,
    title: meme.title,
    summary: meme.summary,
    year: meme.origin_year,
    category: meme.category,
  });
}

/**
 * Same document the Korean page shows. A catalog miss still resolves a curated
 * seed id (`bjk2021k`, `okk2020k`) or its slug suffix (`bun-jo-ka`).
 */
export async function loadKoreanShareCard(key: string): Promise<MemeShareCardContent | null> {
  try {
    const document = await resolveKoreanMemeDocument(key);
    switch (document.kind) {
      case "database":
        return cardFromFields({
          locale: "ko",
          title: document.meme.title,
          summary: document.meme.summary,
          year: document.meme.origin_year,
          category: document.meme.category,
        });
      case "curated":
        return cardFromCurated(document.meme);
      case "unavailable":
      case "missing":
        break;
      default: {
        const unreachable: never = document;
        return unreachable;
      }
    }
  } catch {
    // The curated catalog does not need the database.
  }
  const curated = findCuratedByShareKey(key);
  return curated ? cardFromCurated(curated) : null;
}
