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
 * Expands the stable short-id route to the current display slug.
 *
 * Slugged aliases deliberately remain renderable. Slugs are editable data, so
 * permanently redirecting an old slug to the current slug can create a browser
 * cached redirect loop when the stored slug changes again. Canonical metadata
 * still consolidates every slugged alias onto the current document URL.
 */
export function canonicalMemeRedirectPath(
  requestedKey: string,
  meme: CanonicalMemeIdentity,
  inputEncoding: "decoded" | "encoded" = "decoded",
): string | null {
  const canonicalPath = localizedMemePath(meme.locale, meme.shortId, meme.slug);
  // Page params are already decoded by Next; only the proxy sees encoded URL segments.
  // Decoding page params again incorrectly accepts double-encoded aliases as canonical.
  const comparableKey = inputEncoding === "encoded" ? decodedRouteKey(requestedKey) : requestedKey;
  return comparableKey === meme.shortId ? canonicalPath : null;
}
