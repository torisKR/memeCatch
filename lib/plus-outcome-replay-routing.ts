const REPLAY_SHORT_ID_PATTERN = /^[^/?#\s]{1,120}$/u;
const REPLAY_LOCALES = ["ko", "en", "ja", "zh", "zh-tw"] as const;
const replayLocaleSet = new Set<string>(REPLAY_LOCALES);

export const PLUS_OUTCOME_REPLAY_PARAM = "replay";
export const PLUS_OUTCOME_REPLAY_LOCALE_PARAM = "replay_locale";
export const PLUS_OUTCOME_REPLAY_SOURCE = "outcome_history";

export type PlusOutcomeReplayLocale = (typeof REPLAY_LOCALES)[number];

export type PlusOutcomeReplayRequest = {
  shortId: string;
  locale: PlusOutcomeReplayLocale;
};

export function parsePlusOutcomeReplayShortId(value: unknown): string | null {
  const candidate = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : null
    : value;
  if (typeof candidate !== "string") return null;
  const shortId = candidate.trim();
  return REPLAY_SHORT_ID_PATTERN.test(shortId) ? shortId : null;
}

export function parsePlusOutcomeReplayLocale(value: unknown): PlusOutcomeReplayLocale | null {
  const candidate = Array.isArray(value)
    ? value.length === 1
      ? value[0]
      : null
    : value;
  return typeof candidate === "string" && replayLocaleSet.has(candidate)
    ? candidate as PlusOutcomeReplayLocale
    : null;
}

export function parsePlusOutcomeReplayRequest({
  shortId: shortIdValue,
  locale: localeValue,
  source: sourceValue,
  focus,
  dailySignalLocale,
}: {
  shortId: unknown;
  locale: unknown;
  source: unknown;
  focus?: unknown;
  dailySignalLocale?: unknown;
}): PlusOutcomeReplayRequest | null {
  if (
    sourceValue !== PLUS_OUTCOME_REPLAY_SOURCE ||
    focus !== undefined ||
    dailySignalLocale !== undefined
  ) {
    return null;
  }
  const shortId = parsePlusOutcomeReplayShortId(shortIdValue);
  const locale = parsePlusOutcomeReplayLocale(localeValue);
  return shortId && locale ? { shortId, locale } : null;
}

export function buildPlusOutcomeReplayPath(
  shortId: string,
  locale: PlusOutcomeReplayLocale,
): string | null {
  const parsed = parsePlusOutcomeReplayShortId(shortId);
  if (!parsed) return null;
  return `/premium?${PLUS_OUTCOME_REPLAY_PARAM}=${encodeURIComponent(parsed)}&${PLUS_OUTCOME_REPLAY_LOCALE_PARAM}=${encodeURIComponent(locale)}&from=${PLUS_OUTCOME_REPLAY_SOURCE}`;
}
