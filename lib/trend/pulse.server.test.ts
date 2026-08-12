import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc: vi.fn(),
    insert,
    from: vi.fn(() => ({ insert })),
    createConfiguredRadarConnectors: vi.fn(() => ({})),
    runRadarPulse: vi.fn(),
  };
});

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

import { runTrendPulse } from "@/lib/trend/pulse.server";

const { rpc, insert, from, createConfiguredRadarConnectors, runRadarPulse } = mocks;

describe("runTrendPulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("keeps legacy fanouts running when configured Radar fails", async () => {
    createConfiguredRadarConnectors.mockReturnValueOnce({ instagram: {} });
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
});
