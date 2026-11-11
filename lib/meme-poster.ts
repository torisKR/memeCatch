import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { SafetyLevel } from "@/lib/labels";
import { getSafetySignalCopy } from "@/lib/safety-copy";

export const POSTER_CHARCOAL = "#141414";
export const POSTER_ORANGE = "#F05A28";
export const POSTER_CREAM = "#F4EFE6";

const KO_BADGE = {
  green: "써도 됨",
  yellow: "주의",
  gray: "이미 늦음",
  red: "금기",
} as const satisfies Record<SafetyLevel, string>;

const TONE = {
  green: { background: "#146c43", foreground: POSTER_CREAM },
  yellow: { background: "#8a5a12", foreground: "#fff6df" },
  gray: { background: "#3f3f46", foreground: POSTER_CREAM },
  red: { background: "#8f1d1d", foreground: "#ffe8e4" },
} as const satisfies Record<SafetyLevel, { background: string; foreground: string }>;

const SAFE_SHORT_ID = /^[A-Za-z0-9_-]{4,64}$/;

export type StoredArtExtension = "png" | "jpg" | "webp";

export function posterBadgeLabel(level: SafetyLevel, locale: SeoRouteLocale): string {
  if (locale === "ko") return KO_BADGE[level];
  return getSafetySignalCopy(locale).levels[level].label;
}

export function posterBadgeTone(level: SafetyLevel): { background: string; foreground: string } {
  return TONE[level];
}

export function memeArtAlt(title: string): string {
  return `${title} 상징 일러스트`;
}

export function memeArtPrompt(meme: {
  title: string;
  meaning: string;
  concept?: string | null;
}): string {
  const concept = meme.concept?.trim() || meme.meaning.trim();
  return `Abstract symbolic illustration for the Korean meme '${meme.title}' meaning '${meme.meaning}'. Single central object representing ${concept}, grainy risograph print style, deep charcoal background with a large orange (#F05A28) speech-bubble shape, cream (#F4EFE6) accents. Focal object in upper-right, empty lower-left for text. No text, no letters, no logos, no real people, no faces of public figures.`;
}

export function memeArtPublicPath(shortId: string, extension: StoredArtExtension): string {
  if (!SAFE_SHORT_ID.test(shortId)) throw new Error("invalid meme short id");
  return `/api/media/meme-art/${shortId}.${extension}`;
}

export function memeArtObjectName(shortId: string, extension: StoredArtExtension): string {
  if (!SAFE_SHORT_ID.test(shortId)) throw new Error("invalid meme short id");
  return `${shortId}.${extension}`;
}

export function isPublicMemeArtPath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/api/media/meme-art/") && !value.includes("..");
}
