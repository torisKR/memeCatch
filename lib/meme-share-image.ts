import { createHash } from "node:crypto";
import { localizedMemePath, type SeoContentLocale } from "@/lib/i18n-routing";
import { memePathFrom, type MemeCategory } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";

/** Published Korean per-meme card. The suffix is Next's old file-convention id. */
export const KOREAN_MEME_CARD_SUFFIX = "opengraph-image-k2cx9c";

export const MEME_SHARE_DESIGN = {
  width: 1200,
  height: 630,
  /** Centered column. x = (1200 - 540) / 2 … that plus 540. */
  maxTextWidth: 540,
  contentLeft: 330,
  contentRight: 870,
  centerSquare: 630,
  titleFontSize: 56,
  summaryFontSize: 32,
  chipFontSize: 22,
  wordmarkFontSize: 20,
  logoSize: 16,
  titleMaxLines: 2,
  summaryMaxLines: 1,
  background: "#131316",
  foreground: "#f0efec",
  summary: "#aaa7af",
  chipBackground: "#26262c",
  /** Raster slack so a line measured at this width stays inside 540px once drawn. */
  measureSlack: 4,
} as const;

export type ShareCardLocale = "ko" | SeoContentLocale;

export type MemeShareCardContent = {
  locale: ShareCardLocale;
  title: string;
  summary: string | null;
  year: number | null;
  category: MemeCategory | null;
};

export type MemeShareImage = {
  url: string;
  width: 1200;
  height: 630;
  alt: string;
  type: "image/png";
};

const CHIP_CATEGORY = {
  ko: { phrase: "유행어", dance: "댄스", song: "노래", image: "영상", comment: "드라마", challenge: "챌린지" },
  en: { phrase: "Phrase", dance: "Dance", song: "Song", image: "Video", comment: "Drama", challenge: "Challenge" },
  ja: { phrase: "流行語", dance: "ダンス", song: "歌", image: "映像", comment: "ドラマ", challenge: "チャレンジ" },
  zh: { phrase: "流行语", dance: "舞蹈", song: "歌曲", image: "视频", comment: "剧情", challenge: "挑战" },
  "zh-tw": { phrase: "流行語", dance: "舞蹈", song: "歌曲", image: "影片", comment: "劇情", challenge: "挑戰" },
} as const satisfies Record<ShareCardLocale, Record<MemeCategory, string>>;

export function chipLabel(card: Pick<MemeShareCardContent, "locale" | "year" | "category">): string | null {
  const parts: string[] = [];
  if (typeof card.year === "number" && Number.isFinite(card.year)) parts.push(String(card.year));
  if (card.category) parts.push(CHIP_CATEGORY[card.locale][card.category]);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function blankToNull(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}

/** Stable for a curated card, and different when its visible copy changes. */
export function curatedShareVersion(meme: {
  title: string;
  summary: string;
  origin_year: number | null;
  category: string;
}): string {
  return createHash("sha256")
    .update([meme.title, meme.summary, String(meme.origin_year ?? ""), meme.category].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

function absoluteVersionedUrl(pathname: string, version: string): string {
  const url = new URL(pathname, SITE_URL);
  url.searchParams.set("v", version);
  return url.toString();
}

/** One absolute HTTPS image. `version` is the meme `updated_at` when the row has one. */
export function koreanMemeShareImage(input: {
  shortId: string;
  slug: string;
  alt: string;
  version: string;
}): MemeShareImage {
  return {
    url: absoluteVersionedUrl(
      `${memePathFrom(input.shortId, input.slug)}/${KOREAN_MEME_CARD_SUFFIX}`,
      input.version,
    ),
    alt: input.alt,
    width: MEME_SHARE_DESIGN.width,
    height: MEME_SHARE_DESIGN.height,
    type: "image/png",
  };
}

export function localeMemeShareImage(input: {
  locale: SeoContentLocale;
  shortId: string;
  slug: string;
  alt: string;
  version: string;
}): MemeShareImage {
  return {
    url: absoluteVersionedUrl(
      `${localizedMemePath(input.locale, input.shortId, input.slug)}/opengraph-image`,
      input.version,
    ),
    alt: input.alt,
    width: MEME_SHARE_DESIGN.width,
    height: MEME_SHARE_DESIGN.height,
    type: "image/png",
  };
}

/** Site-wide cards. A published meme page must not use these. */
export function isGenericShareImageUrl(url: string): boolean {
  const path = url.startsWith("http://") || url.startsWith("https://")
    ? new URL(url).pathname
    : url.split("?")[0] ?? url;
  if (path === "/opengraph-image") return true;
  return /^\/og\/(?:ko|en|ja|zh|zh-tw|ar)$/.test(path);
}
