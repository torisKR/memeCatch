import type { Locale } from "@/lib/i18n";

export const PLUS_DAILY_SIGNAL_FOCUS_PARAM = "focus";
export const PLUS_DAILY_SIGNAL_LOCALE_PARAM = "locale";
export const PLUS_DAILY_SIGNAL_SOURCE_PARAM = "from";
export const PLUS_DAILY_SIGNAL_SOURCE = "daily_signal";
export const PLUS_GLOBAL_DAILY_SOURCE = "global_daily";

export type PlusDailySignalLocale = Extract<Locale, "ko" | "en" | "ja" | "zh" | "zh-tw">;
export type PlusActionPremiumSource =
  | typeof PLUS_DAILY_SIGNAL_SOURCE
  | typeof PLUS_GLOBAL_DAILY_SOURCE;

const DAILY_SIGNAL_LOCALES: readonly PlusDailySignalLocale[] = ["ko", "en", "ja", "zh", "zh-tw"];

const SAFE_MEME_FOCUS_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafePlusDailySignalFocusId(value: unknown): value is string {
  return typeof value === "string" && SAFE_MEME_FOCUS_ID.test(value);
}

export function parsePlusDailySignalFocus(
  value: string | string[] | undefined,
): string | undefined {
  return isSafePlusDailySignalFocusId(value) ? value : undefined;
}

export function parsePlusDailySignalLocale(
  value: string | string[] | undefined,
): PlusDailySignalLocale | undefined {
  return DAILY_SIGNAL_LOCALES.includes(value as PlusDailySignalLocale)
    ? (value as PlusDailySignalLocale)
    : undefined;
}

export function parsePlusDailySignalSource(
  value: string | string[] | undefined,
): typeof PLUS_DAILY_SIGNAL_SOURCE | undefined {
  return parsePlusActionPremiumSource(value) === PLUS_DAILY_SIGNAL_SOURCE
    ? PLUS_DAILY_SIGNAL_SOURCE
    : undefined;
}

export function parsePlusActionPremiumSource(
  value: string | string[] | undefined,
): PlusActionPremiumSource | undefined {
  if (typeof value !== "string") return undefined;
  return value === PLUS_DAILY_SIGNAL_SOURCE || value === PLUS_GLOBAL_DAILY_SOURCE
    ? value
    : undefined;
}

export function buildPlusActionPremiumPath(
  memeId: string,
  locale?: PlusDailySignalLocale,
  source: PlusActionPremiumSource = PLUS_DAILY_SIGNAL_SOURCE,
): string {
  const params = new URLSearchParams({
    [PLUS_DAILY_SIGNAL_FOCUS_PARAM]: memeId,
  });
  if (locale) params.set(PLUS_DAILY_SIGNAL_LOCALE_PARAM, locale);
  params.set(PLUS_DAILY_SIGNAL_SOURCE_PARAM, source);
  return `/premium?${params.toString()}`;
}

export function buildPlusDailySignalPremiumPath(
  memeId: string,
  locale?: PlusDailySignalLocale,
): string {
  return buildPlusActionPremiumPath(memeId, locale, PLUS_DAILY_SIGNAL_SOURCE);
}

export function buildPlusGlobalDailyPremiumPath(
  memeId: string,
  locale: PlusDailySignalLocale,
): string {
  return buildPlusActionPremiumPath(memeId, locale, PLUS_GLOBAL_DAILY_SOURCE);
}
