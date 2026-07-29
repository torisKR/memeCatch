import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isDev = process.env.NODE_ENV === "development";

// 밈 카드의 외부 썸네일은 페이지의 <img>뿐 아니라 서비스워커 fetch()로도 요청된다.
// 해당 호스트만 img-src와 connect-src가 공유해 CSP 권한을 필요한 범위로 제한한다.
const REMOTE_MEME_THUMBNAIL_SOURCES = [
  "https://i.ytimg.com",
  "https://*.tiktokcdn.com",
] as const;

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: isDev,
  // 오프라인 폴백 페이지를 precache 매니페스트에 주입 — app/sw.ts의
  // fallbacks.entries("/offline")가 이 사본을 사용한다. revision은 빌드마다
  // 갱신되어 새 배포 시 오래된 폴백 HTML이 남지 않게 한다.
  additionalPrecacheEntries: [
    { url: "/offline", revision: crypto.randomUUID() },
  ],
});

/**
 * CSP — 기본 enforce(실제 차단). 환경변수 CSP_ENFORCE=false 를 주면 배포 없이
 * Report-Only로 즉시 롤백된다. unsafe-inline은 유지하므로(아래 사유) enforce로
 * 전환해도 인라인 스크립트는 계속 동작하고, allowlist 밖 도메인만 차단된다.
 * unsafe-eval은 금지 유지. nonce는 ISR/SSG(revalidate) 붕괴 + AdSense 비호환으로
 * 미적용(자세한 판단 근거는 PR 설명 참고).
 * 반영된 소스(코드 조사 기준):
 * - 임베드 iframe: youtube-nocookie/youtube, tiktok(player), instagram, facebook
 * - 이미지: i.ytimg.com(YouTube 썸네일), *.tiktokcdn.com(TikTok 썸네일)
 * - GA4: googletagmanager(@next/third-parties) + google-analytics 수집
 * - AdSense: googlesyndication·googleadservices·doubleclick·adtrafficquality 계열
 *   (adsbygoogle가 요구하는 도메인 폭이 넓어 script/frame/img/connect에 분산 반영)
 * - Supabase: *.supabase.co (REST/Storage/Realtime — wss 포함)
 * - inline script: JSON-LD(dangerouslySetInnerHTML)·Next 런타임 인라인 → 'unsafe-inline'
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    "https://pagead2.googlesyndication.com",
    "https://*.googlesyndication.com",
    "https://www.googletagmanager.com",
    "https://www.googleadservices.com",
    "https://*.google-analytics.com",
    "https://*.adtrafficquality.google",
  ].join(" "),
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    ...REMOTE_MEME_THUMBNAIL_SOURCES,
    "https://*.googlesyndication.com",
    "https://*.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://*.googleadservices.com",
    "https://*.g.doubleclick.net",
    "https://*.gstatic.com",
    "https://*.google.com",
    "https://*.google.co.kr",
    "https://*.adtrafficquality.google",
  ].join(" "),
  "font-src 'self' data:",
  [
    "frame-src 'self'",
    "https://www.youtube-nocookie.com",
    "https://www.youtube.com",
    "https://www.tiktok.com",
    "https://www.instagram.com",
    "https://www.facebook.com",
    "https://*.googlesyndication.com",
    "https://*.g.doubleclick.net",
    "https://www.google.com",
    "https://*.adtrafficquality.google",
    "https://ads-partners.coupang.com", // 쿠팡 파트너스 위젯 iframe
  ].join(" "),
  [
    "connect-src 'self'",
    // /sw.js의 NetworkOnly 이미지 요청은 CSP에서 connect-src 적용 대상이다.
    ...REMOTE_MEME_THUMBNAIL_SOURCES,
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://analytics.google.com", // GA4 수집 — 베어 도메인은 와일드카드(*.analytics.google.com)와 미매치
    "https://www.google.com", // GA4 리전 폴백 수집(/g/collect)
    "https://www.googletagmanager.com",
    "https://*.googlesyndication.com",
    "https://*.googleadservices.com",
    "https://*.g.doubleclick.net",
    "https://*.adtrafficquality.google",
  ].join(" "),
  "media-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
];

// 위반 리포트 수집 엔드포인트 — 기본은 같은 오리진의 /api/csp-report.
// CSP_REPORT_URI 로 외부 수집기(예: report-uri.com)로 재지정할 수 있고,
// 빈 문자열("")을 주면 리포트 발행을 완전히 끈다.
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com";
const CSP_REPORT_URI =
  process.env.CSP_REPORT_URI ?? `${SITE_ORIGIN}/api/csp-report`;

const CSP_VALUE = [
  ...CSP_DIRECTIVES,
  // report-uri: 레거시(넓은 호환) / report-to: Reporting API v1(아래 Reporting-Endpoints와 짝)
  ...(CSP_REPORT_URI
    ? [`report-uri ${CSP_REPORT_URI}`, "report-to csp-endpoint"]
    : []),
].join("; ");

// 적용 모드 — 기본 enforce(실제 차단). 광고/임베드 회귀가 관측되면 코드 배포 없이
// Vercel 환경변수 CSP_ENFORCE=false 로 즉시 Report-Only 롤백 가능.
const CSP_ENFORCE = process.env.CSP_ENFORCE !== "false";
const CSP_HEADER_KEY = CSP_ENFORCE
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

const nextConfig: NextConfig = {
  // Multiple root layouts make a single composed app/not-found impossible.
  // Next's router-level global fallback returns a complete HTML document.
  experimental: {
    globalNotFound: true,
  },
  // 워크트리·모노 환경에서 다중 lockfile로 인한 workspace root 추론 경고 제거
  outputFileTracingRoot: __dirname,
  // x-powered-by 헤더 제거 — 프레임워크 버전 노출 방지
  poweredByHeader: false,
  // 기본 보안 헤더 — CSP는 임베드·인라인 스크립트 회귀 위험이 있어 Report-Only로만 관찰(enforce 전환 금지)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // HSTS 보강 — Vercel 기본값(max-age=63072000)을 명시 헤더로 덮어써
          // includeSubDomains·preload까지 적용한다.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CSP — 기본 enforce로 XSS/데이터 유출 1차 방어(위 allowlist 주석 참고).
          // ⚠️ 서비스 장애 주의(1): unsafe-inline은 유지하므로 JSON-LD·AdSense·Next
          //    런타임 인라인은 계속 동작한다. enforce가 새로 차단하는 것은 "allowlist에
          //    없는 도메인의 리소스"뿐이다.
          // ⚠️ 서비스 장애 주의(2): AdSense는 런타임에 도메인을 동적 확장할 수 있어,
          //    광고가 allowlist 밖 도메인을 끌어오면 해당 광고만 로드 실패할 수 있다.
          //    배포 직후 실광고·임베드를 콘솔로 확인하고, 문제 시 CSP_ENFORCE=false 로
          //    즉시 Report-Only 롤백(코드 배포 불필요).
          {
            key: CSP_HEADER_KEY,
            value: CSP_VALUE,
          },
          // 위반 리포트 수집 엔드포인트가 설정된 경우에만 Reporting-Endpoints 발행.
          // (미설정 시 report-to 디렉티브도 생략되므로 죽은 설정이 남지 않는다.)
          ...(CSP_REPORT_URI
            ? [
                {
                  key: "Reporting-Endpoints",
                  value: `csp-endpoint="${CSP_REPORT_URI}"`,
                },
              ]
            : []),
        ],
      },
      // public/ 정적 자산 장기 캐시(PageSpeed "효율적인 캐시 수명" 대응).
      // 파일명에 해시가 없어 무한 immutable은 위험 → max-age + stale-while-revalidate.
      // 확장자 기반(정적 이미지/폰트). HTML·sitemap.xml·robots/ads.txt(.txt)·manifest(.webmanifest)·
      // sw.js(.js)는 이 목록에 없어 매칭되지 않는다. /_next/static 해시 자산은 Next가 이미 immutable로 서빙(덮어쓰기 불가).
      {
        source:
          "/:path*\\.(svg|png|jpg|jpeg|webp|avif|ico|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      // PWA 아이콘·브랜드 자산은 사실상 불변에 가까움 → 더 길게(1년) 잡되 swr로 갱신 여지 확보.
      // 위 확장자 규칙보다 뒤에 두어 동일 키(Cache-Control)를 덮어쓴다(마지막 매칭 우선).
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

// dev는 Turbopack(기본)만 사용 — serwist는 webpack 설정을 주입해 Turbopack과 충돌한다.
// PWA 서비스워커는 프로덕션 빌드에서만 필요하므로 dev에선 순수 nextConfig를 쓴다.
export default isDev ? nextConfig : withSerwist(nextConfig);
