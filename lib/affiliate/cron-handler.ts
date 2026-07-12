import type { runDailyAdpickSync } from "@/lib/affiliate/sync.server";

export function createCronHandler(sync: typeof runDailyAdpickSync) {
  return async function cronHandler(request: Request): Promise<Response> {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const result = await sync();
    return Response.json(
      { ok: result.status !== "failed", ...result },
      {
        status: result.status === "failed" ? 502 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  };
}
