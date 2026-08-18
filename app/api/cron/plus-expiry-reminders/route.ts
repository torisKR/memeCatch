import { runPlusExpiryReminders } from "@/lib/plus-expiry-reminder-delivery.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await runPlusExpiryReminders();
  return Response.json(
    { ok: result.status !== "failed", ...result },
    {
      status: result.status === "failed" ? 502 : 200,
      headers: { "cache-control": "no-store" },
    },
  );
}
