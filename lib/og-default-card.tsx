import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  OG_DEFAULT_DESIGN,
  ogDefaultCopy,
  resolveOgDefaultLocale,
  type OgDefaultLocale,
} from "@/lib/og-default-image";

const fontCache = new Map<OgDefaultLocale, Promise<Buffer>>();

function readFontFile(locale: OgDefaultLocale): Promise<Buffer> {
  // Literal paths so the standalone file trace includes every font.
  switch (locale) {
    case "ko":
      return readFile(join(process.cwd(), "assets/og-fonts/ko.ttf"));
    case "en":
      return readFile(join(process.cwd(), "assets/og-fonts/en.ttf"));
    case "ja":
      return readFile(join(process.cwd(), "assets/og-fonts/ja.ttf"));
    case "zh":
      return readFile(join(process.cwd(), "assets/og-fonts/zh.ttf"));
    case "zh-tw":
      return readFile(join(process.cwd(), "assets/og-fonts/zh-tw.ttf"));
    case "ar":
      return readFile(join(process.cwd(), "assets/og-fonts/ar.ttf"));
    default: {
      const unreachable: never = locale;
      return unreachable;
    }
  }
}

function loadFont(locale: OgDefaultLocale): Promise<Buffer> {
  const cached = fontCache.get(locale);
  if (cached) return cached;
  const pending = readFontFile(locale);
  fontCache.set(locale, pending);
  return pending;
}

export async function renderOgDefaultImage(locale: string | null | undefined) {
  const resolved = resolveOgDefaultLocale(locale);
  // Satori does not join this Arabic subset. Chrome/HarfBuzz does.
  // scripts/render-og-ar.mjs writes the committed card.
  if (resolved === "ar") {
    const bytes = await readFile(join(process.cwd(), "assets/og/ar.png"));
    return new Response(bytes, {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  }
  const copy = ogDefaultCopy(resolved);
  const font = await loadFont(resolved);
  const { logoSize, wordmarkSize, titleFontSize, titleLineHeight } = OG_DEFAULT_DESIGN;
  return new ImageResponse(
    (
      <div
        style={{
          width: OG_DEFAULT_DESIGN.width,
          height: OG_DEFAULT_DESIGN.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG_DEFAULT_DESIGN.background,
          color: OG_DEFAULT_DESIGN.foreground,
          fontFamily: "OgSans",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: logoSize,
                height: logoSize,
                borderRadius: 16,
                backgroundColor: OG_DEFAULT_DESIGN.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="38" height="38" viewBox="0 0 64 64" fill="none">
                <path
                  d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8"
                  stroke={OG_DEFAULT_DESIGN.icon}
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <circle cx="49.2" cy="20" r="6" fill={OG_DEFAULT_DESIGN.icon} />
                <path fill={OG_DEFAULT_DESIGN.icon} d="M14.5 44.5 10.5 58.5 25.5 53.5Z" />
              </svg>
            </div>
            <div style={{ marginLeft: 16, fontSize: wordmarkSize, fontWeight: 700 }}>
              MemeCatch
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: 28,
            }}
          >
            {copy.lines.map((line) => (
              <div
                key={line}
                style={{
                  fontSize: titleFontSize,
                  fontWeight: 700,
                  lineHeight: titleLineHeight,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: OG_DEFAULT_DESIGN.width,
      height: OG_DEFAULT_DESIGN.height,
      fonts: [
        {
          name: "OgSans",
          data: font,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
