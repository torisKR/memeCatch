/** 업로드 정책 상수 — 클라이언트(폼)와 서버(업로드 라우트)가 공유. */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 이미지 5MB

/** 동영상 상한 — 개인 운영 R2 비용 보호(20MB). */
export const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 커뮤니티 본문용 동영상 — <video>로 직접 재생 가능한 포맷만. */
export const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export const UPLOAD_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");

/** 이미지+동영상 겸용 accept — 커뮤니티 글쓰기 폼용. */
export const UPLOAD_ACCEPT_MEDIA = [
  ...Object.keys(ALLOWED_IMAGE_TYPES),
  ...Object.keys(ALLOWED_VIDEO_TYPES),
].join(",");
