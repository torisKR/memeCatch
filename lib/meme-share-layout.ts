import {
  MEME_SHARE_DESIGN,
  chipLabel,
  type MemeShareCardContent,
  type ShareCardLocale,
} from "@/lib/meme-share-image";
import type { FontAdvances } from "@/lib/ttf-metrics";

export type ShareFontKind = "ko" | "ja" | "zh" | "zh-tw" | "emoji";

export type ShareFontSet = Record<ShareFontKind, FontAdvances>;

export type MemeShareLayout = {
  titleFontSize: number;
  titleLines: string[];
  summaryFontSize: number;
  summaryLine: string | null;
  chipFontSize: number;
  chip: string | null;
  wordmark: string;
  wordmarkFontSize: number;
  logoSize: number;
};

const ELLIPSIS = "…";

function codePoints(text: string): number[] {
  return [...text].map((char) => char.codePointAt(0) ?? 0);
}

function isEmoji(codePoint: number): boolean {
  return codePoint >= 0x1f000
    || (codePoint >= 0x2600 && codePoint <= 0x27bf)
    || codePoint === 0xfe0f
    || codePoint === 0x200d;
}

function isHangul(codePoint: number): boolean {
  return (codePoint >= 0x1100 && codePoint <= 0x11ff)
    || (codePoint >= 0x3130 && codePoint <= 0x318f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3);
}

function isKana(codePoint: number): boolean {
  return (codePoint >= 0x3040 && codePoint <= 0x30ff)
    || (codePoint >= 0x31f0 && codePoint <= 0x31ff)
    || (codePoint >= 0xff66 && codePoint <= 0xff9d);
}

function isHan(codePoint: number): boolean {
  return codePoint >= 0x4e00 && codePoint <= 0x9fff;
}

export function fontKindFor(codePoint: number, locale: ShareCardLocale): ShareFontKind {
  if (isEmoji(codePoint)) return "emoji";
  if (isHangul(codePoint)) return "ko";
  if (isKana(codePoint)) return "ja";
  if (isHan(codePoint)) {
    switch (locale) {
      case "ja":
        return "ja";
      case "zh-tw":
        return "zh-tw";
      case "zh":
        return "zh";
      case "ko":
      case "en":
        return "zh";
      default: {
        const unreachable: never = locale;
        return unreachable;
      }
    }
  }
  return "ko";
}

export function textRuns(text: string, locale: ShareCardLocale): { kind: ShareFontKind; text: string }[] {
  const runs: { kind: ShareFontKind; text: string }[] = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    const kind = fontKindFor(codePoint, locale);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.text += char;
    else runs.push({ kind, text: char });
  }
  return runs;
}

export function measureText(
  text: string,
  fontSize: number,
  locale: ShareCardLocale,
  fonts: ShareFontSet,
): number {
  let width = 0;
  for (const codePoint of codePoints(text)) {
    const kind = fontKindFor(codePoint, locale);
    const font = fonts[kind];
    const advance = font.advances.get(codePoint);
    const units = advance ?? font.unitsPerEm;
    width += (units * fontSize) / font.unitsPerEm;
  }
  return width;
}

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
      (part) => part.segment,
    );
  }
  return [...text];
}

function tokensOf(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

/**
 * Fit `text` into `maxLines` at a fixed font size.
 * Breaks on whitespace (어절 / words). A single token wider than the column
 * breaks by grapheme. The ellipsis is only on the last line, after a word
 * boundary when one still fits.
 */
export function fitShareLines(
  text: string,
  fontSize: number,
  maxLines: number,
  locale: ShareCardLocale,
  fonts: ShareFontSet,
): string[] {
  const maxWidth = MEME_SHARE_DESIGN.maxTextWidth - MEME_SHARE_DESIGN.measureSlack;
  const widthOf = (value: string) => measureText(value, fontSize, locale, fonts);
  const tokens = tokensOf(text.trim());
  const lines: string[] = [];
  let index = 0;
  while (index < tokens.length && lines.length < maxLines) {
    while (index < tokens.length && /^\s+$/.test(tokens[index] ?? "")) index += 1;
    if (index >= tokens.length) break;
    let line = "";
    while (index < tokens.length) {
      const token = tokens[index] ?? "";
      if (/^\s+$/.test(token)) {
        const next = line + token;
        if (line && widthOf(next) <= maxWidth) {
          line = next;
          index += 1;
          continue;
        }
        break;
      }
      const next = line + token;
      if (widthOf(next) <= maxWidth) {
        line = next;
        index += 1;
        continue;
      }
      if (line) break;
      const parts = graphemes(token);
      let piece = "";
      let glyph = 0;
      while (glyph < parts.length && widthOf(piece + parts[glyph]) <= maxWidth) {
        piece += parts[glyph];
        glyph += 1;
      }
      if (!piece) {
        piece = parts[0] ?? "";
        glyph = 1;
      }
      line = piece;
      const rest = parts.slice(glyph).join("");
      if (rest) tokens[index] = rest;
      else index += 1;
      break;
    }
    if (line.trim()) lines.push(line.trimEnd());
  }
  const leftover = tokens.slice(index).join("").trim();
  if (!leftover) return lines;
  const last = lines.length > 0 ? lines[lines.length - 1] ?? "" : "";
  lines[Math.max(lines.length - 1, 0)] = ellipsize(last, widthOf, maxWidth);
  if (lines.length === 0) lines.push(ELLIPSIS);
  return lines.slice(0, maxLines);
}

function ellipsize(
  line: string,
  widthOf: (value: string) => number,
  maxWidth: number,
): string {
  let cut = line.trimEnd();
  const fits = (value: string) => widthOf(value) <= maxWidth;
  if (fits(cut + ELLIPSIS) && cut.length < line.trimEnd().length) return `${cut}${ELLIPSIS}`;
  while (cut && !fits(`${cut}${ELLIPSIS}`)) {
    const space = cut.lastIndexOf(" ");
    if (space > 0 && fits(`${cut.slice(0, space)}${ELLIPSIS}`)) {
      cut = cut.slice(0, space);
      break;
    }
    const parts = graphemes(cut);
    parts.pop();
    cut = parts.join("");
  }
  return cut ? `${cut.trimEnd()}${ELLIPSIS}` : ELLIPSIS;
}

export function layoutMemeShareCard(card: MemeShareCardContent, fonts: ShareFontSet): MemeShareLayout {
  const titleLines = fitShareLines(
    card.title,
    MEME_SHARE_DESIGN.titleFontSize,
    MEME_SHARE_DESIGN.titleMaxLines,
    card.locale,
    fonts,
  );
  const summary = card.summary
    ? fitShareLines(
      card.summary,
      MEME_SHARE_DESIGN.summaryFontSize,
      MEME_SHARE_DESIGN.summaryMaxLines,
      card.locale,
      fonts,
    )[0] ?? null
    : null;
  const chipText = chipLabel(card);
  const chip = chipText
    ? fitShareLines(
      chipText,
      MEME_SHARE_DESIGN.chipFontSize,
      1,
      card.locale,
      fonts,
    )[0] ?? null
    : null;
  return {
    titleFontSize: MEME_SHARE_DESIGN.titleFontSize,
    titleLines,
    summaryFontSize: MEME_SHARE_DESIGN.summaryFontSize,
    summaryLine: summary,
    chipFontSize: MEME_SHARE_DESIGN.chipFontSize,
    chip,
    wordmark: "MemeCatch",
    wordmarkFontSize: MEME_SHARE_DESIGN.wordmarkFontSize,
    logoSize: MEME_SHARE_DESIGN.logoSize,
  };
}
