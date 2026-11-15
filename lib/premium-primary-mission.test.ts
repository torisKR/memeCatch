import { describe, expect, it } from "vitest";
import { resolvePremiumPrimaryMission } from "@/lib/premium-primary-mission";

describe("resolvePremiumPrimaryMission", () => {
  it("chooses an active action", () => {
    expect(
      resolvePremiumPrimaryMission({
        actionInboxStatus: "active",
        globalDailyState: "unavailable",
        outcomeSummaryStatus: "unavailable",
      }),
    ).toBe("action");
  });

  it.each([
    ["empty", "ready"],
    ["empty", "completed"],
    ["unavailable", "ready"],
    ["unavailable", "completed"],
  ] as const)(
    "chooses Global Daily for %s action and %s daily state",
    (actionInboxStatus, globalDailyState) => {
      expect(
        resolvePremiumPrimaryMission({
          actionInboxStatus,
          globalDailyState,
          outcomeSummaryStatus: "unavailable",
        }),
      ).toBe("global_daily");
    },
  );

  it("chooses a ready outcome when action and Global Daily are unavailable", () => {
    expect(
      resolvePremiumPrimaryMission({
        actionInboxStatus: "unavailable",
        globalDailyState: "unavailable",
        outcomeSummaryStatus: "ready",
      }),
    ).toBe("outcome");
  });

  it.each(["unavailable", "locked"] as const)(
    "returns unavailable when all missions are unavailable or Global Daily is %s",
    (globalDailyState) => {
      expect(
        resolvePremiumPrimaryMission({
          actionInboxStatus: "empty",
          globalDailyState,
          outcomeSummaryStatus: "locked",
        }),
      ).toBe("unavailable");
    },
  );

  it("preserves action priority over daily and outcome, and daily priority over outcome", () => {
    expect(
      resolvePremiumPrimaryMission({
        actionInboxStatus: "active",
        globalDailyState: "ready",
        outcomeSummaryStatus: "ready",
      }),
    ).toBe("action");
    expect(
      resolvePremiumPrimaryMission({
        actionInboxStatus: "empty",
        globalDailyState: "completed",
        outcomeSummaryStatus: "ready",
      }),
    ).toBe("global_daily");
  });
});
