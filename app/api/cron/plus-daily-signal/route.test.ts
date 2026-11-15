import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runPlusDailySignal = vi.fn();

vi.mock("@/lib/plus-daily-signal-delivery.server", () => ({
  runPlusDailySignal: () => runPlusDailySignal(),
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

describe("Plus Daily Signal cron route", () => {
  it("requires the exact cron bearer token", async () => {
    const response = await GET(new Request("https://catchmeme.com/api/cron/plus-daily-signal"));
    expect(response.status).toBe(401);
    expect(runPlusDailySignal).not.toHaveBeenCalled();
  });

  it("runs the digest and preserves not-configured as a non-error response", async () => {
    runPlusDailySignal.mockResolvedValueOnce({
      status: "not_configured",
      deliveryDate: "2026-08-09",
      queued: 0,
      claimed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/plus-daily-signal", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "not_configured" });
  });

  it("returns 502 when delivery processing fails", async () => {
    runPlusDailySignal.mockResolvedValueOnce({
      status: "failed",
      deliveryDate: "2026-08-09",
      queued: 1,
      claimed: 1,
      sent: 0,
      skipped: 0,
      failed: 1,
      error: "queue_failed",
    });
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/plus-daily-signal", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "queue_failed" });
  });

  it("runs once daily after the morning user window", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toContainEqual({
      path: "/api/cron/plus-daily-signal",
      schedule: "0 1 * * *",
    });
  });
});
