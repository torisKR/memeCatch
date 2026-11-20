import { renderRobotsTxt } from "@/lib/robots";

// 규칙은 lib/robots.ts에 있다. robots.ts 메타데이터 라우트로는 다음 웹마스터 인증
// 주석 줄을 붙일 수 없어 텍스트를 직접 돌려준다.
export const dynamic = "force-static";

export function GET() {
  return new Response(renderRobotsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
