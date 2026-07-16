/**
 * 마크다운 공용 헬퍼 — 렌더러(components/markdown-body.tsx)와
 * 에디터(components/community-post-form.tsx)가 같은 규약을 공유한다.
 *
 * 미디어 삽입 규약:
 *   이미지  → `![파일명](URL)`
 *   동영상  → `[동영상](URL)` (URL이 .mp4/.webm이면 렌더러가 <video>로 승격)
 *   이미지 구문에 .mp4/.webm URL이 와도 동일하게 <video>로 렌더된다.
 */

/** URL이 직접 재생 가능한 동영상 파일(.mp4/.webm)을 가리키는지 (쿼리/해시 허용) */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(?=$|[?#])/i.test(url);
}

/**
 * 마크다운 안 URL 허용 정책 — http(s) 절대 URL과 사이트 상대 경로(/api/media/ 등)만
 * 통과시키고 그 외 스킴(javascript:, data:, vbscript: …)은 빈 문자열로 무력화한다.
 * react-markdown의 urlTransform으로 꽂아 렌더 단에서 강제된다.
 */
export function sanitizeMarkdownUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url; // 자기 도메인 상대 경로
  if (url.startsWith("#")) return url; // 문서 내 앵커
  return "";
}

/**
 * 마크다운 → 플레인 텍스트 발췌 — 목록 카드/메타 설명용.
 * 이미지·링크·코드펜스·강조 등 구문 문자를 벗겨 내용만 남긴다.
 * (파서 없이 정규식 기반 — 발췌 용도라 완벽할 필요 없음)
 */
export function stripMarkdownToText(md: string): string {
  let text = md;
  // 코드 펜스: 내용만 유지
  text = text.replace(/```[^\n]*\n?([\s\S]*?)```/g, "$1");
  text = text.replace(/~~~[^\n]*\n?([\s\S]*?)~~~/g, "$1");
  // 이미지 → alt 텍스트
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // 링크 → 라벨 텍스트
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  // 오토링크·맨몸 URL 제거 (발췌에 긴 URL 노출 방지)
  text = text.replace(/<https?:\/\/[^>]+>/gi, "");
  text = text.replace(/https?:\/\/\S+/gi, "");
  // 줄머리 구문: 제목 #, 인용 >, 리스트 마커
  text = text.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  text = text.replace(/^[ \t]*>+[ \t]?/gm, "");
  text = text.replace(/^[ \t]*(?:[-*+]|\d+\.)[ \t]+/gm, "");
  // 강조/취소선/인라인 코드 마커
  text = text.replace(/(\*\*|__|~~|`|\*)/g, "");
  // 공백 정리
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}
