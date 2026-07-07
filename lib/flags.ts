/**
 * 피처 플래그 — 전제 게이트 A의 실행 장치.
 * 커뮤니티(댓글·반응 공개·랭킹)는 시드 밈 30개+검색 유입 확인 후 스위치 온.
 */
export const flags = {
  communityEnabled: process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === "true",
  submissionsOpen: process.env.NEXT_PUBLIC_SUBMISSIONS_OPEN !== "false",
} as const;
