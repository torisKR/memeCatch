import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { fitShareCardBytes } from "@/lib/jpeg-encode";
import { loadSharePhoto, prepareSharePhoto, sharePhotoObjectPosition, type PreparedSharePhoto } from "@/lib/meme-share-photo";
import { renderOgDefaultImage } from "@/lib/og-default-card";
import {
  MEME_SHARE_DESIGN,
  SHARE_PHOTO_PILL,
  SHARE_PHOTO_SCRIM,
  type MemeShareCardContent,
} from "@/lib/meme-share-image";
import {
  fontKindFor,
  layoutMemeShareCard,
  type ShareFontKind,
  type ShareFontSet,
} from "@/lib/meme-share-layout";
import { readFontAdvances, type FontAdvances } from "@/lib/ttf-metrics";

type EmojiFont = { data: Buffer; advances: FontAdvances };

type LoadedShareFonts = {
  files: Record<Exclude<ShareFontKind, "emoji">, Buffer>;
  emoji: EmojiFont[];
  metrics: ShareFontSet;
};

const FAMILY: Record<ShareFontKind, string> = {
  ko: "ShareKo",
  ja: "ShareJa",
  zh: "ShareZh",
  "zh-tw": "ShareZhTw",
  emoji: "ShareEmoji",
};

let fontsPromise: Promise<LoadedShareFonts> | null = null;

function loadShareFonts(): Promise<LoadedShareFonts> {
  fontsPromise ??= (async () => {
    const emojiDirectory = join(process.cwd(), "assets/og-fonts/share/emoji");
    const [ko, ja, zh, zhTw, emojiNames] = await Promise.all([
      readFile(join(process.cwd(), "assets/og-fonts/share/ko.otf")),
      readFile(join(process.cwd(), "assets/og-fonts/share/ja.otf")),
      readFile(join(process.cwd(), "assets/og-fonts/share/zh.otf")),
      readFile(join(process.cwd(), "assets/og-fonts/share/zh-tw.otf")),
      readdir(emojiDirectory),
    ]);
    const emoji = await Promise.all(
      emojiNames.filter((name) => name.endsWith(".ttf")).sort().map(async (name) => {
        const data = await readFile(join(emojiDirectory, name));
        return { data, advances: readFontAdvances(data) };
      }),
    );
    const emojiAdvances = new Map<number, number>();
    let emojiUnits = 1000;
    for (const font of emoji) {
      emojiUnits = font.advances.unitsPerEm;
      for (const [codePoint, advance] of font.advances.advances) {
        if (!emojiAdvances.has(codePoint)) emojiAdvances.set(codePoint, advance);
      }
    }
    return {
      files: { ko, ja, zh, "zh-tw": zhTw },
      emoji,
      metrics: {
        ko: readFontAdvances(ko),
        ja: readFontAdvances(ja),
        zh: readFontAdvances(zh),
        "zh-tw": readFontAdvances(zhTw),
        emoji: { unitsPerEm: emojiUnits, advances: emojiAdvances },
      },
    };
  })();
  return fontsPromise;
}

export function emojiFaceName(fonts: EmojiFont[], codePoint: number): string | null {
  const index = fonts.findIndex((font) => font.advances.advances.has(codePoint));
  return index >= 0 ? `ShareEmoji${index}` : null;
}

function fontRuns(
  text: string,
  locale: MemeShareCardContent["locale"],
  emoji: EmojiFont[],
): { family: string; text: string }[] {
  const runs: { family: string; text: string }[] = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const kind = fontKindFor(codePoint, locale);
    const family = kind === "emoji" ? emojiFaceName(emoji, codePoint) ?? FAMILY.ko : FAMILY[kind];
    const last = runs[runs.length - 1];
    if (last && last.family === family) last.text += char;
    else runs.push({ family, text: char });
  }
  const folded: { family: string; text: string }[] = [];
  for (const run of runs) {
    const previous = folded[folded.length - 1];
    if (previous && run.text.trim().length === 0) {
      previous.text += run.text;
      continue;
    }
    folded.push({ family: run.family, text: run.text });
  }
  return folded.map((run) => ({
    family: run.family,
    text: run.text.replaceAll(" ", "\u00A0"),
  }));
}

function ShareLine({
  text,
  locale,
  fontSize,
  color,
  emoji,
}: {
  text: string;
  locale: MemeShareCardContent["locale"];
  fontSize: number;
  color: string;
  emoji: EmojiFont[];
}) {
  return (
    <div style={{ display: "flex", justifyContent: "center", fontSize, color, lineHeight: 1.15, whiteSpace: "pre" }}>
      {fontRuns(text, locale, emoji).map((run, index) => (
        <div
          key={`${run.family}-${index}`}
          style={{ display: "flex", fontFamily: run.family, whiteSpace: "pre" }}
        >
          {run.text}
        </div>
      ))}
    </div>
  );
}

export async function shareFontMetrics(): Promise<ShareFontSet> {
  return (await loadShareFonts()).metrics;
}

async function cardPhoto(card: MemeShareCardContent): Promise<PreparedSharePhoto | null> {
  try {
    if (card.photoBytes) return prepareSharePhoto(card.photoBytes);
    if (card.photoUrl) return await loadSharePhoto(card.photoUrl);
  } catch {
    return null;
  }
  return null;
}

export async function renderMemeShareCard(card: MemeShareCardContent): Promise<Response> {
  const loaded = await loadShareFonts();
  const photo = await cardPhoto(card);
  const layout = layoutMemeShareCard(card, loaded.metrics);
  const painted = [
    layout.wordmark,
    ...layout.titleLines,
    layout.summaryLine ?? "",
    layout.chip ?? "",
  ].join("");
  const emojiPoints = new Set<number>();
  for (const char of painted) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (loaded.metrics.emoji.advances.has(codePoint)) emojiPoints.add(codePoint);
  }
  const emojiFaces = loaded.emoji.flatMap((font, index) => {
    const ownsPaintedGlyph = [...emojiPoints].some(
      (codePoint) => emojiFaceName(loaded.emoji, codePoint) === `ShareEmoji${index}`,
    );
    if (!ownsPaintedGlyph) return [];
    return [{
      name: `ShareEmoji${index}`,
      data: font.data,
      weight: 700 as const,
      style: "normal" as const,
    }];
  });
  const fonts = [
    { name: FAMILY.ko, data: loaded.files.ko, weight: 700 as const, style: "normal" as const },
    { name: FAMILY.ja, data: loaded.files.ja, weight: 700 as const, style: "normal" as const },
    { name: FAMILY.zh, data: loaded.files.zh, weight: 700 as const, style: "normal" as const },
    { name: FAMILY["zh-tw"], data: loaded.files["zh-tw"], weight: 700 as const, style: "normal" as const },
    ...emojiFaces,
  ];
  const scrimLeft = (MEME_SHARE_DESIGN.width - MEME_SHARE_DESIGN.centerSquare) / 2;
  const pill = photo ? SHARE_PHOTO_PILL : "transparent";
  return new ImageResponse(
    (
      <div
        style={{
          width: MEME_SHARE_DESIGN.width,
          height: MEME_SHARE_DESIGN.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: photo ? "#000000" : MEME_SHARE_DESIGN.background,
          position: "relative",
        }}
      >
        {photo ? (
          // Satori only paints a raw img. next/image is not available inside ImageResponse.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={photo.dataUrl}
            width={MEME_SHARE_DESIGN.width}
            height={MEME_SHARE_DESIGN.height}
            style={{
              position: "absolute",
              width: MEME_SHARE_DESIGN.width,
              height: MEME_SHARE_DESIGN.height,
              objectFit: "cover",
              objectPosition: sharePhotoObjectPosition(photo.width, photo.height),
            }}
          />
        ) : null}
        {photo ? (
          <div
            style={{
              position: "absolute",
              left: scrimLeft,
              top: 0,
              width: MEME_SHARE_DESIGN.centerSquare,
              height: MEME_SHARE_DESIGN.centerSquare,
              display: "flex",
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,${SHARE_PHOTO_SCRIM.top}), rgba(0,0,0,${SHARE_PHOTO_SCRIM.bottom}))`,
            }}
          />
        ) : null}
        <div
          style={{
            width: MEME_SHARE_DESIGN.maxTextWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: pill,
              borderRadius: 999,
              padding: photo ? "6px 12px" : "0px",
            }}
          >
            <div
              style={{
                width: layout.logoSize,
                height: layout.logoSize,
                borderRadius: 999,
                backgroundColor: "#F74610",
              }}
            />
            <div style={{ display: "flex", marginLeft: 8 }}>
              <ShareLine
                text={layout.wordmark}
                locale={card.locale}
                fontSize={layout.wordmarkFontSize}
                color={MEME_SHARE_DESIGN.foreground}
                emoji={loaded.emoji}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
            {layout.titleLines.map((line, index) => (
              <ShareLine
                key={`${index}-${line}`}
                text={line}
                locale={card.locale}
                fontSize={layout.titleFontSize}
                color={MEME_SHARE_DESIGN.foreground}
                emoji={loaded.emoji}
              />
            ))}
          </div>
          {layout.summaryLine ? (
            <div
              style={{
                display: "flex",
                marginTop: 16,
                backgroundColor: pill,
                borderRadius: 999,
                padding: photo ? "4px 12px" : "0px",
              }}
            >
              <ShareLine
                text={layout.summaryLine}
                locale={card.locale}
                fontSize={layout.summaryFontSize}
                color={MEME_SHARE_DESIGN.summary}
                emoji={loaded.emoji}
              />
            </div>
          ) : null}
          {layout.chip ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                backgroundColor: photo ? SHARE_PHOTO_PILL : MEME_SHARE_DESIGN.chipBackground,
                borderRadius: 999,
                padding: "6px 14px",
              }}
            >
              <ShareLine
                text={layout.chip}
                locale={card.locale}
                fontSize={layout.chipFontSize}
                color={MEME_SHARE_DESIGN.foreground}
                emoji={loaded.emoji}
              />
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      width: MEME_SHARE_DESIGN.width,
      height: MEME_SHARE_DESIGN.height,
      fonts,
    },
  );
}

/** Same header next/og ImageResponse sets. Main's Arabic meme image route returned that response. */
export function ogImageCacheControl(): string {
  return process.env.NODE_ENV === "development"
    ? "no-cache, no-store"
    : "public, max-age=0, must-revalidate";
}

function cachedImage(body: Uint8Array, contentType: string): Response {
  return new Response(Buffer.from(body), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": ogImageCacheControl(),
    },
  });
}

async function defaultCard(locale: string): Promise<Response> {
  const rendered = await renderOgDefaultImage(locale);
  const bytes = new Uint8Array(await rendered.arrayBuffer());
  const contentType = rendered.headers.get("content-type") ?? "image/png";
  return cachedImage(bytes, contentType);
}

/**
 * A missing meme or a failed render, including a font error thrown while the
 * image stream is read, serves the locale default card. Cards over 1MB become
 * JPEG so a client such as KakaoTalk can fetch them.
 */
export async function respondWithShareCard(
  locale: string,
  card: MemeShareCardContent | null,
  render: (card: MemeShareCardContent) => Promise<Response> = renderMemeShareCard,
): Promise<Response> {
  if (!card?.title.trim()) return defaultCard(locale);
  try {
    const rendered = await render(card);
    const bytes = Buffer.from(await rendered.arrayBuffer());
    if (bytes.byteLength === 0) return defaultCard(locale);
    const fitted = fitShareCardBytes(bytes);
    return cachedImage(fitted.body, fitted.contentType);
  } catch {
    return defaultCard(locale);
  }
}
