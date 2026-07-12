import { afterEach, describe, expect, it, vi } from "vitest";

import { createCronHandler } from "@/lib/affiliate/cron-handler";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("Adpick hotdeal cron handler", () => {
  it("returns 401 without the configured bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret-123456";
    const sync = vi.fn();
    const handler = createCronHandler(sync);

    const response = await handler(
      new Request("https://catchmeme.com/api/cron/adpick-hotdeals"),
    );

    expect(response.status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("rejects a non-exact bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret-123456";
    const sync = vi.fn();
    const handler = createCronHandler(sync);

    const response = await handler(
      new Request("https://catchmeme.com/api/cron/adpick-hotdeals", {
        headers: { authorization: "Bearer cron-secret-123456x" },
      }),
    );

    expect(response.status).toBe(401);
    expect(sync).not.toHaveBeenCalled();
  });

  it("runs sync with the exact bearer token", async () => {
    process.env.CRON_SECRET = "cron-secret-123456";
    const sync = vi.fn().mockResolvedValue({
      status: "succeeded",
      fetchedCount: 12,
      upsertedCount: 12,
      deactivatedCount: 0,
    });
    const handler = createCronHandler(sync);

    const response = await handler(
      new Request("https://catchmeme.com/api/cron/adpick-hotdeals", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(sync).toHaveBeenCalledOnce();
  });

  it("returns 502 when sync fails", async () => {
    process.env.CRON_SECRET = "cron-secret-123456";
    const sync = vi.fn().mockResolvedValue({
      status: "failed",
      fetchedCount: 0,
      errorCode: "ADPICK_HTTP_ERROR",
    });
    const handler = createCronHandler(sync);

    const response = await handler(
      new Request("https://catchmeme.com/api/cron/adpick-hotdeals", {
        headers: { authorization: "Bearer cron-secret-123456" },
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      errorCode: "ADPICK_HTTP_ERROR",
    });
  });
});
