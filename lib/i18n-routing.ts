import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { memePathFrom, type MemeCategory } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";

/**
 * 색인 가능한 완역 콘텐츠를 제공하는 로케일만 둔다.
 * UI가 지원하는 전체 로케일(SUPPORTED_LOCALES)과 의도적으로 분리해 영어 폴백
 * 복제 페이지가 hreflang·사이트맵에 노출되지 않게 한다.
 */
export const SEO_CONTENT_LOCALES = ["en", "ja", "zh", "zh-tw"] as const satisfies readonly Locale[];

export type SeoContentLocale = (typeof SEO_CONTENT_LOCALES)[number];
export type SeoRouteLocale = Extract<Locale, "ko" | SeoContentLocale>;

export const SEO_ROUTE_LOCALES = ["ko", ...SEO_CONTENT_LOCALES] as const satisfies readonly SeoRouteLocale[];

type SeoLocaleConfig = {
  hrefLang: string;
  bcp47: string;
  documentLanguage: string;
  openGraphLocale: string;
  dateLocale: string;
  direction: "ltr" | "rtl";
};

export const SEO_LOCALE_CONFIG: Record<SeoRouteLocale, SeoLocaleConfig> = {
  ko: { hrefLang: "ko", bcp47: "ko-KR", documentLanguage: "ko", openGraphLocale: "ko_KR", dateLocale: "ko-KR", direction: "ltr" },
  en: { hrefLang: "en", bcp47: "en-US", documentLanguage: "en", openGraphLocale: "en_US", dateLocale: "en-US", direction: "ltr" },
  ja: { hrefLang: "ja", bcp47: "ja-JP", documentLanguage: "ja", openGraphLocale: "ja_JP", dateLocale: "ja-JP", direction: "ltr" },
  zh: { hrefLang: "zh-Hans", bcp47: "zh-CN", documentLanguage: "zh-Hans", openGraphLocale: "zh_CN", dateLocale: "zh-CN", direction: "ltr" },
  "zh-tw": { hrefLang: "zh-Hant", bcp47: "zh-TW", documentLanguage: "zh-Hant", openGraphLocale: "zh_TW", dateLocale: "zh-TW", direction: "ltr" },
};

export type SeoCopy = {
  siteName: string;
  defaultTitle: string;
  titleTemplate: string;
  description: string;
  homeName: string;
  glossaryName: string;
  glossaryDescription: string;
  categories: Record<MemeCategory, string>;
};

export const SEO_COPY: Record<SeoRouteLocale, SeoCopy> = {
  ko: {
    siteName: "밈캐치",
    defaultTitle: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    titleTemplate: "%s | 밈캐치",
    description:
      "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 한국 밈의 실시간 사전, 밈캐치.",
    homeName: "밈캐치",
    glossaryName: "밈캐치 밈 사전",
    glossaryDescription: "1990년대부터 오늘까지, 한국 유행 밈·유행어·챌린지 용어집",
    categories: {
      phrase: "밈 용어(유행어)",
      dance: "챌린지 댄스",
      song: "노래",
      image: "밈 영상",
      comment: "드라마 장면",
      challenge: "챌린지 댄스",
    },
  },
  en: {
    siteName: "MemeCatch",
    defaultTitle: "MemeCatch — Korean Memes Explained",
    titleTemplate: "%s | MemeCatch",
    description:
      "Understand Korean memes, slang, and challenges: what they mean, where they came from, and whether they are still safe to use.",
    homeName: "MemeCatch",
    glossaryName: "MemeCatch Korean Meme Dictionary",
    glossaryDescription: "A glossary of Korean memes, slang, and challenges from the 1990s to today.",
    categories: {
      phrase: "Meme terms",
      dance: "Challenge dances",
      song: "Songs",
      image: "Meme videos",
      comment: "Drama scenes",
      challenge: "Challenge dances",
    },
  },
  ja: {
    siteName: "MemeCatch",
    defaultTitle: "MemeCatch — 韓国ミームをわかりやすく解説",
    titleTemplate: "%s | MemeCatch",
    description:
      "韓国で流行するミーム・スラング・チャレンジの意味、由来、今使ってもよい表現かをわかりやすく解説します。",
    homeName: "MemeCatch",
    glossaryName: "MemeCatch 韓国ミーム辞典",
    glossaryDescription: "1990年代から現在までの韓国ミーム・流行語・チャレンジ用語集。",
    categories: {
      phrase: "ミーム用語（流行語）",
      dance: "チャレンジダンス",
      song: "楽曲",
      image: "ミーム動画",
      comment: "ドラマシーン",
      challenge: "チャレンジダンス",
    },
  },
  zh: {
    siteName: "MemeCatch",
    defaultTitle: "MemeCatch — 看懂韩国网络迷因",
    titleTemplate: "%s | MemeCatch",
    description: "解释韩国热门迷因、流行语和挑战的含义、起源，以及现在是否适合使用。",
    homeName: "MemeCatch",
    glossaryName: "MemeCatch 韩国迷因词典",
    glossaryDescription: "收录从20世纪90年代至今的韩国迷因、流行语和网络挑战。",
    categories: {
      phrase: "梗语",
      dance: "舞蹈挑战",
      song: "歌曲",
      image: "梗视频",
      comment: "电视剧场景",
      challenge: "舞蹈挑战",
    },
  },
  "zh-tw": {
    siteName: "MemeCatch",
    defaultTitle: "MemeCatch — 看懂韓國網路迷因",
    titleTemplate: "%s | MemeCatch",
    description: "解釋韓國熱門迷因、流行語和挑戰的含義、起源，以及現在是否適合使用。",
    homeName: "MemeCatch",
    glossaryName: "MemeCatch 韓國迷因辭典",
    glossaryDescription: "收錄從1990年代至今的韓國迷因、流行語和網路挑戰。",
    categories: {
      phrase: "梗語",
      dance: "舞蹈挑戰",
      song: "歌曲",
      image: "梗影片",
      comment: "電視劇場景",
      challenge: "舞蹈挑戰",
    },
  },
};

/** 소비자 코드에서 쓰는 명시적 이름. SEO_COPY는 짧은 호환 별칭으로 유지한다. */
export const SEO_LOCALE_COPY = SEO_COPY;

const SEO_CONTENT_LOCALE_SET = new Set<string>(SEO_CONTENT_LOCALES);
const SEO_ROUTE_LOCALE_SET = new Set<string>(SEO_ROUTE_LOCALES);

export function isSeoContentLocale(value: string | null | undefined): value is SeoContentLocale {
  return !!value && SEO_CONTENT_LOCALE_SET.has(value);
}

export function isSeoRouteLocale(value: string | null | undefined): value is SeoRouteLocale {
  return !!value && SEO_ROUTE_LOCALE_SET.has(value);
}

type SplitPath = { pathname: string; suffix: string };

function splitPath(value: string): SplitPath {
  const marker = value.search(/[?#]/);
  const rawPathname = marker === -1 ? value : value.slice(0, marker);
  const suffix = marker === -1 ? "" : value.slice(marker);
  const pathname = rawPathname === "" ? "/" : rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;
  return { pathname, suffix };
}

export type ParsedLocalePath = {
  locale: SeoRouteLocale;
  pathname: string;
  hadLocalePrefix: boolean;
};

/** `/en/about?x=1` → `{ locale: "en", pathname: "/about?x=1" }`. */
export function parseLocalePath(value: string): ParsedLocalePath {
  const { pathname, suffix } = splitPath(value);
  const [first = "", ...rest] = pathname.split("/").filter(Boolean);

  if (!isSeoRouteLocale(first)) {
    return { locale: "ko", pathname: `${pathname}${suffix}`, hadLocalePrefix: false };
  }

  const stripped = rest.length > 0 ? `/${rest.join("/")}` : "/";
  return { locale: first, pathname: `${stripped}${suffix}`, hadLocalePrefix: true };
}

/** 로케일 prefix만 제거하며 query/hash는 보존한다. */
export function stripLocalePath(value: string): string {
  return parseLocalePath(value).pathname;
}

/** 한국어는 prefix 없이, SEO 번역 로케일은 첫 경로 segment로 붙인다. */
export function localizePath(value: string, locale: SeoRouteLocale): string {
  const unprefixed = stripLocalePath(value);
  const { pathname, suffix } = splitPath(unprefixed);
  if (locale === "ko") return `${pathname}${suffix}`;
  return `${pathname === "/" ? `/${locale}` : `/${locale}${pathname}`}${suffix}`;
}

export function localizedPath(value: string, locale: SeoRouteLocale): string {
  return localizePath(value, locale);
}

export function localizedMemePath(locale: SeoRouteLocale, shortId: string, slug: string): string {
  return localizePath(memePathFrom(shortId, slug), locale);
}

export function toHrefLang(locale: SeoRouteLocale): string {
  return SEO_LOCALE_CONFIG[locale].hrefLang;
}

export function getHreflang(locale: SeoRouteLocale): string {
  return toHrefLang(locale);
}

export function toSeoBcp47(locale: SeoRouteLocale): string {
  return SEO_LOCALE_CONFIG[locale].bcp47;
}

export function toOpenGraphLocale(locale: SeoRouteLocale): string {
  return SEO_LOCALE_CONFIG[locale].openGraphLocale;
}

export function getOpenGraphLocale(locale: SeoRouteLocale): string {
  return toOpenGraphLocale(locale);
}

export function getSeoCopy(locale: SeoRouteLocale): SeoCopy {
  return SEO_COPY[locale];
}

export function absoluteSiteUrl(pathname: string): string {
  return `${SITE_URL}${pathname === "/" ? "" : pathname}`;
}

export function buildHreflangLanguages(
  pathname: string,
  locales: readonly SeoRouteLocale[],
): Record<string, string> {
  return Object.fromEntries(
    locales.map((locale) => [toHrefLang(locale), localizePath(pathname, locale)]),
  );
}

type BuildLocalizedMetadataOptions = {
  locale: SeoRouteLocale;
  /** prefix 유무와 관계없이 받아 canonical에서는 해당 locale 규칙으로 정규화한다. */
  pathname?: string;
  title?: string;
  description?: string;
  /** 실제 공개 번역이 있는 로케일만 전달한다. 생략하면 hreflang을 만들지 않는다. */
  availableLocales?: readonly SeoRouteLocale[];
  /** 언어 선택용 중립 URL이 없으면 영어 번역 URL을 x-default로 쓰는 것이 기본이다. */
  includeXDefault?: boolean;
};

/** 언어별 기본 title/description/canonical/OG/Twitter 메타데이터를 한 번에 만든다. */
export function buildLocalizedMetadata({
  locale,
  pathname = "/",
  title,
  description,
  availableLocales,
  includeXDefault = true,
}: BuildLocalizedMetadataOptions): Metadata {
  const copy = getSeoCopy(locale);
  const canonical = localizePath(pathname, locale);
  const resolvedTitle = title ?? copy.defaultTitle;
  const resolvedDescription = description ?? copy.description;
  const alternateLocales = availableLocales?.filter((item) => item !== locale) ?? [];
  const languages = availableLocales
    ? {
        ...buildHreflangLanguages(pathname, availableLocales),
        // 글로벌 피벗: 해외 방문자가 주 타깃이므로 x-default는 영어 경로를 가리킨다.
        ...(includeXDefault ? { "x-default": localizePath(pathname, "en") } : {}),
      }
    : undefined;

  return {
    metadataBase: new URL(SITE_URL),
    // `absolute` keeps the localized landing title exact, while `template`
    // applies the localized brand to titles in descendant route segments.
    title: title
      ? title
      : { absolute: copy.defaultTitle, template: copy.titleTemplate },
    description: resolvedDescription,
    applicationName: copy.siteName,
    alternates: {
      canonical,
      ...(languages ? { languages } : {}),
    },
    openGraph: {
      type: "website",
      title: resolvedTitle,
      description: resolvedDescription,
      siteName: copy.siteName,
      url: canonical,
      locale: toOpenGraphLocale(locale),
      ...(alternateLocales.length > 0
        ? { alternateLocale: alternateLocales.map(toOpenGraphLocale) }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
    },
  };
}
