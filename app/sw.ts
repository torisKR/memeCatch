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

function isRemoteMemeThumbnail(url: URL): boolean {
  return (
    url.hostname === "i.ytimg.com" || url.hostname.endsWith(".tiktokcdn.com")
  );
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
    // 4) 외부 밈 썸네일은 서비스워커 캐시에 넣지 않는다.
    // Serwist defaultCache의 이미지 규칙은 opaque(status 0) 응답도 정상 캐시한다.
    // 외부 CDN의 일시적 실패가 들어가면 일반 새로고침마다 그 실패 응답을 재사용하고,
    // 강력 새로고침에서만 정상 이미지가 보이는 캐시 오염이 생긴다.
    // same-origin 정적 이미지와 /api/media의 불변 R2 썸네일은 아래 기본 캐시를 유지한다.
    {
      matcher: ({ request, sameOrigin, url }) =>
        !sameOrigin &&
        request.destination === "image" &&
        isRemoteMemeThumbnail(url),
      handler: new NetworkOnly(),
    },
    // 5) 나머지는 Next.js 권장 기본 전략
    ...defaultCache,
  ],
});

serwist.addEventListeners();
