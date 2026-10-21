import { runSourceRefresh } from "@/lib/sources/refresh.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 출처 메타데이터 재확인 cron (vercel.json crons에 등록).
 * 제한된 복구 canary. 7일은 대상 선정 기준이며 전체 갱신 보장이 아니다.
 * 과거 DB 실패 원인·갱신 용량 검증 후 SOURCE_REFRESH_ENABLED=true로 명시 활성화한다.
 * Bearer CRON_SECRET 인증 — trend-pulse와 동일 규약.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (process.env.SOURCE_REFRESH_ENABLED !== "true") {
    return Response.json(
      { ok: true, status: "disabled", reason: "SOURCE_REFRESH_NOT_ACTIVATED" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await runSourceRefresh();
  return Response.json(
    { ok: result.status !== "failed", ...result },
    {
      status: result.status === "failed" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
