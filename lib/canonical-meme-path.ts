import { localizedMemePath, type OgShareLocale } from "@/lib/i18n-routing";

type CanonicalMemeIdentity = {
  shortId: string;
  slug: string;
  locale: OgShareLocale;
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
 * One NFC canonical path. The stored slug is normalized before encoding so an
 * NFD row and an NFD request share the uppercase percent-encoded NFC URL.
 * `inputEncoding` stays in the signature because the proxy still passes
 * "encoded" and pages pass "decoded"; both compare the raw key. Only the
 * exact encoded key and the exact decoded NFC key are already canonical.
 * NFD, lowercase percent-encoding, and `%2D` therefore 308 once.
 */
export function canonicalMemeRedirectPath(
  requestedKey: string,
  meme: CanonicalMemeIdentity,
  inputEncoding: "decoded" | "encoded" = "decoded",
): string | null {
  switch (inputEncoding) {
    case "encoded":
    case "decoded":
      break;
    default: {
      const unreachable: never = inputEncoding;
      return unreachable;
    }
  }
  const slug = meme.slug.normalize("NFC");
  const canonicalPath = localizedMemePath(meme.locale, meme.shortId, slug);
  const encodedKey = canonicalPath.slice(canonicalPath.lastIndexOf("/") + 1);
  const decodedKey = decodedRouteKey(encodedKey);
  if (requestedKey === encodedKey) return null;
  if (decodedKey !== null && requestedKey === decodedKey) return null;
  return canonicalPath;
}
