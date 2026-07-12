import { createCronHandler } from "@/lib/affiliate/cron-handler";
import { runDailyAdpickSync } from "@/lib/affiliate/sync.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const GET = createCronHandler(runDailyAdpickSync);
