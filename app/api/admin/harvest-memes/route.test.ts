import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { POST } from "./route";

describe("POST /api/admin/harvest-memes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-operator requests", async () => {
    mocks.createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    });
    const response = await POST(new Request("http://localhost/api/admin/harvest-memes", { method: "POST" }));
    expect(response.status).toBe(403);
  });

  it("disables synthetic candidate generation even for operators", async () => {
    mocks.createClient.mockResolvedValueOnce({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    });
    const response = await POST(new Request("http://localhost/api/admin/harvest-memes", { method: "POST" }));
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      replacement: "/admin/trend-candidates",
    });
  });
});
