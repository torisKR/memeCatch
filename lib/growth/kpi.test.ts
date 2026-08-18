import { describe, expect, it } from "vitest";
import { growthKpiAdvisory, parseGrowthKpiDashboard } from "./kpi";

const metric = (value: number | null, available = value !== null) => ({
  available,
  value,
  numerator: available ? 1 : 0,
  denominator: available ? 1 : 0,
  reason: available ? null : "baseline_incomplete",
});

describe("growth KPI dashboard", () => {
  it("keeps incomplete coverage as insufficient data instead of zero", () => {
    const parsed = parseGrowthKpiDashboard({
      periodStart: null,
      periodEnd: null,
      coverageStart: null,
      baselineComplete: false,
      metrics: {
        activation: metric(null, false),
        account: metric(null, false),
        conversion: metric(null, false),
        payment: metric(null, false),
        renewal: metric(null, false),
        usage: metric(null, false),
      },
    });

    expect(growthKpiAdvisory("payment", parsed.metrics.payment)).toEqual({
      state: "insufficient",
      target: "50% 이상",
      message: "insufficient data",
    });
  });

  it("surfaces the document decision thresholds as advisory states", () => {
    expect(growthKpiAdvisory("payment", metric(49))).toMatchObject({ state: "action" });
    expect(growthKpiAdvisory("renewal", metric(24.9))).toMatchObject({ state: "action" });
    expect(growthKpiAdvisory("renewal", metric(30))).toMatchObject({ state: "below" });
    expect(growthKpiAdvisory("usage", metric(1.9))).toMatchObject({ state: "action" });
    expect(growthKpiAdvisory("conversion", metric(10))).toMatchObject({ state: "target" });
    expect(growthKpiAdvisory("conversion", metric(13))).toMatchObject({ state: "above" });
  });
});
