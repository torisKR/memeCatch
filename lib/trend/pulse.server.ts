import { createAdminClient } from "@/lib/supabase/admin";

export type TrendPulseResult = {
  status: "ok" | "failed";
  alerts: number;
  error?: string;
};

/**
 * 일일 트렌드 펄스 — Plus 트렌드 알림(A1)과 트렌드 히스토리(A2)의 공통 기반.
 *  1) compute_trend_scores(): meme_trend_metrics 일별 스냅샷 적재 + trend_score/lifecycle 갱신.
 *  2) fan_out_trend_alerts(): 관심 카테고리에서 rising한 밈을 Plus 사용자에게 인앱 알림으로 팬아웃.
 * 두 RPC 모두 security definer이며, admin(service_role) 클라이언트로만 실행한다.
 */
export async function runTrendPulse(): Promise<TrendPulseResult> {
  const admin = createAdminClient();

  // 1) 일별 롤업 — 함수 내부에서 예외를 삼키고 job_runs에 기록하므로 여기선 실패로 안 뜬다.
  const { error: computeError } = await admin.rpc("compute_trend_scores");
  if (computeError) {
    return { status: "failed", alerts: 0, error: `compute:${computeError.message}` };
  }

  // 2) 알림 팬아웃 — 생성된 알림 수를 반환.
  const { data: alerts, error: fanError } = await admin.rpc("fan_out_trend_alerts");
  if (fanError) {
    return { status: "failed", alerts: 0, error: `fanout:${fanError.message}` };
  }

  return { status: "ok", alerts: alerts ?? 0 };
}
