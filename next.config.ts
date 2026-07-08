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
};

// dev는 Turbopack(기본)만 사용 — serwist는 webpack 설정을 주입해 Turbopack과 충돌한다.
// PWA 서비스워커는 프로덕션 빌드에서만 필요하므로 dev에선 순수 nextConfig를 쓴다.
export default isDev ? nextConfig : withSerwist(nextConfig);
