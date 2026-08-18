import { beforeEach, describe, expect, it, vi } from "vitest";

const runSavedStateChangeEmails = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trend/outbox.server", () => ({ runSavedStateChangeEmails }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
});

describe("saved state email cron route", () => {
  it("requires cron auth and keeps missing provider credentials truthful", async () => {
    expect((await GET(new Request("https://memecatch.test/api/cron/saved-state-emails"))).status).toBe(401);
    runSavedStateChangeEmails.mockResolvedValueOnce({ status: "not_configured", delivered: 0, failed: 0 });
    const response = await GET(new Request("https://memecatch.test/api/cron/saved-state-emails", {
      headers: { authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "not_configured" });
  });
});
