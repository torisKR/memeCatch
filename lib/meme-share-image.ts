import { localizedMemePath, type OgShareLocale } from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";

/** Published Korean per-meme card. The suffix is Next's old file-convention id. */
export const KOREAN_MEME_CARD_SUFFIX = "opengraph-image-k2cx9c";

export type MemeShareImage = {
  url: string;
  width: 1200;
  height: 630;
  alt: string;
  type: "image/png";
};

const CARD_SIZE = {
  width: 1200 as const,
  height: 630 as const,
  type: "image/png" as const,
};

/** One absolute-path image. `metadataBase` makes it an HTTPS URL. */
export function koreanMemeShareImage(shortId: string, slug: string, alt: string): MemeShareImage {
  return {
    url: `${memePathFrom(shortId, slug)}/${KOREAN_MEME_CARD_SUFFIX}`,
    alt,
    ...CARD_SIZE,
  };
}

/** Translated locale card. The route already paints that locale's title and meaning. */
export function localeMemeShareImage(
  locale: OgShareLocale,
  shortId: string,
  slug: string,
  alt: string,
): MemeShareImage {
  return {
    url: `${localizedMemePath(locale, shortId, slug)}/opengraph-image`,
    alt,
    ...CARD_SIZE,
  };
}

/**
 * Site-wide cards. A per-meme page must not use these when that meme exists.
 * `/memes/.../opengraph-image-k2cx9c` and `/{locale}/memes/.../opengraph-image` are not generic.
 */
export function isGenericShareImageUrl(url: string): boolean {
  if (url === "/opengraph-image" || url.startsWith("/opengraph-image?")) return true;
  return /^\/og\/(?:ko|en|ja|zh|zh-tw|ar)$/.test(url);
}
