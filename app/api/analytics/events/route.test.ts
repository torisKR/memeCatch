import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/growth/events.server", () => ({
  recordClientGrowthEvent: mocks.record,
  growthSessionIdFromRequest: (request: Request) => {
    const match = /(?:^|;\s*)mc_growth_session=([^;]+)/.exec(request.headers.get("cookie") ?? "");
    return match?.[1] ?? null;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

import { POST } from "@/app/api/analytics/events/route";

function request(body: unknown, origin = "https://catchmeme.com") {
  return new Request("https://catchmeme.com/api/analytics/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      cookie: "mc_growth_session=20000000-0000-4000-8000-000000000002",
    },
    body: JSON.stringify(body),
  });
}

describe("growth analytics ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-secret");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "10000000-0000-4000-8000-000000000001" } }, error: null });
    mocks.record.mockResolvedValue(undefined);
  });

  it("records an allowlisted event with server-derived user identity", async () => {
    const response = await POST(request({
      eventName: "meme_view",
      sessionId: "90000000-0000-4000-8000-000000000009",
      path: "/memes/example",
      params: { meme_id: "30000000-0000-4000-8000-000000000003", locale: "ko" },
    }));

    expect(response.status).toBe(202);
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "meme_view",
      userId: "10000000-0000-4000-8000-000000000001",
      memeId: "30000000-0000-4000-8000-000000000003",
      principalHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      sessionId: "20000000-0000-4000-8000-000000000002",
    }));
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
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "plus_weekly_brief_clicked",
      metadata: {
        brief_id: "2026-08-01_2026-08-07",
        position: 1,
        source: "saved",
        meme_id: "30000000-0000-4000-8000-000000000003",
      },
    }));
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
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        source: "threads",
        medium: "social",
        resolved_by: "utm",
        landing_page: "/memes/example",
      },
    }));
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

  it("rejects requests without the server-observed funnel cookie", async () => {
    const response = await POST(new Request("https://catchmeme.com/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://catchmeme.com" },
      body: JSON.stringify({
        eventName: "meme_view",
        sessionId: "20000000-0000-4000-8000-000000000002",
      }),
    }));

    expect(response.status).toBe(400);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("rejects oversized event payloads", async () => {
    const response = await POST(request({
      eventName: "share_click",
      params: { to: `/${"a".repeat(17_000)}` },
    }));

    expect(response.status).toBe(413);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
