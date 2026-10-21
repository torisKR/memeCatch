import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runTrendEvidencePipeline = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trend/pulse.server", () => ({
  runTrendEvidencePipeline,
}));

import { GET } from "./route";

function request(token?: string) {
  return new Request("https://catchmeme.com/api/cron/trend-discovery", token ? {
    headers: { authorization: `Bearer ${token}` },
  } : undefined);
}

describe("trend discovery cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TREND_CRON_SECRET", "trend-cron-secret");
    vi.stubEnv("CRON_SECRET", "legacy-cron-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["missing authorization", undefined],
    ["wrong dedicated secret", "wrong-secret"],
    ["legacy shared cron secret", "legacy-cron-secret"],
  ])("returns a stable no-store 401 for %s without starting the worker", async (_name, token) => {
    const response = await GET(request(token));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(runTrendEvidencePipeline).not.toHaveBeenCalled();
  });

  it("rejects every request when the dedicated secret is not configured", async () => {
    vi.stubEnv("TREND_CRON_SECRET", "");
    const response = await GET(request("trend-cron-secret"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(runTrendEvidencePipeline).not.toHaveBeenCalled();
  });

  it("returns a truthful no-store 200 when discovery is disabled", async () => {
    runTrendEvidencePipeline.mockResolvedValueOnce({
      status: "disabled",
      discovery: {
        status: "disabled",
        disabledReason: "missing_api_key",
        lanes: {},
        persistedSignals: 0,
        persistedSnapshots: 0,
        discoveredCandidates: 0,
        errorCodes: [],
      },
      assessment: undefined,
    });

    const response = await GET(request("trend-cron-secret"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      status: "disabled",
      discovery: { status: "disabled", disabledReason: "missing_api_key" },
    });
    expect(runTrendEvidencePipeline).toHaveBeenCalledOnce();
  });

  it("maps an actual evidence-pipeline failure to a no-store 502", async () => {
    runTrendEvidencePipeline.mockResolvedValueOnce({
      status: "failed",
      error: "TREND_EVIDENCE_PIPELINE_FAILED",
    });

    const response = await GET(request("trend-cron-secret"));

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: false,
      status: "failed",
      error: "TREND_EVIDENCE_PIPELINE_FAILED",
    });
    expect(runTrendEvidencePipeline).toHaveBeenCalledOnce();
  });
});
