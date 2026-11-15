import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import {
  growthNetworkHash,
  growthSessionIdFromRequest,
  recordClientGrowthEvent,
  resolveGrowthSession,
} from "@/lib/growth/events.server";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("MEMECATCH_SIGNING_SECRET", "test-service-role-key");
  mocks.rpc.mockReset();
  mocks.rpc.mockResolvedValue({ data: "event-1", error: null });
});

describe("growthSessionIdFromRequest", () => {
  it("accepts only a server-signed session cookie", () => {
    const issued = resolveGrowthSession(new Request("https://catchmeme.com"));
    expect(issued).not.toBeNull();
    if (!issued?.setCookie) throw new Error("signed growth cookie was not issued");
    const cookie = issued.setCookie.split(";", 1)[0];

    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie },
    }))).toBe(issued.sessionId);
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie: "mc_growth_session=20000000-0000-4000-8000-000000000002" },
    }))).toBeNull();
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie: "mc_growth_session=%E0%A4%A" },
    }))).toBeNull();
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com"))).toBeNull();
  });

  it("issues a secure HttpOnly cookie and rejects a modified MAC", () => {
    const issued = resolveGrowthSession(new Request("https://catchmeme.com"));
    expect(issued).not.toBeNull();
    if (!issued?.setCookie) throw new Error("signed growth cookie was not issued");
    expect(issued.setCookie).toContain("; HttpOnly; SameSite=Lax; Secure");

    const cookie = issued.setCookie.split(";", 1)[0];
    const [nameAndSession, mac] = cookie.split(".");
    const tampered = `${nameAndSession}.${mac.startsWith("a") ? "b" : "a"}${mac.slice(1)}`;
    expect(growthSessionIdFromRequest(new Request("https://catchmeme.com", {
      headers: { cookie: tampered },
    }))).toBeNull();
  });

  it("derives a stable network hash without retaining the network identity", () => {
    const first = growthNetworkHash("203.0.113.10");
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("203.0.113.10");
    expect(growthNetworkHash("203.0.113.10")).toBe(first);
    expect(growthNetworkHash("203.0.113.11")).not.toBe(first);
  });

  it("records client events only through the bounded service RPC", async () => {
    await recordClientGrowthEvent({
      eventName: "meme_view",
      sessionId: "20000000-0000-4000-8000-000000000002",
      userId: null,
      memeId: null,
      surface: null,
      format: null,
      locale: "ko",
      path: "/",
      dedupeKey: "client:test",
      metadata: {},
    }, "a".repeat(64));

    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_bounded_client_growth_event",
      expect.objectContaining({
        p_session_id: "20000000-0000-4000-8000-000000000002",
        p_network_hash: "a".repeat(64),
      }),
    );
  });
});
