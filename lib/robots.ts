import type { MetadataRoute } from "next";
import { SEO_CONTENT_LOCALES, localizedPath } from "@/lib/i18n-routing";
import { SITE_URL } from "@/lib/site";

const PRIVATE_PATHS = ['/admin', '/my', '/api/', '/go/', '/auth/', '/submit', '/login'] as const;

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

export function robots(): MetadataRoute.Robots {
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

/**
 * 다음(Daum) 웹마스터도구 사이트 소유 확인 줄. 다음이 robots.txt 하단에 이 주석이
 * 그대로 있는지로 소유를 확인하므로 값을 바꾸거나 지우지 말 것.
 * MetadataRoute.Robots에는 임의 줄을 넣을 자리가 없어서 app/robots.txt/route.ts가
 * 직접 텍스트를 만든다.
 */
export const DAUM_WEBMASTER_VERIFICATION =
  "#DaumWebMasterTool:4bdf39757ad941fd692decfa5a97dfd5b26f372c0690ffa5832b6d14d43a48d7:9OXzxfMP1b1VGCOsL/bJCQ==";

function list(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Next의 robots.ts 직렬화(resolveRobots)와 같은 형식으로 쓰고 끝에 다음 인증 줄을 붙인다. */
export function renderRobotsTxt(data: MetadataRoute.Robots = robots()): string {
  let content = "";
  const rules = Array.isArray(data.rules) ? data.rules : [data.rules];
  for (const rule of rules) {
    for (const agent of list(rule.userAgent ?? "*")) content += `User-Agent: ${agent}\n`;
    for (const item of list(rule.allow)) content += `Allow: ${item}\n`;
    for (const item of list(rule.disallow)) content += `Disallow: ${item}\n`;
    if (rule.crawlDelay) content += `Crawl-delay: ${rule.crawlDelay}\n`;
    content += "\n";
  }
  if (data.host) content += `Host: ${data.host}\n`;
  for (const sitemap of list(data.sitemap)) content += `Sitemap: ${sitemap}\n`;
  content += `\n${DAUM_WEBMASTER_VERIFICATION}\n`;
  return content;
}
