import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  OG_DEFAULT_DESIGN,
  ogContentBox,
  ogDefaultCopy,
  ogTitleFontSize,
  resolveOgDefaultLocale,
  type OgDefaultLocale,
} from "@/lib/og-default-image";

/**
 * Satori shapes Arabic letters but keeps word order left to right.
 * Reverse the Arabic words so the painted line reads شرح الميمات الكورية
 * from the right. The metadata alt stays the logical string.
 */
function displayTitle(locale: OgDefaultLocale, title: string): string {
  if (locale !== "ar") return title;
  const dash = title.indexOf("—");
  const arabic = title.slice(dash + 1).trim();
  const visual = arabic.split(/\s+/).reverse().join(" ");
  return `${title.slice(0, dash + 1)} ${visual}`;
}

const fontCache = new Map<OgDefaultLocale, Promise<Buffer>>();

function loadFont(locale: OgDefaultLocale): Promise<Buffer> {
  const cached = fontCache.get(locale);
  if (cached) return cached;
  const pending = readFile(join(process.cwd(), "assets/og-fonts", `${locale}.ttf`));
  fontCache.set(locale, pending);
  return pending;
}

export async function renderOgDefaultImage(locale: string | null | undefined) {
  const resolved = resolveOgDefaultLocale(locale);
  const copy = ogDefaultCopy(resolved);
  const box = ogContentBox();
  const titleSize = ogTitleFontSize(copy.title);
  const font = await loadFont(resolved);
  return new ImageResponse(
    (
      <div
        style={{
          width: OG_DEFAULT_DESIGN.width,
          height: OG_DEFAULT_DESIGN.height,
          display: "flex",
          backgroundColor: OG_DEFAULT_DESIGN.background,
          color: OG_DEFAULT_DESIGN.foreground,
          fontFamily: "OgSans",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: box.margin,
            top: box.margin,
            width: box.width,
            height: box.height,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
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
                  stroke="#FFF9F5"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <circle cx="49.2" cy="20" r="6" fill="#FFF9F5" />
                <path fill="#FFF9F5" d="M14.5 44.5 10.5 58.5 25.5 53.5Z" />
              </svg>
            </div>
            <div style={{ marginLeft: 16, fontSize: 36, fontWeight: 700 }}>
              MemeCatch
            </div>
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
            }}
          >
            {displayTitle(resolved, copy.title)}
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
