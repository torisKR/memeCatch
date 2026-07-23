/**
 * 출처 검수 상수 — 클라이언트/서버 공용(순수 상수만).
 * 값은 media_sources/meme_media 체크 제약과 반드시 일치해야 한다.
 */

export const SOURCE_ROLES = [
  "original",
  "official_reupload",
  "earliest_known",
  "secondary_reference",
  "usage_example",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export const RIGHTS_BASIS = [
  "official_embed",
  "creator_permission",
  "creative_commons",
  "public_data",
  "link_only",
  "unknown",
  "blocked",
] as const;
export type RightsBasis = (typeof RIGHTS_BASIS)[number];

export const REVIEW_STATES = ["pending", "approved", "rejected", "removed"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const SOURCE_ROLE_LABELS: Record<SourceRole, string> = {
  original: "원본",
  official_reupload: "공식 재업로드",
  earliest_known: "최초 확인 출처",
  secondary_reference: "2차 참고 자료",
  usage_example: "사용 예시",
};

export const RIGHTS_BASIS_LABELS: Record<RightsBasis, string> = {
  official_embed: "공식 임베드",
  creator_permission: "창작자 허가",
  creative_commons: "크리에이티브 커먼즈",
  public_data: "공공 데이터",
  link_only: "링크만 허용",
  unknown: "권리 미확인",
  blocked: "저작권 위험 차단",
};

/** media_sources.platform → 기존 meme_contents/meme_sources 표기 라벨 */
export const DISPLAY_PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
  broadcast_archive: "방송 아카이브",
  public_archive: "공공 아카이브",
  web: "web",
};

export const YEAR_PRECISIONS = [
  "exact",
  "year",
  "approximate",
  "decade",
  "unknown",
] as const;

export const ERA_TYPES = [
  "pre_internet",
  "early_web",
  "social_media",
  "shortform",
] as const;

/**
 * 연도로 시대 유형을 추정한다. 명시적 era_type이 없을 때만 사용.
 * 1980~1994 pre_internet / 1995~2004 early_web / 2005~2020 social_media / 2021~ shortform
 */
export function eraTypeForYear(year: number | null | undefined) {
  if (year == null) return null;
  if (year <= 1994) return "pre_internet";
  if (year <= 2004) return "early_web";
  if (year <= 2020) return "social_media";
  return "shortform";
}
