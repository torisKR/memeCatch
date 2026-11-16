import { runSourceRefresh } from "@/lib/sources/refresh.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 출처 메타데이터 재확인 cron (deploy/scheduler/crontab에 등록).
 * 오래된 출처부터 공개·임베드 상태를 확인한다.
 * Bearer CRON_SECRET 인증 — trend-pulse와 동일 규약.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await runSourceRefresh();
  return Response.json(
    { ok: result.status === "ok", ...result },
    {
      status: result.status === "ok" ? 200 : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
