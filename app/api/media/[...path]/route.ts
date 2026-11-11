import { NextRequest, NextResponse } from "next/server";
import { r2Configured, r2Get } from "@/lib/r2.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SAFE_MEDIA_TYPES: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  png: "image/png",
  webm: "video/webm",
  webp: "image/webp",
};

function safeMediaType(key: string) {
  const extension = key.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
  return extension ? SAFE_MEDIA_TYPES[extension] ?? null : null;
}

/**
 * 업로드·썸네일 이미지 조회 프록시
 * - /api/media/meme-uploads/{userId}/{uuid}.{ext} — 사용자 업로드
 * - /api/media/meme-thumbs/{platform}/{id}.{ext} — TikTok·IG 카드 썸네일 재호스팅
 *   (원본 CDN 만료 서명 URL이라 수집 시점에 R2로 영구화)
 * - /api/media/meme-art/{shortId}.{ext} — 글자 없는 포스터 일러스트 (공개)
 * R2가 설정돼 있으면 서버가 서명해 스트리밍(버킷 비공개 유지 가능),
 * 아니면 Supabase Storage에서 같은 권한·MIME·캐시 정책으로 스트리밍.
 * 허용 프리픽스 외 경로는 차단.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const key = path.join("/");
  const contentType = safeMediaType(key);
  // meme-uploads/ = 사용자 업로드, meme-thumbs/ = 소셜(TikTok·IG) 썸네일 재호스팅
  // (원본 CDN이 만료 서명 URL이라 수집 시점에 R2로 영구화 — 카드 미리보기용)
  const allowed =
    key.startsWith("meme-uploads/") ||
    key.startsWith("meme-thumbs/") ||
    key.startsWith("meme-art/");
  if (!allowed || key.includes("..") || !contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (key.startsWith("meme-uploads/")) {
    const ownerId = path[1];
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (user?.id !== ownerId) {
      const { data } = await createAdminClient()
        .from("meme_submissions")
        .select("id")
        .eq("attachment_path", key)
        .eq("status", "approved")
        .limit(1);
      if (!data?.length) return new NextResponse("Not found", { status: 404 });
    }
  }

  if (r2Configured()) {
    const res = await r2Get(key);
    if (!res.ok) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(res.body, {
      headers: {
        // 저장소 메타데이터는 직접 신뢰하지 않는다. 같은 출처에서 HTML 등 활성
        // 콘텐츠로 응답되면 저장형 XSS가 되므로, 허용 확장자에 대응하는 MIME으로 고정한다.
        "Content-Type": contentType,
        "Cache-Control": key.startsWith("meme-thumbs/") || key.startsWith("meme-art/")
          ? "public, max-age=60, s-maxage=300"
          : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const [bucket, ...objectParts] = path;
  const { data, error } = await createAdminClient().storage
    .from(bucket)
    .download(objectParts.join("/"));
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": key.startsWith("meme-thumbs/") || key.startsWith("meme-art/")
        ? "public, max-age=60, s-maxage=300"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
