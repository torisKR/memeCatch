import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { renderOgDefaultImage } from "@/lib/og-default-card";
import {
  MEME_SHARE_DESIGN,
  type MemeShareCardContent,
} from "@/lib/meme-share-image";
import {
  layoutMemeShareCard,
  textRuns,
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

function ShareLine({
  text,
  locale,
  fontSize,
  color,
}: {
  text: string;
  locale: MemeShareCardContent["locale"];
  fontSize: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "center", fontSize, color, lineHeight: 1.15 }}>
      {textRuns(text, locale).map((run, index) => (
        <div key={`${run.kind}-${index}`} style={{ display: "flex", fontFamily: FAMILY[run.kind] }}>
          {run.text}
        </div>
      ))}
    </div>
  );
}

export async function shareFontMetrics(): Promise<ShareFontSet> {
  return (await loadShareFonts()).metrics;
}

export async function renderMemeShareCard(card: MemeShareCardContent): Promise<Response> {
  const loaded = await loadShareFonts();
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
  const emojiData: Buffer[] = [];
  for (const codePoint of emojiPoints) {
    const font = loaded.emoji.find((item) => item.advances.advances.has(codePoint));
    if (font && !emojiData.includes(font.data)) emojiData.push(font.data);
  }
  const fonts = [
    { name: FAMILY.ko, data: loaded.files.ko, weight: 700 as const, style: "normal" as const },
    { name: FAMILY.ja, data: loaded.files.ja, weight: 700 as const, style: "normal" as const },
    { name: FAMILY.zh, data: loaded.files.zh, weight: 700 as const, style: "normal" as const },
    { name: FAMILY["zh-tw"], data: loaded.files["zh-tw"], weight: 700 as const, style: "normal" as const },
    ...emojiData.map((data) => ({
      name: FAMILY.emoji,
      data,
      weight: 700 as const,
      style: "normal" as const,
    })),
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: MEME_SHARE_DESIGN.width,
          height: MEME_SHARE_DESIGN.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: MEME_SHARE_DESIGN.background,
        }}
      >
        <div
          style={{
            width: MEME_SHARE_DESIGN.maxTextWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
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
              />
            ))}
          </div>
          {layout.summaryLine ? (
            <div style={{ display: "flex", marginTop: 16 }}>
              <ShareLine
                text={layout.summaryLine}
                locale={card.locale}
                fontSize={layout.summaryFontSize}
                color={MEME_SHARE_DESIGN.summary}
              />
            </div>
          ) : null}
          {layout.chip ? (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                backgroundColor: MEME_SHARE_DESIGN.chipBackground,
                borderRadius: 999,
                padding: "6px 14px",
              }}
            >
              <ShareLine
                text={layout.chip}
                locale={card.locale}
                fontSize={layout.chipFontSize}
                color={MEME_SHARE_DESIGN.foreground}
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

/** A missing meme or a failed render serves the locale default card, never a 404. */
export async function respondWithShareCard(
  locale: string,
  card: MemeShareCardContent | null,
  render: (card: MemeShareCardContent) => Promise<Response> = renderMemeShareCard,
): Promise<Response> {
  if (!card?.title.trim()) return renderOgDefaultImage(locale);
  try {
    return await render(card);
  } catch {
    return renderOgDefaultImage(locale);
  }
}
