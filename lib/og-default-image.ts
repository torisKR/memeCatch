import type { SeoContentLocale } from "@/lib/i18n-routing";

/**
 * Shared link-preview image for every locale.
 *
 * Design criteria (home, detail, and pricing all use this image; meme-specific
 * cards are intentionally not part of this image):
 * - exactly 1200×630 PNG, under 5MB
 * - logo plus one localized title line
 * - content inset by at least `minMarginPx` on every edge
 * - Hangul appears only on the Korean image
 * - an unknown locale falls back to English, which has no Hangul
 */
export const OG_DEFAULT_DESIGN = {
  width: 1200,
  height: 630,
  minMarginPx: 60,
  /** Layout inset. Larger than the minimum so glyph antialiasing stays inside the safe margin. */
  layoutMarginPx: 72,
  maxBytes: 5 * 1024 * 1024,
  contentType: "image/png" as const,
  background: "#131316",
  foreground: "#f0efec",
  accent: "#FF5A1F",
  composition: "logo-and-one-line-title" as const,
} as const;

export const OG_DEFAULT_LOCALES = ["ko", "en", "ja", "zh", "zh-tw", "ar"] as const;
export type OgDefaultLocale = (typeof OG_DEFAULT_LOCALES)[number];

/** Locales that have a prefixed document. Korean stays on `/`. */
export const OG_PAGE_LOCALES = ["en", "ja", "zh", "zh-tw", "ar"] as const;
export type OgPageLocale = (typeof OG_PAGE_LOCALES)[number];

export type OgDefaultCopy = {
  /** One line drawn on the image. Also the localized `og:image:alt`. */
  title: string;
  alt: string;
};

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;

export const OG_DEFAULT_COPY = {
  ko: {
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    alt: "밈캐치 — 그 밈, 3초 안에 알려드려요",
  },
  en: {
    title: "MemeCatch — Korean Memes Explained",
    alt: "MemeCatch — Korean Memes Explained",
  },
  ja: {
    title: "MemeCatch — 韓国ミームをわかりやすく解説",
    alt: "MemeCatch — 韓国ミームをわかりやすく解説",
  },
  zh: {
    title: "MemeCatch — 看懂韩国网络迷因",
    alt: "MemeCatch — 看懂韩国网络迷因",
  },
  "zh-tw": {
    title: "MemeCatch — 看懂韓國網路迷因",
    alt: "MemeCatch — 看懂韓國網路迷因",
  },
  ar: {
    title: "MemeCatch — شرح الميمات الكورية",
    alt: "MemeCatch — شرح الميمات الكورية",
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
  return HANGUL.test(copy.title) || HANGUL.test(copy.alt);
}

const LOGO_TEXT = "MemeCatch";

function glyphWidth(character: string, fontSize: number): number {
  if (character === " ") return fontSize * 0.33;
  if (character === "—") return fontSize * 0.9;
  if (HANGUL.test(character) || /[\u3040-\u30ff\u3400-\u9fff]/.test(character)) {
    return fontSize;
  }
  if (/[\u0600-\u06FF]/.test(character)) return fontSize * 0.62;
  return fontSize * 0.62;
}

export function estimateOgTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const character of text) width += glyphWidth(character, fontSize);
  return width;
}

export function ogTitleFontSize(title: string): number {
  const maxWidth = OG_DEFAULT_DESIGN.width - OG_DEFAULT_DESIGN.layoutMarginPx * 2;
  for (let size = 64; size >= 28; size -= 2) {
    if (estimateOgTextWidth(title, size) <= maxWidth) return size;
  }
  return 28;
}

export function ogContentBox() {
  const margin = OG_DEFAULT_DESIGN.layoutMarginPx;
  return {
    margin,
    width: OG_DEFAULT_DESIGN.width - margin * 2,
    height: OG_DEFAULT_DESIGN.height - margin * 2,
  };
}

export function ogLogoLineWidth(): number {
  return 56 + 16 + estimateOgTextWidth(LOGO_TEXT, 36);
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
