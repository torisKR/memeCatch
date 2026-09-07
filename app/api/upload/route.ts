import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
} from "@/lib/upload-shared";
import { rateLimit } from "@/lib/rate-limit";
import { readBoundedFormData, RequestBodyTooLargeError } from "@/lib/request-body";
import { MediaValidationError, validateMedia } from "@/lib/mpe/media";

/**
 * 제보 이미지 업로드 — 서버 전용 경로.
 * 비공개 Supabase Storage(meme-uploads 버킷)에 저장한다.
 * 반환 경로는 "meme-uploads/{userId}/{uuid}.{ext}" —
 * submit_meme_v2 RPC의 자기 폴더 프리픽스 검증과 호환된다.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "login_required" }, { status: 401 });
  }

  // 남용 억제 — 인증 사용자당 분당 10회 (인스턴스 로컬 best-effort, lib/rate-limit.ts 참고)
  const rl = rateLimit(`upload:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let form: FormData | null = null;
  try {
    form = await readBoundedFormData(req, MAX_VIDEO_UPLOAD_BYTES + 128 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ ok: false, error: "too_large" }, { status: 413 });
    }
  }
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }

  // 이미지(제보·커뮤니티 공용) 또는 동영상(커뮤니티 본문용, mp4/webm)
  const bytes = new Uint8Array(await file.arrayBuffer());
  let detectedType: string;
  try {
    detectedType = validateMedia(bytes, file.type).mimeType;
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
    }
    throw error;
  }
  const videoExt = ALLOWED_VIDEO_TYPES[detectedType];
  const ext = ALLOWED_IMAGE_TYPES[detectedType] ?? videoExt;
  if (!ext) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }
  const maxBytes = videoExt ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 400 });
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("meme-uploads")
    .upload(objectPath, bytes, {
      contentType: detectedType,
      cacheControl: "3600",
      upsert: false,
    });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, path: `meme-uploads/${data.path}` });
}
