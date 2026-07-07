/**
 * 관리자 콘솔 공용 상수 — 검수 상태 전이 규칙(스키마 트리거와 동일해야 함)과 UI 옵션.
 * 서버·클라이언트 양쪽에서 import한다 ("use server" 파일에는 상수를 둘 수 없음).
 */

import type { SafetyLevel } from "@/lib/labels";

export type ModerationStatus =
  | "pending"
  | "fact_checking"
  | "rights_checking"
  | "approved"
  | "limited"
  | "rejected";

/** supabase/migrations/…schema_v2.sql의 check_moderation_transition()과 동일 */
export const VALID_TRANSITIONS: Record<ModerationStatus, ModerationStatus[]> = {
  pending: ["fact_checking", "rejected"],
  fact_checking: ["rights_checking", "rejected", "pending"],
  rights_checking: ["approved", "limited", "rejected", "fact_checking"],
  limited: ["approved", "rejected"],
  approved: ["limited"],
  rejected: [],
};

/** 전이 버튼 문구 (관리자 전용 — 해요체 불필요한 짧은 동작명) */
export const TRANSITION_ACTION_LABELS: Record<ModerationStatus, string> = {
  pending: "대기로 되돌리기",
  fact_checking: "사실 확인 시작",
  rights_checking: "저작권 확인으로",
  approved: "게시 승인",
  limited: "제한 공개로 전환",
  rejected: "반려",
};

/** limited 전환 시 노출 주의 문구 */
export const LIMITED_WARNING =
  "제한 공개로 전환하면 사용자에게는 '출처 확인 중'으로 표시되고 추천·큐레이션에서 제외돼요. 출처나 저작권 문제가 해결되면 다시 게시로 되돌릴 수 있어요.";

export const SAFETY_OPTIONS: SafetyLevel[] = ["green", "yellow", "gray", "red"];

export const CATEGORY_OPTIONS = [
  "phrase",
  "dance",
  "song",
  "image",
  "comment",
  "challenge",
] as const;

export const DIFFICULTY_OPTIONS = ["beginner", "normal", "deep"] as const;

export const LIFECYCLE_OPTIONS = ["rising", "active", "cooling", "archived"] as const;

export const SENTIMENT_OPTIONS = [
  "funny",
  "ironic",
  "controversial",
  "negative",
  "wholesome",
] as const;

export const SENTIMENT_ADMIN_LABELS: Record<(typeof SENTIMENT_OPTIONS)[number], string> = {
  funny: "유머",
  ironic: "풍자",
  controversial: "논쟁",
  negative: "부정",
  wholesome: "훈훈",
};

export const USAGE_CONTEXT_KEYS = ["work", "friends", "family", "sns"] as const;

/** 접수 후 48시간 초과 여부 (제보 큐 SLA 배지) */
export function isSubmissionOverdue(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > 48 * 60 * 60 * 1000;
}

/** N시간 전 시각의 ISO 문자열 (대시보드 24h 집계 등) */
export function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}
