"use client";

/**
 * GA4 이벤트 헬퍼 — CEO 플랜 Wave 1 이벤트 7종 + 레인 확장의 단일 진입점.
 * gtag 미로드(GA_ID 미설정·차단기) 시 조용히 무시.
 * 이벤트명: next_meme_click | related_click | random_meme | context_nav
 *          | today_meme_click | resume_click | share_click | donate_click
 *          | weekly_click(레인 D: /weekly 카드 클릭) | my_recent_click(레인 C: MY 최근 본 밈 클릭)
 *          | timeline_click(레인 A: /timeline 카드 클릭) | search_suggest_click(레인 B: 검색 자동완성 클릭)
 */
type GtagEvent =
  | "next_meme_click"
  | "related_click"
  | "random_meme"
  | "context_nav"
  | "today_meme_click"
  | "resume_click"
  | "share_click"
  | "donate_click"
  | "weekly_click"
  | "my_recent_click"
  | "timeline_click"
  | "search_suggest_click"
  | "affiliate_click"
  | "generation_news_click";

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
