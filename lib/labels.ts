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

/** 출처 구분 — 카탈로그(인터넷 밈 문서) vs 밈캐치 자체 제작 */
export const ORIGIN_KIND = {
  catalog: { user: null, admin: "카탈로그" },
  house_original: { user: "밈캐치 자체 제작", admin: "자체 제작" },
} as const;
export type OriginKind = keyof typeof ORIGIN_KIND;

/** 검수 상태 — 관리자 전용 노출. 사용자에겐 '출처 확인 중'(limited)만 보임 */
export const MODERATION_STATUS = {
  pending: { admin: "대기", token: "mod-pending" },
  fact_checking: { admin: "사실 확인 중", token: "mod-checking" },
  rights_checking: { admin: "저작권 확인 중", token: "mod-checking" },
  approved: { admin: "게시됨", token: "mod-approved" },
  limited: { admin: "제한 공개", user: "출처 확인 중", token: "mod-limited" },
  rejected: { admin: "반려", token: "mod-rejected" },
} as const;

/**
 * 카테고리 = 소프트 틴트 칩(DESIGN §11). color 발명 금지 — tone은 globals.css의
 * --cat-*-bg / --cat-*-text 토큰 베이스명. icon은 중립 SVG 식별자(불꽃 회피, 이모지 금지).
 * challenge 아이콘은 깃발/트로피 개념(생명게이지 불꽃과 분리).
 */
export const CATEGORIES = {
  phrase: { user: "밈 용어(유행어)", emojiFree: true, tone: "cat-phrase", icon: "speech" },
  dance: { user: "챌린지 댄스", tone: "cat-dance", icon: "dance" },
  song: { user: "노래", tone: "cat-song", icon: "note" },
  image: { user: "밈 영상", tone: "cat-image", icon: "frame" },
  comment: { user: "드라마 장면", tone: "cat-comment", icon: "comment" },
  challenge: { user: "챌린지 댄스", tone: "cat-dance", icon: "dance" },
} as const;
export type MemeCategory = keyof typeof CATEGORIES;
export type CategoryIcon = (typeof CATEGORIES)[MemeCategory]["icon"];

export const DISPLAY_CATEGORIES = {
  "ai-meme": {
    key: "ai-meme",
    user: "AI 밈",
    tone: "cat-image",
    icon: "frame" as const,
    categories: ["phrase", "image"] as const,
  },
  meme_term: {
    key: "meme_term",
    user: "밈 용어(유행어)",
    tone: "cat-phrase",
    icon: "speech" as const,
    categories: ["phrase"] as const,
  },
  challenge_dance: {
    key: "challenge_dance",
    user: "챌린지 댄스",
    tone: "cat-dance",
    icon: "dance" as const,
    categories: ["dance", "challenge"] as const,
  },
  song: {
    key: "song",
    user: "노래",
    tone: "cat-song",
    icon: "note" as const,
    categories: ["song"] as const,
  },
  drama_scene: {
    key: "drama_scene",
    user: "드라마 장면",
    tone: "cat-comment",
    icon: "comment" as const,
    categories: ["comment"] as const,
  },
  meme_video: {
    key: "meme_video",
    user: "밈 영상",
    tone: "cat-image",
    icon: "frame" as const,
    categories: ["image"] as const,
  },
} as const;
export type DisplayCategoryKey = keyof typeof DISPLAY_CATEGORIES;

export const AI_MEME_DISPLAY_CATEGORY: DisplayCategoryKey = "ai-meme";
export const AI_MEME_TOPIC_TAG = "AI 밈";

const DISPLAY_BY_LEGACY_CATEGORY: Record<MemeCategory, DisplayCategoryKey> = {
  phrase: "meme_term",
  dance: "challenge_dance",
  song: "song",
  image: "meme_video",
  comment: "drama_scene",
  challenge: "challenge_dance",
};

const DISPLAY_CATEGORY_TOKENS = Object.values(DISPLAY_CATEGORIES).map((item) => item.key);

function normalizeDisplayCategory(token: string): DisplayCategoryKey | null {
  if ((DISPLAY_CATEGORY_TOKENS as readonly string[]).includes(token)) {
    return token as DisplayCategoryKey;
  }
  if ((Object.keys(CATEGORIES) as readonly string[]).includes(token)) {
    return DISPLAY_BY_LEGACY_CATEGORY[token as MemeCategory];
  }
  return null;
}

export const DISPLAY_CATEGORY_LIST = Object.values(DISPLAY_CATEGORIES);

export function resolveDisplayCategory(category: MemeCategory): DisplayCategoryKey {
  return DISPLAY_BY_LEGACY_CATEGORY[category];
}

export function expandDisplayCategoryTokens(tokens: readonly string[]): DisplayCategoryKey[] {
  const normalized = [...new Set(tokens.map((token) => normalizeDisplayCategory(token)).filter(Boolean))] as DisplayCategoryKey[];
  return normalized;
}

export function expandToLegacyCategories(tokens: readonly DisplayCategoryKey[]): MemeCategory[] {
  const categories = new Set<MemeCategory>();
  for (const token of tokens) {
    for (const category of DISPLAY_CATEGORIES[token].categories) {
      categories.add(category as MemeCategory);
    }
  }
  return [...categories];
}

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
/**
 * 근거가 뒷받침하는 연도 정밀도 — 이 값일 때만 연도를 단정 표기한다.
 * `approximate`·`decade`·`unknown`은 단정할 근거가 없다는 뜻이다.
 */
export const DEFINITE_YEAR_PRECISIONS = ["exact", "year"] as const;

/**
 * 등장 연도 표기.
 *
 * 화면은 `{origin_year}년생 밈`이라고 단정해 왔지만, 공개 문서 3,904건 전부
 * `year_precision='unknown'`이다 — 근거보다 세밀한 날짜 정밀도를 주장하는 상태이고
 * LOOP.md의 release blocker 중 하나다. 데이터를 고치는 대신 표시 계층에서 정밀도를
 * 함께 읽어, 근거가 생기면 자동으로 단정 표기로 돌아가게 한다.
 */
export function formatOriginYear(
  year: number | null | undefined,
  precision?: string | null,
): string | null {
  if (typeof year !== "number" || !Number.isFinite(year)) return null;
  const isDefinite = DEFINITE_YEAR_PRECISIONS.some((p) => p === precision);
  return isDefinite ? `${year}년생 밈` : `${year}년생 밈 (추정)`;
}

export function memePathFrom(shortId: string, slug: string) {
  return `/memes/${shortId}-${encodeURIComponent(slug)}`;
}
export function shortIdFromParam(param: string) {
  return decodeURIComponent(param).split("-")[0];
}
