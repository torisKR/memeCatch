import type { MetadataRoute } from "next";
import { SEO_CONTENT_LOCALES, localizedPath } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";

const PRIVATE_PATHS = [
  "/admin",
  "/my",
  "/api/",
  "/go/",
  "/auth/",
  "/submit",
  "/login",
  "/premium",
  "/community/new",
  "/products/new",
  "/products/mine",
] as const;

const DISALLOWED_PATHS = [
  ...PRIVATE_PATHS,
  ...SEO_CONTENT_LOCALES.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => localizedPath(path, locale)),
  ),
];

/** 검색 색인·검색 답변 인용용 크롤러. 공개 문서만 읽고 운영 경로는 보지 못한다. */
const SEARCH_CRAWLER_USER_AGENTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "PerplexityBot",
  "Claude-SearchBot",
] as const;

/** 사용자가 요청한 현재 페이지 조회. 모델 학습용 크롤링과 구분한다. */
const USER_FETCH_USER_AGENTS = [
  "ChatGPT-User",
  "Perplexity-User",
  "Claude-User",
] as const;

/** 모델 학습·데이터셋 수집용 크롤러는 허용하지 않는다. */
const MODEL_TRAINING_USER_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  // Google-Extended opt-out은 Google 검색 색인이나 AI Overviews 포함 여부를
  // 제어하지 않는다. Gemini 모델 개선·grounding 사용에 관한 별도 토큰이다.
  "Google-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api·/go(제휴 리다이렉트)·/auth(콜백)는 크롤 가치 없음 — 색인 낭비 방지
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: [...SEARCH_CRAWLER_USER_AGENTS, ...USER_FETCH_USER_AGENTS],
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        // AdSense 문맥 크롤러도 공개 문서만 확인하며 관리자·API 경로는 제외한다.
        userAgent: "Mediapartners-Google",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      {
        userAgent: [...MODEL_TRAINING_USER_AGENTS],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
