import { z } from "zod";

export const GROWTH_KPI_IDS = [
  "activation",
  "account",
  "conversion",
  "payment",
  "renewal",
  "usage",
] as const;

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
    case "conversion":
      if (value < 8) return { state: "below", target: "8~12%", message: "유료 가치와 paywall 시점을 점검하세요." };
      if (value > 12) return { state: "above", target: "8~12%", message: "목표 상단을 넘었습니다. 표본과 결제 완료율을 함께 확인하세요." };
      return { state: "target", target: "8~12%", message: "초기 목표 범위입니다." };
    case "payment":
      return value >= 50
        ? { state: "target", target: "50% 이상", message: "초기 목표 범위입니다." }
        : { state: "action", target: "50% 이상", message: "지원 네트워크, 결제 안내, 지갑 동선을 먼저 검토하세요." };
    case "renewal":
      if (value < 25) return { state: "action", target: "35% 이상", message: "유입 확대보다 반복 가치 개선을 먼저 검토하세요." };
      return value < 35
        ? { state: "below", target: "35% 이상", message: "재구매 목표 아래입니다. 개인화와 알림 가치를 점검하세요." }
        : { state: "target", target: "35% 이상", message: "초기 목표 범위입니다." };
    case "usage":
      if (value < 2) return { state: "action", target: "월 5회 이상", message: "문구 품질, 플랫폼 구분, 복사 UX를 먼저 점검하세요." };
      return value < 5
        ? { state: "below", target: "월 5회 이상", message: "핵심 유료 기능 사용 목표 아래입니다." }
        : { state: "target", target: "월 5회 이상", message: "초기 목표 범위입니다." };
  }
}

function targetLabel(id: GrowthKpiId): string {
  if (id === "activation") return "8% 이상";
  if (id === "account") return "35% 이상";
  if (id === "conversion") return "8~12%";
  if (id === "payment") return "50% 이상";
  if (id === "renewal") return "35% 이상";
  return "월 5회 이상";
}
