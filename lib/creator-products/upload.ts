"use client";

import { validateUploadFile } from "@/lib/upload";

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  storage_quota_exceeded: "상품 이미지는 계정당 최대 20개까지 보관할 수 있어요.",
  storage_quota_unavailable: "이미지 저장 공간을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.",
};

export async function uploadCreatorProductImage(file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const invalid = validateUploadFile(file);
  if (invalid) return { ok: false, error: invalid };
  try {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/creator-products/upload", { method: "POST", body: form });
    const result = await response.json() as { ok?: boolean; path?: string; error?: string };
    if (!response.ok || !result.ok || !result.path) {
      return {
        ok: false,
        error: (result.error && UPLOAD_ERROR_MESSAGES[result.error]) ?? "상품 이미지 업로드에 실패했어요. 다시 시도해 주세요.",
      };
    }
    return { ok: true, path: result.path };
  } catch {
    return { ok: false, error: "상품 이미지 업로드에 실패했어요. 다시 시도해 주세요." };
  }
}
