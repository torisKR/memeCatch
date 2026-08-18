import { beforeEach, describe, expect, it, vi } from "vitest";

const runWebPushDelivery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/web-push/server", () => ({ runWebPushDelivery }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
});

describe("web push cron route", () => {
  it("requires the cron bearer token and reports delivery failures", async () => {
    expect((await GET(new Request("https://memecatch.test/api/cron/web-push"))).status).toBe(401);
    runWebPushDelivery.mockResolvedValueOnce({ status: "failed", error: "vapid_not_configured" });
    const response = await GET(new Request("https://memecatch.test/api/cron/web-push", {
      headers: { authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "vapid_not_configured" });
  });
});
