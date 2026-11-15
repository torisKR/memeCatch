"use client";

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_MEDIA,
} from "@/lib/upload-shared";

export {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  UPLOAD_ACCEPT_MEDIA,
};

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string; code?: "login_required" | "rate_limited" };

/** 업로드 전 클라이언트 유효성 검사(이미지 전용 — 밈 제보 폼). 문제 없으면 null. */
export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    return "JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "이미지는 5MB 이하만 올릴 수 있어요";
  }
  return null;
}

/** 업로드 전 클라이언트 유효성 검사(이미지+동영상 — 커뮤니티 글쓰기). 문제 없으면 null. */
export function validateMediaFile(file: File): string | null {
  if (ALLOWED_VIDEO_TYPES[file.type]) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      return "동영상은 20MB 이하만 올릴 수 있어요";
    }
    return null;
  }
  if (ALLOWED_IMAGE_TYPES[file.type]) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return "이미지는 5MB 이하만 올릴 수 있어요";
    }
    return null;
  }
  return "이미지(JPG·PNG·WebP·GIF) 또는 동영상(MP4·WebM)만 올릴 수 있어요";
}

/** /api/upload 공통 호출 — 성공 시 DB/본문에 쓸 경로("meme-uploads/{userId}/{uuid}.{ext}") 반환. */
async function postUpload(file: File, failMessage: string): Promise<UploadResult> {
  const form = new FormData();
  form.set("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = (await res.json()) as { ok: boolean; path?: string; error?: string };
    if (!res.ok || !json.ok || !json.path) {
      if (json.error === "login_required") {
        return {
          ok: false,
          code: "login_required",
          error: "로그인이 필요해요. 로그인 후 다시 시도해 주세요",
        };
      }
      if (json.error === "rate_limited") {
        return {
          ok: false,
          code: "rate_limited",
          error: "업로드가 너무 잦아요. 잠시 후 다시 시도해 주세요",
        };
      }
      return { ok: false, error: failMessage };
    }
    return { ok: true, path: json.path };
  } catch {
    return { ok: false, error: failMessage };
  }
}

/**
 * 이미지 업로드 — 서버 라우트(/api/upload) 경유(밈 제보 폼용).
 * 서버가 R2(설정 시) 또는 Supabase Storage(폴백)에 저장한다.
 * 스토리지 자격증명은 서버에만 있고 클라이언트는 경로만 돌려받는다.
 */
export async function uploadMemeImage(file: File): Promise<UploadResult> {
  const invalid = validateUploadFile(file);
  if (invalid) return { ok: false, error: invalid };
  return postUpload(file, "이미지 업로드에 실패했어요. 다시 시도해 주세요");
}

/**
 * 커뮤니티 본문용 미디어(이미지+동영상) 업로드 — 같은 버킷/경로 정책 재사용.
 * 서빙은 /api/media/{path} 프록시 경유(마크다운에 삽입할 URL은 그쪽).
 */
export async function uploadCommunityMedia(file: File): Promise<UploadResult> {
  const invalid = validateMediaFile(file);
  if (invalid) return { ok: false, error: invalid };
  return postUpload(file, "파일 업로드에 실패했어요. 다시 시도해 주세요");
}
