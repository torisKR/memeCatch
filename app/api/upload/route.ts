import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Configured, r2Put } from "@/lib/r2.server";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
} from "@/lib/upload-shared";
import { rateLimit } from "@/lib/rate-limit";
import { MediaValidationError, validateMedia } from "@/lib/mpe/media";

/**
 * 제보 이미지 업로드 — 서버 전용 경로.
 * R2 자격증명이 설정돼 있으면 Cloudflare R2(memecatch-uploads)로,
 * 아니면 기존 Supabase Storage(meme-uploads 버킷)로 폴백.
 * 어느 쪽이든 반환 경로는 "meme-uploads/{userId}/{uuid}.{ext}" —
 * submit_meme_v2 RPC의 자기 폴더 프리픽스 검증과 호환된다.
 * 클라이언트는 R2 키를 전혀 알지 못한다(서버 env로만 서명).
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

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }

  // 이미지(제보·커뮤니티 공용) 또는 동영상(커뮤니티 본문용, mp4/webm)
  const videoExt = ALLOWED_VIDEO_TYPES[file.type];
  const ext = ALLOWED_IMAGE_TYPES[file.type] ?? videoExt;
  if (!ext) {
    return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
  }
  // 동영상 20MB(개인 운영 R2 비용 보호), 이미지 기존 5MB 유지
  const maxBytes = videoExt ? MAX_VIDEO_UPLOAD_BYTES : MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ ok: false, error: "too_large" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    validateMedia(bytes, file.type);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ ok: false, error: "invalid_type" }, { status: 400 });
    }
    throw error;
  }

  const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const fullPath = `meme-uploads/${objectPath}`;

  if (r2Configured()) {
    const ok = await r2Put(fullPath, bytes.buffer, file.type);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, path: fullPath });
  }

  // 폴백: Supabase Storage (RLS 정책 — 자기 폴더만 insert 가능)
  const { data, error } = await supabase.storage
    .from("meme-uploads")
    .upload(objectPath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "upload_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, path: `meme-uploads/${data.path}` });
}
