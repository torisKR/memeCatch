/**
 * enum ↔ 한국어 노출 문구 ↔ 색 토큰 단일 소스 (디자인 리뷰 Pass 5, D5-1)
 * 사용자 노출용(user)과 관리자 전용(admin)을 구분한다.
 * 색은 globals.css의 CSS 변수 토큰 이름을 가리킨다 (라이트/다크 쌍은 CSS에서 해결).
 */

export const SAFETY_LEVELS = {
  green: { user: "써도 됨", admin: "안전", token: "safety-green", icon: "●" },
  yellow: { user: "맥락 주의", admin: "주의", token: "safety-yellow", icon: "▲" },
  gray: { user: "이미 늦음", admin: "사어", token: "safety-gray", icon: "◌" },
  red: { user: "쓰면 위험", admin: "위험", token: "safety-red", icon: "✕" },
} as const;
export type SafetyLevel = keyof typeof SAFETY_LEVELS;

export const LIFECYCLE_STATUS = {
  rising: { user: "급상승", token: "life-rising", flame: 4 },
  active: { user: "유행 중", token: "life-active", flame: 3 },
  cooling: { user: "식는 중", token: "life-cooling", flame: 2 },
  archived: { user: "추억 밈", token: "life-archived", flame: 1 },
} as const;
export type LifecycleStatus = keyof typeof LIFECYCLE_STATUS;

/** 검수 상태 — 관리자 전용 노출. 사용자에겐 '출처 확인 중'(limited)만 보임 */
export const MODERATION_STATUS = {
  pending: { admin: "대기", token: "mod-pending" },
  fact_checking: { admin: "사실 확인 중", token: "mod-checking" },
  rights_checking: { admin: "저작권 확인 중", token: "mod-checking" },
  approved: { admin: "게시됨", token: "mod-approved" },
  limited: { admin: "제한 공개", user: "출처 확인 중", token: "mod-limited" },
  rejected: { admin: "반려", token: "mod-rejected" },
} as const;

export const CATEGORIES = {
  phrase: { user: "유행어", emojiFree: true },
  dance: { user: "댄스 챌린지" },
  song: { user: "노래" },
  image: { user: "짤" },
  comment: { user: "댓글 밈" },
  challenge: { user: "챌린지" },
} as const;
export type MemeCategory = keyof typeof CATEGORIES;

export const DIFFICULTY = {
  beginner: { user: "입문", token: "diff-beginner" },
  normal: { user: "보통", token: "diff-normal" },
  deep: { user: "고인물", token: "diff-deep" },
} as const;

/** sentiment=controversial은 status가 아닌 보조 칩으로만 노출 (D5-1 확정) */
export const SENTIMENT = {
  funny: { user: null },
  ironic: { user: null },
  controversial: { user: "논쟁 중", token: "sent-controversial" },
  negative: { user: null },
  wholesome: { user: null },
} as const;

export const REACTIONS = {
  understood: { user: "이해됨", emoji: "💡" },
  funny: { user: "웃김", emoji: "😂" },
  just_learned: { user: "이제 알았다", emoji: "👀" },
  too_late: { user: "이미 늦었다", emoji: "🕰️" },
  still_alive: { user: "아직 살아있다", emoji: "🔥" },
  risky: { user: "쓰면 위험하다", emoji: "🚨" },
} as const;
export type ReactionType = keyof typeof REACTIONS;

export const SUBMISSION_STATUS = {
  pending: { user: "접수됨 — 24~48시간 내 검토돼요", token: "sub-pending" },
  reviewing: { user: "검수 중", token: "sub-reviewing" },
  approved: { user: "등록 완료!", token: "sub-approved" },
  rejected: { user: "반려됨", token: "sub-rejected" },
} as const;

export const USAGE_CONTEXTS = {
  work: "직장에서",
  friends: "친구끼리",
  family: "자녀·가족과",
  sns: "공개 SNS에서",
} as const;

/** 포용형 톤 원칙(T5): 서비스 발화는 포용형, 유저 자기표현(반응)은 원문 유지 */
export const SECTION_TITLES = {
  trending: "오늘의 급상승",
  forBeginners: "지금 알아도 충분한 밈",
  catchUp: "따라잡기 큐레이션",
  controversial: "지금 논쟁 중",
  fresh: "새로 등록된 밈",
} as const;

/** T6: 하이브리드 slug — /memes/{short_id}-{한글slug}, short_id만으로도 해석 */
export function memePathFrom(shortId: string, slug: string) {
  return `/memes/${shortId}-${encodeURIComponent(slug)}`;
}
export function shortIdFromParam(param: string) {
  return decodeURIComponent(param).split("-")[0];
}
