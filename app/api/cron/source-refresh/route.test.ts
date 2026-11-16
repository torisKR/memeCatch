import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/sources/refresh.server", () => ({ runSourceRefresh: mocks.refresh }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
import { GET, POST } from "./route";

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
  it("only expires catalog data for an authenticated POST", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.revalidateTag.mockClear();
    expect((await POST(new Request("https://example.com", { method: "POST" }))).status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    const response = await POST(new Request("https://example.com", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
  });

  it("reports a cache invalidation failure", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.revalidateTag.mockImplementationOnce(() => { throw new Error("cache error"); });
    const response = await POST(new Request("https://example.com", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "REVALIDATION_FAILED" });
  });
});
