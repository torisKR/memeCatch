/**
 * ads.txt — AdSense 게시자 인증 파일.
 * NEXT_PUBLIC_ADSENSE_CLIENT(ca-pub-XXXXXXXXXXXXXXXX)가 설정된 경우에만 제공.
 * 미설정 시 404 — 잘못된/빈 ads.txt는 광고 수익 차단 사유가 되므로 노출하지 않는다.
 */
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const pub = client?.replace(/^ca-/, ""); // ca-pub-123... → pub-123...
  if (!pub || !pub.startsWith("pub-")) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
