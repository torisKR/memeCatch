import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const isDev = process.env.NODE_ENV === "development";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: isDev,
});

const nextConfig: NextConfig = {
  // 워크트리·모노 환경에서 다중 lockfile로 인한 workspace root 추론 경고 제거
  outputFileTracingRoot: __dirname,
  // 기본 보안 헤더 — CSP는 유튜브 임베드·인라인 스크립트 회귀 위험이 있어 제외(추후 report-only로 도입)
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
