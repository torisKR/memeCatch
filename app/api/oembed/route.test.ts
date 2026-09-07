import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOEmbed: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/oembed", () => ({ getOEmbed: mocks.getOEmbed, OEmbedError: class extends Error {} }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
  rateLimit: () => ({ ok: true }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.getOEmbed.mockResolvedValue({ type: "video" });
});

describe("oEmbed route quota", () => {
  it("reserves the durable quota before provider work", async () => {
    const response = await GET(new Request("https://memecatch.test/api/oembed?url=https://youtube.com/watch?v=x"));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_oembed_request");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.getOEmbed.mock.invocationCallOrder[0]);
  });

  it("stops before provider work when the durable quota is exhausted", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "oembed_quota_exceeded" } });
    const response = await GET(new Request("https://memecatch.test/api/oembed?url=https://youtube.com/watch?v=x"));
    expect(response.status).toBe(429);
    expect(mocks.getOEmbed).not.toHaveBeenCalled();
  });
});
