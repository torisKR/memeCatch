import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const selectPolicies = vi.fn().mockResolvedValue({ data: [], error: null });
  return {
    rpc: vi.fn(),
    insert,
    selectPolicies,
    from: vi.fn((table: string) => table === "job_runs" ? { insert } : { select: selectPolicies }),
    createConfiguredRadarConnectors: vi.fn(() => ({})),
    runRadarPulse: vi.fn(),
    runTrendDiscoveryRuntime: vi.fn(),
    runTrendAssessmentRuntime: vi.fn(),
    createTrendDraftCompletion: vi.fn(),
    revalidateTag: vi.fn(),
  };
});
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("@/lib/trend/radar-platform-connectors.server", () => ({
  createConfiguredRadarConnectors: mocks.createConfiguredRadarConnectors,
}));
vi.mock("@/lib/trend/radar-pulse.server", () => ({
  runRadarPulse: mocks.runRadarPulse,
}));
vi.mock("@/lib/trend/radar-repository.server", () => ({
  createRadarRepository: vi.fn(() => ({})),
}));
vi.mock("@/lib/trend/discovery-runtime.server", () => ({
  runTrendDiscoveryRuntime: mocks.runTrendDiscoveryRuntime,
}));
vi.mock("@/lib/trend/assessment-runtime.server", () => ({
  runTrendAssessmentRuntime: mocks.runTrendAssessmentRuntime,
}));
vi.mock("@/lib/trend/draft-completion.server", () => ({
  createTrendDraftCompletion: mocks.createTrendDraftCompletion,
}));

import { runTrendPulse } from "@/lib/trend/pulse.server";

const {
  rpc,
  insert,
  from,
  createConfiguredRadarConnectors,
  runRadarPulse,
  runTrendDiscoveryRuntime,
  runTrendAssessmentRuntime,
  selectPolicies,
} = mocks;

const disabledDiscovery = {
  status: "disabled",
  disabledReason: "missing_api_key",
  lanes: {
    new_discovery: { claimed: false, runId: null, status: "skipped", callsUsed: 0 },
    candidate_tracking: { claimed: false, runId: null, status: "skipped", callsUsed: 0 },
  },
  persistedSignals: 0,
  persistedSnapshots: 0,
  discoveredCandidates: 0,
  errorCodes: [],
};

describe("runTrendPulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RADAR_DISCOVERY_ENABLED", "false");
    createConfiguredRadarConnectors.mockReturnValue({});
    runTrendDiscoveryRuntime.mockResolvedValue(disabledDiscovery);
    runTrendAssessmentRuntime.mockResolvedValue({ assessed: 0, drafts: 0, observing: 0 });
    selectPolicies.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stops every fanout and records a failed run when scoring fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("score failed") });

    await expect(runTrendPulse()).resolves.toMatchObject({
      status: "failed",
      alerts: 0,
      savedContextAlerts: 0,
      error: "compute:score failed",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("job_runs");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ job_name: "compute_trend_scores", ok: false }),
    );
  });

  it("runs both fanouts only after scoring succeeds", async () => {
    rpc
      .mockResolvedValueOnce({ data: undefined, error: null })
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });

    await expect(runTrendPulse()).resolves.toEqual({
      status: "ok",
      alerts: 3,
      savedContextAlerts: 2,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "compute_trend_scores",
      "fan_out_trend_alerts",
      "fan_out_saved_context_alerts",
    ]);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
  });

  it("keeps legacy fanouts running when configured Radar fails", async () => {
    createConfiguredRadarConnectors.mockReturnValueOnce({ instagram: {} });
    selectPolicies.mockResolvedValueOnce({ data: [{
      platform: "instagram",
      enabled: true,
      verified_at: "2026-01-01T00:00:00.000Z",
      approval_basis: "approved API terms",
      derived_analysis_allowed: true,
      cross_platform_combination_allowed: false,
    }], error: null });
    runRadarPulse.mockRejectedValueOnce(new Error("instagram unavailable"));
    rpc
      .mockResolvedValueOnce({ data: undefined, error: null })
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });

    await expect(runTrendPulse()).resolves.toMatchObject({
      status: "partial",
      alerts: 3,
      savedContextAlerts: 2,
      radar: { status: "failed", error: "instagram unavailable" },
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "compute_trend_scores",
      "fan_out_trend_alerts",
      "fan_out_saved_context_alerts",
    ]);
  });

  it("invalidates successful scoring even if later fanout fails", async () => {
    rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "fanout failed" } });
    await expect(runTrendPulse()).resolves.toMatchObject({ status: "failed", error: "fanout:fanout failed" });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
  });

  it("does not run a credential-configured legacy connector without an approved policy and reports a missing platform key as partial", async () => {
    vi.stubEnv("RADAR_DISCOVERY_ENABLED", "true");
    createConfiguredRadarConnectors.mockReturnValue({ youtube: {} });
    rpc
      .mockResolvedValueOnce({ data: {}, error: null })
      .mockResolvedValueOnce({ data: undefined, error: null })
      .mockResolvedValueOnce({ data: 3, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });

    await expect(runTrendPulse()).resolves.toMatchObject({
      status: "partial",
      alerts: 3,
      savedContextAlerts: 2,
      discovery: { status: "disabled", disabledReason: "missing_api_key" },
      assessment: { assessed: 0, drafts: 0, observing: 0 },
    });
    expect(runTrendDiscoveryRuntime).toHaveBeenCalledOnce();
    expect(runTrendAssessmentRuntime).toHaveBeenCalledOnce();
    expect(createConfiguredRadarConnectors).toHaveBeenCalledOnce();
    expect(selectPolicies).toHaveBeenCalledOnce();
    expect(runRadarPulse).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "expire_trend_evidence",
      "compute_trend_scores",
      "fan_out_trend_alerts",
      "fan_out_saved_context_alerts",
    ]);
  });

  it("keeps internal scoring and fanouts running when external discovery throws", async () => {
    vi.stubEnv("RADAR_DISCOVERY_ENABLED", "true");
    runTrendDiscoveryRuntime.mockRejectedValueOnce(new Error("external provider detail"));
    rpc
      .mockResolvedValueOnce({ data: undefined, error: null })
      .mockResolvedValueOnce({ data: 4, error: null })
      .mockResolvedValueOnce({ data: 1, error: null });

    await expect(runTrendPulse()).resolves.toMatchObject({
      status: "partial",
      alerts: 4,
      savedContextAlerts: 1,
    });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "compute_trend_scores",
      "fan_out_trend_alerts",
      "fan_out_saved_context_alerts",
    ]);
    expect(from).toHaveBeenCalledWith("job_runs");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      job_name: "trend_evidence_pipeline",
      ok: false,
      detail: { error: "TREND_EVIDENCE_PIPELINE_FAILED" },
    }));
    expect(createConfiguredRadarConnectors).toHaveBeenCalledOnce();
    expect(runRadarPulse).not.toHaveBeenCalled();
  });
});
