import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runTrendPulse = vi.fn();

vi.mock("@/lib/trend/pulse.server", () => ({
  runTrendPulse: () => runTrendPulse(),
}));

import { GET } from "./route";

const originalCronSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret-123456";
});

afterEach(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("trend pulse cron route", () => {
  it("requires the exact cron bearer token", async () => {
    const response = await GET(new Request("https://catchmeme.com/api/cron/trend-pulse"));
    expect(response.status).toBe(401);
    expect(runTrendPulse).not.toHaveBeenCalled();
  });

  it("surfaces a stopped scoring pipeline as 502", async () => {
    runTrendPulse.mockResolvedValueOnce({
      status: "failed",
      alerts: 0,
      savedContextAlerts: 0,
      error: "compute:score failed",
    });
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/trend-pulse", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "compute:score failed",
    });
  });

  it("is the one scheduled owner of the sequential trend pipeline", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({
      path: "/api/cron/trend-pulse",
      schedule: "0 18 * * *",
    });
  });
});
