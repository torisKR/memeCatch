/**
 * 피처 플래그 — 전제 게이트 A의 실행 장치.
 * 커뮤니티(댓글·반응·랭킹)는 2026-07 UGC 오픈 결정으로 기본 활성.
 * 긴급 차단이 필요하면 NEXT_PUBLIC_COMMUNITY_ENABLED=false 로 내릴 수 있다(옵트아웃).
 */
export const flags = {
  communityEnabled: process.env.NEXT_PUBLIC_COMMUNITY_ENABLED !== "false",
  submissionsOpen: process.env.NEXT_PUBLIC_SUBMISSIONS_OPEN !== "false",
} as const;
