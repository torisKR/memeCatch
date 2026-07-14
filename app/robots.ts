import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api·/go(제휴 리다이렉트)·/auth(콜백)는 크롤 가치 없음 — 색인 낭비 방지
        disallow: ["/admin", "/my", "/api/", "/go/", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
