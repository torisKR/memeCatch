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

function normalizedKey(value: string): string {
  return value.normalize("NFC");
}

/**
 * Page params are decoded on Vercel and still percent-encoded under the
 * standalone server. Compare both forms in NFC. An ASCII-only escape such as
 * `%2D` stays literal in decoded mode so a double-encoded hyphen still redirects.
 */
function comparableRequestedKey(
  requestedKey: string,
  inputEncoding: "decoded" | "encoded",
): string | null {
  const decoded = decodedRouteKey(requestedKey);
  if (inputEncoding === "encoded") return decoded === null ? null : normalizedKey(decoded);
  if (decoded && decoded !== requestedKey && /[^\u0000-\u007f]/.test(decoded)) {
    return normalizedKey(decoded);
  }
  return normalizedKey(requestedKey);
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
  const canonicalDecoded = decodedRouteKey(canonicalKey);
  const canonicalDecodedKey = canonicalDecoded === null ? null : normalizedKey(canonicalDecoded);
  const comparableKey = comparableRequestedKey(requestedKey, inputEncoding);
  const isCanonical = comparableKey !== null && comparableKey === canonicalDecodedKey;

  return isCanonical ? null : canonicalPath;
}
