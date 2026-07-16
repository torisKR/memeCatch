import { NextRequest, NextResponse } from "next/server";
import { r2Configured, r2Get } from "@/lib/r2.server";

/**
 * 업로드 이미지 조회 프록시 — /api/media/meme-uploads/{userId}/{uuid}.{ext}
 * R2가 설정돼 있으면 서버가 서명해 스트리밍(버킷 비공개 유지 가능),
 * 아니면 Supabase Storage 공개 URL로 리다이렉트.
 * meme-uploads/ 프리픽스 외 경로는 차단.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const key = path.join("/");
  // meme-uploads/ = 사용자 업로드, meme-thumbs/ = 소셜(TikTok·IG) 썸네일 재호스팅
  // (원본 CDN이 만료 서명 URL이라 수집 시점에 R2로 영구화 — 카드 미리보기용)
  const allowed =
    key.startsWith("meme-uploads/") || key.startsWith("meme-thumbs/");
  if (!allowed || key.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (r2Configured()) {
    const res = await r2Get(key);
    if (!res.ok) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
        // 업로드 키가 uuid라 내용 불변 — 강캐시
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(`${base}/storage/v1/object/public/${key}`, 302);
}
