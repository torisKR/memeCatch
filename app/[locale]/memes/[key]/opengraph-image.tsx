import { ImageResponse } from "next/og";
import { isSeoContentLocale, type SeoContentLocale } from "@/lib/i18n-routing";
import { shortIdFromParam } from "@/lib/labels";
import { getLocalizedMemeByShortId } from "@/lib/meme-translations";
import { SITE_URL } from "@/lib/site";

export const alt = "MemeCatch Korean meme explainer card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const COLORS = {
  background: "#131316",
  surface: "#1c1c21",
  border: "#34343c",
  foreground: "#f0efec",
  muted: "#aaa7af",
  accent: "#ff6b47",
  accentSurface: "#321d19",
} as const;

type OgCopy = {
  dictionary: string;
  kicker: string;
  originalLabel: string;
  fallbackTitle: string;
  fallbackSummary: string;
  localeLabel: string;
};

const OG_COPY: Record<SeoContentLocale, OgCopy> = {
  en: {
    dictionary: "K-Meme Dictionary",
    kicker: "Korean meme, explained",
    originalLabel: "Original Korean",
    fallbackTitle: "Korean memes, decoded",
    fallbackSummary:
      "Understand the meaning, origin, and context behind Korean internet culture.",
    localeLabel: "English",
  },
  ja: {
    dictionary: "韓国ミーム辞典",
    kicker: "韓国ミームをわかりやすく解説",
    originalLabel: "韓国語の原題",
    fallbackTitle: "韓国ミームを読み解く",
    fallbackSummary:
      "韓国のネット文化で生まれたミームの意味・由来・使い方をわかりやすく紹介します。",
    localeLabel: "日本語",
  },
  zh: {
    dictionary: "韩国迷因词典",
    kicker: "看懂韩国网络迷因",
    originalLabel: "韩文原名",
    fallbackTitle: "轻松看懂韩国迷因",
    fallbackSummary: "了解韩国网络文化中热门迷因的含义、起源和使用语境。",
    localeLabel: "简体中文",
  },
  "zh-tw": {
    dictionary: "韓國迷因辭典",
    kicker: "看懂韓國網路迷因",
    originalLabel: "韓文原名",
    fallbackTitle: "輕鬆看懂韓國迷因",
    fallbackSummary: "了解韓國網路文化中熱門迷因的含義、起源和使用情境。",
    localeLabel: "繁體中文",
  },
};

let fontCache: Promise<{ bold: ArrayBuffer; regular: ArrayBuffer } | null> | null =
  null;

function loadFonts() {
  fontCache ??= (async () => {
    try {
      const [bold, regular] = await Promise.all([
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf",
        ).then((response) => {
          if (!response.ok) throw new Error("Unable to load the bold OG font");
          return response.arrayBuffer();
        }),
        fetch(
          "https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Regular.otf",
        ).then((response) => {
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

  const title = truncate(localized?.title ?? copy.fallbackTitle, 42);
  const summary = truncate(localized?.summary ?? copy.fallbackSummary, 112);
  const originalTitle = localized?.original.title
    ? truncate(localized.original.title, 46)
    : null;
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: COLORS.background,
          padding: "52px 68px 50px",
          fontFamily: fonts ? "Pretendard" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 21,
                height: 21,
                borderRadius: 9999,
                backgroundColor: COLORS.accent,
              }}
            />
            <div style={{ color: COLORS.accent, fontSize: 34, fontWeight: 700 }}>
              MemeCatch
            </div>
            <div style={{ color: COLORS.muted, fontSize: 25 }}>
              {copy.dictionary}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 9999,
              color: COLORS.muted,
              fontSize: 22,
              padding: "9px 18px",
            }}
          >
            {copy.localeLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 19 }}>
          <div
            style={{
              color: COLORS.accent,
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            {copy.kicker}
          </div>
          <div
            style={{
              color: COLORS.foreground,
              fontSize: title.length > 28 ? 64 : title.length > 16 ? 72 : 82,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
          <div
            style={{
              color: COLORS.muted,
              fontSize: summary.length > 82 ? 30 : 34,
              lineHeight: 1.42,
              maxWidth: 1030,
            }}
          >
            {summary}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 58,
          }}
        >
          {originalTitle ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                backgroundColor: COLORS.surface,
                padding: "12px 18px",
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 21 }}>
                {copy.originalLabel}
              </div>
              <div style={{ color: COLORS.foreground, fontSize: 25, fontWeight: 700 }}>
                {originalTitle}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                color: COLORS.accent,
                backgroundColor: COLORS.accentSurface,
                borderRadius: 9999,
                fontSize: 22,
                padding: "11px 19px",
              }}
            >
              K-Meme · Culture · Context
            </div>
          )}
          <div style={{ color: COLORS.muted, fontSize: 23 }}>
            {new URL(SITE_URL).host}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fonts
        ? [
            {
              name: "Pretendard",
              data: fonts.bold,
              style: "normal" as const,
              weight: 700 as const,
            },
            {
              name: "Pretendard",
              data: fonts.regular,
              style: "normal" as const,
              weight: 400 as const,
            },
          ]
        : undefined,
    },
  );
}
