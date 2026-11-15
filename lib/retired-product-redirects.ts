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
