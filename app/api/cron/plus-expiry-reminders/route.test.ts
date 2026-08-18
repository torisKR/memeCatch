import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runPlusExpiryReminders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/plus-expiry-reminder-delivery.server", () => ({
  runPlusExpiryReminders,
}));

import { GET } from "./route";

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "cron-secret-123456";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

describe("Plus expiry reminder cron route", () => {
  it("requires the exact cron bearer token", async () => {
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/plus-expiry-reminders"),
    );
    expect(response.status).toBe(401);
    expect(runPlusExpiryReminders).not.toHaveBeenCalled();
  });

  it("returns the delivery result without caching", async () => {
    runPlusExpiryReminders.mockResolvedValueOnce({
      status: "ok",
      deliveryDate: "2026-08-18",
      queued: 4,
      claimed: 4,
      sent: 3,
      skipped: 1,
      failed: 0,
    });
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/plus-expiry-reminders", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ ok: true, sent: 3, skipped: 1 });
  });

  it("returns 502 when durable delivery processing fails", async () => {
    runPlusExpiryReminders.mockResolvedValueOnce({
      status: "failed",
      deliveryDate: "2026-08-18",
      queued: 1,
      claimed: 1,
      sent: 0,
      skipped: 0,
      failed: 1,
      error: "claim_failed",
    });
    const response = await GET(
      new Request("https://catchmeme.com/api/cron/plus-expiry-reminders", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "claim_failed" });
  });
});
