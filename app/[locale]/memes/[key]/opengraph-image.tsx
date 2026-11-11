import { ImageResponse } from "next/og";
import { MemePosterOg } from "@/components/meme-poster-og";
import { isSeoContentLocale, type SeoContentLocale } from "@/lib/i18n-routing";
import { shortIdFromParam, type SafetyLevel } from "@/lib/labels";
import { loadMemeArtByShortId, loadReachableMemeArt } from "@/lib/meme-art.server";
import { memeArtAlt, posterBadgeLabel, posterBadgeTone } from "@/lib/meme-poster";
import { getLocalizedMemeByShortId } from "@/lib/meme-translations";

export const alt = "MemeCatch Korean meme explainer card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_COPY: Record<SeoContentLocale, { fallbackTitle: string; fallbackSummary: string }> = {
  en: {
    fallbackTitle: "Korean memes, decoded",
    fallbackSummary: "Understand the meaning, origin, and context behind Korean internet culture.",
  },
  ja: {
    fallbackTitle: "韓国ミームを読み解く",
    fallbackSummary: "韓国のネット文化で生まれたミームの意味・由来・使い方をわかりやすく紹介します。",
  },
  zh: {
    fallbackTitle: "轻松看懂韩国迷因",
    fallbackSummary: "了解韩国网络文化中热门迷因的含义、起源和使用语境。",
  },
  "zh-tw": {
    fallbackTitle: "輕鬆看懂韓國迷因",
    fallbackSummary: "了解韓國網路文化中熱門迷因的含義、起源和使用情境。",
  },
};

let fontCache: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer } | null> | null = null;

function loadFonts() {
  fontCache ??= (async () => {
    try {
      const [bold, regular] = await Promise.all([
        fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf").then((response) => {
          if (!response.ok) throw new Error("Unable to load the bold OG font");
          return response.arrayBuffer();
        }),
        fetch("https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf").then((response) => {
          if (!response.ok) throw new Error("Unable to load the regular OG font");
          return response.arrayBuffer();
        }),
      ]);
      return { bold, regular };
    } catch {
      return null;
    }
  })();
  return fontCache;
}

function truncate(value: string, maxLength: number) {
  const text = value.trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; key: string }>;
}) {
  const { locale: localeParam, key } = await params;
  const locale = isSeoContentLocale(localeParam) ? localeParam : "en";
  const copy = OG_COPY[locale];
  const localized = isSeoContentLocale(localeParam)
    ? await getLocalizedMemeByShortId(shortIdFromParam(key), locale)
    : null;
  const title = truncate(localized?.title ?? copy.fallbackTitle, 24);
  const summary = truncate(localized?.summary ?? copy.fallbackSummary, 64);
  const safety = (localized?.safety_level ?? "yellow") as SafetyLevel;
  const tone = posterBadgeTone(safety);
  const artSrc = await loadReachableMemeArt(await loadMemeArtByShortId(shortIdFromParam(key)));
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <MemePosterOg
        title={title}
        summary={summary}
        badgeLabel={posterBadgeLabel(safety, locale)}
        badgeBackground={tone.background}
        badgeForeground={tone.foreground}
        year={localized?.origin_year}
        artSrc={artSrc}
        artAlt={memeArtAlt(localized?.title ?? copy.fallbackTitle)}
      />
    ),
    {
      ...size,
      fonts: fonts
        ? [
            { name: "Pretendard", data: fonts.bold, style: "normal" as const, weight: 700 as const },
            { name: "Pretendard", data: fonts.regular, style: "normal" as const, weight: 400 as const },
          ]
        : undefined,
    },
  );
}
