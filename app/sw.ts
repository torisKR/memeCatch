/// <reference lib="webworker" />
/**
 * 밈캐치 서비스 워커 (레인 E)
 * - 정적 자산 precache (@serwist/next가 매니페스트 주입)
 * - Supabase(원격·로컬)와 /auth 경로는 항상 NetworkOnly (세션·데이터 신선도 보장)
 * - 요청별 로케일·세션이 반영되는 HTML 문서와 RSC payload는 항상 NetworkOnly
 * - 나머지는 defaultCache 전략
 */
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

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
  // 오프라인 폴백 — 내비게이션(NetworkOnly)이 실패하면 precache된 /offline을 보여준다.
  // /offline은 next.config.ts의 additionalPrecacheEntries로 매니페스트에 주입된다.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
  runtimeCaching: [
    // 1) Supabase·인증은 절대 캐시하지 않는다
    {
      matcher: ({ url }) => isSupabaseOrAuth(url),
      handler: new NetworkOnly(),
    },
    // 2) 문서 내비게이션은 로케일·세션에 따라 달라지므로 URL 기준 캐시에 넣지 않는다
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
    // 3) 클라이언트 전환·refresh·prefetch RSC도 헤더/쿠키별 응답을 URL 기준 캐시에 넣지 않는다
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin &&
        request.headers.get("RSC") === "1" &&
        !/^\/api(?:\/|$)/.test(url.pathname),
      handler: new NetworkOnly(),
    },
    // 4) 나머지는 Next.js 권장 기본 전략
    ...defaultCache,
  ],
});

serwist.addEventListeners();
