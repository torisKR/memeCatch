import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), expire: vi.fn(), quota: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }) }));
vi.mock("@/lib/instagram-video-verification-cache", () => ({ expireInstagramVideoVerificationCache: mocks.expire }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: () => "test", rateLimit: mocks.quota }));
import { POST } from "./route";

function request(origin = "https://example.com") {
  return new NextRequest("https://example.com/api/admin/instagram-video-verification/revalidate", { method: "POST", headers: { origin } });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "operator" } } });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.quota.mockReturnValue({ ok: true });
});

describe("verification cache-only retry", () => {
  it("requires a trusted origin and an authenticated operator", async () => {
    expect((await POST(request("https://other.example"))).status).toBe(403);
    mocks.user.mockResolvedValueOnce({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it("only expires cache and never repeats a previous verification decision", async () => {
    // A newer revocation may have happened after the first decision committed.
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("is_operator");
    expect(mocks.expire).toHaveBeenCalledOnce();
  });

  it("allows retrying cache expiration without changing the database", async () => {
    mocks.expire.mockImplementationOnce(() => { throw new Error("cache unavailable"); });
    const first = await POST(request());
    expect(first.status).toBe(503);
    expect(first.headers.get("retry-after")).toBe("1");
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["is_operator", "is_operator"]);
  });
});
