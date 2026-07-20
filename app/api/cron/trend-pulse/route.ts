import { runTrendPulse } from "@/lib/trend/pulse.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 일일 트렌드 펄스 cron (vercel.json crons에 등록).
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
