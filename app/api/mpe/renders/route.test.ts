import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "./route";

function client(
  user: { id: string } | null,
  rpc = vi.fn().mockResolvedValue({ error: null }),
) {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, rpc };
}

function request(body: unknown) {
  return new Request("http://localhost/api/mpe/renders", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

const valid = {
  ingestionId: "10000000-0000-4000-8000-000000000001",
  preset: "vertical",
  attribution: "직접 촬영 · @creator",
  segments: [{ startMs: 0, endMs: 1200, text: "첫 자막" }],
};

beforeEach(() => vi.clearAllMocks());

describe("MPE render queue API", () => {
  it("rejects a cross-origin render before authentication or queueing", async () => {
    const response = await POST(new Request("http://localhost/api/mpe/renders", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify(valid),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "invalid_origin" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("requires authentication before queueing", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValueOnce(client(null, rpc));
    expect((await POST(request(valid))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid bounds, missing attribution, and unknown URL fields", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue(client({ id: "user-1" }, rpc));
    expect((await POST(request({ ...valid, attribution: "" }))).status).toBe(400);
    expect((await POST(request({ ...valid, segments: [{ startMs: 10, endMs: 5, text: "x" }] }))).status).toBe(400);
    expect((await POST(request({ ...valid, sourceUrl: "https://third-party.example/video" }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("queues a validated owner-uploaded render contract", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "job-1", status: "queued" }, error: null });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));
    const response = await POST(request(valid));
    expect(response.status).toBe(202);
    expect(rpc).toHaveBeenCalledWith("queue_metered_mpe_render_job", {
      p_ingestion_id: valid.ingestionId,
      p_segments: valid.segments,
      p_preset: "vertical",
      p_attribution: "직접 촬영 · @creator",
    });
    await expect(response.json()).resolves.toEqual({ ok: true, data: { jobId: "job-1", status: "queued" } });
  });

  it("stops before queueing when the durable quota is exhausted", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "api_rate_limited" } });
    mocks.createClient.mockResolvedValueOnce(client({ id: "user-1" }, rpc));

    const response = await POST(request(valid));

    expect(response.status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
