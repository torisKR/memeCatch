import { readFileSync } from "node:fs";

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

describe("Adpick hotdeal cron deployment", () => {
  it("schedules the sync once daily", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));

    // 다른 cron이 추가돼도 깨지지 않도록 자기 항목만 검증한다.
    expect(config.crons).toContainEqual({
      path: "/api/cron/adpick-hotdeals",
      schedule: "0 21 * * *",
    });
  });

  it("documents the bounded Hobby execution window and no retries", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain(
      "06:00:00–06:59:59 KST (21:00:00–21:59:59 UTC)",
    );
    expect(readme).toContain(
      "실패한 작업을 Vercel이 자동으로 재시도하지 않습니다.",
    );
  });
});
