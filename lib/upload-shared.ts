/** 업로드 정책 상수 — 클라이언트(폼)와 서버(업로드 라우트)가 공유. */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const UPLOAD_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");
