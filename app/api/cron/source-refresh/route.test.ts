import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/lib/sources/refresh.server", () => ({ runSourceRefresh: mocks.refresh }));
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("source refresh cron", () => {
  it("rejects unauthenticated requests", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await GET(new Request("https://example.com"))).status).toBe(401);
  });
  it("reports partial runs as errors to the scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.refresh.mockResolvedValue({ status: "partial" });
    const response = await GET(new Request("https://example.com", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false, status: "partial" });
  });
});
