/**
 * Locales with a `/<locale>/rankings` URL. Korean stays on `/rankings`.
 * Kept free of path aliases so `next.config.ts` can import it at startup.
 * `zh-tw` is listed before `zh` so the rewrite matches the full prefix.
 */
export const RANKINGS_LOCALE_PREFIXES = [
  "en",
  "ja",
  "zh-tw",
  "zh",
  "th",
  "vi",
  "mn",
  "id",
  "ar",
  "ru",
  "es",
  "de",
  "fr",
  "it",
  "pt",
  "tr",
  "ms",
  "hi",
] as const;

export function rankingsLocaleRewriteSource(): string {
  return `/:locale(${RANKINGS_LOCALE_PREFIXES.join("|")})/rankings`;
}
