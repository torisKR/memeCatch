import { renderQuizResultOgImage } from "@/lib/quiz-og";
import { decodeQuizShareToken } from "@/lib/quiz-share";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * /og/quiz/{token} — 밈력고사 결과 공유 링크의 미리보기 이미지.
 * 토큰이 결과 전체를 담고 있어 같은 토큰은 항상 같은 이미지 — 길게 캐시한다.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { token } = await params;
  const result = decodeQuizShareToken(token);
  if (!result) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const image = await renderQuizResultOgImage(result);
  const headers = new Headers(image.headers);
  headers.set("cache-control", "public, max-age=86400, s-maxage=604800");
  return new Response(image.body, { status: image.status, headers });
}
