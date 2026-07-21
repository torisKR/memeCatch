/**
 * 고객센터 공용 상수/타입 — 서버 액션 파일("use server")은 async 함수만
 * export할 수 있으므로 상수는 여기서 분리해 서버/클라이언트가 공유한다.
 */

export const INQUIRY_CATEGORIES = [
  "bug",
  "content",
  "account",
  "billing",
  "suggestion",
  "other",
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export const INQUIRY_CATEGORY_LABEL: Record<InquiryCategory, string> = {
  bug: "오류/버그",
  content: "콘텐츠 문의(정정·삭제 요청)",
  account: "계정/로그인",
  billing: "결제/프리미엄",
  suggestion: "제안/아이디어",
  other: "기타",
};

export type InquiryStatus = "open" | "answered" | "closed";

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  open: "접수됨",
  answered: "답변 완료",
  closed: "종료",
};

/** 상태 배지 색 — 프로젝트 토큰 기반(관리자/사용자 화면 공용) */
export const INQUIRY_STATUS_BADGE_CLASS: Record<InquiryStatus, string> = {
  open: "bg-accent-soft text-accent",
  answered: "bg-surface-2 text-foreground",
  closed: "bg-surface-2 text-muted",
};
