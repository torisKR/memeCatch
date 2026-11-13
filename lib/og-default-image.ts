import type { SeoContentLocale } from "@/lib/i18n-routing";

/**
 * Shared link-preview image for every locale.
 *
 * Design criteria (home, detail, and pricing all use this image; meme-specific
 * cards are intentionally not part of this image):
 * - exactly 1200×630 PNG, under 5MB
 * - logo, wordmark, and title are one centered group
 * - the title is at most two lines, each at most 540px wide
 * - the whole group sits inside the center 630×630, the 60px safe margin,
 *   and the centered 2:1 and 1.91:1 crops
 * - title size stays at least 48px so a 300px-wide preview keeps about 12px
 * - Japanese and Chinese break only on a phrase boundary; Arabic breaks only
 *   on a word boundary; no line is punctuation alone
 * - Hangul appears only on the Korean image
 * - an unknown locale falls back to English, which has no Hangul
 */
export const OG_DEFAULT_DESIGN = {
  width: 1200,
  height: 630,
  minMarginPx: 60,
  maxBytes: 5 * 1024 * 1024,
  contentType: "image/png" as const,
  background: "#131316",
  foreground: "#f0efec",
  /** Darkened from #FF5A1F so the #FFF9F5 mark clears 3:1 on the chip. */
  accent: "#F74610",
  icon: "#FFF9F5",
  titleFontSize: 64,
  titleMaxWidthPx: 540,
  titleLineHeight: 1.2,
  centerSquarePx: 630,
  logoSize: 56,
  wordmarkSize: 36,
  composition: "centered-logo-and-title" as const,
} as const;

export const OG_DEFAULT_LOCALES = ["ko", "en", "ja", "zh", "zh-tw", "ar"] as const;
export type OgDefaultLocale = (typeof OG_DEFAULT_LOCALES)[number];

/** Locales that have a prefixed document. Korean stays on `/`. */
export const OG_PAGE_LOCALES = ["en", "ja", "zh", "zh-tw", "ar"] as const;
export type OgPageLocale = (typeof OG_PAGE_LOCALES)[number];

export type OgDefaultCopy = {
  /** Logical title. Also the localized `og:image:alt`. */
  title: string;
  alt: string;
  /**
   * Painted title lines. The Latin wordmark sits on the logo row, so these
   * lines are the localized phrase only (Korean keeps 밈캐치 in the phrase).
   */
  lines: readonly [string] | readonly [string, string];
};

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;

export const OG_DEFAULT_COPY = {
  ko: {
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    alt: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    lines: ["밈캐치 — 그 밈,", "3초 안에 알려드려요"],
  },
  en: {
    title: "MemeCatch — Korean Memes Explained",
    alt: "MemeCatch — Korean Memes Explained",
    lines: ["Korean Memes", "Explained"],
  },
  ja: {
    title: "MemeCatch — 韓国ミームをわかりやすく解説",
    alt: "MemeCatch — 韓国ミームをわかりやすく解説",
    lines: ["韓国ミームを", "わかりやすく解説"],
  },
  zh: {
    title: "MemeCatch — 看懂韩国网络迷因",
    alt: "MemeCatch — 看懂韩国网络迷因",
    lines: ["看懂韩国网络迷因"],
  },
  "zh-tw": {
    title: "MemeCatch — 看懂韓國網路迷因",
    alt: "MemeCatch — 看懂韓國網路迷因",
    lines: ["看懂韓國網路迷因"],
  },
  ar: {
    title: "MemeCatch — شرح الميمات الكورية",
    alt: "MemeCatch — شرح الميمات الكورية",
    lines: ["شرح الميمات", "الكورية"],
  },
} as const satisfies Record<OgDefaultLocale, OgDefaultCopy>;

export function isOgDefaultLocale(value: string | null | undefined): value is OgDefaultLocale {
  return !!value && (OG_DEFAULT_LOCALES as readonly string[]).includes(value);
}

export function isOgPageLocale(value: string | null | undefined): value is OgPageLocale {
  return !!value && (OG_PAGE_LOCALES as readonly string[]).includes(value);
}

/** Unknown locales use the English card so a non-Korean URL cannot paint Hangul. */
export function resolveOgDefaultLocale(value: string | null | undefined): OgDefaultLocale {
  return isOgDefaultLocale(value) ? value : "en";
}

export function ogDefaultCopy(value: string | null | undefined): OgDefaultCopy {
  return OG_DEFAULT_COPY[resolveOgDefaultLocale(value)];
}

/** Arabic pages reuse reviewed English meme copy until an Arabic catalog exists. */
export function ogPageContentLocale(locale: OgPageLocale): SeoContentLocale {
  switch (locale) {
    case "ar":
      return "en";
    case "en":
    case "ja":
    case "zh":
    case "zh-tw":
      return locale;
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}

export function ogDefaultLocaleHasHangul(locale: OgDefaultLocale): boolean {
  const copy = OG_DEFAULT_COPY[locale];
  return [copy.title, copy.alt, ...copy.lines].some((text) => HANGUL.test(text));
}

/** Font size of the title when the 1200px card is shown at `previewWidth`. */
export function ogTitlePreviewPx(previewWidth: number): number {
  return (OG_DEFAULT_DESIGN.titleFontSize * previewWidth) / OG_DEFAULT_DESIGN.width;
}

/** Relative image URL. `metadataBase` turns it into an absolute HTTPS URL. */
export function ogDefaultImageDescriptor(locale: string | null | undefined) {
  const resolved = resolveOgDefaultLocale(locale);
  const copy = OG_DEFAULT_COPY[resolved];
  return {
    url: `/og/${resolved}`,
    width: OG_DEFAULT_DESIGN.width,
    height: OG_DEFAULT_DESIGN.height,
    alt: copy.alt,
    type: OG_DEFAULT_DESIGN.contentType,
  };
}
