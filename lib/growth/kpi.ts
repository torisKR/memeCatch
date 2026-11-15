import { z } from "zod";

// Paid-funnel KPIs (conversion/payment/renewal/usage) retired with Plus; the
// RPC may still return them and zod strips the extra keys.
export const GROWTH_KPI_IDS = ["activation", "account"] as const;

export type GrowthKpiId = (typeof GROWTH_KPI_IDS)[number];

const metricSchema = z.object({
  available: z.boolean(),
  value: z.number().nonnegative().nullable(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  reason: z.string().nullable(),
});

const dashboardSchema = z.object({
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  coverageStart: z.string().nullable(),
  baselineComplete: z.boolean(),
  metrics: z.object(Object.fromEntries(GROWTH_KPI_IDS.map((id) => [id, metricSchema])) as {
    [K in GrowthKpiId]: typeof metricSchema;
  }),
});

export type GrowthKpiDashboard = z.infer<typeof dashboardSchema>;
export type GrowthKpiMetric = GrowthKpiDashboard["metrics"][GrowthKpiId];
export type GrowthKpiAdvisoryState = "insufficient" | "action" | "below" | "target" | "above";

export type GrowthKpiAdvisory = {
  state: GrowthKpiAdvisoryState;
  target: string;
  message: string;
};

export function parseGrowthKpiDashboard(value: unknown): GrowthKpiDashboard {
  return dashboardSchema.parse(value);
}

export function growthKpiAdvisory(id: GrowthKpiId, metric: GrowthKpiMetric): GrowthKpiAdvisory {
  if (!metric.available || metric.value === null) {
    return { state: "insufficient", target: targetLabel(id), message: "insufficient data" };
  }

  const value = metric.value;
  switch (id) {
    case "activation":
      return value >= 8
        ? { state: "target", target: "8% 이상", message: "초기 목표 범위입니다." }
        : { state: "below", target: "8% 이상", message: "상세 첫 화면의 가치 전달을 점검하세요." };
    case "account":
      return value >= 35
        ? { state: "target", target: "35% 이상", message: "초기 목표 범위입니다." }
        : { state: "below", target: "35% 이상", message: "로그인 전환 마찰을 점검하세요." };
  }
}

function targetLabel(id: GrowthKpiId): string {
  return id === "activation" ? "8% 이상" : "35% 이상";
}
