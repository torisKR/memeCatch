import type { MetadataRoute } from "next";
import { SEO_CONTENT_LOCALES, localizedPath } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";

const PRIVATE_PATHS = ["/admin", "/my", "/api/", "/go/", "/auth/"] as const;

const DISALLOWED_PATHS = [
  ...PRIVATE_PATHS,
  ...SEO_CONTENT_LOCALES.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => localizedPath(path, locale)),
  ),
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api·/go(제휴 리다이렉트)·/auth(콜백)는 크롤 가치 없음 — 색인 낭비 방지
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
