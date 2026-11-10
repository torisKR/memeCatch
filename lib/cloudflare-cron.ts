/** Same UTC schedules as vercel.json. One expression can dispatch more than one route. */
export const CLOUDFLARE_CRON_ROUTES = [
  { cron: "0 21 * * *", paths: ["/api/cron/adpick-hotdeals"] },
  { cron: "0 18 * * *", paths: ["/api/cron/trend-pulse"] },
  { cron: "0 17 * * *", paths: ["/api/cron/source-refresh"] },
  { cron: "0 1 * * *", paths: ["/api/cron/plus-daily-signal"] },
  { cron: "15 0 * * *", paths: ["/api/cron/growth-baseline", "/api/cron/plus-expiry-reminders"] },
  { cron: "30 1 * * *", paths: ["/api/cron/web-push"] },
  { cron: "45 0 * * *", paths: ["/api/cron/saved-state-emails"] },
  { cron: "30 18 * * *", paths: ["/api/cron/meme-embeddings"] },
] as const;

export function cronPathsForSchedule(cron: string): readonly string[] {
  const match = CLOUDFLARE_CRON_ROUTES.find((item) => item.cron === cron);
  return match ? match.paths : [];
}

export type CronDispatchResult = {
  cron: string;
  path: string;
  status: number;
};

/** Calls one existing cron route. A non-2xx response is logged and does not throw. */
export async function dispatchCronPath(
  fetchRoute: (request: Request) => Promise<Response>,
  path: string,
  cron: string,
  secret: string | undefined,
): Promise<CronDispatchResult> {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  try {
    const response = await fetchRoute(new Request(`https://catchmeme.com${path}`, { headers }));
    await response.arrayBuffer().catch(() => undefined);
    return { cron, path, status: response.status };
  } catch {
    return { cron, path, status: 0 };
  }
}

export async function dispatchScheduledCron(
  fetchRoute: (request: Request) => Promise<Response>,
  cron: string,
  secret: string | undefined,
): Promise<CronDispatchResult[]> {
  const paths = cronPathsForSchedule(cron);
  const results: CronDispatchResult[] = [];
  for (const path of paths) {
    const result = await dispatchCronPath(fetchRoute, path, cron, secret);
    console.log(JSON.stringify({ event: "cron_dispatched", ...result }));
    results.push(result);
  }
  return results;
}
