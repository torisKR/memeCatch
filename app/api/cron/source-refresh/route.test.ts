import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runSourceRefresh: vi.fn() }));

vi.mock("@/lib/sources/refresh.server", () => ({
  runSourceRefresh: mocks.runSourceRefresh,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("SOURCE_REFRESH_ENABLED", "true");
});

describe("GET /api/cron/source-refresh", () => {
  it("does not activate recovery before an explicit capacity and failure audit", async () => {
    vi.stubEnv("SOURCE_REFRESH_ENABLED", "");
    const response = await GET(new Request("https://catchmeme.com/api/cron/source-refresh", {
      headers: { authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true, status: "disabled", reason: "SOURCE_REFRESH_NOT_ACTIVATED",
    });
    expect(mocks.runSourceRefresh).not.toHaveBeenCalled();
  });

  it("returns an uncached 401 without running refresh", async () => {
    const response = await GET(new Request("https://catchmeme.com/api/cron/source-refresh"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(mocks.runSourceRefresh).not.toHaveBeenCalled();
  });

  it("returns an uncached partial result without treating it as a failed request", async () => {
    mocks.runSourceRefresh.mockResolvedValue({
      status: "partial",
      youtube: { checked: 1, removed: 0, hidden: 0, failed: 1, errors: ["provider_uncertain"] },
      oembed: { checked: 0, removed: 0, hidden: 0, failed: 0, errors: [] },
    });
    const response = await GET(new Request("https://catchmeme.com/api/cron/source-refresh", {
      headers: { authorization: "Bearer cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "partial" });
  });
});
