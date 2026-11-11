/** Retired product and affiliate URLs. `permanent: true` is HTTP 308. */
export const RETIRED_PRODUCT_REDIRECTS = [
  { source: "/products", destination: "/", permanent: true },
  { source: "/products/:path*", destination: "/", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/products", destination: "/", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/products/:path*", destination: "/", permanent: true },
  { source: "/go/products", destination: "/", permanent: true },
  { source: "/go/products/:path*", destination: "/", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/go/products", destination: "/", permanent: true },
  { source: "/:locale(en|ja|zh|zh-tw)/go/products/:path*", destination: "/", permanent: true },
  { source: "/api/cron/adpick-hotdeals", destination: "/", permanent: true },
  { source: "/api/creator-products", destination: "/", permanent: true },
  { source: "/api/creator-products/:path*", destination: "/", permanent: true },
  { source: "/admin/creator-products", destination: "/", permanent: true },
  { source: "/admin/creator-products/:path*", destination: "/", permanent: true },
] as const;
