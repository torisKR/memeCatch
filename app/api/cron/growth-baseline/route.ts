import { captureGrowthFunnelBaseline } from "@/lib/growth/events.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await captureGrowthFunnelBaseline();
  return Response.json({ ok: true });
}
