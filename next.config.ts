import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isDev = process.env.NODE_ENV === "development";

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
 * CSP — Report-Only로만 배포한다(enforce 금지). 실제 위반은 브라우저 콘솔로
 * 관찰하고, 충분히 안정화된 뒤에만 enforce 전환을 검토한다.
 * 반영된 소스(코드 조사 기준):
 * - 임베드 iframe: youtube-nocookie/youtube, tiktok(player), instagram, facebook
 * - 이미지: i.ytimg.com(YouTube 썸네일), *.tiktokcdn.com(TikTok 썸네일)
 * - GA4: googletagmanager(@next/third-parties) + google-analytics 수집
 * - AdSense: googlesyndication·googleadservices·doubleclick·adtrafficquality 계열
 *   (adsbygoogle가 요구하는 도메인 폭이 넓어 script/frame/img/connect에 분산 반영)
 * - Supabase: *.supabase.co (REST/Storage/Realtime — wss 포함)
 * - inline script: JSON-LD(dangerouslySetInnerHTML)·Next 런타임 인라인 → 'unsafe-inline'
 */
const CSP_REPORT_ONLY = [
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
    "https://i.ytimg.com",
    "https://*.tiktokcdn.com",
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
  ].join(" "),
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
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
].join("; ");

const nextConfig: NextConfig = {
  // 워크트리·모노 환경에서 다중 lockfile로 인한 workspace root 추론 경고 제거
  outputFileTracingRoot: __dirname,
  // 기본 보안 헤더 — CSP는 임베드·인라인 스크립트 회귀 위험이 있어 Report-Only로만 관찰(enforce 전환 금지)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // 관찰 전용 CSP — 위반해도 차단되지 않는다(위 CSP_REPORT_ONLY 주석 참고)
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
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
