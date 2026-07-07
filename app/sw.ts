/// <reference lib="webworker" />
/**
 * 밈캐치 서비스 워커 (레인 E)
 * - 정적 자산 precache (@serwist/next가 매니페스트 주입)
 * - Supabase(원격·로컬)와 /auth 경로는 항상 NetworkOnly (세션·데이터 신선도 보장)
 * - HTML 문서는 network-first (오프라인 시 캐시 폴백)
 * - 나머지는 defaultCache 전략
 */
import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Supabase 호스트 판별 — 프로덕션(*.supabase.co)과 로컬 개발 스택 모두 커버 */
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

function isSupabaseOrAuth(url: URL): boolean {
  if (url.hostname.endsWith(".supabase.co")) return true;
  if (SUPABASE_ORIGIN && url.origin === SUPABASE_ORIGIN) return true;
  if (url.origin === self.location.origin && url.pathname.startsWith("/auth")) {
    return true;
  }
  return false;
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1) Supabase·인증은 절대 캐시하지 않는다
    {
      matcher: ({ url }) => isSupabaseOrAuth(url),
      handler: new NetworkOnly(),
    },
    // 2) HTML 내비게이션은 network-first (오프라인 폴백용 캐시)
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        !url.pathname.startsWith("/auth") &&
        !url.pathname.startsWith("/admin") &&
        !url.pathname.startsWith("/api"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.html,
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // 3) 나머지는 Next.js 권장 기본 전략
    ...defaultCache,
  ],
});

serwist.addEventListeners();
