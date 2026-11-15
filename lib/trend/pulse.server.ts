import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";
import { createConfiguredRadarConnectors } from "@/lib/trend/radar-platform-connectors.server";
import { runRadarPulse, type RadarPulseResult } from "@/lib/trend/radar-pulse.server";
import { createRadarRepository } from "@/lib/trend/radar-repository.server";

export type TrendPulseResult = {
  status: "ok" | "partial" | "failed";
  alerts: number;
  savedContextAlerts: number;
  radar?: RadarPulseResult;
  error?: string;
};

function failedRadar(error: unknown): RadarPulseResult & { error: string } {
  return {
    status: "failed",
    persistedSignals: 0,
    automaticMatches: 0,
    pendingMatches: 0,
    observations: 0,
    safetyReviews: 0,
    error: error instanceof Error ? error.message : "RADAR_FAILED",
  };
}

/**
 * 일일 트렌드 펄스 — Plus 트렌드 알림(A1)과 트렌드 히스토리(A2)의 공통 기반.
 *  1) compute_trend_scores(): meme_trend_metrics 일별 스냅샷 적재 + trend_score/lifecycle 갱신.
 *  2) fan_out_trend_alerts(): 관심 카테고리에서 rising한 밈을 Plus 사용자에게 인앱 알림으로 팬아웃.
 * 두 RPC 모두 security definer이며, admin(service_role) 클라이언트로만 실행한다.
 */
export async function runTrendPulse(): Promise<TrendPulseResult> {
  const admin = createAdminClient();

  const { error: computeError } = await admin.rpc("compute_trend_scores");
  if (computeError) {
    await admin.from("job_runs").insert({
      job_name: "compute_trend_scores",
      finished_at: new Date().toISOString(),
      ok: false,
      detail: { algorithm: "content_views_v3", error: computeError.message },
    });
    return {
      status: "failed",
      alerts: 0,
      savedContextAlerts: 0,
      error: `compute:${computeError.message}`,
    };
  }

  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  const connectors = createConfiguredRadarConnectors();
  let radar: (RadarPulseResult & { error?: string }) | undefined;
  if (Object.keys(connectors).length) {
    try {
      radar = await runRadarPulse({
        connectors,
        repository: createRadarRepository(admin),
      });
    } catch (error) {
      radar = failedRadar(error);
    }
  }

  // 2) 알림 팬아웃 — 생성된 알림 수를 반환.
  const { data: alerts, error: fanError } = await admin.rpc("fan_out_trend_alerts");
  if (fanError) {
    return {
      status: "failed",
      alerts: 0,
      savedContextAlerts: 0,
      radar,
      error: `fanout:${fanError.message}`,
    };
  }

  const { data: savedContextAlerts, error: savedContextError } = await admin.rpc(
    "fan_out_saved_context_alerts",
  );
  if (savedContextError) {
    return {
      status: "failed",
      alerts: alerts ?? 0,
      savedContextAlerts: 0,
      radar,
      error: `saved_context:${savedContextError.message}`,
    };
  }

  return {
    status: radar?.status === "partial" || radar?.status === "failed" ? "partial" : "ok",
    alerts: alerts ?? 0,
    savedContextAlerts: savedContextAlerts ?? 0,
    radar,
  };
}
