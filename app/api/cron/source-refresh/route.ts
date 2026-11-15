import { runSourceRefresh } from "@/lib/sources/refresh.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 출처 메타데이터 재확인 cron (vercel.json crons에 등록).
 * YouTube 공개·임베드 상태 7일 주기 확인, API 메타데이터 30일 갱신 정책을 지킨다.
 * Bearer CRON_SECRET 인증 — trend-pulse와 동일 규약.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
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
