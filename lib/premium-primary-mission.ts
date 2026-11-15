import type { GlobalDailyLoadState } from "@/lib/global-daily-challenge.server";
import type { PlusGlobalActionInboxStatus } from "@/lib/plus-global-action-inbox";
import type { PlusOutcomeSummaryStatus } from "@/lib/plus-outcome-ledger";

export type PremiumPrimaryMission =
  | "action"
  | "global_daily"
  | "outcome"
  | "unavailable";

export function resolvePremiumPrimaryMission({
  actionInboxStatus,
  globalDailyState,
  outcomeSummaryStatus,
}: {
  actionInboxStatus: PlusGlobalActionInboxStatus;
  globalDailyState: GlobalDailyLoadState | "locked" | "signed_out";
  outcomeSummaryStatus: PlusOutcomeSummaryStatus;
}): PremiumPrimaryMission {
  if (actionInboxStatus === "active") return "action";
  if (globalDailyState === "ready" || globalDailyState === "completed") {
    return "global_daily";
  }
  if (outcomeSummaryStatus === "ready") return "outcome";
  return "unavailable";
}
