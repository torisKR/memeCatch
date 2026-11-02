import { localizedMemePath, type SeoRouteLocale } from "@/lib/i18n-routing";

type CanonicalMemeIdentity = {
  shortId: string;
  slug: string;
  locale: SeoRouteLocale;
};

function decodedRouteKey(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Known duplicate entries mapped to a single authoritative canonical representative.
 * Prevents redundant crawl targets and "thin/duplicate content" AdSense penalties.
 * (e.g. Hiddink 2002 World Cup quote variations)
 */
export const CANONICAL_MEME_ALIAS_MAP: Record<string, string> = {
  // Hiddink "I am still hungry" duplicates -> canonical: gnact78h (히딩크 "나는 아직 배가 고프다")
  cssqxwmb: "gnact78h",
  "9ajbp6w6": "gnact78h",
};

/**
 * Returns a same-site canonical destination for a valid meme alias, or null
 * when the requested route key already identifies the canonical document.
 */
export function canonicalMemeRedirectPath(
  requestedKey: string,
  meme: CanonicalMemeIdentity,
  inputEncoding: "decoded" | "encoded" = "decoded",
): string | null {
  const canonicalPath = localizedMemePath(meme.locale, meme.shortId, meme.slug);
  const canonicalKey = canonicalPath.slice(canonicalPath.lastIndexOf("/") + 1);
  const canonicalDecodedKey = decodedRouteKey(canonicalKey);
  // Page params are already decoded by Next; only the proxy sees encoded URL segments.
  // Decoding page params again incorrectly accepts double-encoded aliases as canonical.
  const comparableKey = inputEncoding === "encoded" ? decodedRouteKey(requestedKey) : requestedKey;
  const isCanonical = comparableKey !== null && comparableKey === canonicalDecodedKey;

  return isCanonical ? null : canonicalPath;
}
