import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  getUser: vi.fn(),
  rateLimit: vi.fn((): { ok: boolean; retryAfterSec?: number } => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/growth/events.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/growth/events.server")>();
  return { ...actual, recordClientGrowthEvent: mocks.record };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.10",
  rateLimit: mocks.rateLimit,
}));

import { POST } from "@/app/api/analytics/events/route";

function request(body: unknown, origin = "https://catchmeme.com", cookie?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    origin,
  };
  if (cookie) headers.cookie = cookie;
  return new Request("https://catchmeme.com/api/analytics/events", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("growth analytics ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "10000000-0000-4000-8000-000000000001" } }, error: null });
    mocks.record.mockResolvedValue(undefined);
    mocks.rateLimit.mockReturnValue({ ok: true });
  });

  it("records an allowlisted event with server-derived user identity", async () => {
    const response = await POST(request({
      eventName: "meme_view",
      sessionId: "90000000-0000-4000-8000-000000000009",
      path: "/memes/example",
      params: { meme_id: "30000000-0000-4000-8000-000000000003", locale: "ko" },
    }));

    expect(response.status).toBe(202);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "meme_view",
        userId: "10000000-0000-4000-8000-000000000001",
        memeId: "30000000-0000-4000-8000-000000000003",
        sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
    expect(response.headers.get("set-cookie")).toContain("; HttpOnly; SameSite=Lax; Secure");
  });

  it("persists weekly brief engagement with bounded metadata", async () => {
    const response = await POST(request({
      eventName: "plus_weekly_brief_clicked",
      params: {
        brief_id: "2026-08-01_2026-08-07",
        position: 1,
        source: "saved",
        meme_id: "30000000-0000-4000-8000-000000000003",
        forged_user_id: "attacker",
      },
    }));

    expect(response.status).toBe(202);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "plus_weekly_brief_clicked",
        metadata: {
          brief_id: "2026-08-01_2026-08-07",
          position: 1,
          source: "saved",
          meme_id: "30000000-0000-4000-8000-000000000003",
        },
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("keeps only privacy-safe acquisition dimensions", async () => {
    const response = await POST(request({
      eventName: "traffic_source",
      params: {
        source: "threads",
        medium: "social",
        resolved_by: "utm",
        landing_page: "/memes/example",
        campaign: "possibly-sensitive-campaign",
        term: "possibly-sensitive-term",
        referrer_host: "private.example",
      },
    }));

    expect(response.status).toBe(202);
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          source: "threads",
          medium: "social",
          resolved_by: "utm",
          landing_page: "/memes/example",
        },
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("rejects payment truth and cross-origin writes from the client", async () => {
    expect((await POST(request({
      eventName: "payment_confirmed",
      sessionId: "20000000-0000-4000-8000-000000000002",
    }))).status).toBe(400);
    expect((await POST(request({
      eventName: "renewal",
      sessionId: "20000000-0000-4000-8000-000000000002",
    }))).status).toBe(400);
    expect((await POST(request({
      eventName: "meme_view",
      sessionId: "20000000-0000-4000-8000-000000000002",
    }, "https://attacker.example"))).status).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("accepts a first event by issuing a server-only funnel cookie", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://catchmeme.com" },
      body: JSON.stringify({
        eventName: "meme_view",
        sessionId: "20000000-0000-4000-8000-000000000002",
      }),
    }));

    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toMatch(/^mc_growth_session=[0-9a-f-]{36}\.[A-Za-z0-9_-]+;/);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.record).toHaveBeenCalledOnce();
  });

  it("replaces a tampered token with a newly signed session", async () => {
    const forgedId = "20000000-0000-4000-8000-000000000002";
    const response = await POST(request(
      { eventName: "meme_view" },
      "https://catchmeme.com",
      `mc_growth_session=${forgedId}.forged`,
    ));

    expect(response.status).toBe(202);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: expect.not.stringMatching(new RegExp(`^${forgedId}$`)),
      }),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("rejects oversized event payloads", async () => {
    const response = await POST(request({
      eventName: "share_click",
      params: { to: `/${"a".repeat(17_000)}` },
    }));

    expect(response.status).toBe(413);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rate limits abusive clients before authentication or recording", async () => {
    mocks.rateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 17 });

    const response = await POST(request({ eventName: "meme_view" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "analytics:ip:203.0.113.10",
      { limit: 120, windowMs: 60_000 },
    );
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rate limits a signed session independently from its IP", async () => {
    const first = await POST(request({ eventName: "meme_view" }));
    const cookie = first.headers.get("set-cookie")?.split(";", 1)[0];
    if (!cookie) throw new Error("signed growth cookie was not issued");
    mocks.record.mockClear();
    mocks.getUser.mockClear();
    mocks.rateLimit.mockClear();
    mocks.rateLimit
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, retryAfterSec: 9 });

    const response = await POST(request({ eventName: "share_click" }, "https://catchmeme.com", cookie));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("9");
    expect(mocks.rateLimit.mock.calls[1]).toEqual([
      expect.stringMatching(/^analytics:session:[0-9a-f-]{36}$/),
      { limit: 60, windowMs: 60_000 },
    ]);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("durably limits repeated new sessions from the same network", async () => {
    const networkCounts = new Map<string, number>();
    mocks.record.mockImplementation(async (_event: unknown, networkHash: string) => {
      const count = (networkCounts.get(networkHash) ?? 0) + 1;
      networkCounts.set(networkHash, count);
      if (count > 2) throw { code: "P0429", message: "growth_client_rate_limited" };
    });

    const first = await POST(request({ eventName: "meme_view" }));
    const second = await POST(request({ eventName: "meme_view" }));
    const third = await POST(request({ eventName: "meme_view" }));

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(first.headers.get("set-cookie")).not.toBe(second.headers.get("set-cookie"));
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBe("60");
    expect(new Set(mocks.record.mock.calls.map((call) => call[1]))).toHaveLength(1);
  });
});
