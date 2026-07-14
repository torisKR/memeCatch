import { getOEmbed, OEmbedError } from "@/lib/oembed";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // 남용 억제 — IP당 분당 20회 (인스턴스 로컬 best-effort, lib/rate-limit.ts 참고)
  const rl = rateLimit(`oembed:${getClientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const url = new URL(request.url).searchParams.get("url") ?? "";
    const result = await getOEmbed(url);
    return Response.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    if (error instanceof OEmbedError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "플랫폼 응답 시간이 초과되었습니다."
        : "콘텐츠 정보를 불러오는 중 오류가 발생했습니다.";
    return Response.json(
      { error: message, code: "UPSTREAM_ERROR" },
      { status: 502 }
    );
  }
}
