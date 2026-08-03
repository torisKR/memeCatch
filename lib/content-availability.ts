/**
 * `meme_contents`를 공개 화면에 렌더해도 되는가 — 단일 판정점.
 *
 * 왜 한곳에 모으는가: 이 판정이 코드 곳곳에 복사돼 있었고 전부 `dead`만 걸렀다.
 * 반면 DB 게이트(`is_meme_rank_eligible`, 20260721120000_preview_quality_gate.sql)는
 * `dead`와 `region_blocked`를 **둘 다** 제외한다. 그래서 랭킹에는 못 오르지만 상세
 * 페이지에서는 그대로 임베드되는 콘텐츠가 생겼다(공개 문서 3건).
 *
 * 기준을 바꿔야 하면 이 파일만 고친다. 소비처:
 *   - app/(default)/memes/[key]/page.tsx  — 상세 대표/관련 콘텐츠 선택
 *   - components/meme-embed.tsx           — 임베드 vs 폴백 카드 분기
 *   - lib/content-depth.ts                — 충실도 점수의 mediaCount
 *   - scripts/quality-check.mts           — DQ-C2/DQ-H3 검사
 */

/**
 * 재생·표시가 불가능한 상태.
 * `unchecked`는 포함하지 않는다 — 아직 확인하지 않았을 뿐 살아 있을 수 있고,
 * 여기에 넣으면 미확인 콘텐츠 279건이 한꺼번에 화면에서 사라진다.
 */
export const UNAVAILABLE_STATUSES = ["dead", "region_blocked"] as const;

/**
 * PostgREST `not.in` 필터 값 — `.not(col, "in", UNAVAILABLE_FILTER)` 형태로 쓴다.
 *
 * 목록 화면(탐색 그리드 등)은 JS 술어가 아니라 쿼리로 거르므로 위 함수들을 쓸 수
 * 없다. 대신 제외 목록을 이 상수 하나에서 파생시켜, 기준이 바뀔 때 렌더 경로와
 * 쿼리 경로가 함께 움직이게 한다.
 */
export const UNAVAILABLE_FILTER = `(${UNAVAILABLE_STATUSES.join(",")})`;

export type AvailabilityRef = { availability?: string | null };
export type RenderableContentRef = AvailabilityRef & {
  moderation_status?: string | null;
};

/** 원본이 살아 있고 지역 차단도 아닌가. 검수 상태는 보지 않는다. */
export function isAvailableContent(
  content: AvailabilityRef | null | undefined,
): boolean {
  const status = content?.availability;
  return !UNAVAILABLE_STATUSES.some((s) => s === status);
}

/** 공개 화면에 실제로 렌더해도 되는가 — 재생 가능 + 콘텐츠 검수 승인. */
export function isRenderableContent(
  content: RenderableContentRef | null | undefined,
): boolean {
  return (
    content != null &&
    isAvailableContent(content) &&
    content.moderation_status === "approved"
  );
}
