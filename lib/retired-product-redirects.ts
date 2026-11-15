/**
 * English product URLs go to `/en` in one hop, including the trailing-slash
 * form. These are listed before the default trailing-slash strip, which
 * otherwise turns `/en/products/` into `/en/products` and then into `/en`.
 */
export const EN_PRODUCT_GONE_REDIRECTS = [
  { source: "/en/products", destination: "/en", permanent: true },
  { source: "/en/products/", destination: "/en", permanent: true },
  { source: "/en/products/:path+", destination: "/en", permanent: true },
  { source: "/en/products/:path+/", destination: "/en", permanent: true },
] as const;

/** Same rule Next adds unless `skipTrailingSlashRedirect` is set. */
export const DEFAULT_TRAILING_SLASH_REDIRECT = {
  source: "/:path+/",
  destination: "/:path+",
  permanent: true,
} as const;

/**
 * Plus/Pro membership, checkout, and the Plus-only daily page are gone; the
 * site is ad-supported only. Old links land on the matching home page.
 */
export const RETIRED_MEMBERSHIP_REDIRECTS = [
  { source: "/pricing", destination: "/", permanent: true },
  { source: "/premium", destination: "/", permanent: true },
  { source: "/premium/:path+", destination: "/", permanent: true },
  { source: "/daily", destination: "/", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/pricing", destination: "/:locale", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/daily", destination: "/:locale", permanent: true },
] as const;
