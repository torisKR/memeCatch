"use client";

import { createClient } from "@/lib/supabase/client";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB (버킷 제한과 동일)

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const UPLOAD_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");

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
 * meme-uploads 버킷의 자기 폴더({userId}/)에 이미지 업로드.
 * 성공 시 DB에 저장할 경로("meme-uploads/{userId}/{uuid}.{ext}")를 반환.
 */
export async function uploadMemeImage(
  file: File,
  userId: string
): Promise<UploadResult> {
  const invalid = validateUploadFile(file);
  if (invalid) return { ok: false, error: invalid };

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from("meme-uploads")
    .upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error || !data) {
    return {
      ok: false,
      error: "이미지 업로드에 실패했어요. 다시 시도해 주세요",
    };
  }
  return { ok: true, path: `meme-uploads/${data.path}` };
}
