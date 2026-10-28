import { runTrendEvidencePipeline } from "@/lib/trend/pulse.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Existing Supabase pg_cron invokes this worker; it never rolls up internal popularity. */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.TREND_CRON_SECRET;
  const headers = { "Cache-Control": "no-store" };
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  const result = await runTrendEvidencePipeline();
  return Response.json({ ok: result.status !== "failed", ...result }, {
    status: result.status === "failed" ? 502 : 200, headers,
  });
}
