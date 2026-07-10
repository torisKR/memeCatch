"use client";

import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
} from "@/lib/upload-shared";

export { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT };

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/** 업로드 전 클라이언트 유효성 검사. 문제 없으면 null, 있으면 에러 메시지. */
export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES[file.type]) {
    return "JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "이미지는 5MB 이하만 올릴 수 있어요";
  }
  return null;
}

/**
 * 이미지 업로드 — 서버 라우트(/api/upload) 경유.
 * 서버가 R2(설정 시) 또는 Supabase Storage(폴백)에 저장한다.
 * 스토리지 자격증명은 서버에만 있고 클라이언트는 경로만 돌려받는다.
 * 성공 시 DB에 저장할 경로("meme-uploads/{userId}/{uuid}.{ext}") 반환.
 */
export async function uploadMemeImage(file: File): Promise<UploadResult> {
  const invalid = validateUploadFile(file);
  if (invalid) return { ok: false, error: invalid };

  const form = new FormData();
  form.set("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = (await res.json()) as { ok: boolean; path?: string; error?: string };
    if (!res.ok || !json.ok || !json.path) {
      if (json.error === "login_required") {
        return { ok: false, error: "로그인이 필요해요. 로그인 후 다시 시도해 주세요" };
      }
      return { ok: false, error: "이미지 업로드에 실패했어요. 다시 시도해 주세요" };
    }
    return { ok: true, path: json.path };
  } catch {
    return { ok: false, error: "이미지 업로드에 실패했어요. 다시 시도해 주세요" };
  }
}
