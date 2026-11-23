import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
import { POST } from "./route";

const call = (scope: string | null, authorization?: string) =>
  POST(new Request(`https://example.com/api/internal/cache${scope === null ? "" : `?scope=${scope}`}`, {
    method: "POST",
    headers: authorization ? { authorization } : {},
  }));

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.revalidateTag.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("internal cache expiry", () => {
  it("refuses without the cron bearer, and when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await call("public-catalog")).status).toBe(401);
    expect((await call("public-catalog", "Bearer wrong")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("public-catalog", "Bearer ")).status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("expires only the fixed scopes", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    for (const scope of [null, "", "toString", "__proto__", "public-meme-catalog"]) {
      const response = await call(scope, "Bearer test-secret");
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ ok: false, error: "UNKNOWN_SCOPE" });
    }
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("expires the catalog tag", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const response = await call("public-catalog", "Bearer test-secret");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("expires the catalog and the layout for a video verification", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await call("instagram-video-verification", "Bearer test-secret")).status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("public-meme-catalog", { expire: 0 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports a failed expiry", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    mocks.revalidateTag.mockImplementationOnce(() => { throw new Error("cache error"); });
    const response = await call("public-catalog", "Bearer test-secret");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "REVALIDATION_FAILED" });
  });
});
