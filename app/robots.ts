import type { MetadataRoute } from "next";
import { SEO_CONTENT_LOCALES, localizedPath } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";

const PRIVATE_PATHS = ['/admin', '/my', '/api/', '/go/', '/auth/', '/submit', '/login', '/premium'] as const;

const DISALLOWED_PATHS = [
  ...PRIVATE_PATHS,
  ...SEO_CONTENT_LOCALES.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => localizedPath(path, locale)),
  ),
];

/**
 * GEO 결정(글로벌 피벗): 와일드카드(*) 규칙이 이미 이 봇들을 막지 않지만,
 * 답변엔진(ChatGPT·Claude·Perplexity·Gemini)이 인용하려면 명시적 허용 신호가
 * 필요하다는 판단으로 별도 규칙을 추가한다. 이후 와일드카드가 좁아져도 AI
 * 크롤러 접근이 실수로 막히지 않도록 하는 안전장치이기도 하다. 정책은
 * 와일드카드와 동일(PRIVATE_PATHS만 차단, 나머지 전체 허용) — 기존 차단 경로는
 * 그대로 유지한다.
 */
const AI_CRAWLER_USER_AGENTS = [
  "GPTBot", // OpenAI (ChatGPT)
  "ClaudeBot", // Anthropic (Claude)
  "Claude-Web", // Anthropic (Claude 실시간 조회)
  "PerplexityBot", // Perplexity
  "Google-Extended", // Google (Gemini/AI Overviews 학습)
  "CCBot", // Common Crawl (다수 AI 학습 데이터셋의 원천)
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
        userAgent: [...AI_CRAWLER_USER_AGENTS],
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
