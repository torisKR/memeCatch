import { beforeEach, describe, expect, it, vi } from "vitest";

const getPremiumEntitlement = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const createClient = vi.fn(async () => ({ rpc, from }));

vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: () => getPremiumEntitlement(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));

import { GET, POST } from "./route";

function request(origin = "http://localhost") {
  return new Request("http://localhost/api/trend-alerts", {
    method: "POST",
    headers: { origin },
  });
}

beforeEach(() => {
  getPremiumEntitlement.mockReset();
  rpc.mockReset();
  from.mockReset();
  createClient.mockClear();
});

describe("trend-alert read marking", () => {
  it("rejects a cross-origin read mark before entitlement checks", async () => {
    const response = await POST(request("https://evil.example"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "invalid_origin" });
    expect(getPremiumEntitlement).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not expose alert rows to signed-out visitors", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: false, isPremium: false });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      locked: true,
      reason: "signed_out",
      alerts: [],
      unread: 0,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("does not expose alert rows after Plus access expires", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: false });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      locked: true,
      reason: "not_premium",
      alerts: [],
      unread: 0,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("does not let a signed-out visitor write", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: false, isPremium: false });

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps the write path Plus-only after access expires", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: false });

    const response = await POST(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "not_premium" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the existing self-scoped RPC for an active Plus member", async () => {
    getPremiumEntitlement.mockResolvedValue({ signedIn: true, isPremium: true });
    rpc.mockResolvedValue({ data: 2, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("mark_trend_alerts_read");
    await expect(response.json()).resolves.toEqual({ ok: true, marked: 2 });
  });
});
