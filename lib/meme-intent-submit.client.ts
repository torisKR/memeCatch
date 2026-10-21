export const MEME_INTENT_SUBMIT_EVENT = "memecatch:intent-search";

const STORAGE_KEY = "mc_intent_search";
const MAX_QUERY_LENGTH = 120;
const MIN_QUERY_LENGTH = 2;
const MARKER_TTL_MS = 30_000;

export type MemeIntentLocale = "ko";

type IntentSubmitDetail = {
  locale: MemeIntentLocale;
  query: string;
};

function normalizeQuery(query: string) {
  const value = query.trim();
  return value.length >= MIN_QUERY_LENGTH && value.length <= MAX_QUERY_LENGTH
    ? value
    : null;
}

export function recordMemeIntentSubmit(
  query: string,
  locale: string,
  now = Date.now(),
) {
  const normalized = normalizeQuery(query);
  if (locale !== "ko" || !normalized || typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      locale,
      query: normalized,
      createdAt: now,
    }));
    return true;
  } catch {
    return false;
  }
}

export function consumeMemeIntentSubmit(
  query: string,
  locale: string,
  now = Date.now(),
) {
  const normalized = normalizeQuery(query);
  if (locale !== "ko" || !normalized || typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    // Remove before any provider work so back/forward navigation and remounts cannot replay it.
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<IntentSubmitDetail> & { createdAt?: unknown };
    const createdAt = Number(parsed.createdAt);
    return Number.isFinite(createdAt)
      && parsed.locale === locale
      && parsed.query === normalized
      && createdAt <= now
      && now - createdAt <= MARKER_TTL_MS;
  } catch {
    return false;
  }
}

export function signalMemeIntentSubmit(
  query: string,
  locale: string,
  now = Date.now(),
) {
  const normalized = normalizeQuery(query);
  if (!normalized || !recordMemeIntentSubmit(normalized, locale, now)) return false;
  const detail: IntentSubmitDetail = { locale: "ko", query: normalized };
  window.dispatchEvent(new CustomEvent<IntentSubmitDetail>(MEME_INTENT_SUBMIT_EVENT, { detail }));
  return true;
}

export function isMemeIntentSubmitEvent(
  event: Event,
  query: string,
  locale: string,
): event is CustomEvent<IntentSubmitDetail> {
  if (!(event instanceof CustomEvent)) return false;
  const detail = event.detail as Partial<IntentSubmitDetail> | undefined;
  return detail?.locale === locale && detail.query === query;
}
