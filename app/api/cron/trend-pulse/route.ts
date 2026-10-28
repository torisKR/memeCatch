import { runTrendPulse } from "@/lib/trend/pulse.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 내부 인기의 일일 펄스 cron. 외부 후보의 6시간 주기는 Supabase가 담당한다.
 * Bearer CRON_SECRET 인증 — lib/affiliate/cron-handler.ts와 동일 규약.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await runTrendPulse();
  return Response.json(
    { ok: result.status !== "failed", ...result },
    {
      status: result.status === "failed" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
