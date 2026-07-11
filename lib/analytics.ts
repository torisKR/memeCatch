"use client";

/**
 * GA4 이벤트 헬퍼 — CEO 플랜 Wave 1 이벤트 7종의 단일 진입점.
 * gtag 미로드(GA_ID 미설정·차단기) 시 조용히 무시.
 * 이벤트명: next_meme_click | related_click | random_meme | context_nav
 *          | today_meme_click | resume_click | share_click | donate_click
 */
type GtagEvent =
  | "next_meme_click"
  | "related_click"
  | "random_meme"
  | "context_nav"
  | "today_meme_click"
  | "resume_click"
  | "share_click"
  | "donate_click";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: GtagEvent, params?: Record<string, string | number>) {
  try {
    window.gtag?.("event", event, params ?? {});
  } catch {
    /* 분석 실패가 UX를 깨면 안 됨 */
  }
}
