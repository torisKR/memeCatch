import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  growthSessionId: vi.fn((): string | null => null),
  rpc: vi.fn(),
  rateLimit: vi.fn((): { ok: boolean; retryAfterSec?: number } => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.10",
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/growth/events.server", () => ({
  growthSessionIdFromRequest: mocks.growthSessionId,
}));

import { POST } from "@/app/api/memes/view/route";

const MEME_ID = "30000000-0000-4000-8000-000000000003";

function request(body: unknown, origin = "https://catchmeme.com") {
  return new Request("https://catchmeme.com/api/memes/view", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "origin": origin,
      "user-agent": "route-test",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}

describe("meme view ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMECATCH_SIGNING_SECRET", "test-service-secret");
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.rateLimit.mockReturnValue({ ok: true });
    mocks.growthSessionId.mockReturnValue(null);
  });

  it("sends only a server-signed daily viewer key to the service RPC", async () => {
    const response = await POST(request({ memeId: MEME_ID, p_session_hash: "forged" }));

    expect(response.status).toBe(202);
    expect(mocks.rpc).toHaveBeenCalledWith("increment_view", {
      p_meme_id: MEME_ID,
      p_session_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it("keeps the fallback key stable across User-Agent rotation and cookie clearing on one IP", async () => {
    const first = request({ memeId: MEME_ID });
    first.headers.set("user-agent", "rotating-agent-1");
    first.headers.set("cookie", "mc_growth_session=cleared-or-invalid");
    const second = request({ memeId: MEME_ID });
    second.headers.set("user-agent", "rotating-agent-2");

    await POST(first);
    await POST(second);

    expect(mocks.rpc.mock.calls[0]?.[1]?.p_session_hash)
      .toBe(mocks.rpc.mock.calls[1]?.[1]?.p_session_hash);
  });

  it("uses a verified server-issued growth session when available", async () => {
    mocks.growthSessionId.mockReturnValue("20000000-0000-4000-8000-000000000002");

    await POST(request({ memeId: MEME_ID }));
    const signedSessionKey = mocks.rpc.mock.calls[0]?.[1]?.p_session_hash;
    mocks.growthSessionId.mockReturnValue(null);
    await POST(request({ memeId: MEME_ID }));

    expect(signedSessionKey).toMatch(/^[0-9a-f]{64}$/);
    expect(signedSessionKey).not.toBe(mocks.rpc.mock.calls[1]?.[1]?.p_session_hash);
  });

  it("rejects cross-origin, malformed, and oversized requests before the RPC", async () => {
    expect((await POST(request({ memeId: MEME_ID }, "https://attacker.example"))).status).toBe(403);
    expect((await POST(request({ memeId: "not-a-uuid" }))).status).toBe(400);
    expect((await POST(new Request("https://catchmeme.com/api/memes/view", {
      method: "POST",
      headers: { "content-length": "129" },
      body: "{}",
    }))).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests before service-role access", async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 30 });

    const response = await POST(request({ memeId: MEME_ID }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the server signing secret is unavailable", async () => {
    vi.stubEnv("MEMECATCH_SIGNING_SECRET", "");

    const response = await POST(request({ memeId: MEME_ID }));

    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
